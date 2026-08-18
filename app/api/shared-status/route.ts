import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth";
import { isSharedModeConfigured } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSharedModeConfigured()) return NextResponse.json({ mode: "local", role: "admin", connector: null });
  try {
    const viewer = await requireViewer();
    const supabase = await createServerSupabase();
    const { data: connector } = await supabase!
      .from("connectors")
      .select("identity_email,identity_name,status,last_attempted_at,last_successful_at,safe_error,record_counts,granted_scopes")
      .eq("provider", "google")
      .maybeSingle();
    return NextResponse.json({
      mode: "shared",
      localImportAvailable: process.env.NODE_ENV !== "production",
      viewer: { email: viewer.email, displayName: viewer.displayName, role: viewer.role, organizationIds: viewer.organizationIds },
      connector: connector ? {
        identityEmail: connector.identity_email,
        identityName: connector.identity_name,
        status: connector.status,
        lastAttemptedAt: connector.last_attempted_at,
        lastSuccessfulAt: connector.last_successful_at,
        safeError: connector.safe_error,
        recordCounts: connector.record_counts,
        grantedScopes: connector.granted_scopes,
      } : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
}
