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

// ─── New website message → the business inbox ────────────────────────────────
// Unlike the emails above, this one carries what a visitor typed, so every value is escaped
// for the HTML and line breaks are taken out of the subject.

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const oneLine = (s: string, max = 120): string => s.replace(/[\r\n]+/g, " ").trim().slice(0, max);

export type NewMessageNotice = {
  kind: "enquiry" | "callback" | "contact";
  name: string; email?: string; phone?: string; subject: string; body: string;
  /** "#NBS004" when it is about a property. */
  nbId?: string; propertyUrl?: string;
  /** The signed-in account that sent it. */
  accountEmail?: string;
  inboxUrl: string;
};

const KIND_LABEL: Record<NewMessageNotice["kind"], string> = { enquiry: "Property enquiry", callback: "Callback request", contact: "Contact message" };

/** "New property enquiry: …" to the business address; Reply goes to the visitor. */
export function newMessageEmail(to: string[], m: NewMessageNotice): OutgoingEmail {
  const label = KIND_LABEL[m.kind];
  const about = m.nbId ? ` ${m.nbId}` : "";
  const subject = oneLine(`${label}${about}: ${m.kind === "callback" ? `${m.name}, ${m.subject.replace(/^Please call:\s*/, "")}` : `${m.subject} (${m.name})`}`);
  const rows: [string, string | undefined][] = [
    ["From", m.name], ["Phone", m.phone], ["Email", m.email], ["Signed-in account", m.accountEmail !== m.email ? m.accountEmail : undefined],
    ["About", m.nbId ? `${m.nbId}${m.propertyUrl ? ` (${m.propertyUrl})` : ""}` : undefined], ["Subject", m.subject],
  ];
  const shown = rows.filter((r): r is [string, string] => !!r[1]);
  const text = `${label} from the website.\n\n${shown.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${m.body}\n\nOpen it in Admin → Messages: ${m.inboxUrl}\n${m.email ? "Reply to this email to answer the visitor." : "No email address given: call or WhatsApp the number above."}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1611">
<h2 style="color:#8a2030;font-weight:normal;margin:0 0 4px">Nepal Bhoomi</h2>
<p style="margin:0 0 20px;color:#7a7060;font-size:13px;letter-spacing:1px;text-transform:uppercase">${esc(label)} from the website</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">${shown.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#7a7060;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${k === "Phone" ? `<a href="tel:${esc(v.replace(/[^\d+]/g, ""))}" style="color:#8a2030">${esc(v)}</a>` : k === "Email" ? `<a href="mailto:${esc(v)}" style="color:#8a2030">${esc(v)}</a>` : esc(v)}</td></tr>`).join("")}</table>
<div style="margin:20px 0;padding:16px;background:#f7f3ed;border-left:3px solid #b08848;white-space:pre-line;font-size:15px;line-height:1.6">${esc(m.body)}</div>
<p style="margin:24px 0"><a href="${esc(m.inboxUrl)}" style="background:#8a2030;color:#ffffff;padding:12px 22px;text-decoration:none;display:inline-block">Open in Admin → Messages</a></p>
<p style="color:#7a7060;font-size:12px">${m.email ? "Reply to this email to answer the visitor directly." : "No email address given: call or WhatsApp the number above."} Sent automatically by the website for every new message.</p>
</div>`;
  return { to, subject, text, html, ...(m.email ? { replyTo: m.email } : {}) };
}
