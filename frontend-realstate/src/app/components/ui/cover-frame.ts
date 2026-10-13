import type { CSSProperties } from "react";
import type { CoverFrame, Prop } from "@/app/data/properties";

// The admin's framing of a property's cover photo (focal point + zoom), applied wherever the cover
// is cropped: listing cards, the home banner, list and map views, the map card and admin lists.
// The property page's own gallery shows the photos unframed.
//
// How it works: object-fit: cover fills the box; object-position puts the focal point where it
// sits proportionally; scale() with the same origin zooms around it. Because the origin is inside
// the box and zoom >= 1, the photo always covers the box: no gaps at the edges.

export type Framing = Pick<CoverFrame, "x" | "y" | "zoom">;

export const CENTRED: Framing = { x: 50, y: 50, zoom: 1 };
export const MAX_ZOOM = 3;

/** The framing for this property's cover, or none when it was set for a different photo. */
export function frameOf(p: Pick<Prop, "hero" | "coverFrame">): Framing | undefined {
  const f = p.coverFrame;
  return f && f.src === p.hero ? f : undefined;
}

/**
 * Style for an `object-cover` <img> showing the cover. `hoverZoom` multiplies in a card's own
 * hover zoom, since both use `transform`.
 */
export function coverStyle(f: Framing | undefined, hoverZoom = 1): CSSProperties {
  const { x, y, zoom } = f ?? CENTRED;
  return { objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%`, transform: `scale(${zoom * hoverZoom})` };
}

/** The same as an inline style string, for HTML built outside React (the Leaflet map card). */
export function coverStyleText(f: Framing | undefined): string {
  const { x, y, zoom } = f ?? CENTRED;
  return `object-position:${x}% ${y}%;transform-origin:${x}% ${y}%;transform:scale(${zoom})`;
}
