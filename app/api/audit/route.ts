import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth";
import { isSharedModeConfigured } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSharedModeConfigured()) return NextResponse.json({ events: [] });
  try {
    await requireViewer();
    const supabase = await createServerSupabase();
    const { data, error } = await supabase!.from("audit_events").select("id,organization_ids,actor_email,action,entity_type,entity_id,details,created_at").order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ message: "Shared audit history could not be read." }, { status: 503 });
    return NextResponse.json({ events: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
}
