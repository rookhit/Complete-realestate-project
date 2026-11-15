import { useMemo, useState, type ReactNode } from "react";
import { LISTING_STATUS, updateListing, type ListingStatus, type ListingSubmission } from "@/app/data/listings";
import type { Prop } from "@/app/data/properties";
import { MUTED_L, WHITE, sans } from "@/app/components/ui/brand";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import type { AdminNav } from "./AdminLayout";
import { PropertyEditor } from "./PropertyEditor";
import type { Notify } from "./parts";

export const STATUS_TONE: Record<ListingStatus, { bg: string; fg: string }> = {
  new: { bg: "#d93636", fg: WHITE }, draft: { bg: "rgba(176,136,72,0.16)", fg: "#7a5a24" },
  published: { bg: "rgba(31,158,77,0.12)", fg: "#1f7a43" }, rejected: { bg: "rgba(26,22,17,0.07)", fg: MUTED_L },
};

/** "New", "Saved for later", "Published", "Rejected", in their colours. */
export function StatusPill({ s }: { s: ListingStatus }) {
  const t = STATUS_TONE[s];
  return <span className="inline-block px-2.5 py-1 text-[10px] tracking-[0.16em] uppercase whitespace-nowrap" style={{ background: t.bg, color: t.fg, ...sans }}>{LISTING_STATUS[s]}</span>;
}

/**
 * The listing's property is on the website. A published listing loses its link when that property is
 * deleted (the server clears it); it is then treated like an open listing: it can be copied again.
 */
export const isOnSite = (l: ListingSubmission): l is ListingSubmission & { propertyId: number } =>
  l.status === "published" && l.propertyId != null;

/** Published once, but its property has since been deleted from the website. */
export const propertyRemoved = (l: ListingSubmission) => l.status === "published" && l.propertyId == null;

/**
 * What the admin can do with a seller's free listing, shared by the Free Listings list and the
 * listing's own page. Nothing goes on the website straight from a listing: "Copy to Add Property"
 * opens the Add Property editor filled in with the seller's details, and the admin publishes from
 * there (the listing is then marked Published and linked to the new property).
 * Render `ui` once on the page: it holds the editor and the reject confirmation.
 */
export function useListingActions(notify: Notify, nav: AdminNav): {
  copyToProperty: (l: ListingSubmission) => void;
  later: (l: ListingSubmission) => void;
  restore: (l: ListingSubmission) => void;
  askReject: (l: ListingSubmission) => void;
  ui: ReactNode;
} {
  const [editing, setEditing] = useState<ListingSubmission | null>(null);
  const [toReject, setToReject] = useState<ListingSubmission | null>(null);
  // Stable while the editor is open: a new object would restart the editor on every render.
  const source = useMemo(() => editing && {
    submission: editing,
    onSaveForLater: (p: Prop) => updateListing(editing.id, { status: "draft", draft: p }),
    onPublished: (p: Prop) => updateListing(editing.id, { status: "published", draft: p, propertyId: p.id }),
    onReject: () => { setEditing(null); setToReject(editing); },
  }, [editing]);

  const later = (l: ListingSubmission) => {
    const before = l.status;
    updateListing(l.id, { status: "draft" });
    notify(`“${l.title}” saved for later`, { label: "Undo", run: () => updateListing(l.id, { status: before }) });
  };
  const restore = (l: ListingSubmission) => {
    updateListing(l.id, { status: l.statusBeforeReject ?? (l.draft ? "draft" : "new") });
    notify(`“${l.title}” restored`);
  };
  const reject = (l: ListingSubmission) => {
    const before = l.status;
    updateListing(l.id, { status: "rejected", statusBeforeReject: before });
    setToReject(null);
    notify(`“${l.title}” rejected`, { label: "Undo", run: () => updateListing(l.id, { status: before }) });
  };

  const ui = (
    <>
      <PropertyEditor property={null} open={editing !== null} onClose={() => setEditing(null)} onSaved={notify} onViewOnSite={nav.openProperty} source={source} />
      <ConfirmDialog open={!!toReject} title="Reject this listing?"
        message={toReject ? `“${toReject.title}” from ${toReject.seller.name} won’t be published. You can restore it from the Rejected filter.` : ""}
        confirmLabel="Reject" onCancel={() => setToReject(null)} onConfirm={() => toReject && reject(toReject)} />
    </>
  );
  return { copyToProperty: setEditing, later, restore, askReject: setToReject, ui };
}
