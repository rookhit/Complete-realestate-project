// Website forms and the admin's Messages inbox (backend-realstate/app/api/v1/enquiries, callbacks,
// contact, admin/messages). The three forms are SIGNED-IN ONLY: the account comes from the token.
// Every call goes through authFetch (base URL, bearer token, refresh on 401, ApiError).
import { authFetch } from "@/app/auth";
import type { Message } from "@/app/data/messages";

type Meta = { page: number; limit: number; total: number; totalPages: number; unread: number };
type One = { data: Message };

// ─── The forms ──────────────────────────────────────────────────────────────────

/** "Enquire About This Property". An email or a phone is required. */
export const sendEnquiry = (input: { propertyId: number; name: string; email: string; phone: string; message: string }): Promise<One> =>
  authFetch("/enquiries", { method: "POST", body: JSON.stringify(input) });

/** "Request a Callback". */
export const sendCallback = (input: { name: string; phone: string; time: string }): Promise<One> =>
  authFetch("/callbacks", { method: "POST", body: JSON.stringify(input) });

/** The Contact Us page. */
export const sendContact = (input: { name: string; email: string; phone: string; topic: string; message: string }): Promise<One> =>
  authFetch("/contact", { method: "POST", body: JSON.stringify(input) });

// ─── Admin ──────────────────────────────────────────────────────────────────────

/** Every live message, newest first (200 a page). */
export async function fetchAllMessages(): Promise<Message[]> {
  const all: Message[] = [];
  for (let page = 1; ; page++) {
    const res = await authFetch<{ data: Message[]; meta: Meta }>(`/admin/messages?limit=200&page=${page}`);
    all.push(...res.data);
    if (page >= res.meta.totalPages) return all;
  }
}

export const patchMessage = (id: number, patch: { read?: boolean; replied?: boolean }): Promise<One> =>
  authFetch(`/admin/messages/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteMessageOnServer = (id: number): Promise<void> =>
  authFetch(`/admin/messages/${id}`, { method: "DELETE" });

export const restoreMessageOnServer = (id: number): Promise<One> =>
  authFetch(`/admin/messages/${id}/restore`, { method: "POST", body: "{}" });
