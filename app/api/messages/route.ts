import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/auth";
import { isSharedModeConfigured } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isSharedModeConfigured()) return NextResponse.json({ messages: [], count: 0 });
  try {
    await requireViewer();
    const supabase = await createServerSupabase();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = 25;
    const from = (page - 1) * pageSize;
    const { data, error, count } = await supabase!
      .from("message_evidence")
      .select("id,gmail_thread_id,source_title,sender,sent_at,evidence_kind,body_text,attachment_names,attachment_text,source_url,refreshed_at", { count: "exact" })
      .order("sent_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ message: "Shared message evidence could not be read." }, { status: 503 });
    const messages = (data ?? []).map(({ body_text, attachment_text, ...message }) => ({
      ...message,
      evidence_excerpt: String(attachment_text || body_text || "").replace(/\s+/g, " ").trim().slice(0, 320),
    }));
    return NextResponse.json({ messages, count: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
}
