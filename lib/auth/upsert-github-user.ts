import "server-only";

import { AuthProvider } from "@prisma/client";

import { resolveRoleForOAuth } from "@/lib/auth/admin-access";
import type { GitHubUserProfile } from "@/lib/auth/github-oauth";
import { prisma } from "@/lib/prisma";

/**
 * OAuth identity policy: each `(provider, providerSubject)` is one User row.
 * The same email on Google and GitHub creates two separate accounts; there is no automatic linking.
 */
export async function upsertGithubUser(profile: GitHubUserProfile) {
  const where = {
    provider_providerSubject: {
      provider: AuthProvider.github,
      providerSubject: profile.sub,
    },
  } as const;
  const existing = await prisma.user.findUnique({ where });
  const role = resolveRoleForOAuth(existing?.role ?? null, profile.email);

  return prisma.user.upsert({
    where,
    create: {
      provider: AuthProvider.github,
      providerSubject: profile.sub,
      email: profile.email,
      displayName: profile.displayName,
      role,
    },
    update: {
      ...(profile.email != null ? { email: profile.email } : {}),
      displayName: profile.displayName,
      role,
    },
  });
}
