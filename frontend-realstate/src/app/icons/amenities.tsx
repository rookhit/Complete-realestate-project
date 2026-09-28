import type { SVGProps } from "react";
import {
  Accessibility, AirVent, Archive, BedSingle, Blinds, BookOpen, Cctv, Droplets, Fan, Fence,
  FireExtinguisher, Flame, GlassWater, LandPlot, Microwave, PawPrint, Plug, Refrigerator,
  ShowerHead, ThermometerSun, ToyBrick, Tv, WashingMachine,
  type LucideIcon, type LucideProps,
} from "lucide-react";

/**
 * Amenity icons.
 *
 * Drawn to match lucide-react, which every other icon in this app comes from:
 * 24x24 viewBox, fill none, stroke currentColor, stroke width 2, round caps
 * and joins. That means they inherit colour from `style={{color:...}}` exactly
 * like the lucide icons beside them, and scale with the `size` prop.
 *
 * Nothing existed before these — amenities rendered as a gold dot and a label,
 * and the project contained no SVG files at all. 44 are drawn here: 22 for the
 * canonical list, and 22 more to cover the phrases real listings use.
 *
 * A further 25 (2026-09-27, "Everyday essentials" below) use lucide-react's own
 * icons, where lucide has a clear match (AirVent, Cctv, WashingMachine, …). They
 * sit in the same set with the same size and colour behaviour, so nothing on a
 * page can tell the two sources apart.
 *
 * For the backend: only the amenity NAME is ever stored or sent. Which drawing
 * represents a name is decided here, so icons can change without a migration.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "size"> & { size?: number };

/** Adapt a lucide icon to this file's icon signature (same default size and stroke). */
const fromLucide = (L: LucideIcon) => ({ size = 22, ...rest }: IconProps) => (
  <L size={size} strokeWidth={2} aria-hidden="true" {...(rest as LucideProps)} />
);

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


/* ─── Grounds, systems and outlook ───────────────────────────────────────── */
//
// Added 2026-09-23. The first 22 icons covered the canonical vocabulary but
// not the marketing phrases the listings actually carry ("Infinity Pool",
// "Home Theater", "24/7 Security"), so half of every amenity list fell back to
// the gold dot and the column read as half-finished. These close that gap.

/** Water surface with a ladder rail. */
export const Pool = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 16.5c1.6 0 1.6 1.2 3.2 1.2S6.8 16.5 8.4 16.5s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2" />
    <path d="M2 20.2c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2" />
    <path d="M7 14V5a2 2 0 0 1 4 0" />
    <path d="M15 14V5a2 2 0 0 1 4 0" />
    <path d="M7 9h4m4 0h4" />
  </Svg>
);

/** Wide screen with a seat row below. */
export const HomeTheater = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="3" width="20" height="11" rx="1.5" />
    <path d="M7 18.5h10" />
    <path d="M6 21v-2.5a1.5 1.5 0 0 1 1.5-1.5h9a1.5 1.5 0 0 1 1.5 1.5V21" />
    <path d="M9.5 17v-1m5 1v-1" />
  </Svg>
);

/** House with a signal arc. */
export const SmartHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="M9.9 15.4a3 3 0 0 1 4.2 0" />
    <path d="M7.8 13.1a6 6 0 0 1 8.4 0" />
    <circle cx="12" cy="17.8" r=".6" fill="currentColor" />
  </Svg>
);

/** Shrub over a ground line. */
export const Garden = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21h18" />
    <path d="M12 21v-6" />
    <path d="M12 15c-3.2 0-5-1.8-5-4.4 0-2.4 2-4.6 5-6.6 3 2 5 4.2 5 6.6 0 2.6-1.8 4.4-5 4.4z" />
    <path d="M12 8.5v6.5" />
  </Svg>
);

/** Garage door with a car silhouette. */
export const Garage = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 21V9.2L12 4l9 5.2V21" />
    <path d="M6.5 21v-5.5h11V21" />
    <path d="M6.5 18h11" />
    <path d="M8.8 13.2 9.6 11h4.8l.8 2.2" />
  </Svg>
);

/** Bell on a desk — concierge, reception, staff. */
export const Concierge = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 18h18" />
    <path d="M4.5 15a7.5 7.5 0 0 1 15 0z" />
    <path d="M12 7.5V6" />
    <circle cx="12" cy="4.6" r="1.4" />
  </Svg>
);

/** Bottle rack in a vaulted cellar. */
export const WineCellar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21V10a8 8 0 0 1 16 0v11z" />
    <path d="M4 14.5h16M4 18h16" />
    <path d="M9 14.5V21m6-6.5V21" />
    <circle cx="12" cy="8" r="1.2" />
  </Svg>
);

/** Panel grid under a sun. */
export const SolarPower = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="18.5" cy="5" r="2.2" />
    <path d="M18.5 1.4v.8m0 5.6v.8m3.6-3.6h-.8m-5.6 0h-.8" />
    <path d="M3 20h12l-2-8H5z" />
    <path d="M3.9 16h11.2M9.6 12l-.8 8" />
  </Svg>
);

/** Shield with a check. */
export const Security = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s7-3.2 7-9V5.6l-7-2.6-7 2.6V12c0 5.8 7 9 7 9z" />
    <polyline points="9.2 11.8 11.4 14 15 10.2" />
  </Svg>
);

/** Dumbbell. */
export const Gym = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 9.5v5M5.5 7.5v9M18.5 7.5v9M21.5 9.5v5" />
    <path d="M5.5 12h13" />
  </Svg>
);

/** Lift car with up and down arrows. */
export const Elevator = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M12 3v18" />
    <polyline points="7.4 10.4 8.6 8.6 9.8 10.4" />
    <polyline points="7.4 13.8 8.6 15.6 9.8 13.8" />
    <path d="M14.6 9.2h3.2m-3.2 3h3.2m-3.2 3h3.2" />
  </Svg>
);

/** Plug with a power bolt — generator backup. */
export const Generator = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="7" width="13" height="11" rx="1.5" />
    <path d="M16 10.5h2.6a2.4 2.4 0 0 1 0 4.8H16" />
    <path d="M6.5 7V4.6m4 2.4V4.6" />
    <path d="M10.2 10.2 8 13.4h2.6L9 16.6" />
  </Svg>
);

/** Peaks — mountain, valley and panoramic outlook. */
export const Views = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 19h20" />
    <path d="M2 19 8.4 8l3.4 5.6L14.6 9l7.4 10z" />
    <path d="M6.6 10.6h3.6" />
    <circle cx="17.6" cy="4.8" r="1.8" />
  </Svg>
);

/** Jetty over water — river, lake and dock frontage. */
export const Waterfront = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 18.4c1.7 0 1.7 1.3 3.3 1.3s1.7-1.3 3.4-1.3 1.7 1.3 3.3 1.3 1.7-1.3 3.4-1.3 1.7 1.3 3.3 1.3 1.7-1.3 3.3-1.3" />
    <path d="M4 15h16" />
    <path d="M6.5 15v-3.5m11 3.5v-3.5" />
    <path d="M12 15V6" />
    <path d="M12 6h5.5l-2 2 2 2H12" />
  </Svg>
);

/** Armchair — fully furnished, modern interiors. */
export const Furnished = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 12V7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5V12" />
    <path d="M4 12.5a2 2 0 0 1 2 2V17h12v-2.5a2 2 0 1 1 4 0V19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-4.5a2 2 0 0 1 2-2z" />
  </Svg>
);

/** Tiered pagoda roof — heritage, Newari courtyard, restored woodwork. */
export const Heritage = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.6 4 7h16z" />
    <path d="M5.5 11.4 12 7.8l6.5 3.6z" />
    <path d="M7 11.4V21m10-9.6V21" />
    <path d="M4 21h16" />
    <path d="M10.4 21v-5.2h3.2V21" />
  </Svg>
);

/** Footprints on a path — nature and trekking trails. */
export const Trail = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21c2.5-4.5 3-9.5 1.5-14" />
    <path d="M20 21c-2.5-4.5-3-9.5-1.5-14" />
    <path d="M9.2 5.4h1.2m3.2 0h1.2M9.8 11h1.2m3 0h1.2M10.4 16.6h1.2m2.6 0h1.2" />
  </Svg>
);

/** Stacked slabs — floor count. */
export const Floors = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7.5h18M3 12h18M3 16.5h18" />
    <path d="M6 7.5V4h12v3.5" />
    <path d="M6 20.5V17h12v3.5" />
  </Svg>
);

/** Room outline with a corner measure — open plan area. */
export const OpenPlan = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <path d="M7.5 7.5h4.5v4.5" />
    <path d="M7.5 12 16.5 16.5" />
    <path d="M13.2 16.5h3.3v-3.3" />
  </Svg>
);

/** Shopfront row — commercial units and ground-floor retail. */
export const CommercialUnit = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.2 9 4.6 4.5h14.8L20.8 9z" />
    <path d="M4 9v11h16V9" />
    <path d="M8 20v-6h3.5v6" />
    <path d="M14.5 13.5h3.5v3.5h-3.5z" />
  </Svg>
);

/** Table ringed with seats — board room. */
export const BoardRoom = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="9" width="14" height="6" rx="2.4" />
    <path d="M8.5 9V6.6m7 2.4V6.6m-7 10.8V15m7 2.4V15" />
    <path d="M2.6 12h1.6m15.6 0h1.6" />
  </Svg>
);

/** Small pitched outbuilding — guest cottage. */
export const GuestCottage = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5 12 7l7 5.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
    <path d="M10 21v-4.5h4V21" />
    <path d="M3.2 13.6 12 6.6l8.8 7" />
    <path d="M16 8.4V5.4h2.2v4.7" />
  </Svg>
);

/* ─── Everyday essentials (lucide) ───────────────────────────────────────── */
//
// Added 2026-09-27 so the admin's amenity picker covers what Nepali listings
// actually advertise, and the backend's amenity vocabulary is complete. Each
// uses lucide's own icon where it has an unambiguous one.

export const AirConditioning = fromLucide(AirVent);
export const CctvCamera      = fromLucide(Cctv);
export const FireSafety      = fromLucide(FireExtinguisher);
export const BoringWater     = fromLucide(Droplets);
export const SolarWaterHeater = fromLucide(ThermometerSun);
export const GatedCommunity  = fromLucide(Fence);
export const KidsPlayArea    = fromLucide(ToyBrick);
export const PetFriendly     = fromLucide(PawPrint);
export const WheelchairAccess = fromLucide(Accessibility);
export const EvCharging      = fromLucide(Plug);
export const CornerPlot      = fromLucide(LandPlot);
export const PujaRoom        = fromLucide(Flame);
export const StudyRoom       = fromLucide(BookOpen);
export const StoreRoom       = fromLucide(Archive);
export const LaundryRoom     = fromLucide(WashingMachine);
export const GuestRoom       = fromLucide(BedSingle);
export const AttachedBathroom = fromLucide(ShowerHead);
export const Fridge          = fromLucide(Refrigerator);
export const WasherMachine   = fromLucide(WashingMachine);
export const MicrowaveOven   = fromLucide(Microwave);
export const Television      = fromLucide(Tv);
export const WaterPurifier   = fromLucide(GlassWater);
export const CurtainsBlinds  = fromLucide(Blinds);
export const CeilingFans     = fromLucide(Fan);

/* ─── Registry ───────────────────────────────────────────────────────────── */

export type AmenityGroup = "Main Features" | "Rooms" | "Furnished";

export type Amenity = {
  name: string;
  group: AmenityGroup;
  Icon: (p: IconProps) => React.JSX.Element;
};

/**
 * The canonical amenity vocabulary.
 *
 * `Amenity.name` is the contract. The API should send these strings verbatim
 * in a property's `amenities` array; see CLAUDE.md §6. Free-text marketing
 * phrases still resolve through ALIASES below, but only these names are
 * guaranteed, filterable and translatable.
 */
export const AMENITIES: Amenity[] = [
  // Main features — structure, grounds, building services.
  { name: "Earthquake Resistant", group: "Main Features", Icon: EarthquakeResistant },
  { name: "Marble",               group: "Main Features", Icon: Marble },
  { name: "Parquet",              group: "Main Features", Icon: Parquet },
  { name: "Balcony",              group: "Main Features", Icon: Balcony },
  { name: "Terrace",              group: "Main Features", Icon: Terrace },
  { name: "Garden",               group: "Main Features", Icon: Garden },
  { name: "Swimming Pool",        group: "Main Features", Icon: Pool },
  { name: "Parking",              group: "Main Features", Icon: Parking },
  { name: "Garage",               group: "Main Features", Icon: Garage },
  { name: "Elevator",             group: "Main Features", Icon: Elevator },
  { name: "Security",             group: "Main Features", Icon: Security },
  { name: "Concierge",            group: "Main Features", Icon: Concierge },
  { name: "Gym",                  group: "Main Features", Icon: Gym },
  { name: "Solar Power",          group: "Main Features", Icon: SolarPower },
  { name: "Generator Backup",     group: "Main Features", Icon: Generator },
  { name: "Drinking Water",       group: "Main Features", Icon: DrinkingWater },
  { name: "Reserve Tank",         group: "Main Features", Icon: ReserveTank },
  { name: "Drainage",             group: "Main Features", Icon: Drainage },
  { name: "Mountain Views",       group: "Main Features", Icon: Views },
  { name: "Waterfront",           group: "Main Features", Icon: Waterfront },
  { name: "Nature Trails",        group: "Main Features", Icon: Trail },
  { name: "Heritage Architecture",group: "Main Features", Icon: Heritage },
  { name: "Air Conditioning",     group: "Main Features", Icon: AirConditioning },
  { name: "CCTV",                 group: "Main Features", Icon: CctvCamera },
  { name: "Fire Safety",          group: "Main Features", Icon: FireSafety },
  { name: "Boring Water",         group: "Main Features", Icon: BoringWater },
  { name: "Solar Water Heater",   group: "Main Features", Icon: SolarWaterHeater },
  { name: "Gated Community",      group: "Main Features", Icon: GatedCommunity },
  { name: "Kids Play Area",       group: "Main Features", Icon: KidsPlayArea },
  { name: "Pet Friendly",         group: "Main Features", Icon: PetFriendly },
  { name: "Wheelchair Access",    group: "Main Features", Icon: WheelchairAccess },
  { name: "EV Charging",          group: "Main Features", Icon: EvCharging },
  { name: "Corner Plot",          group: "Main Features", Icon: CornerPlot },

  // Rooms — what the building contains.
  { name: "Bedroom",              group: "Rooms", Icon: Bedroom },
  { name: "Master Bedroom",       group: "Rooms", Icon: MasterBedroom },
  { name: "Living Room",          group: "Rooms", Icon: LivingRoom },
  { name: "Dining Room",          group: "Rooms", Icon: DiningRoom },
  { name: "Kitchen",              group: "Rooms", Icon: Kitchen },
  { name: "Bathroom",             group: "Rooms", Icon: Bathroom },
  { name: "Pantry",               group: "Rooms", Icon: Pantry },
  { name: "Home Theater",         group: "Rooms", Icon: HomeTheater },
  { name: "Wine Cellar",          group: "Rooms", Icon: WineCellar },
  { name: "Staff Quarters",       group: "Rooms", Icon: Concierge },
  { name: "Guest Cottage",        group: "Rooms", Icon: GuestCottage },
  { name: "Board Room",           group: "Rooms", Icon: BoardRoom },
  { name: "Commercial Unit",      group: "Rooms", Icon: CommercialUnit },
  { name: "Open Plan",            group: "Rooms", Icon: OpenPlan },
  { name: "Floors",               group: "Rooms", Icon: Floors },
  { name: "Puja Room",            group: "Rooms", Icon: PujaRoom },
  { name: "Study Room",           group: "Rooms", Icon: StudyRoom },
  { name: "Store Room",           group: "Rooms", Icon: StoreRoom },
  { name: "Laundry Room",         group: "Rooms", Icon: LaundryRoom },
  { name: "Guest Room",           group: "Rooms", Icon: GuestRoom },
  { name: "Attached Bathroom",    group: "Rooms", Icon: AttachedBathroom },

  // Furnished — what conveys with the property.
  { name: "Fully Furnished",      group: "Furnished", Icon: Furnished },
  { name: "Modular Kitchen",      group: "Furnished", Icon: ModularKitchen },
  { name: "Internet",             group: "Furnished", Icon: Internet },
  { name: "Smart Home",           group: "Furnished", Icon: SmartHome },
  { name: "Dining Table",         group: "Furnished", Icon: DiningTable },
  { name: "Bed",                  group: "Furnished", Icon: Bed },
  { name: "Closet",               group: "Furnished", Icon: Closet },
  { name: "Sofa",                 group: "Furnished", Icon: Sofa },
  { name: "Refrigerator",         group: "Furnished", Icon: Fridge },
  { name: "Washing Machine",      group: "Furnished", Icon: WasherMachine },
  { name: "Microwave",            group: "Furnished", Icon: MicrowaveOven },
  { name: "Television",           group: "Furnished", Icon: Television },
  { name: "Water Purifier",       group: "Furnished", Icon: WaterPurifier },
  { name: "Curtains & Blinds",    group: "Furnished", Icon: CurtainsBlinds },
  { name: "Ceiling Fans",         group: "Furnished", Icon: CeilingFans },
];

export const AMENITY_GROUPS: AmenityGroup[] = ["Main Features", "Rooms", "Furnished"];

/**
 * Keyword → canonical name.
 *
 * Listings are written by agents, not by a dropdown, so the same thing arrives
 * as "Infinity Pool", "Heated Pool" or "Swimming Pool". Every key here is a
 * substring matched against the lowercased input, longest key first, so
 * "master bedroom" wins over "bedroom" and "modular kitchen" over "kitchen".
 *
 * This is a display convenience only. It does not widen the contract: the API
 * should still send canonical names, because an alias cannot be filtered on.
 */
const ALIASES: Record<string, string> = {
  // Water
  "infinity pool": "Swimming Pool",
  "heated pool": "Swimming Pool",
  "swimming pool": "Swimming Pool",
  "pool": "Swimming Pool",
  "lakefront": "Waterfront",
  "river frontage": "Waterfront",
  "boat dock": "Waterfront",
  "spring water": "Drinking Water",
  "water tank": "Reserve Tank",

  // Grounds and outlook
  "rooftop garden": "Garden",
  "private garden": "Garden",
  "botanical": "Garden",
  "private forest": "Garden",
  "yoga terrace": "Terrace",
  "private terrace": "Terrace",
  "open verandah": "Terrace",
  "mountain deck": "Mountain Views",
  "mountain views": "Mountain Views",
  "panoramic views": "Mountain Views",
  "durbar views": "Mountain Views",
  "jungle views": "Mountain Views",
  "balcony views": "Balcony",
  "trekking trails": "Nature Trails",
  "nature trails": "Nature Trails",

  // Building services
  "24/7 security": "Security",
  "24/7 concierge": "Concierge",
  "reception area": "Concierge",
  "staff quarters": "Staff Quarters",
  "gym access": "Gym",
  "generator backup": "Generator Backup",
  "generator": "Generator Backup",
  "covered parking": "Parking",
  "parking for": "Parking",
  "car garage": "Garage",

  // Interior
  "high-speed internet": "Internet",
  "wifi ready": "Internet",
  "international kitchen": "Kitchen",
  "modern interiors": "Fully Furnished",
  "fully furnished": "Fully Furnished",
  "restored woodwork": "Heritage Architecture",
  "traditional courtyard": "Heritage Architecture",
  "heritage architecture": "Heritage Architecture",

  // Counted facts written as prose
  "bedrooms": "Bedroom",
  "floors": "Floors",
  "open plan": "Open Plan",
  "commercial units": "Commercial Unit",
  "ground floor retail": "Commercial Unit",
  "development ready": "Open Plan",

  // Everyday essentials. Whole phrases only: short keys like "ac" or "tv"
  // would match inside unrelated words ("space", "private").
  "air conditioning": "Air Conditioning",
  "air conditioned": "Air Conditioning",
  "air-conditioned": "Air Conditioning",
  "cctv": "CCTV",
  "fire alarm": "Fire Safety",
  "fire safety": "Fire Safety",
  "deep boring": "Boring Water",
  "boring water": "Boring Water",
  "solar water": "Solar Water Heater",
  "water heater": "Solar Water Heater",
  "geyser": "Solar Water Heater",
  "gated community": "Gated Community",
  "gated colony": "Gated Community",
  "play area": "Kids Play Area",
  "playground": "Kids Play Area",
  "pet friendly": "Pet Friendly",
  "pets allowed": "Pet Friendly",
  "wheelchair": "Wheelchair Access",
  "ev charging": "EV Charging",
  "corner plot": "Corner Plot",
  "puja room": "Puja Room",
  "prayer room": "Puja Room",
  "study room": "Study Room",
  "store room": "Store Room",
  "laundry": "Laundry Room",
  "guest room": "Guest Room",
  "attached bath": "Attached Bathroom",
  "ensuite": "Attached Bathroom",
  "fridge": "Refrigerator",
  "washing machine": "Washing Machine",
  "smart tv": "Television",
  "water purifier": "Water Purifier",
  "curtains": "Curtains & Blinds",
  "ceiling fan": "Ceiling Fans",
};

const BY_NAME = new Map(AMENITIES.map((a) => [a.name.toLowerCase(), a]));

/** Alias keys longest first, so the most specific phrase wins. */
const ALIAS_KEYS = Object.keys(ALIASES).sort((a, b) => b.length - a.length);

/** Canonical names longest first, for the final substring sweep. */
const NAME_KEYS = AMENITIES.map((a) => a.name.toLowerCase()).sort(
  (a, b) => b.length - a.length,
);

/**
 * Resolve any amenity string — canonical or free text — to an icon.
 *
 * Four passes, most precise first: exact canonical name, exact alias, alias
 * substring, canonical substring. Returns null only for something genuinely
 * outside the vocabulary, and the caller then falls back to a gold dot.
 */
export function amenityIcon(name: string): Amenity["Icon"] | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;

  const exact = BY_NAME.get(n);
  if (exact) return exact.Icon;

  const aliased = ALIASES[n];
  if (aliased) return BY_NAME.get(aliased.toLowerCase())?.Icon ?? null;

  for (const k of ALIAS_KEYS) {
    if (n.includes(k)) return BY_NAME.get(ALIASES[k].toLowerCase())?.Icon ?? null;
  }
  for (const k of NAME_KEYS) {
    if (n.includes(k)) return BY_NAME.get(k)?.Icon ?? null;
  }
  return null;
}

