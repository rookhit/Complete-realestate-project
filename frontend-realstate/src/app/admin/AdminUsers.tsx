import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ApiError, UNVERIFIED_ACCOUNT_DAYS, authFetch, useAuth } from "@/app/auth";
import { BG_LIGHT, BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { Button, Select } from "@/app/components/ui/form-controls";
import { ListPagination, paginate } from "@/app/components/ui/list-pagination";
import { AdminLayout, type AdminNav } from "./AdminLayout";
import { EmptyState, SearchBox } from "./parts";

/**
 * A registered account, as GET /api/v1/admin/users returns it today.
 * `lastLoginAt` is stored on User but not selected by that endpoint yet; the
 * column shows "—" until the backend adds it to USER_SELECT (FRONTEND_CLAUDE.md §12).
 */
type AdminUserRow = {
  id: string; email: string; name: string | null; phone: string; role: "USER" | "ADMIN";
  emailVerifiedAt: string | null; createdAt: string; lastLoginAt?: string | null;
};

type Filter = "all" | "members" | "admins" | "unverified";
const PER_PAGE = 10;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const initials = (u: AdminUserRow) => (u.name || u.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join("");

/** Everyone who has registered, from the live API. The only admin screen with real data today. */
export function AdminUsers({ nav }: { nav: AdminNav }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setErr(""); setUsers(null);
    let cancelled = false;
    authFetch<{ users: AdminUserRow[] }>("/admin/users")
      .then(r => { if (!cancelled) setUsers(r.users); })
      .catch(e => { if (!cancelled) setErr(e instanceof ApiError ? e.message : "Could not load users."); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => (isAdmin ? load() : undefined), [isAdmin, load]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (users ?? []).filter(u =>
      (filter === "all" || (filter === "members" && u.role === "USER") || (filter === "admins" && u.role === "ADMIN") || (filter === "unverified" && !u.emailVerifiedAt)) &&
      (!s || [u.name ?? "", u.email, u.phone].some(v => v.toLowerCase().includes(s))));
  }, [users, q, filter]);

  const weekAgo = Date.now() - 7 * 864e5;
  const tiles = users ? [
    { l: "Registered users", v: users.length },
    { l: "Members", v: users.filter(u => u.role === "USER").length },
    { l: "Joined this week", v: users.filter(u => new Date(u.createdAt).getTime() >= weekAgo).length },
    { l: "Awaiting verification", v: users.filter(u => !u.emailVerifiedAt).length },
  ] : [];
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / PER_PAGE)));

  return (
    <AdminLayout nav={nav} current="admin-users" tag="Administration" title="Users" previewNote={false}
      back={{ label: "Back to Dashboard", to: "admin" }}
      intro="Everyone who has created an account, live from the database. Unverified accounts are removed automatically after a week.">
      {err ? (
        <div className="border px-6 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: BORDER_L, background: WHITE }}>
          <p className="text-[15px]" style={{ color: MAROON, ...sans }}>{err}</p>
          <Button variant="quiet" onClick={load}><RotateCcw size={14} />Try Again</Button>
        </div>
      ) : !users ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 border animate-pulse" style={{ borderColor: BORDER_L, background: WHITE }} />)}
        </div>
      ) : (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {tiles.map(t => (
            <div key={t.l} className="border px-6 py-5" style={{ borderColor: BORDER_L, background: WHITE }}>
              <p className="text-[10px] tracking-[0.28em] uppercase mb-2" style={{ color: MUTED_L, ...sans }}>{t.l}</p>
              <p className="text-3xl" style={{ color: FG_LIGHT, ...serif }}>{t.v}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <SearchBox value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by name, email or phone" />
          <div className="md:w-64">
            <Select value={filter} onChange={v => { setFilter(v as Filter); setPage(1); }} options={[
              { value: "all", label: "Everyone" }, { value: "members", label: "Members" },
              { value: "admins", label: "Admins" }, { value: "unverified", label: "Awaiting verification" },
            ]} />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No users match" text="Try a different search or filter." />
        ) : (
          <div className="border overflow-x-auto" style={{ borderColor: BORDER_L, background: WHITE }}>
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b" style={{ borderColor: BORDER_L, background: BG_LIGHT }}>
                  {["User", "Phone", "Email Status", "Role", "Joined", "Last Sign-in"].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] tracking-[0.28em] uppercase font-normal" style={{ color: MUTED_L, ...sans }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginate(rows, current, PER_PAGE).map(u => (
                  <tr key={u.id} className="border-b last:border-b-0" style={{ borderColor: BORDER_L }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[12px]" style={{ border: `1px solid ${GOLD}`, color: GOLD, ...sans }}>{initials(u)}</span>
                        <div className="min-w-0">
                          <p className="text-[14px] truncate" style={{ color: FG_LIGHT, ...sans }}>{u.name || "—"}</p>
                          <p className="text-[12px] truncate" style={{ color: MUTED_L, ...sans }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[14px] whitespace-nowrap" style={{ color: MUTED_L, ...sans }}>{u.phone || "—"}</td>
                    <td className="px-5 py-4 text-[13px] whitespace-nowrap" style={{ color: u.emailVerifiedAt ? MUTED_L : MAROON, ...sans }}>
                      {u.emailVerifiedAt ? "Verified" : `Pending · deleted ${fmtDate(new Date(new Date(u.createdAt).getTime() + UNVERIFIED_ACCOUNT_DAYS * 864e5).toISOString())}`}
                    </td>
                    <td className="px-5 py-4"><span className="text-[10px] tracking-[0.2em] uppercase px-2 py-1" style={{ color: u.role === "ADMIN" ? WHITE : FG_LIGHT, background: u.role === "ADMIN" ? MAROON : BG_LIGHT, ...sans }}>{u.role === "ADMIN" ? "Admin" : "Member"}</span></td>
                    <td className="px-5 py-4 text-[14px] whitespace-nowrap" style={{ color: MUTED_L, ...sans }}>{fmtDate(u.createdAt)}</td>
                    <td className="px-5 py-4 text-[14px] whitespace-nowrap" style={{ color: MUTED_L, ...sans }}>{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ListPagination page={current} total={rows.length} perPage={PER_PAGE} onPage={setPage} noun="users" />
      </>)}
    </AdminLayout>
  );
}
