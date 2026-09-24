import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";
import type { GoogleProfile } from "@/lib/auth/google";

export type OAuthUser = {
  id: string;
  role: Role;
};

export class OAuthLoginRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthLoginRejectedError";
  }
}

// Finds the user linked to this Google account, otherwise links the Google account to the
// existing user with the same (Google-verified) email, otherwise creates a new USER.
// Every successful login refreshes the stored email/name/picture and lastLoginAt.
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<OAuthUser> {
  if (!profile.emailVerified) {
    throw new OAuthLoginRejectedError("Google account email is not verified");
  }

  const accountDetails = {
    email: profile.email,
    emailVerified: profile.emailVerified,
    name: profile.name,
    pictureUrl: profile.picture,
    lastLoginAt: new Date(),
  };

  return prisma.$transaction(async (tx) => {
    const linked = await tx.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: "GOOGLE", providerAccountId: profile.sub } },
      select: { id: true, user: { select: { id: true, role: true } } },
    });

    if (linked) {
      assertNotAdmin(linked.user.role);
      await tx.oAuthAccount.update({ where: { id: linked.id }, data: accountDetails });
      return linked.user;
    }

    const existing = await tx.user.findUnique({
      where: { email: profile.email },
      select: { id: true, role: true },
    });

    if (existing) {
      assertNotAdmin(existing.role);
      await tx.oAuthAccount.create({
        data: { ...accountDetails, provider: "GOOGLE", providerAccountId: profile.sub, userId: existing.id },
      });
      // Registration doesn't verify email ownership, so this account (and its password) may
      // have been created by someone else using this email ("pre-account hijacking"). Google
      // has now proven who owns the email: drop the unverified password and sign out every
      // existing session. The owner can set a password again via forgot-password.
      // Revisit once email verification exists: only do this when the email was never verified.
      await tx.user.update({
        where: { id: existing.id },
        data: { passwordHash: null, sessionsRevokedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return existing;
    }

    // Public sign-up path: always a plain USER, no password.
    return tx.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        oauthAccounts: {
          create: { ...accountDetails, provider: "GOOGLE", providerAccountId: profile.sub },
        },
      },
      select: { id: true, role: true },
    });
  });
}

// The single admin signs in with email + password only, never through Google.
function assertNotAdmin(role: Role): void {
  if (role === "ADMIN") {
    throw new OAuthLoginRejectedError("Admin accounts cannot sign in with Google");
  }
}
