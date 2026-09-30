// The only map entry points the rest of the app uses. They keep Leaflet out of the main bundle:
// its code (and the map tiles) are fetched only when a map scrolls into view. If that download or
// the map itself fails, the fallback is shown instead, so a map problem can never break the page.
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import type { AreaMapProps, PropertiesMapProps } from "./leaflet-maps";

const load = () => import("./leaflet-maps");
const AreaMapImpl = lazy(() => load().then(m => ({ default: m.AreaMap })));
const PropertiesMapImpl = lazy(() => load().then(m => ({ default: m.PropertiesMap })));

class MapBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error("[map] failed to load", error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** True once the element is within 300 px of the screen. Stays true. */
function useNearScreen<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "300px" });
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
