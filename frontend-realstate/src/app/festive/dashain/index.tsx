import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { DASHAIN, dashainActive, type DashainPage } from "./config";

// The one thing App.tsx mounts for Dashain. Outside the festival dates it renders nothing and loads
// nothing: the pop-up and the kite (with three.js) are separate chunks, fetched only while the
// festival is on and only once the loading screen is gone. To take Dashain down, see README.md.

const DashainPopup = lazy(() => import("./DashainPopup"));
const DashainKite = lazy(() => import("./DashainKite"));

const FONT_ID = "nb-dashain-font";
/** Devanagari for the greeting, added to the page only during the festival. */
function useDevanagariFont(on: boolean) {
  useEffect(() => {
    if (!on || document.getElementById(FONT_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_ID; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Serif+Devanagari:wght@500;600&display=swap";
    document.head.appendChild(link);
  }, [on]);
}

function seen(): boolean {
  try { return sessionStorage.getItem(DASHAIN.seenKey) === "1"; } catch { return false; }
}
function markSeen() {
  try { sessionStorage.setItem(DASHAIN.seenKey, "1"); } catch { /* private mode: it may show again */ }
}

export function DashainFestival({ page, ready, go }: {
  /** App's current page name. */
  page: string;
  /** False while the loading screen is up. */
  ready: boolean;
  go: (page: DashainPage) => void;
}) {
  const [active] = useState(dashainActive);
  const [open, setOpen] = useState(false);
  useDevanagariFont(active);

  // Open the greeting once per visit, a moment after the site appears on a pop-up page.
  useEffect(() => {
    if (!active || !ready || seen() || !(DASHAIN.popupPages as readonly string[]).includes(page)) return;
    const t = window.setTimeout(() => { markSeen(); setOpen(true); }, 700);
    return () => window.clearTimeout(t);
  }, [active, ready, page]);

  if (!active) return null;
  const kite = ready && (DASHAIN.kitePages as readonly string[]).includes(page);
  return (
    <Suspense fallback={null}>
      {kite && <DashainKite />}
      <AnimatePresence>{open && <DashainPopup key="dashain" onClose={() => setOpen(false)} onNavigate={go} />}</AnimatePresence>
    </Suspense>
  );
}
