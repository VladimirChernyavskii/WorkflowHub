import "server-only";

import type { WorkflowHubEnv } from "@/lib/env-parse";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

export class GitHubOAuthError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number) {
    super(code);
    this.name = "GitHubOAuthError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type GitHubUserProfile = {
  sub: string;
  email: string | null;
  displayName: string;
};

export function isGitHubOAuthConfigured(env: WorkflowHubEnv): boolean {
  return !!(
    env.GITHUB_CLIENT_ID &&
    env.GITHUB_CLIENT_SECRET &&
    env.AUTH_BASE_URL
  );
}

export function githubRedirectUri(baseUrl: string): string {
  return `${baseUrl}/api/auth/github/callback`;
}

export function buildGitHubAuthorizationUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: "read:user user:email",
    state: opts.state,
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export async function exchangeGitHubAuthorizationCode(opts: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string }> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    code: opts.code,
    redirect_uri: opts.redirectUri,
  });

  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new GitHubOAuthError("token_exchange_failed", res.status);
  }

  const json: unknown = await res.json();
  if (!isRecord(json) || typeof json.access_token !== "string") {
    throw new GitHubOAuthError("token_response_invalid", res.status);
  }

  return { accessToken: json.access_token };
}

async function fetchGitHubUserJson(accessToken: string): Promise<unknown> {
  const res = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new GitHubOAuthError("user_failed", res.status);
  }
  return res.json();
}

async function fetchPrimaryGitHubEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(GITHUB_EMAILS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new GitHubOAuthError("user_emails_failed", res.status);
  }
  const json: unknown = await res.json();
  if (!Array.isArray(json)) {
    throw new GitHubOAuthError("user_emails_invalid", res.status);
  }
  for (const item of json) {
    if (!isRecord(item)) continue;
    if (item.primary === true && typeof item.email === "string" && item.email.length > 0) {
      return item.email;
    }
  }
  for (const item of json) {
    if (!isRecord(item)) continue;
    if (typeof item.email === "string" && item.email.length > 0) {
      return item.email;
    }
  }
  return null;
}

export async function fetchGitHubUserProfile(
  accessToken: string
): Promise<GitHubUserProfile> {
  const json: unknown = await fetchGitHubUserJson(accessToken);
  if (
    !isRecord(json) ||
    typeof json.id !== "number" ||
    !Number.isFinite(json.id)
  ) {
    throw new GitHubOAuthError("user_invalid", 200);
  }

  const sub = String(json.id);
  let email: string | null =
    typeof json.email === "string" && json.email.length > 0 ? json.email : null;
  if (email == null) {
    email = await fetchPrimaryGitHubEmail(accessToken);
  }

  const login =
    typeof json.login === "string" && json.login.length > 0 ? json.login : null;
  const name =
    typeof json.name === "string" && json.name.length > 0 ? json.name : null;

  const displayName = name ?? login ?? (email ? email.split("@")[0] || "User" : "User");

  return {
    sub,
    email,
    displayName,
  };
}
