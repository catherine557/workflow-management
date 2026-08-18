import type { CompanyId } from "@/lib/workspace-config";

export const APPROVED_ROUTINE_WORKBOOKS = [
  { id: "1vWu4a3zroXvejKFs89sybe3uZWCQDuZpDClutf43WHs", name: "Christine Routine", owner: "Christine" },
  { id: "1ZrFaKNVXNWwE_TP2gGMjurztVy9txg0kPd6B1l14PVI", name: "Bella Routine", owner: "Bella" },
  { id: "1Sqti0LnpoBPzapPh4OG4u-QlOeergDEuS-6sOGYdO7Y", name: "Ashley Routine", owner: "Ashley" },
  { id: "1zk5UGy-GA15nepfrbm_MR0wJVmlIjGLJoOMEfvbMVmc", name: "Trisha Routine", owner: "Trisha" },
] as const;

export type RoutineCadence = "Daily" | "Weekly" | "Monthly";

export type RoutineRecord = {
  id: string;
  workbook_id: string;
  workbook_name: string;
  sheet_name: string;
  source_row: number;
  owner: string;
  cadence: RoutineCadence;
  section: string;
  task: string;
  schedule: string;
  category: string;
  source_status: string;
  notes: string;
  organization_ids: CompanyId[];
  source_url: string;
  refreshed_at: string;
};
