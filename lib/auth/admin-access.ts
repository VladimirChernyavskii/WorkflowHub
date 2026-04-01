import "server-only";

import type { User } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";

/** Split on commas and newlines; trim; lowercase; drop empties. */
export function parseAdminEmailAllowlist(raw: string): Set<string> {
  const out = new Set<string>();
  if (!raw.trim()) return out;
  for (const segment of raw.split(/[,\n]+/)) {
    const e = segment.trim().toLowerCase();
    if (e) out.add(e);
  }
  return out;
}

const adminEmailAllowlist = parseAdminEmailAllowlist(env.ADMIN_EMAIL_ALLOWLIST);

export function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  if (user.role === UserRole.admin) return true;
  const e = user.email?.trim().toLowerCase();
  return !!e && adminEmailAllowlist.has(e);
}

/**
 * OAuth upsert: never demote `admin` → `user` when the email leaves the allowlist or is missing.
 * New and non-admin users gain `admin` when their email is allowlisted.
 */
export function resolveRoleForOAuth(
  existingRole: UserRole | null,
  email: string | null | undefined
): UserRole {
  if (existingRole === UserRole.admin) return UserRole.admin;
  const e = email?.trim().toLowerCase();
  if (e && adminEmailAllowlist.has(e)) return UserRole.admin;
  return UserRole.user;
}

/** `null` means caller may continue; otherwise return this Response from the route handler. */
export function adminRouteGuard(user: User | null): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
