import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { coverStyle, type Framing } from "./cover-frame";

/**
 * Filling the box may cut at most this share of the photo; beyond it, the whole photo is shown.
 * 1.4 = the photo's shape is up to 40 % wider (or taller) than the box, i.e. about 29 % cropped.
 */
const FIT_RATIO = 1.4;

/**
 * A photo that adapts to the box it is shown in, on every screen:
 * - shape close to the box (a landscape photo in a card): it fills the box, cropped a little around
 *   the cover's focal point (the admin's "Adjust" framing);
 * - shape far from the box (a tall poster in a wide card, a wide photo in a phone's tall banner): it
 *   is shown whole, on a blurred copy of itself that fills the rest, so nothing is cut off.
 * Decided in the browser from the photo's real size and the box's size, again when the box changes
 * (rotating a phone, resizing a window). A cover the admin framed is always filled as framed.
 * The parent sets the box's size; this fills it.
 */
export function SmartPhoto({
  src, srcSet, sizes, alt, frame, framed = false, hoverZoom = 1, blurSrc, imgClassName = "", fitPosition = "50% 50%",
  loading, fetchPriority, onError,
}: {
  src: string; srcSet?: string; sizes?: string; alt: string;
  /** The focal point for filling the box (frameOf(p) for a cover; none = centred). */
  frame?: Framing;
  /** The admin framed this photo on purpose: always fill the box as framed. */
  framed?: boolean;
  /** A card's own hover zoom. */
  hoverZoom?: number;
  /** Where a whole (fitted) photo sits in its box, as object-position, e.g. "50% 18%": nearer the top. */
  fitPosition?: string;
  /** A small copy for the blurred background (the card copy); defaults to src. */
  blurSrc?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  onError?: (e: SyntheticEvent<HTMLImageElement>) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [fit, setFit] = useState(false);

  const decide = useCallback(() => {
    const b = box.current, i = img.current;
    if (!b || !i || !i.naturalWidth || !b.clientWidth || !b.clientHeight) return;
    if (framed) { setFit(false); return; }
    const r = (i.naturalWidth / i.naturalHeight) / (b.clientWidth / b.clientHeight);
    setFit(r > FIT_RATIO || r < 1 / FIT_RATIO);
  }, [framed]);

  useEffect(() => {
    const b = box.current;
    if (!b) return;
    if (img.current?.complete) decide();   // already loaded (from the cache) before this ran
    const ro = new ResizeObserver(decide);
    ro.observe(b);
    return () => ro.disconnect();
  }, [decide, src]);

  return (
    <div ref={box} className="relative w-full h-full overflow-hidden" data-photo-fit={fit ? "whole" : framed ? "framed" : "fill"}>
      {fit && (
        <img src={blurSrc ?? src} alt="" aria-hidden="true" loading={loading} decoding="async"
          className="absolute inset-0 w-full h-full object-cover" style={{ filter: "blur(22px) brightness(0.82) saturate(1.1)", transform: "scale(1.15)" }} />
      )}
      <img ref={img} src={src} srcSet={srcSet} sizes={sizes} alt={alt} loading={loading} decoding="async"
        onLoad={decide} onError={onError} {...(fetchPriority ? { fetchpriority: fetchPriority } : {})}
        className={`relative w-full h-full ${fit ? "object-contain" : "object-cover"} ${imgClassName}`}
        style={fit ? { objectPosition: fitPosition, transform: hoverZoom !== 1 ? `scale(${hoverZoom})` : undefined } : coverStyle(frame, hoverZoom)} />
    </div>
  );
}
