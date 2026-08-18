import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  GOOGLE_SHEET_ID,
  GOOGLE_SHEET_TITLE,
  STAFF_SHEET_NAME,
  WORKPLAN_SHEET_NAMES,
  type SheetSnapshot,
} from "@/lib/sheet-data";
import { SHEET_SOURCE_URL } from "@/lib/workspace-config";
import { requireViewer } from "@/lib/auth";
import { isSharedModeConfigured } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Data-Classification": "authorized-operational",
};

function isValidSnapshot(value: unknown): value is SheetSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<SheetSnapshot>;
  const requiredTabs = new Set([STAFF_SHEET_NAME, ...WORKPLAN_SHEET_NAMES]);
  const workplanTabs = new Set<string>(WORKPLAN_SHEET_NAMES);
  const verifiedTabs = snapshot.source?.verifiedTabs;

  return (
    snapshot.version === 1 &&
    snapshot.source?.spreadsheetId === GOOGLE_SHEET_ID &&
    snapshot.source?.title === GOOGLE_SHEET_TITLE &&
    snapshot.source?.url === SHEET_SOURCE_URL &&
    snapshot.source?.locale === "en_GB" &&
    Array.isArray(verifiedTabs) &&
    verifiedTabs.length === requiredTabs.size &&
    new Set(verifiedTabs).size === requiredTabs.size &&
    verifiedTabs.every((tab) => requiredTabs.has(tab)) &&
    Array.isArray(snapshot.staff) &&
    Array.isArray(snapshot.tasks) &&
    snapshot.counts?.staff === snapshot.staff.length &&
    snapshot.counts?.tasks === snapshot.tasks.length &&
    snapshot.staff.every((person) => person.sourceSheet === STAFF_SHEET_NAME && person.sourceRow > 1) &&
    snapshot.tasks.every((task) => workplanTabs.has(task.sourceSheet) && task.sourceRow > 1) &&
    typeof snapshot.connector?.identity?.email === "string" &&
    Boolean(snapshot.connector.identity.email) &&
    !Number.isNaN(Date.parse(snapshot.connector?.retrievedAt ?? "")) &&
    snapshot.connector?.mappingMode === "Local verified snapshot" &&
    snapshot.connector?.writeMode === "Read-only"
  );
}

function unavailable(message: string, status = 503) {
  return NextResponse.json(
    { status: "unavailable", message },
    { status, headers: responseHeaders },
  );
}

async function readSharedSnapshot() {
  await requireViewer();
  const supabase = await createServerSupabase();
  if (!supabase) return unavailable("The shared database is not configured.");
  const [staffResult, taskResult, connectorResult] = await Promise.all([
    supabase.from("staff_records").select("id,source_sheet,source_row,name,source_organization,role,department,work_email").order("source_row"),
    supabase.from("workplan_records").select("id,source_sheet,source_row,owner,current_assignment,cat_notes,original_due_date,new_due_date,community,collaborator,source_status,notes,new_assignment,task_overrides(normalized_status,new_assignment,notes,updated_at)").order("source_sheet").order("source_row"),
    supabase.from("connectors").select("identity_email,identity_name,status,last_successful_at,safe_error,record_counts").eq("provider", "google").maybeSingle(),
  ]);
  if (staffResult.error || taskResult.error) return unavailable("The shared workplan snapshot could not be read.");
  if (!staffResult.data?.length && !taskResult.data?.length) return unavailable("No verified shared workplan snapshot is available.");
  const connector = connectorResult.data;
  const retrievedAt = connector?.last_successful_at || new Date(0).toISOString();
  const snapshot: SheetSnapshot = {
    version: 1,
    source: {
      spreadsheetId: GOOGLE_SHEET_ID,
      title: GOOGLE_SHEET_TITLE,
      url: SHEET_SOURCE_URL,
      locale: "en_GB",
      timeZone: "America/Winnipeg",
      verifiedTabs: [STAFF_SHEET_NAME, ...WORKPLAN_SHEET_NAMES],
    },
    connector: {
      identity: {
        id: "shared-google-connector",
        name: connector?.identity_name || "Not provided",
        email: connector?.identity_email || "Not provided",
      },
      retrievedAt,
      mappingMode: connector?.status === "Stale snapshot" ? "Local verified snapshot" : "Shared Google OAuth",
      writeMode: "Read-only",
    },
    counts: { staff: staffResult.data?.length ?? 0, tasks: taskResult.data?.length ?? 0 },
    staff: (staffResult.data ?? []).map((person) => ({
      id: person.id,
      sourceSheet: STAFF_SHEET_NAME,
      sourceRow: person.source_row,
      name: person.name,
      organization: person.source_organization,
      role: person.role,
      department: person.department,
      email: person.work_email,
    })),
    tasks: (taskResult.data ?? []).map((task) => {
      const override = Array.isArray(task.task_overrides) ? task.task_overrides[0] : task.task_overrides;
      return {
      id: task.id,
      sourceSheet: task.source_sheet as (typeof WORKPLAN_SHEET_NAMES)[number],
      sourceRow: task.source_row,
      owner: task.owner,
      currentAssignment: task.current_assignment,
      catNotes: task.cat_notes,
      originalDueDate: task.original_due_date,
      newDueDate: task.new_due_date,
      community: task.community,
      collaborator: task.collaborator,
      sourceStatus: task.source_status,
      notes: task.notes,
      newAssignment: task.new_assignment,
      dashboardStatus: override?.normalized_status || undefined,
      dashboardNewAssignment: override?.new_assignment || undefined,
      dashboardNotes: override?.notes || undefined,
      dashboardUpdatedAt: override?.updated_at || undefined,
    };}),
  };
  return NextResponse.json(snapshot, { headers: responseHeaders });
}

export async function GET(request: Request) {
  if (isSharedModeConfigured()) {
    try {
      return await readSharedSnapshot();
    } catch {
      return unavailable("Sign in to view the shared workplan.", 401);
    }
  }

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_SHEET_SNAPSHOT !== "true") {
    return unavailable("The local verified snapshot adapter is disabled in production.");
  }

  const hostname = new URL(request.url).hostname;
  if (process.env.NODE_ENV !== "production" && !["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname)) {
    return unavailable("The local verified snapshot is available only on this device.", 403);
  }

  try {
    const filePath = path.join(process.cwd(), "data", "local", "google-sheet-snapshot.json");
    const snapshot = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    if (!isValidSnapshot(snapshot)) {
      return unavailable("The local Google Sheet snapshot failed source verification.");
    }

    return NextResponse.json(snapshot, { headers: responseHeaders });
  } catch {
    return unavailable("No verified local Google Sheet snapshot is available.");
  }
}
