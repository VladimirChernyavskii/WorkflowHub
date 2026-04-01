import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserProfile,
  googleRedirectUri,
  GoogleOAuthError,
  isGoogleOAuthConfigured,
} from "@/lib/auth/google-oauth";
import {
  OAUTH_STATE_COOKIE_NAME,
  oauthStateCookieClearOptions,
} from "@/lib/auth/oauth-state";
import { upsertGoogleUser } from "@/lib/auth/upsert-google-user";
import { env } from "@/lib/env";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieSetOptions,
} from "@/lib/session-cookie";

function redirectToLogin(
  error: string,
  baseUrl: string
): NextResponse {
  const u = new URL("/login", baseUrl);
  u.searchParams.set("error", error);
  return NextResponse.redirect(u);
}

export async function GET(request: NextRequest) {
  const baseUrl = isGoogleOAuthConfigured(env)
    ? env.AUTH_BASE_URL!
    : request.nextUrl.origin;

  if (!isGoogleOAuthConfigured(env)) {
    return redirectToLogin("oauth_config", baseUrl);
  }

  const params = request.nextUrl.searchParams;
  const providerError = params.get("error");
  if (providerError) {
    console.error("[google-oauth] provider returned error", providerError);
    return redirectToLogin("oauth_failed", baseUrl);
  }

  const jar = await cookies();
  const storedState = jar.get(OAUTH_STATE_COOKIE_NAME)?.value;
  jar.set(OAUTH_STATE_COOKIE_NAME, "", oauthStateCookieClearOptions());

  const state = params.get("state");
  if (!storedState || !state || storedState !== state) {
    return redirectToLogin("oauth_state", baseUrl);
  }

  const code = params.get("code");
  if (!code) {
    return redirectToLogin("oauth_failed", baseUrl);
  }

  const redirectUri = googleRedirectUri(env.AUTH_BASE_URL!);

  try {
    const { accessToken } = await exchangeGoogleAuthorizationCode({
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
      code,
      redirectUri,
    });

    const profile = await fetchGoogleUserProfile(accessToken);
    const user = await upsertGoogleUser(profile);
    const sessionToken = createSessionToken(user.id);
    jar.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieSetOptions());
  } catch (e) {
    const msg =
      e instanceof GoogleOAuthError
        ? `${e.code} (http ${e.httpStatus})`
        : e instanceof Error
          ? e.message
          : "unknown";
    console.error("[google-oauth] callback failed:", msg);
    return redirectToLogin("oauth_failed", baseUrl);
  }

  return NextResponse.redirect(new URL("/", baseUrl));
}
