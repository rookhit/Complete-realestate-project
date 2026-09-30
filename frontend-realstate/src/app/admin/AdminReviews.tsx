import { useMemo, useState } from "react";
import { CheckCircle2, Eye, Star, Trash2 } from "lucide-react";
import { ALL_PROPS, displayRef } from "@/app/data/properties";
import { deleteReview, ratingFor, restoreReview, reviewedPropertyIds, reviewsFor, type Review } from "@/app/data/reviews";
import { useDataVersion } from "@/app/data/store";
import { BORDER_L, FG_LIGHT, GOLD, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { Button, Select } from "@/app/components/ui/form-controls";
import { ListPagination, paginate } from "@/app/components/ui/list-pagination";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { StarRow } from "@/app/components/ui/star-row";
import { AdminLayout, type AdminNav } from "./AdminLayout";
import { EmptyState, SearchBox, useToast } from "./parts";

const GROUPS_PER_PAGE = 3;

/**
 * Resident reviews, grouped under the property they were written about, as
 * small cards the admin can delete. API: GET /api/v1/admin/reviews and
 * DELETE /api/v1/admin/reviews/:id (see data/reviews.ts).
 */
export function AdminReviews({ nav }: { nav: AdminNav }) {
  const version = useDataVersion();
  const [toast, notify] = useToast();
  const [q, setQ] = useState("");
  const [propFilter, setPropFilter] = useState("all");
  const [stars, setStars] = useState("all");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<{ propertyId: number; review: Review } | null>(null);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    return reviewedPropertyIds()
      .map(id => ({ property: ALL_PROPS.find(p => p.id === id), reviews: reviewsFor(id) }))
      // Reviews of a property that has since been deleted are not shown.
      .filter((g): g is { property: NonNullable<typeof g.property>; reviews: Review[] } => !!g.property)
      .filter(g => propFilter === "all" || String(g.property.id) === propFilter)
      .map(g => ({
        ...g,
        reviews: g.reviews.filter(r =>
          (stars === "all" || (stars === "low" ? r.rating <= 3 : r.rating === Number(stars))) &&
          (!s || r.author.toLowerCase().includes(s) || r.text.toLowerCase().includes(s))),
      }))
      .filter(g => g.reviews.length > 0);
  }, [q, propFilter, stars, version]);

  const total = groups.reduce((n, g) => n + g.reviews.length, 0);
  const current = Math.min(page, Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE)));
  const propertyOptions = [{ value: "all", label: "All properties" },
    ...reviewedPropertyIds().map(id => ALL_PROPS.find(p => p.id === id)).filter(Boolean).map(p => ({ value: String(p!.id), label: `${p!.title} (${displayRef(p!.nbId)})` }))];

  return (
    <AdminLayout nav={nav} current="admin-reviews" tag="Administration" title="Reviews"
      intro="What visitors wrote about each property. Anything you remove leaves the site at once.">
      <div className="flex flex-col lg:flex-row gap-3 mb-8">
        <SearchBox value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by reviewer or words in the review" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[34rem]">
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
        <EmptyState title="No reviews match" text="Try a different search, property or rating." />
      ) : (
        <div className="flex flex-col gap-10">
          {paginate(groups, current, GROUPS_PER_PAGE).map(({ property: p, reviews }) => (
            <section key={p.id} className="border" style={{ borderColor: BORDER_L, background: WHITE }}>
              <header className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-b" style={{ borderColor: BORDER_L }}>
                <img src={p.hero} alt="" className="w-24 h-16 object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[18px] truncate" style={{ color: FG_LIGHT, ...serif }}>{p.title}</p>
                  <p className="flex items-center gap-2 mt-1 text-[13px]" style={{ color: MUTED_L, ...sans }}>
                    <Star size={13} fill={GOLD} style={{ color: GOLD }} /><span style={{ color: FG_LIGHT }}>{ratingFor(p.id).toFixed(1)}</span>
                    · {reviewsFor(p.id).length} review{reviewsFor(p.id).length === 1 ? "" : "s"} · {displayRef(p.nbId)}
                  </p>
                </div>
                <Button variant="quiet" onClick={() => nav.openProperty(p.id)}><Eye size={13} />View Property</Button>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5" style={{ background: "#fbf9f5" }}>
                {reviews.map(r => (
                  <article key={r.id} className="border p-5 flex flex-col gap-3" style={{ borderColor: BORDER_L, background: WHITE }}>
                    <div className="flex items-start gap-3">
                      <img src={r.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] truncate" style={{ color: FG_LIGHT, ...serif }}>{r.author}</p>
                        <div className="flex items-center gap-2 mt-1"><StarRow value={r.rating} size={12} /><span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: MUTED_L, ...sans }}>{r.date}</span></div>
                      </div>
                      <button type="button" aria-label={`Delete review by ${r.author}`} onClick={() => setToDelete({ propertyId: p.id, review: r })}
                        className="w-8 h-8 shrink-0 flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030]" style={{ borderColor: BORDER_L, color: MUTED_L }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {r.verified && (
                      <span className="self-start flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-[0.18em] uppercase" style={{ background: "rgba(176,136,72,0.13)", color: GOLD, ...sans }}>
                        <CheckCircle2 size={10} />Verified Visit
                      </span>
                    )}
                    <p className="text-[13px] leading-relaxed line-clamp-4" style={{ color: MUTED_L, ...sans }}>{r.text}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <ListPagination page={current} total={groups.length} perPage={GROUPS_PER_PAGE} onPage={setPage} noun="properties" />

      <ConfirmDialog open={toDelete !== null} title="Delete this review?"
        message={toDelete ? `${toDelete.review.author}’s review will be removed from the property page. You can undo this for a few seconds afterwards.` : ""}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            const { propertyId, review } = toDelete;
            const at = reviewsFor(propertyId).findIndex(r => r.id === review.id);
            deleteReview(propertyId, review.id);
            notify("Review deleted", { label: "Undo", run: () => restoreReview(propertyId, review, at) });
          }
          setToDelete(null);
        }} />
      {toast}
    </AdminLayout>
  );
}
