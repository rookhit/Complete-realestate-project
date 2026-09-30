// The admin's inbox: every form a visitor sends from the website, plus emails to the
// business address. Shown in Admin → Messages, newest first, with an unread count.
//
// For the backend (FRONTEND_CLAUDE.md §7.9):
//   POST   /api/v1/enquiries | /callbacks | /contact               public, each creates a message
//   GET    /api/v1/admin/messages?kind&unread&q&page              ADMIN
//   PATCH  /api/v1/admin/messages/:id  { read }                   ADMIN
//   DELETE /api/v1/admin/messages/:id                             ADMIN (soft delete, for Undo)
//   GET    /api/v1/admin/messages/unread-count                    ADMIN, polled for the badge
// Emails arrive through the mailbox (Gmail API or IMAP polling) and are stored as kind "email".
// Until then the site's forms add to this array, so the inbox works within one visit.
import { emitChange } from "./store";

// Free listings have their own page (data/listings.ts, Admin → Free Listings).
export type MessageKind = "enquiry" | "callback" | "contact" | "email";

export const MESSAGE_KINDS: Record<MessageKind, string> = {
  enquiry: "Property Enquiry", callback: "Callback Request", contact: "Contact Form", email: "Email",
};

export interface Message {
  id: number;
  kind: MessageKind;
  name: string;
  email?: string;
  phone?: string;
  subject: string;
  body: string;          // line breaks kept
  propertyId?: number;   // property enquiries
  propRef?: string;      // "NBS004", so the admin can quote it back
  receivedAt: string;    // ISO 8601
  read: boolean;
  replied?: boolean;     // set when the admin opens a reply
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const MESSAGES: Message[] = [
  { id: 8, kind: "enquiry", name: "Anita Gurung", email: "anita.gurung@example.com", phone: "9841234567", propertyId: 4, propRef: "NBS004",
    subject: "Godavari Forest Estate", body: "Hello, is the land still available? We would like to visit this Saturday if possible. Is the road access usable in the monsoon?", receivedAt: ago(18), read: false },
  { id: 7, kind: "callback", name: "Bikash Shrestha", phone: "9803456789",
    subject: "Please call: Evening (4pm-6pm)", body: "Requested a call back: Evening (4pm-6pm).", receivedAt: ago(95), read: false },
  { id: 6, kind: "email", name: "Ramesh Adhikari", email: "ramesh.adhikari@example.com",
    subject: "Selling my house in Bhaktapur", body: "Namaste,\n\nI have a 4-bedroom house in Bhaktapur (6 aana, built 2016) and I am thinking of selling. Could someone from your team come for a valuation next week?\n\nThank you,\nRamesh", receivedAt: ago(240), read: false },
  { id: 5, kind: "contact", name: "Sarah Mitchell", email: "sarah.m@example.com", phone: "+44 7700 900123",
    subject: "Buying as an NRN", body: "I'm a Non-Resident Nepali living in the UK. What documents do I need to buy an apartment in Kathmandu, and can the process be done remotely?", receivedAt: ago(60 * 26), read: true, replied: true },
  { id: 3, kind: "enquiry", name: "Deepak Rai", email: "deepak.rai@example.com", propertyId: 7, propRef: "NBL007",
    subject: "Jhamsikhel Luxury Flat", body: "Is the flat pet-friendly? I have a small dog. Also, is parking included in the rent?", receivedAt: ago(60 * 50), read: true },
  { id: 2, kind: "email", name: "Kathmandu Post Property Desk", email: "property@example.com",
    subject: "Interview request: valley land prices", body: "Dear Nepal Bhoomi team,\n\nWe are preparing a feature on land prices in the Kathmandu Valley and would welcome a short comment from your founder.\n\nBest regards", receivedAt: ago(60 * 75), read: true },
  { id: 1, kind: "callback", name: "Sunita Karki", phone: "9812345670",
    subject: "Please call: Morning (9am-12pm)", body: "Requested a call back: Morning (9am-12pm).", receivedAt: ago(60 * 100), read: true, replied: true },
];

export const unreadCount = () => MESSAGES.filter(m => !m.read).length;

/** A new message from one of the site's forms. API: the form's own POST endpoint. */
export function addMessage(m: Omit<Message, "id" | "receivedAt" | "read">): void {
  const id = MESSAGES.reduce((n, x) => Math.max(n, x.id), 0) + 1;
  MESSAGES.unshift({ ...m, id, receivedAt: new Date().toISOString(), read: false });
  emitChange();
}

/** API: PATCH /admin/messages/:id. */
export function updateMessage(id: number, patch: Partial<Pick<Message, "read" | "replied">>): void {
  const m = MESSAGES.find(x => x.id === id);
  if (!m || Object.entries(patch).every(([k, v]) => m[k as keyof Message] === v)) return;
  Object.assign(m, patch);
  emitChange();
}

/** API: DELETE /admin/messages/:id. Returns where it was, for Undo. */
export function deleteMessage(id: number): number {
  const i = MESSAGES.findIndex(m => m.id === id);
  if (i >= 0) { MESSAGES.splice(i, 1); emitChange(); }
  return i;
}

export function restoreMessage(m: Message, index: number): void {
  if (MESSAGES.some(x => x.id === m.id)) return;
  MESSAGES.splice(Math.min(Math.max(index, 0), MESSAGES.length), 0, m);
  emitChange();
}

/** "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
  if (min < 60 * 24 * 7) { const d = Math.round(min / 1440); return `${d} day${d === 1 ? "" : "s"} ago`; }
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
