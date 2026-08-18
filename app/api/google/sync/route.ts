import { NextResponse } from "next/server";
import { requireAdmin, type Viewer } from "@/lib/auth";
import { connectedGoogleAccessToken, getGoogleConfig, googleUserInfo } from "@/lib/google-connector";
import { syncGmailEvidence, syncGoogleSheet, syncRoutineWorkbooks } from "@/lib/google-sync";
import { createAdminSupabase } from "@/lib/supabase/admin";

async function runSync(actor: Viewer | null) {
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ message: "Shared database is not configured." }, { status: 503 });
  const now = new Date().toISOString();
  const { data: run, error: runError } = await admin
    .from("sync_runs")
    .insert({ provider: "google", status: "running", actor_id: actor?.id ?? null })
    .select("id")
    .single();
  if (runError || !run) return NextResponse.json({ message: "The refresh could not be started." }, { status: 503 });
  await admin.from("connectors").update({ last_attempted_at: now, updated_at: now }).eq("provider", "google");

  try {
    const accessToken = await connectedGoogleAccessToken();
    const identity = await googleUserInfo(accessToken);
    if (identity.email.toLowerCase() !== getGoogleConfig().authorizedEmail) throw new Error("Account mismatch");
    const sheetCounts = await syncGoogleSheet(admin, accessToken, run.id, identity);
    const routineCounts = await syncRoutineWorkbooks(admin, accessToken, run.id);
    const gmailCounts = await syncGmailEvidence(admin, accessToken, run.id, identity.email.toLowerCase());
    const counts = { ...sheetCounts, ...routineCounts, ...gmailCounts };
    const completedAt = new Date().toISOString();
    await admin.from("sync_runs").update({ status: "succeeded", finished_at: completedAt, counts }).eq("id", run.id);
    await admin.from("connectors").update({
      status: "Healthy",
      identity_email: identity.email.toLowerCase(),
      identity_name: identity.name || identity.email,
      last_successful_at: completedAt,
      safe_error: null,
      record_counts: counts,
      updated_at: completedAt,
    }).eq("provider", "google");
    await admin.from("audit_events").insert({
      actor_id: actor?.id ?? null,
      actor_email: actor?.email ?? "Scheduled refresh",
      action: "Shared Google sources refreshed",
      entity_type: "sync_run",
      entity_id: run.id,
      details: counts,
    });
    return NextResponse.json({ status: "Healthy", counts, refreshedAt: completedAt });
  } catch (error) {
    const safeError = error instanceof Error && error.message === "Account mismatch"
      ? "Account mismatch"
      : "The Google refresh failed. The last successful shared snapshot is still available.";
    const completedAt = new Date().toISOString();
    await admin.from("sync_runs").update({ status: "failed", finished_at: completedAt, safe_error: safeError }).eq("id", run.id);
    const { data: connector } = await admin.from("connectors").select("last_successful_at").eq("provider", "google").maybeSingle();
    await admin.from("connectors").update({
      status: connector?.last_successful_at ? "Stale snapshot" : safeError,
      safe_error: safeError,
      updated_at: completedAt,
    }).eq("provider", "google");
    return NextResponse.json({ status: "failed", message: safeError }, { status: 502 });
  }
}

export async function POST() {
  try {
    return await runSync(await requireAdmin());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error && error.message === "FORBIDDEN" ? "Administrator access is required." : "Sign in is required." }, { status: 403 });
  }
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }
  return runSync(null);
}
