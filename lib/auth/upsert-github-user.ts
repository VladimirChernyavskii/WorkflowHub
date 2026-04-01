import "server-only";

import { AuthProvider, UserRole } from "@prisma/client";

import type { GitHubUserProfile } from "@/lib/auth/github-oauth";
import { prisma } from "@/lib/prisma";

/**
 * OAuth identity policy: each `(provider, providerSubject)` is one User row.
 * The same email on Google and GitHub creates two separate accounts; there is no automatic linking.
 */
export async function upsertGithubUser(profile: GitHubUserProfile) {
  return prisma.user.upsert({
    where: {
      provider_providerSubject: {
        provider: AuthProvider.github,
        providerSubject: profile.sub,
      },
    },
    create: {
      provider: AuthProvider.github,
      providerSubject: profile.sub,
      email: profile.email,
      displayName: profile.displayName,
      role: UserRole.user,
    },
    update: {
      ...(profile.email != null ? { email: profile.email } : {}),
      displayName: profile.displayName,
    },
  });
}
