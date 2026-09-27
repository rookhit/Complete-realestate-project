import { amenityIcon, canonicalAmenity } from "@/app/icons/amenities";
import { GOLD, MUTED_L, sans } from "./brand";

type AmenityIcon = NonNullable<ReturnType<typeof amenityIcon>>;

/**
 * A compact row of amenity icons for listing cards.
 *
 * Features arrive as free text, so several can mean the same thing ("Balcony"
 * and "Balcony Views", "Parking" and "Parking for 4"). They are collapsed to
 * their canonical name first so a card never shows the same icon twice.
 * Anything past `max` is summarised as "+N more"; the full list is on the
 * detail page.
 */
export function AmenityStrip({ features, max = 5, labels = false, color = GOLD, muted = MUTED_L }: {
  features: string[];
  max?: number;
  labels?: boolean;   // show the name beside each icon (list rows) or icon only (cards)
  color?: string;
  muted?: string;
}) {
  const seen = new Set<string>();
  const items: { name: string; Icon: AmenityIcon }[] = [];
  for (const f of features) {
    const name = canonicalAmenity(f) ?? f;
    const Icon = amenityIcon(f);
    if (!Icon || seen.has(name)) continue;
    seen.add(name);
    items.push({ name, Icon });
  }
  if (!items.length) return null;

  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <div className={`flex flex-wrap items-center ${labels ? "gap-x-4 gap-y-2" : "gap-3"}`}>
      {shown.map(({ name, Icon }) => (
        // `relative` anchors the sr-only label; without it the label escapes
        // the Hot Properties scroller and widens the page on mobile.
        <span key={name} title={name} className="relative flex items-center gap-1.5" style={{ color }}>
          <Icon size={labels ? 15 : 17} />
          {labels
            ? <span className="text-[12px]" style={{ color: muted, ...sans }}>{name}</span>
            : <span className="sr-only">{name}</span>}
        </span>
      ))}
      {rest > 0 && <span className="text-[11px] tracking-[0.05em]" style={{ color: muted, ...sans }}>+{rest} more</span>}
    </div>
  );
}
