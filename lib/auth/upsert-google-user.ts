import "server-only";

import { AuthProvider, UserRole } from "@prisma/client";

import type { GoogleUserProfile } from "@/lib/auth/google-oauth";
import { prisma } from "@/lib/prisma";

export async function upsertGoogleUser(profile: GoogleUserProfile) {
  return prisma.user.upsert({
    where: {
      provider_providerSubject: {
        provider: AuthProvider.google,
        providerSubject: profile.sub,
      },
    },
    create: {
      provider: AuthProvider.google,
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
