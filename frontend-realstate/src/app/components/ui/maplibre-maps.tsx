// The real maps: MapLibre GL (open source) drawing OpenFreeMap's vector map (free, no account, no
// key, no view limits). This file is only downloaded when a map is about to appear on screen:
// import the wrappers in ./maps.tsx, never this file directly.
//
// Privacy: visitors only ever see the approximate area (data/maps.ts → approxFor). The exact point
// is drawn only in the admin editor's preview, and as a development-only debug mark.
//
// Every map: "cooperative gestures", so the page scrolls over the map (Ctrl / ⌘ + scroll zooms it)
// and phones move it with two fingers and say so; no rotation or tilt. The hover card is drawn
// outside the map (FloatingCard), fixed above the navbar, so neither the map's edge nor the sticky
// bars can hide it. If OpenFreeMap can't be reached, the map switches to OpenStreetMap's own tiles.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { LngLatBounds, Map as MapLibreMap, NavigationControl, setWorkerUrl, type ExpressionSpecification, type FilterSpecification, type GeoJSONSource, type MapMouseEvent, type StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { Feature, FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre 6 draws in a web worker loaded from its own file. Vite copies that file into the build
// (hashed, served from this site, so the CSP's worker-src 'self' allows it) and gives us its address.
setWorkerUrl(workerUrl);

/** Fetches the worker file into the browser cache ahead of the first map (maps.tsx prefetchMapCode). */
export function warmUpWorker(): void {
  void fetch(workerUrl, { priority: "low" } as RequestInit).catch(() => undefined);
}
import "./map-card.css";
import { blobRing, type LatLng, type PublicArea } from "@/app/data/maps";
import { GOLD, MAROON, WHITE } from "./brand";
import { coverStyle, type Framing } from "./cover-frame";

import { cardSrc, fullPhotoOnError } from "@/app/components/ui/card-photo";
// ─── Public types ─────────────────────────────────────────────────────────────

/** What the pin's hover card shows. */
export type MapCard = {
  title: string; price: string;
  /** Card photo (the cover) and the lines under the title, e.g. "Jawlakhel, Lalitpur". */
  image: string; location: string; listing: string;
  /** The admin's framing of that photo (cover-frame.ts); none = centred. */
  frame?: Framing;
  /** Short facts for the card, e.g. ["4 beds", "3 baths", "4,850 sq.ft"]. */
  facts: string[];
};
/** `exact` only in development builds (the blue debug mark); never set it in production. */
export type MapItem = MapCard & { id: number; area: PublicArea; exact?: LatLng | null };

export type AreaMapProps = {
  area: PublicArea;
  /** The real point. Pass it only in the admin editor ("admin") or in development ("debug"). */
  exact?: LatLng | null;
  exactMode?: "admin" | "debug";
  /** Property page: a pin at the public centre, with the photo card on hover (tap on phones). */
  card?: MapCard;
  className?: string;
};

export type PropertiesMapProps = {
  items: MapItem[];
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  onOpen: (id: number) => void;
};

// ─── Settings ─────────────────────────────────────────────────────────────────

/** OpenFreeMap's "Liberty" style: colourful, street names, building shapes. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
/** Used only when OpenFreeMap can't be reached: OpenStreetMap's own (raster) tiles. */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
/** Nepal, for a map with nothing on it yet. */
const NEPAL: [number, number] = [84.1, 28.2];
/** From this zoom level the Buy / Rent map also draws the approximate areas around the pins. */
const AREA_ZOOM = 14;
/** Street level, for a property shown at its exact location (no area to fit). */
const EXACT_ZOOM = 16;
/** The notices cooperative gestures show. */
const GESTURE_TEXT = {
  "CooperativeGesturesHandler.WindowsHelpText": "Use Ctrl + scroll to zoom the map",
  "CooperativeGesturesHandler.MacHelpText": "Use ⌘ + scroll to zoom the map",
  "CooperativeGesturesHandler.MobileHelpText": "Use two fingers to move the map",
};
/** The admin preview's real point (dark, so it can't be mistaken for the maroon public pin). */
const ADMIN_MARK = "#1a1611";
const DEBUG_MARK = "#1f6feb";

const SRC = { areas: "nb-areas", pins: "nb-pins", marks: "nb-marks" } as const;
const LYR = {
  areaFill: "nb-area-fill", areaLine: "nb-area-line",
  cluster: "nb-cluster", clusterCount: "nb-cluster-count", pin: "nb-pin", pinActive: "nb-pin-active",
  markLine: "nb-mark-line", markDot: "nb-mark-dot",
} as const;
const IMG = { pin: "nb-pin", pinActive: "nb-pin-active" } as const;
/** Pin height on screen (px) and how far its tip sits above the image's bottom edge. */
const PIN_H = 48, PIN_TIP = 5;

/** Touch screens have no hover: the first tap shows the card, the second opens the property. */
const isTouch = (): boolean => window.matchMedia("(hover: none)").matches;

// ─── GeoJSON helpers ──────────────────────────────────────────────────────────

type Props = Record<string, string | number | boolean>;
const collection = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });
const lngLat = (p: LatLng): [number, number] => [p.lng, p.lat];
const pointFeature = (p: LatLng, properties: Props): Feature =>
  ({ type: "Feature", properties, geometry: { type: "Point", coordinates: lngLat(p) } });
function areaFeature(centre: LatLng, shapeSeed: number, id: number): Feature {
  const ring = blobRing(centre, shapeSeed).map(lngLat);
  return { type: "Feature", properties: { id }, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] } };
}
/** The real point and a dashed line to the public centre (admin preview, development debug). */
function exactMarks(exact: LatLng, centre: LatLng, color: string): Feature[] {
  return [
    { type: "Feature", properties: { color }, geometry: { type: "LineString", coordinates: [lngLat(exact), lngLat(centre)] } },
    pointFeature(exact, { color, real: true }),
  ];
}

// ─── Pin images ───────────────────────────────────────────────────────────────

/** The Google Maps style pin, drawn at 2× for sharp screens; its tip is the public centre. */
function pinSvg(active: boolean): string {
  const fill = active ? MAROON : "#b3263a", stroke = active ? GOLD : "#6e1826";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="96" viewBox="-3 -2 36 48">` +
    `<defs><filter id="s" x="-40%" y="-30%" width="180%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity=".35"/></filter></defs>` +
    `<path filter="url(#s)" d="M15 41C15 41 28 25.6 28 14.5 28 6.9 22.2 1 15 1S2 6.9 2 14.5C2 25.6 15 41 15 41Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
    `<circle cx="15" cy="14.5" r="5.2" fill="${WHITE}"/></svg>`;
}
type PinImages = [HTMLImageElement, HTMLImageElement];
let pinImages: Promise<PinImages> | null = null;
function loadPinImages(): Promise<PinImages> {
  const load = (active: boolean) => {
    const img = new Image(72, 96);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(active))}`;
    return img.decode().then(() => img);
  };
  pinImages ??= Promise.all([load(false), load(true)]);
  return pinImages;
}

// ─── The map itself ───────────────────────────────────────────────────────────

type MapState = {
  map: MapLibreMap | null;
  /** Goes up each time a base style has loaded: our sources and layers must be (re)added. */
  styleVersion: number;
  failure: Error | null;
};

/** Creates the map once (after the pin images are ready) and removes it on unmount. */
function useMap(ref: RefObject<HTMLDivElement>): MapState {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const [failure, setFailure] = useState<Error | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let m: MapLibreMap | null = null;
    let ro: ResizeObserver | null = null;
    let cancelled = false;
    loadPinImages().then(([pin, active]) => {
      if (cancelled) return;
      const created = new MapLibreMap({
        container: el, style: STYLE_URL, center: NEPAL, zoom: 6.2,
        cooperativeGestures: true, locale: GESTURE_TEXT,
        // The credits as an (i) button, so they don't cover a phone-sized map.
        attributionControl: { compact: true },
        dragRotate: false, pitchWithRotate: false, touchPitch: false, maxPitch: 0,
      });
      m = created;
      created.touchZoomRotate.disableRotation();
      created.addControl(new NavigationControl({ showCompass: false }), "top-right");
      // A newly loaded style has none of our images: add them, and tell the callers to draw.
      const onStyle = () => {
        if (!created.isStyleLoaded() || created.hasImage(IMG.pin)) return;
        created.addImage(IMG.pin, pin, { pixelRatio: 2 });
        created.addImage(IMG.pinActive, active, { pixelRatio: 2 });
        setStyleVersion(v => v + 1);
      };
      created.on("styledata", onStyle);
      created.on("load", onStyle);
      // OpenFreeMap unreachable (style or its tiles): fall back to OpenStreetMap's tiles, once.
      let fellBack = false;
      created.on("error", e => {
        const url = (e as { sourceId?: string; error?: { url?: string } }).error?.url ?? "";
        const ours = !url || url.includes("openfreemap.org");
        if (!fellBack && ours && !created.loaded()) {
          fellBack = true;
          console.warn("[map] OpenFreeMap unavailable, using OpenStreetMap tiles", e.error?.message);
          created.setStyle(FALLBACK_STYLE);
        } else {
          console.warn("[map]", e.error?.message ?? e);
        }
      });
      // Page transitions animate the container, so the map re-measures when its size changes.
      ro = new ResizeObserver(() => created.resize());
      ro.observe(el);
      setMap(created);
    }).catch(e => { if (!cancelled) setFailure(e instanceof Error ? e : new Error(String(e))); });   // e.g. no WebGL
    return () => { cancelled = true; ro?.disconnect(); m?.remove(); setMap(null); };
  }, [ref]);

  return { map, styleVersion, failure };
}

type LayerSpec = Parameters<MapLibreMap["addLayer"]>[0];
type SourceSpec = Extract<Parameters<MapLibreMap["addSource"]>[1], { type: "geojson" }>;

/** Adds the source, or replaces its data if it is already there. */
function setSource(map: MapLibreMap, id: string, data: FeatureCollection, options: Omit<SourceSpec, "type" | "data"> = {}): void {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  if (src) void src.setData(data);
  else map.addSource(id, { type: "geojson", data, ...options });
}
/** Adds the missing layers; `beforeId` puts them under that layer of the base map. */
function addLayers(map: MapLibreMap, layers: LayerSpec[], beforeId?: string): void {
  for (const l of layers) if (!map.getLayer(l.id)) map.addLayer(l, beforeId && map.getLayer(beforeId) ? beforeId : undefined);
}
/** The base map's first label layer: the shaded areas go under the street and place names. */
const firstLabelLayer = (map: MapLibreMap): string | undefined =>
  map.getStyle().layers.find(l => l.type === "symbol")?.id;
const isActive: ExpressionSpecification = ["boolean", ["feature-state", "active"], false];
/** A single pin (not a cluster) whose id is, or isn't, `id`. */
const pinFilter = (op: "==" | "!=", id: number): FilterSpecification => ["all", ["!", ["has", "point_count"]], [op, ["get", "id"], id]];

/** The approximate areas (shaded, irregular, ~500 m across). */
function drawAreas(map: MapLibreMap, features: Feature[], minzoom: number): void {
  setSource(map, SRC.areas, collection(features), { promoteId: "id" });
  addLayers(map, [
    { id: LYR.areaFill, type: "fill", source: SRC.areas, minzoom,
      paint: { "fill-color": MAROON, "fill-opacity": ["case", isActive, 0.28, 0.16] } } as LayerSpec,
    { id: LYR.areaLine, type: "line", source: SRC.areas, minzoom,
      paint: { "line-color": MAROON, "line-opacity": 0.9, "line-width": ["case", isActive, 2.5, 1.5] } } as LayerSpec,
  ], firstLabelLayer(map));
}

/** The pins (grouped into numbered circles when `cluster`), plus the hovered one, larger. */
function drawPins(map: MapLibreMap, features: Feature[], cluster: boolean): void {
  setSource(map, SRC.pins, collection(features), cluster ? { cluster: true, clusterRadius: 48, clusterMaxZoom: 15 } : {});
  addLayers(map, [
    ...(cluster ? [
      { id: LYR.cluster, type: "circle", source: SRC.pins, filter: ["has", "point_count"],
        paint: { "circle-color": MAROON, "circle-radius": 20, "circle-stroke-width": 3, "circle-stroke-color": GOLD } } as LayerSpec,
      { id: LYR.clusterCount, type: "symbol", source: SRC.pins, filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-allow-overlap": true },
        paint: { "text-color": WHITE } } as LayerSpec,
    ] : []),
    { id: LYR.pin, type: "symbol", source: SRC.pins, filter: pinFilter("!=", -1),
      layout: { "icon-image": IMG.pin, "icon-anchor": "bottom", "icon-offset": [0, PIN_TIP], "icon-allow-overlap": true, "icon-ignore-placement": true } } as LayerSpec,
    { id: LYR.pinActive, type: "symbol", source: SRC.pins, filter: pinFilter("==", -1),
      layout: { "icon-image": IMG.pinActive, "icon-size": 1.18, "icon-anchor": "bottom", "icon-offset": [0, PIN_TIP], "icon-allow-overlap": true, "icon-ignore-placement": true } } as LayerSpec,
  ]);
}

/** Shows pin `id` as the hovered one, and darkens its area. -1 = none. */
function setActive(map: MapLibreMap, id: number, previous: number): void {
  if (!map.getLayer(LYR.pin)) return;
  map.setFilter(LYR.pin, pinFilter("!=", id));
  map.setFilter(LYR.pinActive, pinFilter("==", id));
  if (!map.getSource(SRC.areas)) return;
  if (previous >= 0) map.setFeatureState({ source: SRC.areas, id: previous }, { active: false });
  if (id >= 0) map.setFeatureState({ source: SRC.areas, id }, { active: true });
}

/** The real point and its dashed line (admin preview; development debug). */
function drawMarks(map: MapLibreMap, features: Feature[]): void {
  setSource(map, SRC.marks, collection(features));
  addLayers(map, [
    { id: LYR.markLine, type: "line", source: SRC.marks, filter: ["==", ["geometry-type"], "LineString"],
      paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-opacity": 0.75, "line-dasharray": [2, 2] } } as LayerSpec,
    { id: LYR.markDot, type: "circle", source: SRC.marks, filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-color": ["get", "color"], "circle-radius": 6, "circle-stroke-width": 2, "circle-stroke-color": WHITE } } as LayerSpec,
  ]);
}

/** The topmost of our features under the pointer (only layers that exist on this map). */
function featureAt(map: MapLibreMap, e: MapMouseEvent, layers: string[]) {
  const present = layers.filter(l => map.getLayer(l));
  return present.length ? map.queryRenderedFeatures(e.point, { layers: present })[0] : undefined;
}

/** True while pin `at` is drawn on its own (not grouped into a cluster, not off the map). */
function pinDrawn(map: MapLibreMap, at: LatLng): boolean {
  if (!map.getLayer(LYR.pinActive)) return false;
  const p = map.project(lngLat(at));
  return map.queryRenderedFeatures([[p.x - 3, p.y - 24], [p.x + 3, p.y]], { layers: [LYR.pinActive] }).length > 0;
}

// ─── The floating card ────────────────────────────────────────────────────────

type Float = {
  at: LatLng;
  content: ReactNode;
  kind: "card" | "tip";
  /** Pixels between the point and the card's arrow: a pin's height, or a little for a plain point. */
  lift: number;
  /** Touch: the card itself opens the property. */
  onClick?: () => void;
  /** Hide it while this says the point isn't drawn (e.g. its pin is inside a cluster). */
  drawn?: (map: MapLibreMap) => boolean;
};
type Placement = { left: number; top: number; arrow: number; below: boolean; shown: boolean };

/**
 * Drawn in <body>, fixed above everything on the page: it follows the point as the map or the page
 * moves, sits above the point (below it when there is no room above the screen's top edge), stays
 * inside the screen sideways, and hides when the point leaves the map.
 */
function FloatingCard({ map, float }: { map: MapLibreMap; float: Float }) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<Placement | null>(null);
  const spec = useRef(float);
  spec.current = float;

  useLayoutEffect(() => {
    let raf = 0;
    const place = () => {
      raf = 0;
      const f = spec.current;
      const r = map.getContainer().getBoundingClientRect();
      const p = map.project(lngLat(f.at));
      const inside = p.x >= 0 && p.y >= 0 && p.x <= r.width && p.y <= r.height;
      const w = box.current?.offsetWidth ?? 250, h = box.current?.offsetHeight ?? 200;
      const x = r.left + p.x, y = r.top + p.y;
      let top = y - f.lift - 10 - h, below = false;
      if (top < 8) { top = y + 12; below = true; }
      const left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8);
      const next: Placement = { left, top, arrow: Math.min(Math.max(14, x - left), w - 14), below, shown: inside && (f.drawn?.(map) ?? true) };
      setAt(prev => prev && prev.left === next.left && prev.top === next.top && prev.arrow === next.arrow
        && prev.below === next.below && prev.shown === next.shown ? prev : next);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    map.on("render", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      map.off("render", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [map]);
  // A new point or new content: measure and place again on the next frame.
  useLayoutEffect(() => { map.triggerRepaint(); }, [map, float.at.lat, float.at.lng, float.content]);

  const cls = ["nb-map-float", at?.below ? "nb-map-float--below" : "nb-map-float--above",
    float.kind === "tip" ? "nb-map-float--tip" : "", float.onClick ? "nb-map-float--interactive" : ""].join(" ");
  return createPortal(
    <div ref={box} className={cls} role={float.onClick ? "button" : undefined} tabIndex={float.onClick ? 0 : undefined}
      onClick={float.onClick} onKeyDown={e => { if (float.onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); float.onClick(); } }}
      style={{ left: at?.left ?? -9999, top: at?.top ?? -9999, opacity: at?.shown ? 1 : 0, visibility: at?.shown ? "visible" : "hidden" }}>
      {float.content}
      <span className="nb-map-float__arrow" style={{ left: at?.arrow ?? 0 }} aria-hidden="true" />
    </div>,
    document.body,
  );
}

function PropertyCardBody({ card, precise, tapToOpen }: { card: MapCard; precise: boolean; tapToOpen?: boolean }) {
  return (
    <div className="nb-map-card">
      <div className="nb-map-card__inner">
        <div className="nb-map-card__photo">
          <img src={cardSrc(card.image)} onError={fullPhotoOnError(card.image)} alt="" loading="lazy" style={coverStyle(card.frame)} />
          <span className="nb-map-card__tag">{card.listing}</span>
        </div>
        <div className="nb-map-card__body">
          <p className="nb-map-card__price">{card.price}</p>
          <p className="nb-map-card__title">{card.title}</p>
          <p className="nb-map-card__place">{card.location}{precise ? "" : " · approximate area"}</p>
          {card.facts.length > 0 && <div className="nb-map-card__facts">{card.facts.map(f => <span key={f} className="nb-map-card__fact">{f}</span>)}</div>}
          {tapToOpen && <span className="nb-map-card__open">Tap to view property →</span>}
        </div>
      </div>
    </div>
  );
}

const tip = (text: string) => <div className="nb-map-tip">{text}</div>;

function MapFrame({ el, background, className = "", children }:
  { el: RefObject<HTMLDivElement>; background: string; className?: string; children?: ReactNode }) {
  return (
    <div className={`relative w-full h-full ${className}`} style={{ isolation: "isolate", background }}>
      {/* Inline: MapLibre's own stylesheet sets position: relative on this element, which would
          override a class and leave the map 0 px tall. */}
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {children}
    </div>
  );
}

/** Thrown during render, so ./maps.tsx's error boundary shows the caller's fallback. */
function assertUsable(failure: Error | null): void {
  if (failure) throw failure;
}

// ─── One property: property page, admin editor preview ────────────────────────

type AreaHover = { kind: "pin" | "area" | "real"; at: LatLng } | null;

/**
 * One property's location. Approximate: the shaded area around the shifted centre. Exact
 * (`area.precise`): a pin on the real point only. With `card`, the pin shows the property card.
 */
export function AreaMap({ area, exact, exactMode = "debug", card, className = "" }: AreaMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const { map, styleVersion, failure } = useMap(el);
  assertUsable(failure);
  const [hover, setHover] = useState<AreaHover>(null);
  const [pinned, setPinned] = useState(false);
  const adminPreview = exactMode === "admin";
  const showPin = !!card || area.precise || adminPreview;
  const showReal = !!exact && !area.precise && (adminPreview || import.meta.env.DEV);
  const placeKey = `${area.centre.lat},${area.centre.lng},${area.shapeSeed},${area.precise},${exact?.lat},${exact?.lng},${exactMode},${showPin}`;

  // Draw (again after a fallback style); fit the view only when the place itself changes.
  const fitted = useRef("");
  useEffect(() => {
    if (!map || !styleVersion) return;
    drawAreas(map, area.precise ? [] : [areaFeature(area.centre, area.shapeSeed, 0)], 0);
    drawPins(map, showPin ? [pointFeature(area.centre, { id: 0 })] : [], false);
    drawMarks(map, showReal && exact ? exactMarks(exact, area.centre, adminPreview ? ADMIN_MARK : DEBUG_MARK) : []);
    if (fitted.current === placeKey) return;
    fitted.current = placeKey;
    if (area.precise) { map.jumpTo({ center: lngLat(area.centre), zoom: EXACT_ZOOM }); return; }
    const b = new LngLatBounds();
    for (const q of blobRing(area.centre, area.shapeSeed)) b.extend(lngLat(q));
    map.fitBounds(b, { padding: 28, duration: 0 });
    // `placeKey` covers every input; the objects themselves are rebuilt on each render.
  }, [map, styleVersion, placeKey]);

  // The pin grows and the area darkens while the pin is hovered (or its card is open on a phone).
  const pinActive = pinned || hover?.kind === "pin";
  useEffect(() => { if (map && styleVersion) setActive(map, pinActive ? 0 : -1, 0); }, [map, styleVersion, pinActive]);

  useEffect(() => {
    if (!map) return;
    const layers = [LYR.markDot, LYR.pinActive, LYR.pin, LYR.areaFill];
    const hit = (e: MapMouseEvent): AreaHover => {
      const f = featureAt(map, e, layers);
      if (!f) return null;
      const kind = f.layer.id === LYR.markDot ? "real" : f.layer.id === LYR.areaFill ? "area" : "pin";
      return { kind, at: { lat: e.lngLat.lat, lng: e.lngLat.lng } };
    };
    const onMove = (e: MapMouseEvent) => {
      if (isTouch()) return;
      const h = hit(e);
      map.getCanvas().style.cursor = h?.kind === "pin" ? "pointer" : "";
      setHover(prev => (!h && !prev) || (h && prev && h.kind === prev.kind && h.kind !== "area") ? prev : h);
    };
    const onLeave = () => { map.getCanvas().style.cursor = ""; setHover(null); };
    const onClick = (e: MapMouseEvent) => { if (isTouch()) setPinned(hit(e)?.kind === "pin" ? p => !p : false); };
    map.on("mousemove", onMove);
    map.on("mouseout", onLeave);
    map.on("click", onClick);
    return () => { map.off("mousemove", onMove); map.off("mouseout", onLeave); map.off("click", onClick); };
  }, [map]);

  const pinLabel = area.precise ? "Exact location (shown to visitors)" : "Public pin: what visitors see (the real point is hidden)";
  let float: Float | null = null;
  if ((pinned || hover?.kind === "pin") && showPin) {
    float = card
      ? { at: area.centre, kind: "card", lift: PIN_H * 1.18, content: <PropertyCardBody card={card} precise={area.precise} /> }
      : { at: area.centre, kind: "tip", lift: PIN_H * 1.18, content: tip(pinLabel) };
  } else if (hover?.kind === "real" && exact) {
    float = { at: exact, kind: "tip", lift: 10, content: tip(adminPreview ? "Real point (admin only, never shown to visitors)" : "DEV ONLY: real point (not in production)") };
  } else if (hover?.kind === "area" && !showPin) {
    float = { at: hover.at, kind: "tip", lift: 8, content: tip("Approximate location") };
  }

  return (
    <MapFrame el={el} background="#e9e3d8" className={className}>
      {map && float && <FloatingCard map={map} float={float} />}
    </MapFrame>
  );
}

// ─── Many properties: the Buy / Rent map view ─────────────────────────────────

/**
 * A pin at each property's public centre (grouped into numbered circles when they overlap; click
 * one to zoom in). Hover a pin, or a card in the list, for its card; from street level (AREA_ZOOM)
 * the approximate areas are drawn too. Phones: tap a pin for its card, tap the card to open it.
 */
export function PropertiesMap({ items, hoveredId, onHover, onOpen }: PropertiesMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const { map, styleVersion, failure } = useMap(el);
  assertUsable(failure);
  const handlers = useRef({ onHover, onOpen });
  handlers.current = { onHover, onOpen };
  const [pinned, setPinned] = useState<number | null>(null);
  const itemsKey = items.map(i => `${i.id}:${i.area.centre.lat},${i.area.centre.lng}:${i.area.precise}:${i.area.shapeSeed}:${i.exact?.lat},${i.exact?.lng}`).join("|");

  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (!map || !styleVersion) return;
    drawAreas(map, items.filter(i => !i.area.precise).map(i => areaFeature(i.area.centre, i.area.shapeSeed, i.id)), AREA_ZOOM);
    drawPins(map, items.map(i => pointFeature(i.area.centre, { id: i.id })), true);
    drawMarks(map, import.meta.env.DEV ? items.flatMap(i => (i.exact && !i.area.precise ? exactMarks(i.exact, i.area.centre, DEBUG_MARK) : [])) : []);
    if (fitted.current === itemsKey) return;
    fitted.current = itemsKey;
    if (!items.length) { map.jumpTo({ center: NEPAL, zoom: 6.2 }); return; }
    const b = new LngLatBounds();
    for (const i of items) b.extend(lngLat(i.area.centre));
    map.fitBounds(b, { padding: 60, maxZoom: 13, duration: 0 });
    // `itemsKey` covers everything that is drawn.
  }, [map, styleVersion, itemsKey]);

  // The open card: a pin tapped on a phone, else the pin or list card under the mouse.
  const shownId = pinned !== null && items.some(i => i.id === pinned) ? pinned : hoveredId;
  const lastActive = useRef(-1);
  useEffect(() => {
    if (!map || !styleVersion) return;
    const id = shownId ?? -1;
    setActive(map, id, lastActive.current);
    lastActive.current = id;
  }, [map, styleVersion, shownId]);

  useEffect(() => {
    if (!map) return;
    const layers = [LYR.cluster, LYR.pinActive, LYR.pin, LYR.areaFill];
    let over: number | null = null;
    const onMove = (e: MapMouseEvent) => {
      if (isTouch()) return;
      const f = featureAt(map, e, layers);
      map.getCanvas().style.cursor = f ? "pointer" : "";
      const id = f && f.layer.id !== LYR.cluster ? Number(f.properties.id) : null;
      if (id !== over) { over = id; handlers.current.onHover(id); }
    };
    const onLeave = () => { map.getCanvas().style.cursor = ""; if (over !== null) { over = null; handlers.current.onHover(null); } };
    const onClick = (e: MapMouseEvent) => {
      const f = featureAt(map, e, layers);
      if (!f) { setPinned(null); return; }
      if (f.layer.id === LYR.cluster) {
        if (f.geometry.type !== "Point") return;
        const [lng, lat] = f.geometry.coordinates;
        void (map.getSource(SRC.pins) as GeoJSONSource).getClusterExpansionZoom(Number(f.properties.cluster_id))
          .then(zoom => map.easeTo({ center: [lng, lat], zoom: zoom + 0.5 }))
          .catch(() => {});
        return;
      }
      const id = Number(f.properties.id);
      if (!isTouch()) { handlers.current.onOpen(id); return; }
      setPinned(id);
    };
    map.on("mousemove", onMove);
    map.on("mouseout", onLeave);
    map.on("click", onClick);
    return () => { map.off("mousemove", onMove); map.off("mouseout", onLeave); map.off("click", onClick); };
  }, [map]);

  const item = shownId === null ? undefined : items.find(i => i.id === shownId);
  const tapToOpen = pinned !== null && item?.id === pinned;
  const float: Float | null = item ? {
    at: item.area.centre, kind: "card", lift: PIN_H * 1.18,
    content: <PropertyCardBody card={item} precise={item.area.precise} tapToOpen={tapToOpen} />,
    onClick: tapToOpen ? () => handlers.current.onOpen(item.id) : undefined,
    drawn: m => pinDrawn(m, item.area.centre),
  } : null;

  return (
    <MapFrame el={el} background="#e8e4df">
      {map && float && <FloatingCard map={map} float={float} />}
    </MapFrame>
  );
}
