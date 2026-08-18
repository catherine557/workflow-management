import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { persistSheetSnapshot, readLocalSheetSnapshot, validateLocalSheetSnapshot } from "@/lib/shared-snapshot";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Local snapshot import is disabled in production. Run it from the authorized development device." }, { status: 403 });
  }
  try {
    const viewer = await requireAdmin();
    const admin = createAdminSupabase();
    if (!admin) return NextResponse.json({ message: "Shared database is not configured." }, { status: 503 });
    const snapshot = await readLocalSheetSnapshot();
    if (!validateLocalSheetSnapshot(snapshot)) return NextResponse.json({ message: "The local snapshot failed source verification." }, { status: 422 });
    const { data: run } = await admin.from("sync_runs").insert({ provider: "google", status: "running", actor_id: viewer.id }).select("id").single();
    if (!run) return NextResponse.json({ message: "The import could not be started." }, { status: 503 });
    await persistSheetSnapshot(admin, snapshot, run.id, snapshot.connector.retrievedAt);
    const counts = snapshot.counts;
    await admin.from("sync_runs").update({ status: "succeeded", finished_at: new Date().toISOString(), counts }).eq("id", run.id);
    await admin.from("connectors").upsert({
      provider: "google",
      identity_email: snapshot.connector.identity.email.toLowerCase(),
      identity_name: snapshot.connector.identity.name,
      status: "Stale snapshot",
      last_successful_at: snapshot.connector.retrievedAt,
      record_counts: counts,
      safe_error: "Imported from the verified local snapshot; connect the authorized Google account for live refresh.",
      updated_by: viewer.id,
      updated_at: new Date().toISOString(),
    });
    await admin.from("audit_events").insert({
      actor_id: viewer.id,
      actor_email: viewer.email,
      action: "Verified local Sheet snapshot imported",
      entity_type: "sync_run",
      entity_id: run.id,
      details: counts,
    });
    return NextResponse.json({ status: "imported", counts });
  } catch {
    return NextResponse.json({ message: "Administrator sign-in and a verified local snapshot are required." }, { status: 403 });
  }
}
