import type { CompanyId } from "@/lib/workspace-config";

export const GOOGLE_SHEET_ID = "1Yyo0l90Go6tdNM4SCZ9f1CI7XMiEegec3htUkzsA6wo";
export const GOOGLE_SHEET_TITLE = "Staff Details and Task";
export const STAFF_SHEET_NAME = "Staffs Details";
export const WORKPLAN_SHEET_NAMES = [
  "Ashley",
  "Moses",
  "Paul",
  "Jayce",
  "Michael",
  "Bella",
  "Trisha",
  "Christine",
  "Richard",
] as const;

export type WorkplanSheetName = (typeof WORKPLAN_SHEET_NAMES)[number];
export type NormalizedTaskStatus = "Done" | "Pending" | "In Progress" | "Needs Review";

export type StaffRecord = {
  id: string;
  sourceSheet: typeof STAFF_SHEET_NAME;
  sourceRow: number;
  name: string;
  organization: string;
  role: string;
  department: string;
  email: string;
};

export type WorkplanRecord = {
  id: string;
  sourceSheet: WorkplanSheetName;
  sourceRow: number;
  owner: string;
  currentAssignment: string;
  catNotes: string;
  originalDueDate: string;
  newDueDate: string;
  community: string;
  collaborator: string;
  sourceStatus: string;
  notes: string;
  newAssignment: string;
  dashboardStatus?: NormalizedTaskStatus;
  dashboardNewAssignment?: string;
  dashboardNotes?: string;
  dashboardUpdatedAt?: string;
};

export type SheetSnapshot = {
  version: 1;
  source: {
    spreadsheetId: string;
    title: string;
    url: string;
    locale: string;
    timeZone: string;
    verifiedTabs: string[];
  };
  connector: {
    identity: { id: string; name: string; email: string };
    retrievedAt: string;
    mappingMode: "Local verified snapshot" | "Shared Google OAuth";
    writeMode: "Read-only";
  };
  counts: { staff: number; tasks: number };
  staff: StaffRecord[];
  tasks: WorkplanRecord[];
};

export function normalizeTaskStatus(value: string): NormalizedTaskStatus {
  const status = value.trim().toLowerCase();
  if (["completed", "done", "closed"].includes(status)) return "Done";
  if (["pending", "not started", "open"].includes(status)) return "Pending";
  if (["active", "in progress", "recurring", "blocker"].includes(status)) return "In Progress";
  return "Needs Review";
}

export function hasExplicitBlocker(task: WorkplanRecord) {
  return task.sourceStatus.trim().toLowerCase() === "blocker";
}

export function isExplicitlyRecurring(task: WorkplanRecord) {
  return task.sourceStatus.trim().toLowerCase() === "recurring";
}

export function parseSheetDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

export function effectiveDueDate(task: WorkplanRecord): { raw: string; iso: string } | null {
  const revised = parseSheetDate(task.newDueDate);
  if (revised) return { raw: task.newDueDate, iso: revised };
  const original = parseSheetDate(task.originalDueDate);
  return original ? { raw: task.originalDueDate, iso: original } : null;
}

export function todayInTimeZone(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function isTaskOverdue(task: WorkplanRecord, today: string) {
  const dueDate = effectiveDueDate(task);
  return Boolean(dueDate && dueDate.iso < today && effectiveTaskStatus(task) !== "Done");
}

export function sourceOrganizationCompanyIds(organization: string): CompanyId[] {
  if (organization.trim().toUpperCase() === "AIMA / SIB") return ["aima", "shellys-bistro"];
  return [];
}

export function staffMatchesCompany(staff: StaffRecord, companyId: CompanyId) {
  return companyId === "all" || sourceOrganizationCompanyIds(staff.organization).includes(companyId);
}

export function taskOwnerStaff(task: WorkplanRecord, staff: StaffRecord[]) {
  return staff.find((person) => person.name.trim().toLowerCase() === task.owner.trim().toLowerCase());
}

export function taskMatchesCompany(task: WorkplanRecord, staff: StaffRecord[], companyId: CompanyId) {
  if (companyId === "all") return true;
  const owner = taskOwnerStaff(task, staff);
  return owner ? staffMatchesCompany(owner, companyId) : false;
}

export function taskAssignment(task: WorkplanRecord) {
  return task.dashboardNewAssignment?.trim() || task.newAssignment.trim() || task.currentAssignment.trim() || "Not provided";
}

export function effectiveTaskStatus(task: WorkplanRecord) {
  return task.dashboardStatus || normalizeTaskStatus(task.sourceStatus);
}

export function taskMetrics(tasks: WorkplanRecord[], today: string) {
  const completed = tasks.filter((task) => effectiveTaskStatus(task) === "Done").length;
  return {
    total: tasks.length,
    completed,
    incomplete: tasks.length - completed,
    needsReview: tasks.filter((task) => effectiveTaskStatus(task) === "Needs Review").length,
    blockers: tasks.filter(hasExplicitBlocker).length,
    overdue: tasks.filter((task) => isTaskOverdue(task, today)).length,
  };
}
