import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { companies, type CompanyId } from "@/lib/workspace-config";

const roles = new Set(["admin", "editor", "viewer"]);
const organizationIds = new Set(companies.filter((company) => company.id !== "all").map((company) => company.id));

export async function POST(request: Request) {
  try {
    const viewer = await requireAdmin();
    const payload = await request.json() as { email?: string; role?: string; organizationIds?: CompanyId[] };
    const email = payload.email?.trim().toLowerCase();
    const role = payload.role || "viewer";
    const grants = payload.organizationIds ?? [];
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || !roles.has(role) || grants.some((id) => !organizationIds.has(id))) {
      return NextResponse.json({ message: "Provide a valid email, role, and organization access list." }, { status: 400 });
    }
    const admin = createAdminSupabase();
    if (!admin) return NextResponse.json({ message: "Shared database is not configured." }, { status: 503 });
    const { error } = await admin.from("dashboard_invites").upsert({
      email,
      role,
      organization_ids: grants,
      invited_by: viewer.id,
    });
    if (error) return NextResponse.json({ message: "The invitation could not be saved." }, { status: 503 });
    const origin = new URL(request.url).origin;
    const invitation = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/auth/confirm` });
    if (invitation.error) return NextResponse.json({ message: "Access was allowlisted, but the invitation email could not be sent." }, { status: 502 });
    await admin.from("audit_events").insert({
      actor_id: viewer.id,
      actor_email: viewer.email,
      action: "Dashboard user invited",
      entity_type: "dashboard_invite",
      entity_id: email,
      details: { role, organizationIds: grants },
    });
    return NextResponse.json({ status: "invited", email, role, organizationIds: grants });
  } catch {
    return NextResponse.json({ message: "Administrator access is required." }, { status: 403 });
  }
}
