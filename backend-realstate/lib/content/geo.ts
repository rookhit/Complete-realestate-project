import { randomInt } from "node:crypto";

// Map locations. The admin pastes a Google Maps link; this reads the real point from it, resolves
// short share links, and makes the shifted centre visitors see in "approximate" mode. Mirrors the
// frontend's frontend-realstate/src/app/data/maps.ts (resolveMap / gridFromCoords).

export type LatLng = { lat: number; lng: number };

const num = "(-?\\d{1,3}\\.\\d+)";
const COORD_PATTERNS = [
  new RegExp(`!3d${num}!4d${num}`), // exact place pin inside a /place/ URL
  new RegExp(`@${num},${num}`), // map centre in a normal URL
  new RegExp(`[?&](?:q|query|ll|destination)=${num},\\s*${num}`),
  new RegExp(`^\\s*${num}\\s*,\\s*${num}\\s*$`), // pasted coordinates
];

function valid({ lat, lng }: LatLng): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** The coordinates written in a link (or pasted "27.67, 85.31"), if any. */
export function coordsFromMapUrl(input: string): LatLng | null {
  const text = (() => {
    try { return decodeURIComponent(input); } catch { return input; }
  })();
  for (const re of COORD_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const point = { lat: Number(m[1]), lng: Number(m[2]) };
      if (valid(point)) return point;
    }
  }
  return null;
}

// Short links are followed server-side (the browser can't). Only Google hosts, only https, at most
// a few hops and a short timeout, so a pasted link can't make the server fetch anything else.
const GOOGLE_HOST = /(^|\.)(google\.[a-z.]{2,6}|goo\.gl)$/i;
const MAX_HOPS = 5;
const TIMEOUT_MS = 5000;

export const isShortMapLink = (input: string): boolean => /(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(input);

async function followShortLink(start: string): Promise<string | null> {
  let url: URL;
  try { url = new URL(start.trim()); } catch { return null; }
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (url.protocol !== "https:" || !GOOGLE_HOST.test(url.hostname)) return null;
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    await res.body?.cancel();
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) return url.href;
    url = new URL(next, url);
    if (coordsFromMapUrl(url.href)) return url.href;
  }
  return url.href;
}

/**
 * The real point for a pasted link. Short share links are resolved first. Returns null (and a
 * reason) when the link has no pin, so the property is saved without a map.
 */
export async function resolveMapLink(input: string): Promise<{ point: LatLng | null; warning?: string }> {
  const direct = coordsFromMapUrl(input);
  if (direct) return { point: direct };
  if (!isShortMapLink(input)) return { point: null, warning: "The Google Maps link has no pin. Drop a pin in Google Maps and copy that link." };
  try {
    const finalUrl = await followShortLink(input);
    const point = finalUrl ? coordsFromMapUrl(finalUrl) : null;
    return point ? { point } : { point: null, warning: "The short link could not be read. Open it and copy the long address instead." };
  } catch {
    return { point: null, warning: "The short link could not be reached. Try again, or paste the long address." };
  }
}

/** Roughly Nepal, to warn when a pasted pin lands somewhere else. */
export const inNepal = ({ lat, lng }: LatLng): boolean => lat > 26 && lat < 30.6 && lng > 79.9 && lng < 88.4;

/**
 * The centre visitors see in "approximate" mode: the real point moved in a random direction by
 * 350 × √(0.2 + 0.8·u) m (never right on top of it). Generated once per real point and stored.
 */
const MAX_SHIFT_M = 350;
export function shiftedCentre(exact: LatLng): LatLng {
  const rand = (): number => randomInt(0, 1_000_000) / 1_000_000;
  const bearing = rand() * Math.PI * 2;
  const dist = MAX_SHIFT_M * Math.sqrt(0.2 + 0.8 * rand());
  const north = Math.cos(bearing) * dist, east = Math.sin(bearing) * dist;
  return {
    lat: round6(exact.lat + north / 111320),
    lng: round6(exact.lng + east / (111320 * Math.cos((exact.lat * Math.PI) / 180))),
  };
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Where a pin sits (0-100 %) on the frontend's decorative Buy / Rent grid. */
export function gridFromCoords({ lat, lng }: LatLng): { mapX: number; mapY: number } {
  const clamp = (v: number, lo: number, hi: number): number => Math.round(Math.min(hi, Math.max(lo, v)));
  return { mapX: clamp(((lng - 80) / 8.3) * 100, 6, 94), mapY: clamp(((30.5 - lat) / 4.2) * 100, 8, 88) };
}
