import { forbidden } from "next/navigation";

import { isAdminUser } from "@/lib/auth/admin-access";
import { getSessionUser } from "@/lib/get-session-user";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  if (!isAdminUser(user)) {
    forbidden();
  }
  return <>{children}</>;
}
