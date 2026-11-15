import type { SyntheticEvent } from "react";

// Photos uploaded to the site have an 800 px "card copy" beside them (the browser makes it at upload:
// media/watermark.ts; older photos got theirs from a one-off back-fill): ".../photos/2026-11/<uuid>.jpg"
// → ".../photos/2026-11/<uuid>.w800.jpg". Cards, lists and map pop-ups show the copy, a fraction of
// the bytes of the full photo, which stays for the hero and the gallery. Same rule as the backend's
// cardKeyOf (lib/storage/r2.ts).
const OUR_PHOTO = /(\/photos\/\d{4}-\d{2}\/[0-9a-f-]{36})\.(jpe?g|png|webp|avif)(?=$|[?#])/i;

/** Card width for photos a service resizes on request (Unsplash). */
const CARD_WIDTH = 640;

/**
 * The card-size version of a photo: our uploads' card copy; for Unsplash (sample content) the same
 * picture asked for at CARD_WIDTH, same shape; anything else unchanged.
 */
export function cardSrc(url: string): string {
  if (OUR_PHOTO.test(url)) return url.replace(OUR_PHOTO, "$1.w800.jpg");
  if (url.startsWith("https://images.unsplash.com/")) {
    try {
      const u = new URL(url);
      const w = Number(u.searchParams.get("w")), h = Number(u.searchParams.get("h"));
      if (w > CARD_WIDTH) {
        u.searchParams.set("w", String(CARD_WIDTH));
        if (h) u.searchParams.set("h", String(Math.round((h * CARD_WIDTH) / w)));
        u.searchParams.set("q", "70");
        return u.toString();
      }
    } catch { /* not a URL: leave it */ }
  }
  return url;
}

/** If a card copy is missing (a photo uploaded before copies existed), show the full photo instead. */
export function fullPhotoOnError(full: string) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fellBack) return;
    img.dataset.fellBack = "1";
    img.removeAttribute("srcset");   // a large image's srcset would otherwise pick the missing copy again
    img.src = full;
  };
}
