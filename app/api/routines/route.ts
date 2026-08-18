import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth";
import { isSharedModeConfigured } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSharedModeConfigured()) return NextResponse.json({ routines: [], count: 0 });
  try {
    await requireViewer();
    const supabase = await createServerSupabase();
    const { data, error, count } = await supabase!
      .from("routine_records")
      .select("id,workbook_id,workbook_name,sheet_name,source_row,owner,cadence,section,task,schedule,category,source_status,notes,organization_ids,source_url,refreshed_at", { count: "exact" })
      .order("owner")
      .order("cadence")
      .order("source_row");
    if (error) return NextResponse.json({ message: "Shared routine records could not be read." }, { status: 503 });
    return NextResponse.json({ routines: data ?? [], count: count ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
}
