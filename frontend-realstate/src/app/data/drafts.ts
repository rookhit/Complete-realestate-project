import { useCallback, useEffect, useState } from "react";

// What a visitor has typed into a site form, kept in sessionStorage (this tab only) so it is
// still there after a sign-in prompt or a lapsed session sends them to the login page and back.
// Cleared once the form is sent. If storage is blocked the form simply starts empty.

const PREFIX = "nb-draft:";

function read<T>(key: string, initial: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw === null ? initial : { ...initial, ...JSON.parse(raw) };
  } catch {
    return initial;
  }
}

/** Whether something was typed into this form earlier in the tab. */
export function hasDraft(key: string): boolean {
  try { return sessionStorage.getItem(PREFIX + key) !== null; } catch { return false; }
}

/** useState for a form's fields object, kept for the tab. Returns [value, setValue, clear]. */
export function useDraft<T extends object>(key: string, initial: T): [T, (next: T | ((old: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  const blank = JSON.stringify(initial);
  useEffect(() => {
    try {
      const json = JSON.stringify(value);
      if (json === blank) sessionStorage.removeItem(PREFIX + key);
      else sessionStorage.setItem(PREFIX + key, json);
    } catch { /* storage blocked: the draft just isn't kept */ }
  }, [key, value, blank]);
  const clear = useCallback(() => {
    try { sessionStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
    setValue(JSON.parse(blank) as T);
  }, [key, blank]);
  return [value, setValue, clear];
}
