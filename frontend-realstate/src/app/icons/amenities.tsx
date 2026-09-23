import type { SVGProps } from "react";

/**
 * Amenity icons.
 *
 * Drawn to match lucide-react, which every other icon in this app comes from:
 * 24x24 viewBox, fill none, stroke currentColor, stroke width 2, round caps
 * and joins. That means they inherit colour from `style={{color:...}}` exactly
 * like the lucide icons beside them, and scale with the `size` prop.
 *
 * Nothing existed before these — amenities rendered as a gold dot and a label,
 * and the project contained no SVG files at all. All 22 are new.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "size"> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ─── Main features ──────────────────────────────────────────────────────── */

/** House inside a rotation ring. */
export const EarthquakeResistant = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 9.5A9 9 0 0 0 5 6.2" />
    <path d="M3.5 14.5A9 9 0 0 0 19 17.8" />
    <polyline points="20.5 5 20.5 9.5 16 9.5" />
    <polyline points="3.5 19 3.5 14.5 8 14.5" />
    <path d="M9 14.2 12 11.8l3 2.4V17H9z" />
  </Svg>
);

/** Tile with marble veining. */
export const Marble = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M6 9c2-1.6 3.4 1.4 5.4.2S15 6.6 18 8" />
    <path d="M6 15.5c2.4-1.2 3.2 1.6 5.6.6s3.4-1.4 5.4-.4" />
  </Svg>
);

/** Building face with a railing in front. */
export const Balcony = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 13V4h14v9" />
    <path d="M9 4v5m6-5v5" />
    <path d="M3 13h18" />
    <path d="M4 13v7m16-7v7" />
    <path d="M4 17h16" />
    <path d="M8.5 13v7m3.5-7v7m3.5-7v7" />
  </Svg>
);

/** Tap with a falling drop. */
export const DrinkingWater = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h6a4 4 0 0 1 4 4v1" />
    <path d="M4 4v4" />
    <path d="M14 11h6" />
    <path d="M17 11v2" />
    <path d="M12 17.8c0 1.2-.9 2.2-2 2.2s-2-1-2-2.2S10 14 10 14s2 2.6 2 3.8Z" />
  </Svg>
);

/** Herringbone parquet inside a tile. */
export const Parquet = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M7 11 11 7M7 11l4 4" />
    <path d="M13 17l4-4M13 17l-4-4" />
    <path d="M12 6l5 5" />
  </Svg>
);

/** Water tank with a level gauge. */
export const ReserveTank = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M7 6V4h10v2" />
    <path d="M3 12h18" />
    <path d="M17 15.5h1.5" />
    <path d="M6 15.5h5" />
  </Svg>
);

/** Round drain grate with slots. */
export const Drainage = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M6.5 9.5h11" />
    <path d="M5.2 12.5h13.6" />
    <path d="M6.5 15.5h11" />
  </Svg>
);

/** Parking sign on a post beside a car. */
export const Parking = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="3" width="10" height="10" rx="2" />
    <path d="M6.5 11V5.5h2.2a1.9 1.9 0 0 1 0 3.8H6.5" />
    <path d="M7.5 13v7" />
    <path d="M14 20v-3.5l1.4-3a1.5 1.5 0 0 1 1.4-.9h3.4a1.5 1.5 0 0 1 1.4.9l1.4 3V20" />
    <path d="M14 17.5h8.4" />
    <circle cx="16" cy="20" r=".6" />
    <circle cx="20.5" cy="20" r=".6" />
  </Svg>
);

/** Rooftop with an upward arrow. */
export const Terrace = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21h18" />
    <path d="M5 21v-7h14v7" />
    <path d="M5 14 12 9l7 5" />
    <path d="M12 7V2" />
    <polyline points="9.5 4.5 12 2 14.5 4.5" />
  </Svg>
);

/* ─── Rooms ──────────────────────────────────────────────────────────────── */

/** Double bed, front view. */
export const Bedroom = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    <path d="M3 15h18" />
    <path d="M3 18v2m18-2v2" />
    <rect x="6" y="7" width="5" height="3" rx="1" />
    <rect x="13" y="7" width="5" height="3" rx="1" />
  </Svg>
);

/** Sofa with a window above. */
export const LivingRoom = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="2.5" width="8" height="5.5" rx="1" />
    <path d="M12 2.5V8M8 5.2h8" />
    <path d="M3 18v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" />
    <path d="M6 12v-1.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 10.5V12" />
    <path d="M3 16h18" />
    <path d="M5 18v2m14-2v2" />
  </Svg>
);

/** Table, two chairs, pendant light. */
export const DiningRoom = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2v3" />
    <path d="M9 8a3 3 0 0 1 6 0Z" />
    <path d="M3 14h18" />
    <path d="M6 14v6m12-6v6" />
    <path d="M4.5 11v3m15-3v3" />
    <path d="M3.5 11h2m13 0h2" />
  </Svg>
);

/** Cabinets with a hob on top. */
export const Kitchen = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="9" width="18" height="12" rx="2" />
    <path d="M3 13h18" />
    <path d="M12 9v12" />
    <path d="M8 15.5h1.5m5 0H16" />
    <circle cx="8" cy="5.5" r="1.6" />
    <circle cx="16" cy="5.5" r="1.6" />
  </Svg>
);

/** Bathtub with a shower head. */
export const Bathroom = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 13h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
    <path d="M5 13V5.5A2.5 2.5 0 0 1 9.6 4.2" />
    <circle cx="8" cy="6.5" r="1" />
    <path d="M6 20l-1 1.5m14-1.5 1 1.5" />
    <path d="M16 4.5h4" />
    <path d="M18 4.5v3" />
    <path d="M16.5 9.5h3" />
  </Svg>
);

/** Wide bed with headboard and two pillows. */
export const MasterBedroom = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 20v-7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7" />
    <path d="M2 17h20" />
    <path d="M4 11V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5" />
    <rect x="6.5" y="7.5" width="4.5" height="3.5" rx="1" />
    <rect x="13" y="7.5" width="4.5" height="3.5" rx="1" />
  </Svg>
);

/** Shelves with jars. */
export const Pantry = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9.5h18M3 15.5h18" />
    <path d="M6.5 6.2V4.6m0 1.6h2v3.3h-2Z" />
    <path d="M11.5 6.2V4.6m0 1.6h2v3.3h-2Z" />
    <path d="M6.5 12.2v-1.5m0 1.5h2v3.3h-2Z" />
    <path d="M14 12.2v-1.5m0 1.5h3v3.3h-3Z" />
  </Svg>
);

/* ─── Furnished ──────────────────────────────────────────────────────────── */

/** Wall units above, counter units below. */
export const ModularKitchen = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="6.5" rx="1.5" />
    <path d="M12 3v6.5" />
    <path d="M9.5 6.2h1m3 0h1" />
    <rect x="3" y="13" width="18" height="8" rx="1.5" />
    <path d="M3 16h18" />
    <path d="M12 16v5" />
    <path d="M9.5 18.5h1m3 0h1" />
  </Svg>
);

/** Router with antennas and signal. */
export const Internet = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="14" width="18" height="6" rx="2" />
    <path d="M7 17h.01M10.5 17h.01" />
    <path d="M17 17h2" />
    <path d="M7.5 14 6 9.5m10.5 4.5L18 9.5" />
    <path d="M9 6.8a4.5 4.5 0 0 1 6 0" />
    <path d="M6.6 4.2a8 8 0 0 1 10.8 0" />
  </Svg>
);

/** Table with two chairs. */
export const DiningTable = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 11h20" />
    <path d="M5 11v9m14-9v9" />
    <path d="M7.5 7.5v3.5m9-3.5v3.5" />
    <path d="M6 7.5h3m6 0h3" />
    <path d="M6 20h3m6 0h3" />
  </Svg>
);

/** Simple bed with a pillow. */
export const Bed = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    <path d="M3 15h18" />
    <path d="M3 18v2.5m18-2.5v2.5" />
    <rect x="6" y="7" width="6" height="3" rx="1" />
  </Svg>
);

/** Wardrobe, two doors and handles. */
export const Closet = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="2.5" width="16" height="18" rx="1.5" />
    <path d="M12 2.5v18" />
    <path d="M10 10.5v2.5m4-2.5v2.5" />
    <path d="M6 20.5v1m12-1v1" />
  </Svg>
);

/** Three-seater sofa. */
export const Sofa = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 17v-4a2 2 0 0 1 2-2 2 2 0 0 1 2 2v1h12v-1a2 2 0 0 1 2-2 2 2 0 0 1 2 2v4" />
    <path d="M6 11.5V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3.5" />
    <path d="M2 17h20" />
    <path d="M4.5 17v2.5m15-2.5v2.5" />
    <path d="M10 11.5v-1.5m4 1.5v-1.5" />
  </Svg>
);

/* ─── Registry ───────────────────────────────────────────────────────────── */

export type AmenityGroup = "Main Features" | "Rooms" | "Furnished";

export type Amenity = {
  name: string;
  group: AmenityGroup;
  Icon: (p: IconProps) => React.JSX.Element;
};

/** Order matters — it is the order the reference design lists them in. */
export const AMENITIES: Amenity[] = [
  { name: "Earthquake Resistant", group: "Main Features", Icon: EarthquakeResistant },
  { name: "Marble", group: "Main Features", Icon: Marble },
  { name: "Balcony", group: "Main Features", Icon: Balcony },
  { name: "Drinking Water", group: "Main Features", Icon: DrinkingWater },
  { name: "Parquet", group: "Main Features", Icon: Parquet },
  { name: "Reserve Tank", group: "Main Features", Icon: ReserveTank },
  { name: "Drainage", group: "Main Features", Icon: Drainage },
  { name: "Parking", group: "Main Features", Icon: Parking },
  { name: "Terrace", group: "Main Features", Icon: Terrace },

  { name: "Bedroom", group: "Rooms", Icon: Bedroom },
  { name: "Living Room", group: "Rooms", Icon: LivingRoom },
  { name: "Dining Room", group: "Rooms", Icon: DiningRoom },
  { name: "Kitchen", group: "Rooms", Icon: Kitchen },
  { name: "Bathroom", group: "Rooms", Icon: Bathroom },
  { name: "Master Bedroom", group: "Rooms", Icon: MasterBedroom },
  { name: "Pantry", group: "Rooms", Icon: Pantry },

  { name: "Modular Kitchen", group: "Furnished", Icon: ModularKitchen },
  { name: "Internet", group: "Furnished", Icon: Internet },
  { name: "Dining Table", group: "Furnished", Icon: DiningTable },
  { name: "Bed", group: "Furnished", Icon: Bed },
  { name: "Closet", group: "Furnished", Icon: Closet },
  { name: "Sofa", group: "Furnished", Icon: Sofa },
];

export const AMENITY_GROUPS: AmenityGroup[] = ["Main Features", "Rooms", "Furnished"];

const BY_NAME = new Map(AMENITIES.map((a) => [a.name.toLowerCase(), a]));

/**
 * Resolve a free-text amenity string to an icon.
 *
 * The existing mock data holds marketing phrases ("Infinity Pool",
 * "Home Theater") rather than these canonical names, so unknown strings fall
 * back to `null` and the caller keeps the old gold dot for those.
 */
export function amenityIcon(name: string): Amenity["Icon"] | null {
  const exact = BY_NAME.get(name.trim().toLowerCase());
  if (exact) return exact.Icon;

  const n = name.toLowerCase();
  for (const a of AMENITIES) {
    if (n.includes(a.name.toLowerCase())) return a.Icon;
  }
  return null;
}
