// Google Maps links pasted by the admin, turned into something an <iframe> can show.
//
// The admin can paste any of: a full Google Maps URL (…/maps/place/…/@27.67,85.31,17z…),
// a share link (https://maps.app.goo.gl/…), the "Embed a map" <iframe> code, or plain
// coordinates ("27.6710, 85.3150"). No API key is needed for any of these.
//
// Short share links only redirect to the real address, and a browser can't follow that
// redirect for another site, so for those we show the area by name. For the backend: follow
// the redirect when the property is saved and store lat / lng (FRONTEND_CLAUDE.md §0.5).

export type LatLng = { lat: number; lng: number };

const num = "(-?\\d{1,3}\\.\\d+)";
const COORD_PATTERNS = [
  new RegExp(`!3d${num}!4d${num}`),                      // exact place pin inside a /place/ URL
  new RegExp(`@${num},${num}`),                          // map centre in a normal URL
  new RegExp(`[?&](?:q|query|ll|destination)=${num},\\s*${num}`),
  new RegExp(`^\\s*${num}\\s*,\\s*${num}\\s*$`),         // pasted coordinates
];

/** The coordinates in a pasted link, if it carries any. */
export function coordsFromMapUrl(input: string): LatLng | null {
  for (const re of COORD_PATTERNS) {
    const m = input.match(re);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

/** A place name in the link ("/place/Jawlakhel+Lalitpur/" or "?q=Jawlakhel"). */
function placeFromMapUrl(input: string): string | null {
  const m = input.match(/\/place\/([^/@?]+)/) ?? input.match(/[?&](?:q|query)=([^&]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1].replace(/\+/g, " ")).trim() || null; } catch { return null; }
}

/** The src of a pasted "Embed a map" iframe. */
function embedSrcFrom(input: string): string | null {
  const m = input.match(/src=["']([^"']*google\.[^"']*\/maps\/embed[^"']*)["']/);
  return m ? m[1] : null;
}

/** "Jawlakhel, Lalitpur" + "Lalitpur" → "Jawlakhel, Lalitpur" (the district is not repeated). */
export function placeLabel(location: string, district: string): string {
  const l = location.trim(), d = district.trim();
  if (!l) return d;
  return !d || l.toLowerCase().includes(d.toLowerCase()) ? l : `${l}, ${d}`;
}

export const isShortMapLink = (input: string) => /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/.test(input);

/** Roughly Nepal. Used to warn when a pasted pin lands somewhere else. */
export const inNepal = ({ lat, lng }: LatLng) => lat > 26 && lat < 30.6 && lng > 79.9 && lng < 88.4;

export type MapSource = "pin" | "embed" | "place" | "area";

/**
 * What the map shows and where it comes from. `fallback` is the area name
 * ("Jawlakhel, Lalitpur") used when the link has no pin, or there is no link.
 */
export function resolveMap(url: string | undefined, fallback: string): { src: string; open: string; source: MapSource; coords: LatLng | null } {
  const input = (url ?? "").trim();
  const embed = input ? embedSrcFrom(input) : null;
  if (embed) return { src: embed, open: embed.replace("/maps/embed", "/maps"), source: "embed", coords: coordsFromMapUrl(embed) };

  const coords = input ? coordsFromMapUrl(input) : null;
  const place = input ? placeFromMapUrl(input) : null;
  const query = coords ? `${coords.lat},${coords.lng}` : place ?? `${fallback}, Nepal`;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${coords ? 16 : 14}&output=embed`;
  // The visitor's "Open in Google Maps" goes to the admin's own link when there is one.
  const open = /^https?:\/\//.test(input) ? input : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return { src, open, source: coords ? "pin" : place ? "place" : "area", coords };
}

// ─── Approximate area ─────────────────────────────────────────────────────────
// Visitors never see where a property really is. They see a soft, irregular area about 500 m
// across whose centre is shifted up to 350 m from the real point, in a direction and distance
// that stay the same for each property (so reloading or comparing visits can't reveal it).
// The real point is always inside: the blob's edge never comes closer than 425 m to its centre.
//
// PRIVACY RULE: the exact point is admin-only, unless the admin chose "Exact location" for that
// property (locationMode "exact"). The public API sends `approx` (the shifted centre, or the real
// point in exact mode) plus `locationMode`, and never mapUrl / lat / lng. Until the API exists, approxFor() computes the shift here from the
// sample data; shiftedCentre() then moves to the backend (with a secret seed) and is deleted here.

export const APPROX_RADIUS_M = 500;
const MAX_SHIFT_M = 350;
const WOBBLE = 0.15;              // edge varies ±15 % around the radius
const RING_POINTS = 64;

/** Small deterministic random generator: the same seed always gives the same numbers. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Moves a point `m` metres north and `e` metres east. */
function offsetMetres({ lat, lng }: LatLng, north: number, east: number): LatLng {
  return { lat: lat + north / 111320, lng: lng + east / (111320 * Math.cos((lat * Math.PI) / 180)) };
}

/**
 * The centre visitors see: the real point shifted up to 350 m. BACKEND JOB: do this on save with
 * a secret seed, store the result, and never send `exact` to the public site.
 */
function shiftedCentre(exact: LatLng, propertyId: number): LatLng {
  const rand = seeded(hash(`nb-dev-shift:${propertyId}`));
  const bearing = rand() * Math.PI * 2;
  const dist = MAX_SHIFT_M * Math.sqrt(0.2 + 0.8 * rand());   // never right on top of the house
  return offsetMetres(exact, Math.cos(bearing) * dist, Math.sin(bearing) * dist);
}

/** The blob's outline around the public centre. Safe to run anywhere: it reveals nothing. */
export function blobRing(centre: LatLng, shapeSeed: number): LatLng[] {
  const rand = seeded(hash(`nb-shape:${shapeSeed}`));
  const waves = [2, 3, 5].map(k => ({ k, amp: (0.35 + rand() * 0.65) / 3, phase: rand() * Math.PI * 2 }));
  return Array.from({ length: RING_POINTS }, (_, i) => {
    const a = (i / RING_POINTS) * Math.PI * 2;
    const wobble = waves.reduce((s, w) => s + w.amp * Math.sin(w.k * a + w.phase), 0);
    const r = APPROX_RADIUS_M * (1 + WOBBLE * wobble);
    return offsetMetres(centre, Math.cos(a) * r, Math.sin(a) * r);
  });
}

/**
 * What the public site may know about a property's location. `precise`: the admin chose
 * "Exact location", so `centre` is the real point and the maps draw a pin without an area.
 */
export type PublicArea = { centre: LatLng; shapeSeed: number; precise: boolean };

/**
 * What visitors see for a property, or null when its link has no coordinates (e.g. a
 * maps.app.goo.gl short link, which the backend will resolve on save). The admin chooses per
 * property: "exact" (the real point) or "approximate" (the default: a shifted centre).
 */
export function approxFor(p: { id: number; approx?: LatLng; mapUrl?: string; locationMode?: "exact" | "approximate" }): PublicArea | null {
  const precise = p.locationMode === "exact";
  if (p.approx) return { centre: p.approx, shapeSeed: p.id, precise };
  const exact = p.mapUrl ? resolveMap(p.mapUrl, "").coords : null;
  if (!exact) return null;
  return { centre: precise ? exact : shiftedCentre(exact, p.id), shapeSeed: p.id, precise };
}

/** The real point, for the admin editor and the development-only debug pin. Never for visitors. */
export const exactFor = (p: { mapUrl?: string }): LatLng | null => (p.mapUrl ? resolveMap(p.mapUrl, "").coords : null);

/** "Open in Google Maps" for visitors: the public point (see approxFor), never the admin's own link. */
export const googleMapsAt = ({ lat, lng }: LatLng) =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(4)},${lng.toFixed(4)}`;

/**
 * Where a pin sits on the Buy / Rent "Map" view, which is an illustrative grid rather than
 * a real map: Nepal's bounding box stretched over it. Replace with a real map when there
 * are stored coordinates.
 */
export function gridFromCoords({ lat, lng }: LatLng): { mapX: number; mapY: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)));
  return { mapX: clamp(((lng - 80) / 8.3) * 100, 6, 94), mapY: clamp(((30.5 - lat) / 4.2) * 100, 8, 88) };
}
