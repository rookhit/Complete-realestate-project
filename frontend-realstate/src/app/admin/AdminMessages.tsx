import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, Inbox, Mail, MailOpen, MessageCircle, Phone, Reply, Trash2 } from "lucide-react";
import {
  MESSAGES, MESSAGE_KINDS, deleteMessage, restoreMessage, timeAgo, unreadCount, updateMessage,
  type Message, type MessageKind,
} from "@/app/data/messages";
import { CONTACT } from "@/app/data/content";
import { displayRef } from "@/app/data/properties";
import { useDataVersion } from "@/app/data/store";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { ListPagination, paginate } from "@/app/components/ui/list-pagination";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { ApiError } from "@/app/auth";
import { AdminLayout, type AdminNav } from "./AdminLayout";
import { Chip, EmptyState, SearchBox, useToast } from "./parts";

const PER_PAGE = 10;
type Filter = "all" | "unread" | MessageKind;

/** A reply in the admin's own email program, with the original message quoted. */
function replyLink(m: Message): string {
  const subject = m.subject.startsWith("Re:") ? m.subject : `Re: ${m.nbId ? `${displayRef(m.nbId)} ` : ""}${m.subject}`;
  const quoted = m.body.split("\n").map(l => `> ${l}`).join("\n");
  const body = `Dear ${m.name.split(" ")[0]},\n\n\n\nKind regards,\nNepal Bhoomi\n${CONTACT.phone}\n\nOn ${new Date(m.receivedAt).toLocaleString("en-GB")}, ${m.name} wrote:\n${quoted}`;
  return `mailto:${encodeURIComponent(m.email ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const waLink = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `977${digits}` : digits}`;   // 98XXXXXXXX → +977
};

/**
 * Admin → Messages: everything visitors send from the website (property enquiries,
 * callback requests, the contact form, free listings) and emails to the business address.
 * Opening a message marks it read; the red count in the tabs is what is still unread.
 */
export function AdminMessages({ nav }: { nav: AdminNav }) {
  useDataVersion();
  const [toast, notify] = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Message | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return MESSAGES.filter(m =>
      (filter === "all" || (filter === "unread" ? !m.read : m.kind === filter)) &&
      (!s || [m.name, m.email ?? "", m.phone ?? "", m.subject, m.body, m.nbId ?? ""].some(v => v.toLowerCase().includes(s))));
  }, [filter, q, MESSAGES.length, unreadCount()]);
  const shown = paginate(list, page, PER_PAGE);
  const open = MESSAGES.find(m => m.id === openId) ?? null;

  const reader = useRef<HTMLDivElement>(null);
  const select = (m: Message) => {
    setOpenId(m.id); updateMessage(m.id, { read: true });
    if (window.innerWidth < 1024) requestAnimationFrame(() => reader.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const failed = (err: unknown) => notify(err instanceof ApiError ? err.message : "Could not save. Please try again.");
  const remove = (m: Message) => {
    setToDelete(null);
    deleteMessage(m.id).then(index => {
      setOpenId(null);
      notify(`Message from ${m.name} deleted`, { label: "Undo", run: () => { restoreMessage(m, index).catch(failed); } });
    }, failed);
  };

  const counts = (f: Filter) => MESSAGES.filter(m => f === "all" || (f === "unread" ? !m.read : m.kind === f)).length;
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" }, { key: "unread", label: "Unread" },
    ...(Object.keys(MESSAGE_KINDS) as MessageKind[]).map(k => ({ key: k as Filter, label: MESSAGE_KINDS[k] })),
  ];

  return (
    <AdminLayout nav={nav} current="admin-messages" tag="Administration" title="Messages"
      intro={<>Website enquiries and emails to <span style={{ color: FG_LIGHT }}>{CONTACT.email}</span>, newest first.</>}>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mb-5">
        {filters.map(f => {
          const on = filter === f.key, n = counts(f.key);
          return (
            <button key={f.key} type="button" onClick={() => { setFilter(f.key); setPage(1); }} aria-pressed={on}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 border text-[12px] tracking-[0.08em] transition-colors hover:border-[#8a2030]"
              style={{ borderColor: on ? FG_LIGHT : BORDER_L, background: on ? FG_LIGHT : WHITE, color: on ? WHITE : FG_LIGHT, ...sans }}>
              {f.label}
              <span className="min-w-5 h-5 px-1.5 rounded-full inline-flex items-center justify-center text-[10px] tabular-nums"
                style={f.key === "unread" && n > 0 ? { background: "#d93636", color: WHITE } : { background: on ? "rgba(255,255,255,0.18)" : "rgba(26,22,17,0.06)", color: on ? WHITE : MUTED_L }}>{n}</span>
            </button>
          );
        })}
      </div>
      <div className="mb-6 max-w-xl"><SearchBox value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by name, email, phone, NB ID or text" /></div>

      {MESSAGES.length === 0 ? (
        <EmptyState title="No messages yet" text="Enquiries from the website and emails will appear here." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] border" style={{ borderColor: BORDER_L, background: WHITE }}>
          {/* List (hidden on phones while a message is open) */}
          <div className={`${open ? "hidden lg:flex" : "flex"} flex-col lg:border-r`} style={{ borderColor: BORDER_L }}>
            {list.length === 0 ? (
              <p className="px-6 py-14 text-center text-[14px]" style={{ color: MUTED_L, ...sans }}>No messages match.</p>
            ) : shown.map(m => {
              const on = m.id === openId;
              return (
                <button key={m.id} type="button" onClick={() => select(m)}
                  className="relative text-left px-5 py-4 border-b transition-colors hover:bg-[#faf7f2]"
                  style={{ borderColor: BORDER_L, background: on ? "rgba(176,136,72,0.1)" : undefined }}>
                  {on && <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: GOLD }} />}
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.read ? "transparent" : "#d93636" }} aria-label={m.read ? undefined : "Unread"} />
                    <span className="flex-1 min-w-0 truncate text-[15px]" style={{ color: FG_LIGHT, ...sans, fontWeight: m.read ? 400 : 600 }}>{m.name}</span>
                    <span className="shrink-0 text-[11px]" style={{ color: MUTED_L, ...sans }}>{timeAgo(m.receivedAt)}</span>
                  </div>
                  <div className="pl-[18px] mt-1 flex items-center gap-2 min-w-0">
                    <span className="shrink-0 text-[10px] tracking-[0.14em] uppercase" style={{ color: m.kind === "email" ? MAROON : GOLD, ...sans }}>{MESSAGE_KINDS[m.kind]}</span>
                    <span className="truncate text-[13px]" style={{ color: FG_LIGHT, ...sans, fontWeight: m.read ? 400 : 500 }}>{m.subject}</span>
                  </div>
                  <p className="pl-[18px] mt-1 text-[12px] truncate" style={{ color: MUTED_L, ...sans }}>{m.body.replace(/\s+/g, " ")}</p>
                </button>
              );
            })}
            {list.length > PER_PAGE && <div className="px-5 py-4"><ListPagination page={page} total={list.length} perPage={PER_PAGE} onPage={setPage} noun="messages" /></div>}
          </div>

          {/* The open message */}
          <div ref={reader} className={`${open ? "flex" : "hidden lg:flex"} flex-col min-w-0 scroll-mt-40`}>
            {!open ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24 px-6 text-center">
                <Inbox size={28} style={{ color: GOLD }} />
                <p className="text-[18px]" style={{ color: FG_LIGHT, ...serif }}>Choose a message to read</p>
                <p className="text-[13px]" style={{ color: MUTED_L, ...sans }}>{unreadCount() ? `${unreadCount()} unread` : "You’re all caught up."}</p>
              </div>
            ) : (
              <article className="flex flex-col">
                <div className="px-6 md:px-8 pt-6 pb-5 border-b" style={{ borderColor: BORDER_L }}>
                  <button type="button" onClick={() => setOpenId(null)} className="lg:hidden inline-flex items-center gap-2 mb-5 text-[11px] tracking-[0.2em] uppercase" style={{ color: MUTED_L, ...sans }}>
                    <ArrowLeft size={14} />All messages
                  </button>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Chip tone={open.kind === "email" ? "maroon" : "gold"}>{MESSAGE_KINDS[open.kind]}</Chip>
                    {open.replied && <Chip tone="muted">Replied</Chip>}
                    <span className="ml-auto text-[12px]" style={{ color: MUTED_L, ...sans }}>{new Date(open.receivedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                  <h2 className="text-[26px] leading-tight" style={{ color: FG_LIGHT, ...serif }}>{open.subject}</h2>
                  <p className="mt-3 text-[15px]" style={{ color: FG_LIGHT, ...sans }}>{open.name}</p>
                  {open.account && (
                    <p className="mt-0.5 text-[12px]" style={{ color: MUTED_L, ...sans }}>
                      Signed-in account: {open.account.name ? `${open.account.name} · ` : ""}<a href={`mailto:${open.account.email}`} className="hover:text-[#8a2030]">{open.account.email}</a>
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px]" style={{ color: MUTED_L, ...sans }}>
                    {open.email && <a href={`mailto:${open.email}`} className="hover:text-[#8a2030]">{open.email}</a>}
                    {open.phone && <a href={telLink(open.phone)} className="hover:text-[#8a2030]">{open.phone}</a>}
                  </div>
                  {open.propertyId && (
                    <button type="button" onClick={() => nav.openProperty(open.propertyId!)}
                      className="mt-4 inline-flex items-center gap-2 px-3 py-2 border text-[12px] transition-colors hover:border-[#8a2030]" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>
                      <Building2 size={14} style={{ color: GOLD }} />About {open.nbId ? displayRef(open.nbId) : "a property"}: view on site
                    </button>
                  )}
                </div>

                <p className="px-6 md:px-8 py-7 text-[15px] leading-[1.8] whitespace-pre-line" style={{ color: FG_LIGHT, ...sans }}>{open.body}</p>

                <div className="px-6 md:px-8 py-5 border-t flex flex-wrap items-center gap-2.5" style={{ borderColor: BORDER_L, background: "#faf7f2" }}>
                  {open.email && (
                    <a href={replyLink(open)} onClick={() => updateMessage(open.id, { replied: true })}
                      className="inline-flex items-center gap-2 px-5 py-3 text-[11px] tracking-[0.2em] uppercase transition-all hover:brightness-110" style={{ background: MAROON, color: WHITE, ...sans }}>
                      <Reply size={14} />Reply by Email<Mail size={14} className="opacity-70" />
                    </a>
                  )}
                  {open.phone && <>
                    <a href={telLink(open.phone)} onClick={() => updateMessage(open.id, { replied: true })}
                      className="inline-flex items-center gap-2 px-4 py-3 border text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-[#8a2030]" style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }}>
                      <Phone size={14} />Call
                    </a>
                    <a href={waLink(open.phone)} target="_blank" rel="noopener noreferrer" onClick={() => updateMessage(open.id, { replied: true })}
                      className="inline-flex items-center gap-2 px-4 py-3 border text-[11px] tracking-[0.2em] uppercase transition-colors" style={{ borderColor: "rgba(37,211,102,0.6)", background: WHITE, color: "#1f9e4d", ...sans }}>
                      <MessageCircle size={14} />WhatsApp
                    </a>
                  </>}
                  <div className="ml-auto flex gap-2">
                    <button type="button" onClick={() => { updateMessage(open.id, { read: false }); setOpenId(null); }} title="Mark as unread" aria-label="Mark as unread"
                      className="w-11 h-11 flex items-center justify-center border transition-colors hover:border-[#8a2030]" style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT }}><MailOpen size={16} /></button>
                    <button type="button" onClick={() => setToDelete(open)} title="Delete" aria-label="Delete message"
                      className="w-11 h-11 flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030]" style={{ borderColor: BORDER_L, background: WHITE, color: MUTED_L }}><Trash2 size={16} /></button>
                  </div>
                </div>
              </article>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog open={!!toDelete} title="Delete this message?"
        message={toDelete ? `The message from ${toDelete.name} will be removed. You can undo this for a few seconds afterwards.` : ""}
        confirmLabel="Delete" onCancel={() => setToDelete(null)} onConfirm={() => toDelete && remove(toDelete)} />
      {toast}
    </AdminLayout>
  );
}
