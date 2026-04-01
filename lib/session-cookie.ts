import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Signed HTTP-only session cookie (PRD §5.7, §10).
 *
 * **Development** (`NODE_ENV !== "production"`, typically HTTP on localhost): the cookie is set
 * without the `Secure` flag so browsers accept it on plain HTTP.
 *
 * **Production** (`NODE_ENV === "production"`, HTTPS): the `Secure` flag is set so the cookie is
 * not sent over unencrypted connections.
 *
 * **SameSite=Lax** supports top-level navigations (OAuth redirects back to the app) while reducing
 * cross-site request risks compared to `None`.
 */
export const SESSION_COOKIE_NAME = "workflowhub_session" as const;

const TOKEN_VERSION = "1";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sessionMaxAgeSeconds(): number {
  return env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
}

export function sessionCookieSetOptions(): {
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
    maxAge: sessionMaxAgeSeconds(),
  };
}

export function sessionCookieClearOptions(): {
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

function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function verifySignature(
  secret: string,
  payload: string,
  sigHex: string
): boolean {
  if (!/^[0-9a-f]{64}$/i.test(sigHex)) return false;
  const expected = signPayload(secret, payload);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sigHex, "hex")
    );
  } catch {
    return false;
  }
}

/** Builds a signed token bound to `userId` until `sessionMaxAgeSeconds()` from now. */
export function createSessionToken(userId: string): string {
  if (!UUID_RE.test(userId)) {
    throw new Error("Invalid user id");
  }
  const expSec = Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds();
  const payload = `${TOKEN_VERSION}|${userId}|${expSec}`;
  const sig = signPayload(env.SESSION_SECRET, payload);
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sig}`;
}

/** Returns `userId` if the token is valid and not expired; otherwise `null`. */
export function parseSessionToken(token: string | undefined): string | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!verifySignature(env.SESSION_SECRET, payload, sigHex)) return null;
  const parts = payload.split("|");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const [, userId, expStr] = parts;
  if (!UUID_RE.test(userId)) return null;
  const expSec = Number(expStr);
  if (!Number.isFinite(expSec) || expSec < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return userId;
}
