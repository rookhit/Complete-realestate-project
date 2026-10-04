import { useMemo, useState } from "react";
import { BadgeCheck, Check, CheckCircle2, Eye, Star, Trash2, X } from "lucide-react";
import { ALL_PROPS, displayRef } from "@/app/data/properties";
import { ADMIN_REVIEWS, deleteReview, pendingReviewCount, restoreReview, updateReview, type AdminReview } from "@/app/data/reviews";
import { useDataVersion } from "@/app/data/store";
import { ApiError } from "@/app/auth";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { Button, Select } from "@/app/components/ui/form-controls";
import { ListPagination, paginate } from "@/app/components/ui/list-pagination";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { StarRow } from "@/app/components/ui/star-row";
import { AdminLayout, type AdminNav } from "./AdminLayout";
import { Chip, EmptyState, SearchBox, useToast } from "./parts";

const GROUPS_PER_PAGE = 3;

const STATUS_LABEL: Record<AdminReview["status"], string> = { pending: "Waiting for approval", published: "Approved", rejected: "Rejected" };
const STATUS_ORDER: Record<AdminReview["status"], number> = { pending: 0, published: 1, rejected: 2 };

/**
 * Resident reviews, grouped under the property they were written about. New reviews wait as
 * "Waiting for approval" until the admin approves them; only approved ones show on the site.
 * The admin can also reject, mark a review "Verified Visit", or delete it (with Undo).
 * Data: ADMIN_REVIEWS (GET /api/v1/admin/reviews, refreshed every 30 s with the inbox).
 */
export function AdminReviews({ nav }: { nav: AdminNav }) {
  const version = useDataVersion();
  const [toast, notify] = useToast();
  const [q, setQ] = useState("");
  const [propFilter, setPropFilter] = useState("all");
  const [stars, setStars] = useState("all");
  const [status, setStatus] = useState<"all" | AdminReview["status"]>("all");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<AdminReview | null>(null);
  const failed = (err: unknown) => notify(err instanceof ApiError ? err.message : "Could not save. Please try again.");

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const shown = ADMIN_REVIEWS.filter(r =>
      (propFilter === "all" || String(r.propertyId) === propFilter) &&
      (status === "all" || r.status === status) &&
      (stars === "all" || (stars === "low" ? r.rating <= 3 : r.rating === Number(stars))) &&
      (!s || r.author.toLowerCase().includes(s) || r.text.toLowerCase().includes(s) || (r.account?.email ?? "").toLowerCase().includes(s)));
    // Grouped by property; within a property, waiting reviews first, then newest.
    const byProperty = new Map<number, AdminReview[]>();
    for (const r of shown) byProperty.set(r.propertyId, [...(byProperty.get(r.propertyId) ?? []), r]);
    return [...byProperty.entries()]
      .map(([id, reviews]) => ({
        id, property: ALL_PROPS.find(p => p.id === id), info: reviews[0].property,
        reviews: reviews.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.dateIso.localeCompare(a.dateIso)),
      }))
      // Reviews of a property that has since been deleted are not shown.
      .filter(g => !!g.info)
      .sort((a, b) => Number(b.reviews.some(r => r.status === "pending")) - Number(a.reviews.some(r => r.status === "pending")));
  }, [q, propFilter, stars, status, version]);

  const total = groups.reduce((n, g) => n + g.reviews.length, 0);
  const current = Math.min(page, Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE)));
  const propertyIds = [...new Set(ADMIN_REVIEWS.filter(r => r.property).map(r => r.propertyId))];
  const propertyOptions = [{ value: "all", label: "All properties" },
    ...propertyIds.map(id => { const r = ADMIN_REVIEWS.find(x => x.propertyId === id)!; return { value: String(id), label: `${r.property!.title} (${displayRef(r.property!.nbId)})` }; })];

  const act = (r: AdminReview, patch: { status?: AdminReview["status"]; verified?: boolean }, done: string) => {
    setBusy(r.id);
    updateReview(r.id, patch).then(() => notify(done), failed).finally(() => setBusy(null));
  };
  const avgOf = (id: number) => {
    const live = ADMIN_REVIEWS.filter(r => r.propertyId === id && r.status === "published");
    return { count: live.length, avg: live.length ? live.reduce((n, r) => n + r.rating, 0) / live.length : 0 };
  };
  const pending = pendingReviewCount();

  return (
    <AdminLayout nav={nav} current="admin-reviews" tag="Administration" title="Reviews"
      intro={pending ? <><span style={{ color: MAROON }}>{pending} review{pending === 1 ? "" : "s"} waiting for approval.</span> Only approved reviews show on the property pages.</> : "What visitors wrote about each property. Only approved reviews show on the site."}>
      <div className="flex flex-col lg:flex-row gap-3 mb-8">
        <SearchBox value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by reviewer, email or words in the review" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:w-[46rem]">
          <Select value={status} onChange={v => { setStatus(v as typeof status); setPage(1); }} options={[
            { value: "all", label: "Any status" }, { value: "pending", label: "Waiting for approval" }, { value: "published", label: "Approved" }, { value: "rejected", label: "Rejected" },
          ]} />
          <Select value={propFilter} onChange={v => { setPropFilter(v); setPage(1); }} options={propertyOptions} />
          <Select value={stars} onChange={v => { setStars(v); setPage(1); }} options={[
            { value: "all", label: "Any rating" }, { value: "5", label: "5 stars" }, { value: "4", label: "4 stars" }, { value: "low", label: "3 stars or fewer" },
          ]} />
        </div>
      </div>

      <p className="text-[12px] tracking-[0.16em] uppercase mb-6" style={{ color: MUTED_L, ...sans }}>
        <span style={{ color: FG_LIGHT }}>{total}</span> review{total === 1 ? "" : "s"} across <span style={{ color: FG_LIGHT }}>{groups.length}</span> propert{groups.length === 1 ? "y" : "ies"}
      </p>

      {groups.length === 0 ? (
        <EmptyState title={ADMIN_REVIEWS.length ? "No reviews match" : "No reviews yet"}
          text={ADMIN_REVIEWS.length ? "Try a different search, status, property or rating." : "When signed-in visitors review a property, their reviews wait here for your approval."} />
      ) : (
        <div className="flex flex-col gap-10">
          {paginate(groups, current, GROUPS_PER_PAGE).map(({ id, property: p, info, reviews }) => {
            const { count, avg } = avgOf(id);
            return (
              <section key={id} className="border" style={{ borderColor: BORDER_L, background: WHITE }}>
                <header className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-b" style={{ borderColor: BORDER_L }}>
                  {p?.hero && <img src={p.hero} alt="" className="w-24 h-16 object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[18px] truncate" style={{ color: FG_LIGHT, ...serif }}>{info!.title}</p>
                    <p className="flex items-center gap-2 mt-1 text-[13px]" style={{ color: MUTED_L, ...sans }}>
                      <Star size={13} fill={GOLD} style={{ color: GOLD }} /><span style={{ color: FG_LIGHT }}>{count ? avg.toFixed(1) : "—"}</span>
                      · {count} approved review{count === 1 ? "" : "s"} · {displayRef(info!.nbId)}
                    </p>
                  </div>
                  <Button variant="quiet" onClick={() => nav.openProperty(id)}><Eye size={13} />View Property</Button>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5" style={{ background: "#fbf9f5" }}>
                  {reviews.map(r => (
                    <article key={r.id} className="border p-5 flex flex-col gap-3" style={{ borderColor: r.status === "pending" ? "rgba(138,32,48,0.45)" : BORDER_L, background: WHITE, opacity: r.status === "rejected" ? 0.7 : 1 }}>
                      <div className="flex items-start gap-3">
                        {r.avatar
                          ? <img src={r.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                          : <span aria-hidden className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[14px]" style={{ background: "#e9e3d8", color: GOLD, ...serif }}>{r.author.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}</span>}
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] truncate" style={{ color: FG_LIGHT, ...serif }}>{r.author}</p>
                          <div className="flex items-center gap-2 mt-1"><StarRow value={r.rating} size={12} /><span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: MUTED_L, ...sans }}>{r.date}</span></div>
                        </div>
                        <button type="button" aria-label={`Delete review by ${r.author}`} title="Delete" onClick={() => setToDelete(r)}
                          className="w-8 h-8 shrink-0 flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030]" style={{ borderColor: BORDER_L, color: MUTED_L }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Chip tone={r.status === "pending" ? "maroon" : r.status === "published" ? "gold" : "muted"}>{STATUS_LABEL[r.status]}</Chip>
                        {r.verified && (
                          <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-[0.18em] uppercase" style={{ background: "rgba(176,136,72,0.13)", color: GOLD, ...sans }}>
                            <CheckCircle2 size={10} />Verified Visit
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] leading-relaxed line-clamp-5" style={{ color: MUTED_L, ...sans }}>{r.text}</p>
                      {r.account && <p className="text-[11px] truncate" style={{ color: MUTED_L, ...sans }}>Account: {r.account.email}</p>}
                      <div className="mt-auto pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: BORDER_L }}>
                        {r.status !== "published" && (
                          <button type="button" disabled={busy === r.id} onClick={() => act(r, { status: "published" }, `Review by ${r.author} approved: it is on the property page now`)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] tracking-[0.18em] uppercase transition-all hover:brightness-110 disabled:opacity-50" style={{ background: MAROON, color: WHITE, ...sans }}>
                            <Check size={12} />Approve
                          </button>
                        )}
                        {r.status !== "rejected" && (
                          <button type="button" disabled={busy === r.id} onClick={() => act(r, { status: "rejected" }, `Review by ${r.author} rejected: it is not shown on the site`)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border text-[10px] tracking-[0.18em] uppercase transition-colors hover:border-[#8a2030] disabled:opacity-50" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>
                            <X size={12} />{r.status === "published" ? "Hide" : "Reject"}
                          </button>
                        )}
                        <button type="button" disabled={busy === r.id} aria-pressed={r.verified} onClick={() => act(r, { verified: !r.verified }, r.verified ? "“Verified Visit” removed" : "Marked as a verified visit")}
                          title="The reviewer visited the property through Nepal Bhoomi"
                          className="inline-flex items-center gap-1.5 px-3 py-2 border text-[10px] tracking-[0.18em] uppercase transition-colors hover:border-[#8a2030] disabled:opacity-50"
                          style={{ borderColor: r.verified ? "rgba(176,136,72,0.6)" : BORDER_L, background: r.verified ? "rgba(176,136,72,0.1)" : WHITE, color: FG_LIGHT, ...sans }}>
                          <BadgeCheck size={12} style={{ color: GOLD }} />{r.verified ? "Verified" : "Mark Verified"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <ListPagination page={current} total={groups.length} perPage={GROUPS_PER_PAGE} onPage={setPage} noun="properties" />

      <ConfirmDialog open={toDelete !== null} title="Delete this review?"
        message={toDelete ? `${toDelete.author}’s review will be removed. You can undo this for a few seconds afterwards.` : ""}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const r = toDelete;
          setToDelete(null);
          if (!r) return;
          deleteReview(r.id).then(at => {
            notify("Review deleted", { label: "Undo", run: () => { restoreReview(r, at).catch(failed); } });
          }, failed);
        }} />
      {toast}
    </AdminLayout>
  );
}
