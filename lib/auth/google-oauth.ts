import "server-only";

import type { WorkflowHubEnv } from "@/lib/env-parse";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export class GoogleOAuthError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number) {
    super(code);
    this.name = "GoogleOAuthError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type GoogleUserProfile = {
  sub: string;
  email: string | null;
  displayName: string;
};

export function isGoogleOAuthConfigured(env: WorkflowHubEnv): boolean {
  return !!(
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    env.AUTH_BASE_URL
  );
}

export function googleRedirectUri(baseUrl: string): string {
  return `${baseUrl}/api/auth/google/callback`;
}

export function buildGoogleAuthorizationUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export async function exchangeGoogleAuthorizationCode(opts: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string }> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    code: opts.code,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new GoogleOAuthError("token_exchange_failed", res.status);
  }

  const json: unknown = await res.json();
  if (!isRecord(json) || typeof json.access_token !== "string") {
    throw new GoogleOAuthError("token_response_invalid", res.status);
  }

  return { accessToken: json.access_token };
}

export async function fetchGoogleUserProfile(
  accessToken: string
): Promise<GoogleUserProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new GoogleOAuthError("userinfo_failed", res.status);
  }

  const json: unknown = await res.json();
  if (!isRecord(json) || typeof json.sub !== "string" || json.sub.length === 0) {
    throw new GoogleOAuthError("userinfo_invalid", res.status);
  }

  const email =
    typeof json.email === "string" && json.email.length > 0
      ? json.email
      : null;
  const name =
    typeof json.name === "string" && json.name.length > 0
      ? json.name
      : null;

  const displayName = name ?? (email ? email.split("@")[0] || "User" : "User");

  return {
    sub: json.sub,
    email,
    displayName,
  };
}
