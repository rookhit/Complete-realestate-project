import { z } from "zod";
import { prisma } from "@/lib/prisma";

// The watermark stamped on property photos (Admin → Watermark), stored in SiteSetting "watermark".
// The browser stamps each photo before uploading it (frontend src/app/media/watermark.ts): admin
// property photos and sellers' free-listing photos, so a clean original never reaches our storage.
// A changed watermark applies to photos uploaded from then on.
//
// The logo is stored here as a small data: URL rather than a file in R2: the browser must read the
// logo's pixels to draw it into a photo, and R2's public address doesn't allow that across sites.
// GET /api/v1/site/watermark is public (sellers' browsers stamp too) and separate from GET /site,
// so the logo isn't downloaded on every page view.

/** Data URL limit: a logo of about 300 KB. Plenty for a PNG logo of a few hundred pixels. */
const MAX_LOGO_CHARS = 400_000;

export const watermarkSchema = z.object({
  enabled: z.boolean(),
  /** The band's text, e.g. "NEPAL BHOOMI". May be empty when there is a logo. */
  text: z.string().trim().max(40, "At most 40 characters"),
  /** A PNG / WebP data URL, or "" for none. */
  logo: z.union([
    z.literal(""),
    z.string().max(MAX_LOGO_CHARS, "The logo is too large: use one under 300 KB")
      .regex(/^data:image\/(png|webp);base64,[A-Za-z0-9+/]+=*$/, "The logo must be a PNG or WebP image"),
  ]),
  /** How visible the whole mark is (band, logo and text), in %. */
  opacity: z.number().int().min(10, "At least 10%").max(90, "At most 90%"),
  /** The band's height, in % of the photo's height. */
  size: z.number().int().min(6, "At least 6%").max(30, "At most 30%"),
}).refine((w) => !w.enabled || w.text !== "" || w.logo !== "", { message: "Add text or a logo, or switch the watermark off", path: ["text"] });

export type Watermark = z.infer<typeof watermarkSchema>;

/** Used until the admin saves one. */
export const DEFAULT_WATERMARK: Watermark = { enabled: true, text: "NEPAL BHOOMI", logo: "", opacity: 45, size: 12 };

const KEY = "watermark";

export async function loadWatermark(): Promise<Watermark> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY }, select: { value: true } });
  const saved = watermarkSchema.safeParse(row?.value);
  return saved.success ? saved.data : DEFAULT_WATERMARK;
}

export async function saveWatermark(value: Watermark): Promise<Watermark> {
  await prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  return value;
}
