import "server-only";

import { randomBytes } from "node:crypto";

export const OAUTH_STATE_COOKIE_NAME = "workflowhub_oauth_state" as const;

const STATE_MAX_AGE_SEC = 600;

export function oauthStateCookieSetOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE_SEC,
  };
}

export function oauthStateCookieClearOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}
