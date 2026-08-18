import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

const validStatuses = new Set(["Done", "Pending", "In Progress", "Needs Review"]);

export async function PATCH(request: Request) {
  try {
    const viewer = await requireViewer();
    if (viewer.role === "viewer") return NextResponse.json({ message: "Editor access is required." }, { status: 403 });
    const payload = await request.json() as { id?: string; status?: string; newAssignment?: string; notes?: string };
    const id = payload.id?.trim();
    const status = payload.status?.trim();
    const newAssignment = payload.newAssignment?.trim() || "";
    const notes = payload.notes?.trim() || "";
    if (!id || !status || !validStatuses.has(status) || newAssignment.length > 500 || notes.length > 4000) {
      return NextResponse.json({ message: "Provide a valid task, status, assignment, and notes." }, { status: 400 });
    }
    const supabase = await createServerSupabase();
    const { data: task } = await supabase!.from("workplan_records").select("id,organization_ids").eq("id", id).maybeSingle();
    if (!task) return NextResponse.json({ message: "The task is unavailable in your organization scope." }, { status: 404 });
    const now = new Date().toISOString();
    const { error } = await supabase!.from("task_overrides").upsert({
      task_id: id,
      normalized_status: status,
      new_assignment: newAssignment,
      notes,
      updated_by: viewer.id,
      updated_at: now,
    });
    if (error) return NextResponse.json({ message: "The shared task update could not be saved." }, { status: 503 });
    await supabase!.from("audit_events").insert({
      organization_ids: task.organization_ids,
      actor_id: viewer.id,
      actor_email: viewer.email,
      action: "Shared task updated",
      entity_type: "workplan_record",
      entity_id: id,
      details: { status, newAssignment, notesProvided: Boolean(notes) },
    });
    return NextResponse.json({ status: "saved", updatedAt: now });
  } catch {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
}
