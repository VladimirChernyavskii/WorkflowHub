import { NextResponse } from "next/server";

import { adminRouteGuard } from "@/lib/auth/admin-access";
import { getSessionUser } from "@/lib/get-session-user";

export async function GET() {
  const user = await getSessionUser();
  const denied = adminRouteGuard(user);
  if (denied) return denied;
  return NextResponse.json({ ok: true });
}
