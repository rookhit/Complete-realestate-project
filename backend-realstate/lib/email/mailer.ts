import nodemailer, { type Transporter } from "nodemailer";

// Sends mail from a Gmail account over SMTP, authenticated with a Google App Password
// (GMAIL_USER + GMAIL_APP_PASSWORD; a normal Gmail password does not work). Read lazily, so the
// rest of the API starts without them. In development, when they're missing, the message is
// printed to the server console instead so the flows can still be tested locally. In
// production a missing configuration is an error: codes and reset links must never be logged.

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set to send email");
    }
    return null;
  }
  // App Passwords are shown by Google with spaces ("abcd efgh ijkl mnop"); SMTP wants them without.
  transporter ??= nodemailer.createTransport({ service: "gmail", auth: { user, pass: pass.replace(/\s+/g, "") } });
  return transporter;
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[email not sent: GMAIL_USER/GMAIL_APP_PASSWORD unset] To: ${email.to}\nSubject: ${email.subject}\n${email.text}`);
    return;
  }
  const fromName = process.env.EMAIL_FROM_NAME ?? "Nepal Bhoomi";
  await transport.sendMail({ from: { name: fromName, address: process.env.GMAIL_USER ?? "" }, ...email });
}
