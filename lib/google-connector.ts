import "server-only";

import { decryptConnectorSecret } from "@/lib/connector-crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { GOOGLE_AUTHORIZED_EMAIL } from "@/lib/workspace-config";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
] as const;

export function getGoogleConfig(origin?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const authorizedEmail = (process.env.GOOGLE_AUTHORIZED_EMAIL || GOOGLE_AUTHORIZED_EMAIL).trim().toLowerCase();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${origin || process.env.APP_URL}/api/google/callback`;
  if (!clientId || !clientSecret || !redirectUri.startsWith("http")) {
    throw new Error("Google OAuth is not configured.");
  }
  return { clientId, clientSecret, authorizedEmail, redirectUri };
}

export function googleAuthorizationUrl(state: string, origin: string) {
  const config = getGoogleConfig(origin);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

async function tokenRequest(body: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google authorization could not be completed.");
  return await response.json() as GoogleTokenResponse;
}

export function exchangeGoogleCode(code: string, origin: string) {
  const config = getGoogleConfig(origin);
  return tokenRequest(new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  }));
}

export function refreshGoogleAccessToken(refreshToken: string) {
  const config = getGoogleConfig();
  return tokenRequest(new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  }));
}

export async function connectedGoogleAccessToken() {
  const admin = createAdminSupabase();
  if (!admin) throw new Error("Shared database is not configured.");
  const { data: connector } = await admin
    .from("connectors")
    .select("refresh_token_encrypted,status")
    .eq("provider", "google")
    .maybeSingle();
  if (!connector?.refresh_token_encrypted) throw new Error("Google is not connected.");
  const token = await refreshGoogleAccessToken(decryptConnectorSecret(connector.refresh_token_encrypted));
  return token.access_token;
}

export async function googleUserInfo(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The connected Google identity could not be verified.");
  return await response.json() as { sub: string; email: string; name?: string };
}
