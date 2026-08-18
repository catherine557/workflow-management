import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { googleAuthorizationUrl } from "@/lib/google-connector";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const state = randomBytes(32).toString("base64url");
    const url = new URL(request.url);
    (await cookies()).set("google_oauth_state", state, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/api/google/callback",
      maxAge: 600,
    });
    return NextResponse.redirect(googleAuthorizationUrl(state, url.origin));
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ message: status === 403 ? "Administrator access is required." : "Sign in is required." }, { status });
  }
}
