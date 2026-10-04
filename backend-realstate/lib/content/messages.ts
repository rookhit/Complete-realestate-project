import { Prisma, type MessageKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { formatNbId, parseNbId } from "@/lib/content/nb-id";
import type { CallbackInput, ContactInput, EnquiryInput, MessagePatch, MessageQuery } from "@/lib/validation/message";

// Admin → Messages: what signed-in visitors send from the website forms (property enquiries,
// callback requests, the contact form), stored in Message with the account that sent it.

const INCLUDE = {
  property: { select: { listing: true, nbNumber: true } },
  user: { select: { name: true, email: true } },
} satisfies Prisma.MessageInclude;
type MessageRow = Prisma.MessageGetPayload<{ include: typeof INCLUDE }>;

const KIND_OUT: Record<MessageKind, MessageOut["kind"]> = { ENQUIRY: "enquiry", CALLBACK: "callback", CONTACT: "contact", EMAIL: "email" };
const KIND_IN: Record<MessageOut["kind"], MessageKind> = { enquiry: "ENQUIRY", callback: "CALLBACK", contact: "CONTACT", email: "EMAIL" };

/** The frontend's Message shape (data/messages.ts), plus the account that sent it. */
export type MessageOut = {
  id: number; kind: "enquiry" | "callback" | "contact" | "email";
  name: string; email?: string; phone?: string; subject: string; body: string;
  propertyId?: number; nbId?: string;
  receivedAt: string; read: boolean; replied: boolean;
  account: { name: string | null; email: string } | null;
};

export function toMessage(m: MessageRow): MessageOut {
  return {
    id: m.id, kind: KIND_OUT[m.kind], name: m.name,
    ...(m.email ? { email: m.email } : {}), ...(m.phone ? { phone: m.phone } : {}),
    subject: m.subject, body: m.body,
    ...(m.propertyId ? { propertyId: m.propertyId } : {}),
    ...(m.property ? { nbId: formatNbId(m.property.listing, m.property.nbNumber) } : {}),
    receivedAt: m.receivedAt.toISOString(), read: m.read, replied: m.replied,
    account: m.user ? { name: m.user.name, email: m.user.email } : null,
  };
}

// ─── Sending (signed-in visitors) ───────────────────────────────────────────────

/** "Enquire About This Property": the subject is the property's title; its NB ID comes from the property. */
export async function createEnquiry(userId: string, v: EnquiryInput): Promise<MessageOut> {
  const property = await prisma.property.findFirst({ where: { id: v.propertyId, deletedAt: null }, select: { title: true, listing: true, nbNumber: true } });
  if (!property) throw new HttpError(404, "NOT_FOUND", "This property is no longer listed");
  const row = await prisma.message.create({
    data: {
      kind: "ENQUIRY", userId, propertyId: v.propertyId, name: v.name, email: v.email, phone: v.phone,
      subject: property.title, body: v.message || `Interested in #${formatNbId(property.listing, property.nbNumber)}.`,
    },
    include: INCLUDE,
  });
  return toMessage(row);
}

export async function createCallback(userId: string, v: CallbackInput): Promise<MessageOut> {
  const row = await prisma.message.create({
    data: { kind: "CALLBACK", userId, name: v.name, phone: v.phone, subject: `Please call: ${v.time}`, body: `Requested a call back: ${v.time}.` },
    include: INCLUDE,
  });
  return toMessage(row);
}

export async function createContact(userId: string, v: ContactInput): Promise<MessageOut> {
  const row = await prisma.message.create({
    data: { kind: "CONTACT", userId, name: v.name, email: v.email, phone: v.phone, subject: v.topic, body: v.message || "(No message)" },
    include: INCLUDE,
  });
  return toMessage(row);
}

// ─── Admin ──────────────────────────────────────────────────────────────────────

/**
 * How long a deleted message can still be restored (the admin's Undo is shown for 7 s). After
 * that it is removed from the database for good.
 */
export const MESSAGE_UNDO_WINDOW_MS = 60_000;

export async function purgeDeletedMessages(): Promise<number> {
  const done = await prisma.message.deleteMany({ where: { deletedAt: { lt: new Date(Date.now() - MESSAGE_UNDO_WINDOW_MS) } } });
  return done.count;
}

export type Page<T> = { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number; unread: number } };

/** Newest first. `kind`, `unread` and `q` (name, email, phone, subject, text, or a full NB ID) narrow it. */
export async function listMessages(q: MessageQuery): Promise<Page<MessageOut>> {
  await purgeDeletedMessages();
  const and: Prisma.MessageWhereInput[] = [{ deletedAt: null }];
  if (q.kind) and.push({ kind: KIND_IN[q.kind] });
  if (q.unread) and.push({ read: false });
  if (q.q) {
    const contains = { contains: q.q, mode: "insensitive" as const };
    const nb = parseNbId(q.q);
    and.push({ OR: [
      { name: contains }, { email: contains }, { phone: contains }, { subject: contains }, { body: contains },
      ...(nb ? [{ property: { listing: nb.listing, nbNumber: nb.nbNumber } }] : []),
    ] });
  }
  const where = { AND: and };
  const [total, unread, rows] = await prisma.$transaction([
    prisma.message.count({ where }),
    prisma.message.count({ where: { deletedAt: null, read: false } }),
    prisma.message.findMany({ where, include: INCLUDE, orderBy: [{ receivedAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.limit, take: q.limit }),
  ]);
  return { data: rows.map(toMessage), meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)), unread } };
}

/** For the red badge, polled by the admin. */
export async function unreadMessageCount(): Promise<number> {
  return prisma.message.count({ where: { deletedAt: null, read: false } });
}

export async function updateMessage(id: number, patch: MessagePatch): Promise<MessageOut> {
  const done = await prisma.message.updateMany({ where: { id, deletedAt: null }, data: patch });
  if (done.count === 0) throw new HttpError(404, "NOT_FOUND", "Message not found");
  return toMessage(await prisma.message.findUniqueOrThrow({ where: { id }, include: INCLUDE }));
}

/** Hidden at once; restorable for MESSAGE_UNDO_WINDOW_MS (Undo), then deleted for good. */
export async function deleteMessage(id: number): Promise<void> {
  const done = await prisma.message.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (done.count === 0) throw new HttpError(404, "NOT_FOUND", "Message not found");
  await purgeDeletedMessages();
  setTimeout(() => { purgeDeletedMessages().catch((e) => console.error("Purging deleted messages failed", e)); }, MESSAGE_UNDO_WINDOW_MS + 1000).unref?.();
}

/** The admin's Undo after a delete. */
export async function restoreMessage(id: number): Promise<MessageOut> {
  const row = await prisma.message.findUnique({ where: { id } });
  const gone = new HttpError(404, "NOT_FOUND", "This message was deleted for good and can't be restored");
  if (!row) throw gone;
  if (!row.deletedAt) throw new HttpError(409, "CONFLICT", "This message is not deleted");
  if (row.deletedAt.getTime() < Date.now() - MESSAGE_UNDO_WINDOW_MS) { await purgeDeletedMessages(); throw gone; }
  return toMessage(await prisma.message.update({ where: { id }, data: { deletedAt: null }, include: INCLUDE }));
}
