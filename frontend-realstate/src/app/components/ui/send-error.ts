import { ApiError, requestSignIn } from "@/app/auth";
import { UserFacingError } from "@/app/errors";

/**
 * The message to show when a website form couldn't be sent. A lapsed sign-in (401) also opens the
 * login page, so the visitor can sign in and come straight back (their typing is kept as a draft).
 */
export function sendError(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) { requestSignIn(); return "Please sign in again to send."; }
  if (err instanceof ApiError) return err.message;
  // Photo preparation and uploads explain their own problem (media/watermark.ts, api/uploads.ts).
  if (err instanceof UserFacingError) return err.message;
  return "Could not send. Please check your connection and try again.";
}
