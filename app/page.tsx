import { DashboardShell } from "@/components/dashboard-shell";
import { getViewer } from "@/lib/auth";
import { isSharedModeConfigured } from "@/lib/supabase/config";
import { redirect } from "next/navigation";

export default async function Home() {
  const sharedMode = isSharedModeConfigured();
  const viewer = sharedMode ? await getViewer() : null;
  if (sharedMode && !viewer) redirect("/login");
  return <DashboardShell viewer={viewer} sharedMode={sharedMode} />;
}
