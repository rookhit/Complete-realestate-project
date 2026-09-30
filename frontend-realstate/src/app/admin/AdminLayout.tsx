import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, ClipboardList, ExternalLink, Info, LayoutDashboard, Mail, MessageSquare, Users, X } from "lucide-react";
import { useAuth } from "@/app/auth";
import { MESSAGES, MESSAGE_KINDS, unreadCount } from "@/app/data/messages";
import { LISTINGS, newListingsCount } from "@/app/data/listings";
import { useDataVersion } from "@/app/data/store";
import { BG_LIGHT, BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { BackButton } from "@/app/components/ui/back-button";

/** The admin pages, as App.tsx names them. */
export type AdminPage = "admin" | "admin-users" | "admin-reviews" | "admin-listings" | "admin-messages";

/**
 * The navigation the admin needs from App.tsx. App's own `go` satisfies this;
 * `openProperty` shows one listing on the public site.
 */
export type AdminNav = {
  go: (page: AdminPage | "home" | "login") => void;
  openProperty: (id: number) => void;
};

/** `lead` is a word shown only on wide screens ("Free" Listings), so each tab has one label. */
const TABS: { page: AdminPage; label: string; lead?: string; Icon: typeof Users }[] = [
  { page: "admin", label: "Dashboard", Icon: LayoutDashboard },
  { page: "admin-users", label: "Users", Icon: Users },
  { page: "admin-reviews", label: "Reviews", Icon: MessageSquare },
  { page: "admin-listings", label: "Listings", lead: "Free", Icon: ClipboardList },
  { page: "admin-messages", label: "Messages", Icon: Mail },
];

const NOTE_KEY = "nb-admin-note-hidden";

/** The red unread count used on the Messages tab and the site's Admin button. */
export function UnreadBadge({ n, className = "inline-flex" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={`min-w-[18px] h-[18px] px-1 rounded-full items-center justify-center text-[10px] font-semibold tabular-nums leading-none ${className}`}
      style={{ background: "#d93636", color: WHITE, letterSpacing: 0, ...sans }} aria-label={`${n} unread`}>{n > 99 ? "99+" : n}</span>
  );
}

/**
 * Pops up when a message arrives while an admin page is open. Today messages only arrive
 * from this browser's forms; with the backend, poll GET /admin/messages/unread-count.
 */
type Fresh = { kind: string; name: string; subject: string; page: AdminPage };
function NewMessageNotice({ onOpen }: { onOpen: (page: AdminPage) => void }) {
  useDataVersion();
  const seen = useRef(new Set([...MESSAGES.map(m => `m${m.id}`), ...LISTINGS.map(l => `l${l.id}`)]));
  const [fresh, setFresh] = useState<Fresh | null>(null);
  useEffect(() => {
    const m = MESSAGES.find(x => !seen.current.has(`m${x.id}`));
    const l = LISTINGS.find(x => !seen.current.has(`l${x.id}`));
    MESSAGES.forEach(x => seen.current.add(`m${x.id}`));
    LISTINGS.forEach(x => seen.current.add(`l${x.id}`));
    const incoming: Fresh | null = l ? { kind: "Free Listing", name: l.seller.name, subject: l.title, page: "admin-listings" }
      : m ? { kind: MESSAGE_KINDS[m.kind], name: m.name, subject: m.subject, page: "admin-messages" } : null;
    if (!incoming) return;
    setFresh(incoming);
    const t = window.setTimeout(() => setFresh(null), 8000);
    return () => window.clearTimeout(t);
  });
  return (
    <AnimatePresence>
      {fresh && (
        <motion.div role="status" className="fixed top-24 right-4 md:right-8 z-[90] w-[min(92vw,360px)] shadow-2xl border flex items-start gap-3 p-4"
          style={{ background: WHITE, borderColor: BORDER_L }}
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.3 }}>
          <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center" style={{ background: "rgba(217,54,54,0.1)", color: "#d93636" }}><Bell size={16} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] tracking-[0.24em] uppercase" style={{ color: "#d93636", ...sans }}>New {fresh.kind}</p>
            <p className="mt-1 text-[14px] truncate" style={{ color: FG_LIGHT, ...sans, fontWeight: 600 }}>{fresh.name}</p>
            <p className="text-[13px] truncate" style={{ color: MUTED_L, ...sans }}>{fresh.subject}</p>
            <button type="button" onClick={() => { setFresh(null); onOpen(fresh.page); }} className="mt-2 text-[11px] tracking-[0.2em] uppercase underline underline-offset-4" style={{ color: MAROON, ...sans }}>Open {fresh.page === "admin-listings" ? "Free Listings" : "Messages"}</button>
          </div>
          <button type="button" onClick={() => setFresh(null)} aria-label="Dismiss" className="p-1" style={{ color: MUTED_L }}><X size={15} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Frame shared by every admin page: the access check, the header, and the
 * Dashboard · Users · Reviews tabs. The backend enforces admin access (ADMIN role
 * + 2FA); the check here only decides what to show.
 */
export function AdminLayout({ nav, current, tag, title, intro, back, previewNote = true, children }: {
  nav: AdminNav; current: AdminPage; tag: string; title: string; intro: ReactNode;
  /** A fixed "Back to …" link above the title, for pages below the dashboard. */
  back?: { label: string; to: AdminPage | "home" };
  /** Show the note explaining that edits are held in the browser until the API exists. */
  previewNote?: boolean;
  children: ReactNode;
}) {
  const { user, status } = useAuth();
  useDataVersion();
  // The "changes last until reload" note, once dismissed on this device, stays hidden.
  const [noteHidden, setNoteHidden] = useState(() => { try { return localStorage.getItem(NOTE_KEY) === "1"; } catch { return false; } });
  // Switching tabs keeps the admin's place: App no longer jumps to the top between admin pages,
  // and if they had scrolled past this header, the tab bar stays pinned at the top with the new
  // tab starting right under it. (80px is the site's fixed header.)
  const head = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const h = head.current;
    if (!h) return;
    const pinnedAt = Math.max(0, h.getBoundingClientRect().bottom + window.scrollY - 80);
    if (window.scrollY > pinnedAt) window.scrollTo(0, pinnedAt);
  }, [current, status]);
  const hideNote = () => { setNoteHidden(true); try { localStorage.setItem(NOTE_KEY, "1"); } catch { /* storage blocked: hide for this visit only */ } };

  if (status === "loading") return (
    <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: BG_LIGHT }}>
      <p className="text-[15px]" style={{ color: MUTED_L, ...sans }}>Checking your access…</p>
    </div>
  );

  if (user?.role !== "ADMIN") return (
    <div className="min-h-screen pt-20 flex items-center justify-center" style={{ background: BG_LIGHT }}>
      <div className="text-center px-6">
        <p className="text-2xl mb-3" style={{ color: FG_LIGHT, ...serif }}>Admins only</p>
        <p className="text-[15px] mb-6" style={{ color: MUTED_L, ...sans }}>You need to be signed in as the administrator to view this page.</p>
        <button onClick={() => nav.go(user ? "home" : "login")} className="px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{ background: MAROON, color: WHITE, ...sans }}>
          {user ? "Back to Home" : "Sign In"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-20" style={{ background: BG_LIGHT }}>
      {/* Header */}
      <div ref={head} className="px-5 sm:px-6 md:px-12 lg:px-20 pt-6 sm:pt-10 md:pt-12 pb-6 sm:pb-10 md:pb-12 border-b" style={{ borderColor: BORDER_L, background: WHITE }}>
        {back && <div className="mb-5 sm:mb-8"><BackButton label={back.label} onClick={() => nav.go(back.to)} /></div>}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div style={{ width: "2rem", height: "0.5px", background: GOLD }} />
              <span className="text-[10px] tracking-[0.34em] uppercase" style={{ color: GOLD, ...sans }}>{tag}</span>
            </div>
            <h1 className="leading-[0.92]" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(2rem,4.6vw,3.8rem)" }}>{title}</h1>
            <div className="text-[14px] sm:text-[15px] mt-3 sm:mt-4 max-w-2xl leading-relaxed" style={{ color: MUTED_L, ...sans }}>{intro}</div>
          </div>
          <button onClick={() => nav.go("home")} className="hidden sm:inline-flex self-start lg:self-auto shrink-0 items-center gap-2 px-5 py-3 border text-[11px] tracking-[0.22em] uppercase transition-colors hover:border-[#8a2030]"
            style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>
            <ExternalLink size={14} />View Website
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-20 z-30 border-b" style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(14px)", borderColor: BORDER_L }}>
        {/* Up to 1024px (phones, tablets): all five tabs fit as an icon-over-label bar, so the red
            counts are always in view. Wider: one row. One label and one badge per tab. */}
        <nav aria-label="Admin sections" className="px-1 sm:px-4 md:px-12 lg:px-20 flex lg:gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(({ page, label, lead, Icon }) => {
            const on = page === current;
            const full = lead ? `${lead} ${label}` : label;
            const n = page === "admin-messages" ? unreadCount() : page === "admin-listings" ? newListingsCount() : 0;
            return (
              <button key={page} onClick={() => nav.go(page)} aria-current={on ? "page" : undefined} aria-label={n ? `${full}, ${n} new` : full}
                className="relative flex-1 lg:flex-none flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 px-1 lg:px-4 pt-2.5 pb-2 lg:py-4 text-[9.5px] sm:text-[10.5px] lg:text-[11px] tracking-[0.06em] sm:tracking-[0.12em] lg:tracking-[0.22em] uppercase whitespace-nowrap transition-colors hover:text-[#8a2030]"
                style={{ color: on ? FG_LIGHT : MUTED_L, ...sans }}>
                <Icon size={16} style={{ color: on ? GOLD : undefined }} />
                <span>{lead && <span className="hidden lg:inline">{lead} </span>}{label}</span>
                {/* Over the icon on the compact bar, after the label on the wide one. */}
                {n > 0 && <UnreadBadge n={n} className="inline-flex absolute top-1 left-1/2 ml-1.5 lg:static lg:ml-0" />}
                <span className="absolute left-3 right-3 bottom-0 h-[2px] transition-opacity" style={{ background: GOLD, opacity: on ? 1 : 0 }} />
              </button>
            );
          })}
        </nav>
      </div>

      {previewNote && !noteHidden && (
        <div className="px-4 sm:px-6 md:px-12 lg:px-20 pt-5 sm:pt-8">
          <p className="flex items-start gap-3 border px-4 sm:px-5 py-3 sm:py-3.5 text-[13px] leading-relaxed" style={{ borderColor: "rgba(176,136,72,0.35)", background: "rgba(176,136,72,0.07)", color: FG_LIGHT, ...sans }}>
            <Info size={16} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
            <span className="flex-1">Changes you save here appear on the website straight away and last until the page is reloaded. Permanent saving arrives with the backend.</span>
            <button type="button" onClick={hideNote} className="shrink-0 text-[10px] tracking-[0.2em] uppercase underline underline-offset-4 hover:text-[#8a2030]" style={{ color: MUTED_L }}>Got it</button>
          </p>
        </div>
      )}

      <div className="px-4 sm:px-6 md:px-12 lg:px-20 py-6 sm:py-10 md:py-12">{children}</div>
      <NewMessageNotice onOpen={p => nav.go(p)} />
    </div>
  );
}
