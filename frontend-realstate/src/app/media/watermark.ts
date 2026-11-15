// The watermark stamped into property photos before they upload (Admin → Watermark; backend
// lib/content/watermark.ts): a see-through band across the middle of the photo with the company's
// text and / or logo. Used for the admin's property photos and sellers' free-listing photos
// (src/api/uploads.ts), so a clean original never reaches the site's storage.
//
// Every photo goes through a canvas, even with the watermark switched off. That also:
// - drops the file's hidden metadata (EXIF), including the GPS position phones record, which would
//   otherwise give away the exact spot of an "Approximate area" property;
// - turns the photo upright (phones store sideways pixels plus an "rotate me" note);
// - caps the longest side at MAX_SIDE px, so a 12-megapixel phone photo isn't served to visitors.
import { fetchWatermark, type Watermark } from "@/api/site";
import { UserFacingError } from "@/app/errors";

/** Longest side of an uploaded photo: sharp on any screen, a fraction of a phone camera's file. */
const MAX_SIDE = 2560;
const JPEG_QUALITY = 0.88;
/** The card-size copy: wide enough for a card on a sharp phone screen, a fraction of the bytes. */
const CARD_WIDTH = 800;
const CARD_QUALITY = 0.8;
const BAND = "10, 9, 8";        // the site's near-black, as RGB
const EDGE = "176, 136, 72";    // GOLD: thin lines along the band's edges
const FONT = "Jost, Arial, Helvetica, sans-serif";

let cached: Promise<Watermark> | null = null;

/** The current watermark, fetched once per page load (and refreshed by rememberWatermark). */
export function currentWatermark(): Promise<Watermark> {
  cached ??= fetchWatermark().catch(err => { cached = null; throw err; });
  return cached;
}

/** After the admin saves a new watermark, later uploads in this tab use it straight away. */
export function rememberWatermark(w: Watermark): void {
  cached = Promise.resolve(w);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UserFacingError("The watermark logo could not be read."));
    img.src = src;
  });
}

/**
 * Draws the band, and its logo and text, centred, on a canvas that already holds a photo of
 * `width` × `height`. Shared by the uploads and the admin's live preview, so what the admin sees
 * is exactly what gets stamped.
 */
export async function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, w: Watermark): Promise<void> {
  if (!w.enabled || (!w.text && !w.logo)) return;
  const bandH = Math.max(12, Math.round((height * w.size) / 100));
  const top = Math.round((height - bandH) / 2);
  // One "strength" for the whole mark: the band, its edges, the logo and the text all fade together.
  // At 50 % the band is half dark and the logo and text are near solid; at 25 % everything is half that.
  const alpha = w.opacity / 100;
  const markAlpha = Math.min(0.95, alpha * 1.8);
  ctx.save();
  ctx.fillStyle = `rgba(${BAND}, ${alpha})`;
  ctx.fillRect(0, top, width, bandH);
  const edge = Math.max(1, Math.round(bandH * 0.035));
  ctx.fillStyle = `rgba(${EDGE}, ${Math.min(0.95, alpha * 1.5)})`;
  ctx.fillRect(0, top, width, edge);
  ctx.fillRect(0, top + bandH - edge, width, edge);

  // Logo and text side by side, centred; both shrink together if they'd run past 90 % of the width.
  const logo = w.logo ? await loadImage(w.logo) : null;
  let fontPx = Math.round(bandH * 0.34);
  let logoH = Math.round(bandH * 0.62);
  const text = w.text.toUpperCase();
  if (text) await document.fonts.load(`600 ${fontPx}px Jost`).catch(() => undefined);
  const measure = () => {
    ctx.font = `600 ${fontPx}px ${FONT}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(fontPx * 0.3)}px`;
    const textW = text ? ctx.measureText(text).width : 0;
    const logoW = logo ? (logo.naturalWidth * logoH) / logo.naturalHeight : 0;
    const gap = logo && text ? bandH * 0.22 : 0;
    return { textW, logoW, gap, total: textW + logoW + gap };
  };
  let m = measure();
  const room = width * 0.9;
  if (m.total > room) {
    const k = room / m.total;
    fontPx = Math.max(8, Math.floor(fontPx * k));
    logoH = Math.max(8, Math.floor(logoH * k));
    m = measure();
  }
  let x = (width - m.total) / 2;
  const mid = top + bandH / 2;
  if (logo) {
    ctx.globalAlpha = markAlpha;
    ctx.drawImage(logo, x, mid - logoH / 2, m.logoW, logoH);
    ctx.globalAlpha = 1;
    x += m.logoW + m.gap;
  }
  if (text) {
    ctx.fillStyle = `rgba(255, 255, 255, ${markAlpha})`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    // Letter spacing adds space after the last letter too: nudge right by half of it to stay centred.
    const spacing = "letterSpacing" in ctx ? Math.round(fontPx * 0.3) : 0;
    ctx.fillText(text, x + spacing / 2, mid + fontPx * 0.04);
  }
  ctx.restore();
}

/**
 * A copy of the picked photo ready to upload: upright, at most MAX_SIDE px, stamped with the
 * watermark (when it's on), as a JPEG without the original's metadata, plus its 800 px card copy.
 * Throws a UserFacingError if the browser can't read the file (e.g. an iPhone HEIC photo).
 */
export async function preparePhoto(file: File, mark?: Watermark): Promise<{ photo: File; card: File | null }> {
  const w = mark ?? await currentWatermark();
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UserFacingError(`"${file.name}" can't be read here. Save it as JPG or PNG and try again.`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UserFacingError("This browser can't prepare photos. Please try another browser.");
  ctx.fillStyle = "#ffffff";                     // see-through PNGs get a white background, not black
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  await drawWatermark(ctx, width, height, w);
  const name = file.name.replace(/\.[^.]+$/, "") || "photo";
  const photo = new File([await jpeg(canvas, JPEG_QUALITY)], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  // The card-size copy, from the stamped photo, for cards and lists (src/app/media/card-photo.ts).
  const k = Math.min(1, CARD_WIDTH / width);
  const small = document.createElement("canvas");
  small.width = Math.round(width * k); small.height = Math.round(height * k);
  const sctx = small.getContext("2d");
  if (!sctx) return { photo, card: null };
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(canvas, 0, 0, small.width, small.height);
  const card = new File([await jpeg(small, CARD_QUALITY)], `${name}.w800.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  return { photo, card };
}

const jpeg = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) =>
  canvas.toBlob(b => (b ? resolve(b) : reject(new UserFacingError("The photo could not be prepared."))), "image/jpeg", quality));
