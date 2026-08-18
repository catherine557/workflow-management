import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, getSupabaseSecretKey } from "@/lib/supabase/config";

export function createAdminSupabase() {
  const config = getSupabasePublicConfig();
  const secretKey = getSupabaseSecretKey();
  if (!config || !secretKey) return null;

  return createClient(config.url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
