// Real links for in-app navigation. Every page has its own address, so navigation is rendered as
// <a href="/buy"> rather than a <button>: search engines can follow it, and visitors can
// middle-click, Ctrl/Cmd-click or "Copy link". A plain click is still handled by App (no reload).
import type { MouseEvent } from "react";

/** A click the browser should handle itself: a new tab or window, or a download. */
const browserClick = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/** onClick for a link App navigates: a plain click runs `go`, other clicks open the link as usual. */
export const follow = (go: () => void) => (e: MouseEvent) => {
  if (e.defaultPrevented || browserClick(e)) return;
  e.preventDefault();
  go();
};

/**
 * onClick for a link inside a clickable card (the card's own onClick navigates): a plain click
 * is left to the card, a Ctrl/middle click opens the link without the card also navigating.
 */
export const leaveToCard = (e: MouseEvent) => {
  if (browserClick(e)) e.stopPropagation();
  else e.preventDefault();
};
