// The only map entry points the rest of the app uses. They keep MapLibre GL out of the main bundle:
// its code (and the map tiles) are fetched only when a map scrolls into view. If that download or
// the map itself fails (e.g. no WebGL), the fallback is shown instead, so a map problem can never
// break the page.
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { AreaMapProps, PropertiesMapProps } from "./maplibre-maps";

const load = () => import("./maplibre-maps");

/**
 * A page with a map below the fold (the property page) calls this: once the browser is idle, the
 * map's code and its worker are fetched quietly, so the map draws at once when it is reached.
 * Skipped when the visitor asked to save data.
 */
export function prefetchMapCode(): void {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  const go = () => { void load().then(m => m.warmUpWorker()).catch(() => undefined); };
  if ("requestIdleCallback" in window) window.requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 2000);
}
const AreaMapImpl = lazy(() => load().then(m => ({ default: m.AreaMap })));
const PropertiesMapImpl = lazy(() => load().then(m => ({ default: m.PropertiesMap })));

class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error("[map] failed to load", error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** True once the element is within 1200 px of the screen (a fast scroll still finds it ready). Stays true. */
function useNearScreen<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "1200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near];
}

function Lazy({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const [ref, near] = useNearScreen<HTMLDivElement>();
  return (
    <div ref={ref} className="absolute inset-0">
      {near && <MapBoundary fallback={fallback}><Suspense fallback={null}>{children}</Suspense></MapBoundary>}
    </div>
  );
}

/** One property's approximate area. Place inside a positioned box that has a height. */
export function AreaMap(props: AreaMapProps & { fallback: ReactNode }) {
  const { fallback, ...rest } = props;
  return <Lazy fallback={fallback}><AreaMapImpl {...rest} /></Lazy>;
}

/** The Buy / Rent map. Place inside a positioned box that has a height. */
export function PropertiesMap(props: PropertiesMapProps & { fallback: ReactNode }) {
  const { fallback, ...rest } = props;
  return <Lazy fallback={fallback}><PropertiesMapImpl {...rest} /></Lazy>;
}
