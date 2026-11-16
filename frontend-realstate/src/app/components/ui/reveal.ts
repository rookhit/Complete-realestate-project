import { useEffect, useRef } from "react";

/** The fixed menu bar's height, plus a little air, so a revealed message isn't hidden under it. */
const NAV_SPACE = 104;

/**
 * Bring an element into view when `show` turns true, unless it is already fully on screen.
 * For a form's "sent" message: the long form is swapped for a short message, the page gets
 * shorter, and the browser would otherwise leave the reader looking at the footer.
 * Put the returned ref on the message.
 */
export function useRevealWhen<T extends HTMLElement>(show: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!show) return;
    // After the swap has been laid out (and the page has shrunk).
    const raf = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top >= NAV_SPACE && r.bottom <= window.innerHeight) return;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(0, window.scrollY + r.top - NAV_SPACE), behavior: still ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [show]);
  return ref;
}
