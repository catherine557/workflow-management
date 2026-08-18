import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { encryptConnectorSecret } from "@/lib/connector-crypto";
import { exchangeGoogleCode, getGoogleConfig, googleUserInfo } from "@/lib/google-connector";
import { createAdminSupabase } from "@/lib/supabase/admin";

function dashboardRedirect(requestUrl: string, result: string) {
  const url = new URL("/", requestUrl);
  url.searchParams.set("google", result);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  cookieStore.delete("google_oauth_state");
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  if (!code || !state || !expectedState || state !== expectedState) return dashboardRedirect(request.url, "invalid-state");

  try {
    const viewer = await requireAdmin();
    const tokens = await exchangeGoogleCode(code, requestUrl.origin);
    const identity = await googleUserInfo(tokens.access_token);
    const config = getGoogleConfig(requestUrl.origin);
    if (identity.email.toLowerCase() !== config.authorizedEmail) {
      const admin = createAdminSupabase();
      const now = new Date().toISOString();
      await admin?.from("connectors").upsert({
        provider: "google",
        identity_email: identity.email.toLowerCase(),
        identity_name: identity.name || identity.email,
        status: "Account mismatch",
        last_attempted_at: now,
        safe_error: `Connect ${config.authorizedEmail} to read the authorized sources.`,
        updated_by: viewer.id,
        updated_at: now,
      });
      await admin?.from("audit_events").insert({
        actor_id: viewer.id,
        actor_email: viewer.email,
        action: "Google connector account mismatch",
        entity_type: "connector",
        entity_id: "google",
        details: { expectedIdentity: config.authorizedEmail, connectedIdentity: identity.email.toLowerCase() },
      });
      return dashboardRedirect(request.url, "account-mismatch");
    }
    if (!tokens.refresh_token) return dashboardRedirect(request.url, "refresh-token-missing");
    const admin = createAdminSupabase();
    if (!admin) return dashboardRedirect(request.url, "database-unavailable");
    const now = new Date().toISOString();
    const { error } = await admin.from("connectors").upsert({
      provider: "google",
      identity_email: identity.email.toLowerCase(),
      identity_name: identity.name || identity.email,
      status: "Connected",
      refresh_token_encrypted: encryptConnectorSecret(tokens.refresh_token),
      granted_scopes: tokens.scope.split(" "),
      safe_error: null,
      updated_by: viewer.id,
      updated_at: now,
    });
    if (error) return dashboardRedirect(request.url, "database-unavailable");
    await admin.from("audit_events").insert({
      actor_id: viewer.id,
      actor_email: viewer.email,
      action: "Google connector authorized",
      entity_type: "connector",
      entity_id: "google",
      details: { identity: identity.email, scopes: tokens.scope.split(" ") },
    });
    return dashboardRedirect(request.url, "connected");
  } catch {
    return dashboardRedirect(request.url, "failed");
  }
}
