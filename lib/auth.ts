import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CompanyId } from "@/lib/workspace-config";
import { DEFAULT_DASHBOARD_ADMIN_EMAILS } from "@/lib/workspace-config";

export type ViewerRole = "admin" | "editor" | "viewer";

export type Viewer = {
  id: string;
  email: string;
  displayName: string;
  role: ViewerRole;
  organizationIds: CompanyId[];
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const configuredAdmins = (process.env.DASHBOARD_ADMIN_EMAILS || process.env.DASHBOARD_ADMIN_EMAIL || DEFAULT_DASHBOARD_ADMIN_EMAILS.join(","))
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (configuredAdmins.includes(user.email.toLowerCase())) {
    const admin = createAdminSupabase();
    await admin?.from("profiles").upsert({
      id: user.id,
      email: user.email.toLowerCase(),
      display_name: user.user_metadata?.full_name || user.email,
      role: "admin",
      active: true,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,display_name,role,active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active) return null;

  const { data: grants } = await supabase
    .from("profile_organizations")
    .select("organization_id")
    .eq("profile_id", user.id);

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name || profile.email,
    role: profile.role as ViewerRole,
    organizationIds: (grants ?? []).map((grant) => grant.organization_id as CompanyId),
  };
}

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) throw new Error("UNAUTHORIZED");
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") throw new Error("FORBIDDEN");
  return viewer;
}
