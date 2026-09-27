import type { OutgoingEmail } from "@/lib/email/mailer";

// Only server-generated values (codes, links) go into these emails, never user input, so the
// HTML needs no escaping.

function layout(body: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1611">
<h2 style="color:#8a2030;font-weight:normal;margin:0 0 16px">Nepal Bhoomi</h2>
${body}
<p style="color:#7a7060;font-size:12px;margin-top:32px">If you didn't request this, you can ignore this email.</p>
</div>`;
}

export function verificationCodeEmail(to: string, code: string, ttlMinutes: number): OutgoingEmail {
  return {
    to,
    subject: `${code} is your Nepal Bhoomi verification code`,
    text: `Your Nepal Bhoomi verification code is ${code}.\n\nIt expires in ${ttlMinutes} minutes. If you didn't create an account, ignore this email.`,
    html: layout(`<p>Enter this code to verify your email address:</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:16px 0">${code}</p>
<p>It expires in ${ttlMinutes} minutes.</p>`),
  };
}

export function passwordResetEmail(to: string, link: string, ttlMinutes: number): OutgoingEmail {
  return {
    to,
    subject: "Reset your Nepal Bhoomi password",
    text: `Open this link to choose a new password:\n\n${link}\n\nIt expires in ${ttlMinutes} minutes and works once. If you didn't ask to reset your password, ignore this email.`,
    html: layout(`<p>Someone asked to reset the password of your Nepal Bhoomi account.</p>
<p style="margin:24px 0"><a href="${link}" style="background:#8a2030;color:#ffffff;padding:12px 24px;text-decoration:none;display:inline-block">Choose a new password</a></p>
<p>The link expires in ${ttlMinutes} minutes and works once.</p>`),
  };
}
