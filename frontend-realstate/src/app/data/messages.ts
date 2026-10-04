// The admin's inbox: what signed-in visitors send from the website forms (property enquiries,
// callback requests, the contact form), plus emails to the business address later. Shown in
// Admin → Messages, newest first, with an unread count.
//
// Stored in the database (backend-realstate/lib/content/messages.ts, src/api/messages.ts). The
// forms post straight to the API; this file is the admin's copy of the inbox: loadMessages()
// fills it (and is polled while an admin is signed in), and the changes below go to the API first.
import { deleteMessageOnServer, fetchAllMessages, patchMessage, restoreMessageOnServer } from "@/api/messages";
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
  nbId?: string;      // "NBS004", so the admin can quote it back
  receivedAt: string;    // ISO 8601
  read: boolean;
  replied?: boolean;     // set when the admin opens a reply
  /** The signed-in account that sent it (the forms require sign-in); null for emails. */
  account?: { name: string | null; email: string } | null;
}

/** The inbox, newest first. Empty until an admin signs in. */
export const MESSAGES: Message[] = [];
let loadRun = 0;
/** Messages with a change on its way: a refresh that started before it finished must not undo it. */
const saving = new Map<number, number>();

/** Fill MESSAGES from the API (admin only). A failure keeps what is there. */
export async function loadMessages(): Promise<void> {
  const run = ++loadRun;
  try {
    const list = await fetchAllMessages();
    if (run !== loadRun) return;
    // Keep this screen's version of any message that is still being saved.
    MESSAGES.splice(0, MESSAGES.length, ...list.map(m => (saving.has(m.id) ? MESSAGES.find(x => x.id === m.id) ?? m : m)));
    emitChange();
  } catch { /* offline or signed out: try again on the next poll */ }
}

/** Signed out: forget the admin's inbox. */
export function clearMessages(): void {
  loadRun++;
  if (MESSAGES.length) { MESSAGES.splice(0); emitChange(); }
}

export const unreadCount = () => MESSAGES.filter(m => !m.read).length;

/** Mark read / unread / replied. Shown at once; put back if the server refuses. */
export function updateMessage(id: number, patch: Partial<Pick<Message, "read" | "replied">>): void {
  const m = MESSAGES.find(x => x.id === id);
  if (!m || Object.entries(patch).every(([k, v]) => m[k as keyof Message] === v)) return;
  const before = { read: m.read, replied: m.replied };
  Object.assign(m, patch);
  emitChange();
  saving.set(id, (saving.get(id) ?? 0) + 1);
  patchMessage(id, patch)
    .catch(() => { const c = MESSAGES.find(x => x.id === id); if (c) Object.assign(c, before); emitChange(); })
    .finally(() => { const n = (saving.get(id) ?? 1) - 1; if (n > 0) saving.set(id, n); else saving.delete(id); });
}

/** Delete on the server, then here. Resolves to where it was, for Undo. */
export async function deleteMessage(id: number): Promise<number> {
  await deleteMessageOnServer(id);
  const i = MESSAGES.findIndex(m => m.id === id);
  if (i >= 0) { MESSAGES.splice(i, 1); emitChange(); }
  return i;
}

/** Undo a delete (the server keeps it for a minute). */
export async function restoreMessage(m: Message, index: number): Promise<void> {
  const { data } = await restoreMessageOnServer(m.id);
  if (MESSAGES.some(x => x.id === m.id)) return;
  MESSAGES.splice(Math.min(Math.max(index, 0), MESSAGES.length), 0, data);
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
