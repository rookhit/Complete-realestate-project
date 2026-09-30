// The real maps (Leaflet + OpenStreetMap tiles, no API key). This file is only downloaded when a
// map is about to appear on screen: import the wrappers in ./maps.tsx, never this file directly.
// Visitors only ever see the approximate area (data/maps.ts → approxFor); the exact point is drawn
// only for the admin, and as a development-only debug pin.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./leaflet-maps.css";
import { blobRing, type LatLng, type PublicArea } from "@/app/data/maps";
import { GOLD, MAROON, WHITE, sans } from "./brand";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
/** From this zoom level the Buy / Rent map also draws the approximate areas around the pins. */
const AREA_ZOOM = 14;

const toLL = (p: LatLng): L.LatLngTuple => [p.lat, p.lng];
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const areaStyle = (active: boolean): L.PathOptions =>
  ({ color: MAROON, weight: active ? 2.5 : 1.5, opacity: 0.9, fillColor: MAROON, fillOpacity: active ? 0.28 : 0.16 });

/**
 * Creates the map once and removes it on unmount. With the cursor over the map, the mouse wheel
 * zooms the map instead of scrolling the page. One-finger dragging is off on phones (so the page
 * still scrolls there; the + / − buttons and pinch still work).
 */
function useLeaflet(ref: React.RefObject<HTMLDivElement | null>): React.RefObject<L.Map | null> {
  const mapRef = useRef<L.Map | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const map = L.map(el, { scrollWheelZoom: true, wheelPxPerZoomLevel: 90, dragging: !L.Browser.mobile, zoomSnap: 0.5 });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    map.attributionControl.setPrefix(false);
    // The page transitions animate the container, so Leaflet re-measures when its size changes.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    mapRef.current = map;
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, [ref]);
  return mapRef;
}

export type AreaMapProps = {
  area: PublicArea;
  /** The real point. Pass it only in the admin editor ("admin") or in development ("debug"). */
  exact?: LatLng | null;
  exactMode?: "admin" | "debug";
  /** Property page: a Google Maps style pin at the public centre, with the photo card on hover. */
  card?: MapCard;
  className?: string;
};

/**
 * Development only (callers pass `exact` only when import.meta.env.DEV): the real point in blue,
 * and a dashed line to the public centre, to check how far it was moved.
 */
function addDebugPin(layers: L.LayerGroup, exact: LatLng, centre: LatLng): void {
  if (!import.meta.env.DEV) return;   // removed from production builds
  L.polyline([toLL(exact), toLL(centre)], { color: "#1f6feb", weight: 1.5, dashArray: "4 4", interactive: false }).addTo(layers);
  L.circleMarker(toLL(centre), { radius: 3, color: "#1f6feb", weight: 1, fillOpacity: 1 }).addTo(layers)
    .bindTooltip("DEV: public centre", { direction: "right" });
  L.circleMarker(toLL(exact), { radius: 6, color: WHITE, weight: 2, fillColor: "#1f6feb", fillOpacity: 1 }).addTo(layers)
    .bindTooltip("DEV ONLY: real point (not in production)", { direction: "right" });
}

/** The admin preview's real-point dot (dark, so it can't be mistaken for the maroon public pin). */
const FG_DARK_DOT = "#1a1611";

/** Street-level zoom for a property shown at its exact location (no area to fit). */
const EXACT_ZOOM = 16;

/**
 * One property's location: the property page and the admin editor preview. Approximate: the
 * shaded area around the shifted centre. Exact (`area.precise`): a pin on the real point only.
 */
export function AreaMap({ area, exact, exactMode = "debug", card, className = "" }: AreaMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useLeaflet(el);
  const key = `${area.centre.lat},${area.centre.lng},${area.shapeSeed},${area.precise},${exact?.lat},${exact?.lng},${exactMode},${card ? cardHtml(card, area.precise) : ""}`;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = L.layerGroup().addTo(map);
    const blob = area.precise ? null : L.polygon(blobRing(area.centre, area.shapeSeed).map(toLL), areaStyle(false)).addTo(layers);
    // The public pin: always on the property page (with its card), and in the admin preview so the
    // admin sees exactly where visitors' pin will be.
    const adminPreview = exactMode === "admin";
    if (card || area.precise || adminPreview) {
      const label = area.precise ? "Exact location (shown to visitors)" : "Public pin: what visitors see (the real point is hidden)";
      const pin = L.marker(toLL(area.centre), { icon: pinIcon(false), keyboard: true, title: card?.title ?? label, alt: card?.title ?? label, riseOnHover: true })
        .bindTooltip(card ? cardHtml(card, area.precise) : label, card ? { direction: "top", className: "nb-map-card", opacity: 1 } : { direction: "top" })
        .addTo(layers);
      pin.on("mouseover", () => { pin.setIcon(pinIcon(true)); blob?.setStyle(areaStyle(true)); });
      pin.on("mouseout", () => { pin.setIcon(pinIcon(false)); blob?.setStyle(areaStyle(false)); });
    } else {
      blob?.bindTooltip("Approximate location", { sticky: true, direction: "top" });
    }
    // In exact mode the pin already is the real point, so there is nothing more to show.
    if (exact && !area.precise && adminPreview) {
      // Admin only: the real point as a dark dot, joined to the public pin by a dashed line.
      L.polyline([toLL(exact), toLL(area.centre)], { color: FG_DARK_DOT, weight: 1.5, opacity: 0.7, dashArray: "4 4", interactive: false }).addTo(layers);
      L.circleMarker(toLL(exact), { radius: 6, color: WHITE, weight: 2, fillColor: FG_DARK_DOT, fillOpacity: 1 })
        .addTo(layers).bindTooltip("Real point (admin only, never shown to visitors)", { direction: "right" });
    } else if (exact && !area.precise) {
      addDebugPin(layers, exact, area.centre);
    }
    if (blob) map.fitBounds(blob.getBounds(), { padding: [28, 28], animate: false });
    else map.setView(toLL(area.centre), EXACT_ZOOM, { animate: false });
    return () => { layers.remove(); };
    // `key` covers every input; the objects themselves are rebuilt on each render.
  }, [mapRef, key]);

  return <div ref={el} className={`w-full h-full ${className}`} style={{ isolation: "isolate", background: "#e9e3d8" }} />;
}

/** What the pin's hover card shows. */
export type MapCard = {
  title: string; price: string;
  /** Card photo (the cover) and the lines under the title, e.g. "Jawlakhel, Lalitpur". */
  image: string; location: string; listing: string;
  /** Short facts for the card, e.g. ["4 beds", "3 baths", "4,850 sq.ft"]. */
  facts: string[];
};
/** `exact` only in development builds (the blue debug pin); never set it in production. */
export type MapItem = MapCard & { id: number; area: PublicArea; exact?: LatLng | null };
export type PropertiesMapProps = {
  items: MapItem[];
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  onOpen: (id: number) => void;
};

/** A Google Maps style pin; its tip is exactly on the area's public centre. */
const PIN_W = 30, PIN_H = 42;
const pinIcon = (active: boolean) => L.divIcon({
  className: "nb-map-pin",
  iconSize: [PIN_W, PIN_H],
  iconAnchor: [PIN_W / 2, PIN_H],
  tooltipAnchor: [0, -PIN_H + 4],
  html: `<svg width="${PIN_W}" height="${PIN_H}" viewBox="0 0 30 42" aria-hidden="true" style="display:block;overflow:visible;` +
    `transform:scale(${active ? 1.18 : 1});transform-origin:50% 100%;transition:transform .15s;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">` +
    `<path d="M15 41C15 41 28 25.6 28 14.5 28 6.9 22.2 1 15 1S2 6.9 2 14.5C2 25.6 15 41 15 41Z" fill="${active ? MAROON : "#b3263a"}" stroke="${active ? GOLD : "#6e1826"}" stroke-width="1.5"/>` +
    `<circle cx="15" cy="14.5" r="5.2" fill="${WHITE}"/></svg>`,
});

/** The hover card: photo on top, then price, title, place and a few facts. */
function cardHtml(it: MapCard, precise: boolean): string {
  const facts = it.facts.map(f => `<span class="nb-map-card__fact">${escapeHtml(f)}</span>`).join("");
  return `<div class="nb-map-card__inner">` +
    `<div class="nb-map-card__photo"><img src="${escapeHtml(it.image)}" alt="" loading="lazy">` +
    `<span class="nb-map-card__tag">${escapeHtml(it.listing)}</span></div>` +
    `<div class="nb-map-card__body"><p class="nb-map-card__price">${escapeHtml(it.price)}</p>` +
    `<p class="nb-map-card__title">${escapeHtml(it.title)}</p>` +
    `<p class="nb-map-card__place">${escapeHtml(it.location)}${precise ? "" : " · approximate area"}</p>` +
    (facts ? `<div class="nb-map-card__facts">${facts}</div>` : "") + `</div></div>`;
}

const clusterIcon = (cluster: L.MarkerCluster) => L.divIcon({
  className: "",
  iconSize: [40, 40],
  html: `<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;` +
    `font:600 13px ${sans.fontFamily};color:${WHITE};background:${MAROON};border:3px solid ${GOLD};box-shadow:0 2px 8px rgba(0,0,0,.3)">` +
    `${cluster.getChildCount()}</div>`,
});

/**
 * The Buy / Rent map: a pin at each property's public centre (grouped when they overlap); hover
 * a pin for its card. From street level (AREA_ZOOM) the approximate areas are drawn around the pins.
 * Touch screens have no hover, so a tap opens the property straight away.
 */
export function PropertiesMap({ items, hoveredId, onHover, onOpen }: PropertiesMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useLeaflet(el);
  const handlers = useRef({ onHover, onOpen });
  handlers.current = { onHover, onOpen };
  const drawn = useRef(new Map<number, { marker: L.Marker; blob: L.Polygon | null }>());
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const itemsKey = items.map(i => `${i.id}:${i.area.centre.lat},${i.area.centre.lng}:${i.area.precise}:${i.price}:${i.image}:${i.facts.join()}:${i.exact?.lat},${i.exact?.lng}`).join("|");

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48, iconCreateFunction: clusterIcon }).addTo(map);
    clusterRef.current = markers;
    const blobs = L.layerGroup();
    // Development-only debug pins, shown at every zoom level.
    const debug = L.layerGroup().addTo(map);
    drawn.current.clear();
    for (const it of items) {
      // Exact-location properties: the pin is the real point, with no area and no debug line.
      if (it.exact && !it.area.precise) addDebugPin(debug, it.exact, it.area.centre);
      const marker = L.marker(toLL(it.area.centre), { icon: pinIcon(false), keyboard: true, title: it.title, alt: it.title, riseOnHover: true })
        .bindTooltip(cardHtml(it, it.area.precise), { direction: "top", className: "nb-map-card", opacity: 1 });
      const blob = it.area.precise ? null : L.polygon(blobRing(it.area.centre, it.area.shapeSeed).map(toLL), areaStyle(false));
      for (const layer of blob ? [marker, blob] : [marker]) {
        layer.on("mouseover", () => handlers.current.onHover(it.id));
        layer.on("mouseout", () => handlers.current.onHover(null));
        layer.on("click", () => handlers.current.onOpen(it.id));
      }
      markers.addLayer(marker);
      if (blob) blobs.addLayer(blob);
      drawn.current.set(it.id, { marker, blob });
    }
    const showForZoom = () => {
      if (map.getZoom() >= AREA_ZOOM) blobs.addTo(map); else blobs.remove();
      debug.eachLayer(l => (l as L.Path).bringToFront());
    };
    map.on("zoomend", showForZoom);
    if (items.length) map.fitBounds(L.latLngBounds(items.map(i => toLL(i.area.centre))), { padding: [60, 60], maxZoom: 13, animate: false });
    else map.setView([28.2, 84.1], 7, { animate: false });   // Nepal
    showForZoom();
    return () => { map.off("zoomend", showForZoom); markers.remove(); blobs.remove(); debug.remove(); drawn.current.clear(); clusterRef.current = null; };
    // `itemsKey` covers everything that is drawn.
  }, [mapRef, itemsKey]);

  // Hovering a pin, or a card in the list, grows the pin, darkens its area and shows its card
  // (the card only when the pin isn't hidden inside a group).
  useEffect(() => {
    if (hoveredId === null) return;
    const d = drawn.current.get(hoveredId);
    if (!d) return;
    d.marker.setIcon(pinIcon(true)).setZIndexOffset(1000);
    d.blob?.setStyle(areaStyle(true));
    if (clusterRef.current?.getVisibleParent(d.marker) === d.marker) d.marker.openTooltip();
    return () => { d.marker.setIcon(pinIcon(false)).setZIndexOffset(0).closeTooltip(); d.blob?.setStyle(areaStyle(false)); };
  }, [hoveredId, itemsKey]);

  return <div ref={el} className="w-full h-full" style={{ isolation: "isolate", background: "#e8e4df" }} />;
}
