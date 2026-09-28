import type { ReactNode } from "react";
import { ExternalLink, Info, LayoutDashboard, MessageSquare, Users } from "lucide-react";
import { useAuth } from "@/app/auth";
import { BG_LIGHT, BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { BackButton } from "@/app/components/ui/back-button";

/** The admin pages, as App.tsx names them. */
export type AdminPage = "admin" | "admin-users" | "admin-reviews";

/**
 * The navigation the admin needs from App.tsx. App's own `go` satisfies this;
 * `openProperty` shows one listing on the public site.
 */
export type AdminNav = {
  go: (page: AdminPage | "home" | "login") => void;
  openProperty: (id: number) => void;
};

const TABS: { page: AdminPage; label: string; Icon: typeof Users }[] = [
  { page: "admin", label: "Dashboard", Icon: LayoutDashboard },
  { page: "admin-users", label: "Users", Icon: Users },
  { page: "admin-reviews", label: "Reviews", Icon: MessageSquare },
];

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
      <div className="px-6 md:px-12 lg:px-20 pt-10 md:pt-12 pb-10 md:pb-12 border-b" style={{ borderColor: BORDER_L, background: WHITE }}>
        {back && <div className="mb-8"><BackButton label={back.label} onClick={() => nav.go(back.to)} /></div>}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div style={{ width: "2rem", height: "0.5px", background: GOLD }} />
              <span className="text-[10px] tracking-[0.34em] uppercase" style={{ color: GOLD, ...sans }}>{tag}</span>
            </div>
            <h1 className="leading-[0.92]" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(2.2rem,4.6vw,3.8rem)" }}>{title}</h1>
            <div className="text-[15px] mt-4 max-w-2xl leading-relaxed" style={{ color: MUTED_L, ...sans }}>{intro}</div>
          </div>
          <button onClick={() => nav.go("home")} className="self-start lg:self-auto shrink-0 inline-flex items-center gap-2 px-5 py-3 border text-[11px] tracking-[0.22em] uppercase transition-colors hover:border-[#8a2030]"
            style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>
            <ExternalLink size={14} />View Website
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-20 z-30 border-b" style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(14px)", borderColor: BORDER_L }}>
        <nav aria-label="Admin sections" className="px-6 md:px-12 lg:px-20 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(({ page, label, Icon }) => {
            const on = page === current;
            return (
              <button key={page} onClick={() => nav.go(page)} aria-current={on ? "page" : undefined}
                className="relative flex items-center gap-2 px-4 py-4 text-[11px] tracking-[0.22em] uppercase whitespace-nowrap transition-colors hover:text-[#8a2030]"
                style={{ color: on ? FG_LIGHT : MUTED_L, ...sans }}>
                <Icon size={15} style={{ color: on ? GOLD : undefined }} />{label}
                <span className="absolute left-3 right-3 bottom-0 h-[2px] transition-opacity" style={{ background: GOLD, opacity: on ? 1 : 0 }} />
              </button>
            );
          })}
        </nav>
      </div>

      {previewNote && (
        <div className="px-6 md:px-12 lg:px-20 pt-8">
          <p className="flex items-start gap-3 border px-5 py-3.5 text-[13px] leading-relaxed" style={{ borderColor: "rgba(176,136,72,0.35)", background: "rgba(176,136,72,0.07)", color: FG_LIGHT, ...sans }}>
            <Info size={16} className="shrink-0 mt-0.5" style={{ color: GOLD }} />
            <span>Changes you save here appear on the website straight away and last until the page is reloaded. Permanent saving arrives with the backend.</span>
          </p>
        </div>
      )}

      <div className="px-6 md:px-12 lg:px-20 py-10 md:py-12">{children}</div>
    </div>
  );
}
