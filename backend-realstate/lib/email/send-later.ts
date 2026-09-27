import { after } from "next/server";
import { sendEmail, type OutgoingEmail } from "@/lib/email/mailer";

// Sends the email after the response has gone out. Talking to Gmail takes a second or two, so
// sending inline would make "email exists" responses measurably slower than "no such email"
// ones (account enumeration by timing), and a Gmail outage would fail the request itself.
// Failures are logged (never with the email body, which holds codes and links) and the user
// can ask for a new email.
export function sendEmailAfterResponse(email: OutgoingEmail): void {
  after(async () => {
    try {
      await sendEmail(email);
    } catch (error) {
      console.error(`Failed to send email "${email.subject.replace(/\d{6}/, "******")}"`, error);
    }
  });
}
