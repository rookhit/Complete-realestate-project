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
