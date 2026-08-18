import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getViewer } from "@/lib/auth";
import { isSharedModeConfigured } from "@/lib/supabase/config";

export default async function LoginPage() {
  if (!isSharedModeConfigured()) redirect("/");
  if (await getViewer()) redirect("/");
  return <LoginForm />;
}
