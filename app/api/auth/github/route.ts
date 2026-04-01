import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildGitHubAuthorizationUrl,
  githubRedirectUri,
  isGitHubOAuthConfigured,
} from "@/lib/auth/github-oauth";
import {
  createOAuthState,
  OAUTH_STATE_COOKIE_NAME,
  oauthStateCookieSetOptions,
} from "@/lib/auth/oauth-state";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const fallbackOrigin = new URL(request.url).origin;

  if (!isGitHubOAuthConfigured(env)) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_config", fallbackOrigin)
    );
  }

  const state = createOAuthState();
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE_NAME, state, oauthStateCookieSetOptions());

  const redirectUri = githubRedirectUri(env.AUTH_BASE_URL!);
  const authorizeUrl = buildGitHubAuthorizationUrl({
    clientId: env.GITHUB_CLIENT_ID!,
    redirectUri,
    state,
  });

  return NextResponse.redirect(authorizeUrl);
}
