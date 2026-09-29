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

/**
 * Where a pin sits on the Buy / Rent "Map" view, which is an illustrative grid rather than
 * a real map: Nepal's bounding box stretched over it. Replace with a real map when there
 * are stored coordinates.
 */
export function gridFromCoords({ lat, lng }: LatLng): { mapX: number; mapY: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)));
  return { mapX: clamp(((lng - 80) / 8.3) * 100, 6, 94), mapY: clamp(((30.5 - lat) / 4.2) * 100, 8, 88) };
}
