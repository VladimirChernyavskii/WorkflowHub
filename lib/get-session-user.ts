import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import {
  parseSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/session-cookie";

/** Resolves the signed session cookie to a `User` row, or `null` if missing or invalid. */
export async function getSessionUser() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  const userId = parseSessionToken(raw);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}
