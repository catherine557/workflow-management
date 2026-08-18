import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GOOGLE_SHEET_ID,
  GOOGLE_SHEET_TITLE,
  STAFF_SHEET_NAME,
  WORKPLAN_SHEET_NAMES,
  sourceOrganizationCompanyIds,
  type SheetSnapshot,
  type StaffRecord,
  type WorkplanRecord,
} from "@/lib/sheet-data";
import { SHEET_SOURCE_URL } from "@/lib/workspace-config";

const batchSize = 200;

async function upsertBatches(client: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const { error } = await client.from(table).upsert(rows.slice(index, index + batchSize));
    if (error) throw new Error(`The shared ${table} snapshot could not be saved.`);
  }
}

function staffRows(staff: StaffRecord[], runId: string, refreshedAt: string) {
  return staff.map((person) => ({
    id: person.id,
    source_sheet: person.sourceSheet,
    source_row: person.sourceRow,
    name: person.name,
    source_organization: person.organization,
    organization_ids: sourceOrganizationCompanyIds(person.organization),
    role: person.role,
    department: person.department,
    work_email: person.email,
    source_url: SHEET_SOURCE_URL,
    sync_run_id: runId,
    refreshed_at: refreshedAt,
  }));
}

function workplanRows(tasks: WorkplanRecord[], staff: StaffRecord[], runId: string, refreshedAt: string) {
  const organizationsByOwner = new Map(
    staff.map((person) => [person.name.trim().toLowerCase(), sourceOrganizationCompanyIds(person.organization)]),
  );
  return tasks.map((task) => ({
    id: task.id,
    source_sheet: task.sourceSheet,
    source_row: task.sourceRow,
    owner: task.owner,
    organization_ids: organizationsByOwner.get(task.owner.trim().toLowerCase()) ?? [],
    current_assignment: task.currentAssignment,
    cat_notes: task.catNotes,
    original_due_date: task.originalDueDate,
    new_due_date: task.newDueDate,
    community: task.community,
    collaborator: task.collaborator,
    source_status: task.sourceStatus,
    notes: task.notes,
    new_assignment: task.newAssignment,
    source_url: SHEET_SOURCE_URL,
    sync_run_id: runId,
    refreshed_at: refreshedAt,
  }));
}

export async function persistSheetSnapshot(
  client: SupabaseClient,
  snapshot: SheetSnapshot,
  runId: string,
  refreshedAt = new Date().toISOString(),
) {
  await upsertBatches(client, "staff_records", staffRows(snapshot.staff, runId, refreshedAt));
  await upsertBatches(client, "workplan_records", workplanRows(snapshot.tasks, snapshot.staff, runId, refreshedAt));
  await client.from("staff_records").delete().neq("sync_run_id", runId);
  await client.from("workplan_records").delete().neq("sync_run_id", runId);
}

export async function readLocalSheetSnapshot() {
  const filePath = path.join(process.cwd(), "data", "local", "google-sheet-snapshot.json");
  return JSON.parse(await readFile(filePath, "utf8")) as SheetSnapshot;
}

export function validateLocalSheetSnapshot(snapshot: SheetSnapshot) {
  const requiredTabs = new Set([STAFF_SHEET_NAME, ...WORKPLAN_SHEET_NAMES]);
  return snapshot.version === 1 &&
    snapshot.source.spreadsheetId === GOOGLE_SHEET_ID &&
    snapshot.source.title === GOOGLE_SHEET_TITLE &&
    snapshot.source.url === SHEET_SOURCE_URL &&
    new Set(snapshot.source.verifiedTabs).size === requiredTabs.size &&
    snapshot.source.verifiedTabs.every((tab) => requiredTabs.has(tab));
}
