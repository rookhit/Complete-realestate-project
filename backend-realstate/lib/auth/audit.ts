import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { RequestContext } from "@/lib/http/request-context";

export type AuditEvent =
  | "register"
  | "login"
  | "login_failed"
  | "login_locked"
  | "login_attack_suspected"
  | "mfa_challenge"
  | "mfa_failed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "google_login"
  | "logout"
  | "password_reset_requested"
  | "password_reset"
  | "refresh_token_reuse"
  | "refresh_user_agent_mismatch";

type AuditInput = {
  userId?: string | null;
  context?: RequestContext;
  metadata?: Prisma.InputJsonObject;
};

// Best-effort: a failure to write the log must never fail the login/logout it describes.
// Never pass passwords, tokens or token hashes in metadata.
export async function logAuthEvent(event: AuditEvent, input: AuditInput = {}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        event,
        userId: input.userId ?? null,
        ipAddress: input.context?.ip,
        userAgent: input.context?.userAgent,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error(`Failed to write audit event "${event}"`, error);
  }
}
