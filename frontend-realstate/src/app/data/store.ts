import { useSyncExternalStore } from "react";

// The data files hold plain arrays. Admin saves call emitChange(), and anything using
// useDataVersion() re-renders. Public pages read the arrays when they open.
// Not needed once the API exists: the admin will refetch instead.
const listeners = new Set<() => void>();
let version = 0;

export function emitChange(): void {
  version++;
  listeners.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Re-render the calling component whenever site data changes. */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

// ─── Local changes vs background refreshes ──────────────────────────────────────
// The site refreshes its property list in the background (PropertySync). That answer can be older
// than a change made in this browser: a refresh that started before an admin's save returns after it,
// or the public list comes from Vercel's edge cache (up to ~90 s old) right after a heart. Changes made
// here are noted, so a background refresh can step aside instead of putting the old values back.
let localVersion = 0;
const touchedAt = new Map<number, number>();

/** Note a change made in this browser (an admin save, a heart), optionally to one property. */
export function noteLocalChange(propertyId?: number): void {
  localVersion++;
  if (propertyId !== undefined) touchedAt.set(propertyId, Date.now());
}

/** Bumped by every local change: a refresh that started before it must not be applied. */
export const localChangeVersion = (): number => localVersion;

/** Changed in this browser within `ms` (so a cached server answer may not show it yet). */
export const changedRecently = (propertyId: number, ms: number): boolean => Date.now() - (touchedAt.get(propertyId) ?? 0) < ms;
