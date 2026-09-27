import { CheckCircle2 } from "lucide-react";
import { GOLD, MAROON, WHITE, sans } from "./brand";

/**
 * Featured / Verified chips shown on property cards.
 *
 * `onImage` swaps the Verified chip's 15%-opacity gold tint for an opaque dark
 * plate. The tint is legible on white but not over a photograph, where the
 * word sat in whatever the picture happened to be behind it.
 */
export function StatusBadge({ verified, featured, onImage = false }: {
  verified: boolean;
  featured: boolean;
  onImage?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {featured && (
        <span className="px-2 py-0.5 text-[10px] tracking-[0.25em] uppercase" style={{ background: MAROON, color: WHITE, ...sans }}>
          Featured
        </span>
      )}
      {verified && <VerifiedChip onImage={onImage} />}
    </div>
  );
}

/** The Verified chip on its own, for rows that show only that. */
export function VerifiedChip({ onImage = false }: { onImage?: boolean }) {
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-[0.2em] uppercase"
      style={{ background: onImage ? "rgba(14,13,11,0.82)" : "rgba(176,136,72,0.15)", color: GOLD, ...sans }}
    >
      <CheckCircle2 size={11} />Verified
    </span>
  );
}
