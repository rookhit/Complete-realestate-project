import { randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { HttpError } from "@/lib/auth/guards";
import { createLocalUpload, deleteLocal, localKeyOf, localUploadsAllowed } from "@/lib/storage/local";

// Cloudflare R2 (S3-compatible) for property photos and videos and journal article covers. The browser uploads straight to R2
// with a short-lived signed PUT URL from POST /api/v1/admin/uploads, so big videos never pass
// through this server; the database stores only the public URL (Property.gallery / videoUrl).
//
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL (the bucket's
// public r2.dev or custom-domain address, e.g. https://media.example.com). Without them uploads
// answer 503 and nothing else changes.

export type UploadKind = "image" | "video";
/** Top-level folder in the bucket: property media, journal covers, team portraits and testimonial photos are kept apart. */
export type UploadFolder = "properties" | "articles" | "team" | "testimonials" | "site" | "listings";
const FOLDERS: UploadFolder[] = ["properties", "articles", "team", "testimonials", "site", "listings"];

/** What each kind accepts. Images match the editor's own check (8 MB). */
export const UPLOAD_RULES: Record<UploadKind, { types: Record<string, string>; maxBytes: number }> = {
  image: {
    types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" },
    maxBytes: 8 * 1024 * 1024,
  },
  video: {
    types: { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" },
    maxBytes: 500 * 1024 * 1024,
  },
};

/** How long a signed upload URL stays valid. */
const UPLOAD_URL_SECONDS = 15 * 60;

type R2Config = { client: AwsClient; endpoint: string; publicUrl: string };

function config(): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) return null;
  return {
    client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" }),
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`,
    publicUrl: R2_PUBLIC_URL.replace(/\/+$/, ""),
  };
}

export const uploadsConfigured = (): boolean => config() !== null;

/**
 * Every uploaded photo can have a smaller copy beside it for cards and lists (the browser makes it
 * when it prepares the photo): ".../photos/2026-11/<uuid>.jpg" → ".../photos/2026-11/<uuid>.w800.jpg".
 * The site shows the copy where a photo is small and falls back to the original if it's missing.
 */
export const CARD_MAX_BYTES = 2 * 1024 * 1024;
export function cardKeyOf(photoKey: string): string | null {
  return /\/photos\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(photoKey) ? photoKey.replace(/\.[a-z]+$/, ".w800.jpg") : null;
}

type SignedPut = { uploadUrl: string; url: string; headers: Record<string, string> };

/** A 15-minute signed PUT for exactly this key, type and size (R2 answers 403 for anything else). */
async function signPut(r2: R2Config, key: string, contentType: string, size: number): Promise<SignedPut> {
  const target = new URL(`${r2.endpoint}/${key}`);
  target.searchParams.set("X-Amz-Expires", String(UPLOAD_URL_SECONDS));
  // allHeaders: aws4fetch leaves Content-Type and Content-Length out of the signature by default,
  // and then R2 takes any type and size (e.g. an HTML page served from our media domain). Signed,
  // a different type or size answers 403. The browser sends Content-Length itself (the file's size).
  const signed = await r2.client.sign(
    new Request(target, { method: "PUT", headers: { "Content-Type": contentType, "Content-Length": String(size) } }),
    { aws: { signQuery: true, allHeaders: true } },
  );
  return { uploadUrl: signed.url, url: `${r2.publicUrl}/${key}`, headers: { "Content-Type": contentType } };
}

/**
 * A signed PUT URL for one new file, and the public URL it will have. The key is random, so files
 * never overwrite each other. The browser must send the same Content-Type it was signed for.
 * `cardSize` (images): also a signed PUT for the photo's card-size copy (a JPEG of that size), at
 * the key derived from the new photo's, so a caller can never aim it at an existing file.
 */
export async function createUpload(kind: UploadKind, contentType: string, size: number, folder: UploadFolder = "properties", origin = "", cardSize?: number): Promise<{ uploadUrl: string; url: string; key: string; headers: Record<string, string>; card?: SignedPut }> {
  const r2 = config();
  // Without R2: in development, files go to the local test store (lib/storage/local.ts).
  if (!r2 && !localUploadsAllowed()) throw new HttpError(503, "SERVICE_UNAVAILABLE", "Uploads are not set up yet (Cloudflare R2 settings are missing on the server)");
  const rules = UPLOAD_RULES[kind];
  const ext = rules.types[contentType];
  if (!ext) {
    const allowed = Object.values(rules.types).map((e) => e.toUpperCase()).join(", ");
    throw new HttpError(400, "VALIDATION_FAILED", `That file type can't be uploaded. Use ${allowed}.`, { contentType: "Unsupported file type" });
  }
  if (size > rules.maxBytes) {
    const mb = rules.maxBytes / 1024 / 1024;
    throw new HttpError(400, "VALIDATION_FAILED", `That file is over ${mb} MB.`, { size: `At most ${mb} MB` });
  }

  if (cardSize !== undefined && (kind !== "image" || cardSize > CARD_MAX_BYTES)) {
    throw new HttpError(400, "VALIDATION_FAILED", "The card copy must be an image under 2 MB.", { cardSize: "Too large" });
  }

  const key = `${folder}/${kind === "image" ? "photos" : "videos"}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const cardKey = cardSize ? cardKeyOf(key) : null;
  if (!r2) {
    const card = cardKey ? { ...createLocalUpload(cardKey, "image/jpeg", origin), headers: { "Content-Type": "image/jpeg" } } : undefined;
    return { ...createLocalUpload(key, contentType, origin), key, headers: { "Content-Type": contentType }, ...(card ? { card } : {}) };
  }
  const main = await signPut(r2, key, contentType, size);
  const card = cardKey && cardSize ? await signPut(r2, cardKey, "image/jpeg", cardSize) : undefined;
  return { ...main, key, ...(card ? { card } : {}) };
}

/** The object key behind one of our public URLs, or null for any other link (e.g. Unsplash). */
export function keyOf(url: string): string | null {
  const r2 = config();
  if (!r2 || !url.startsWith(`${r2.publicUrl}/`)) return null;
  const key = decodeURIComponent(url.slice(r2.publicUrl.length + 1).split(/[?#]/)[0]);
  return FOLDERS.some((f) => key.startsWith(`${f}/`)) ? key : null;
}

/**
 * True for a photo URL this server handed out for an upload into `folder`: our R2 bucket, or the
 * local test store in development. Anything else (another site, a tracking pixel) is false.
 */
export function isUploadedPhoto(url: string, folder: UploadFolder): boolean {
  const key = keyOf(url) ?? (localUploadsAllowed() ? localKeyOf(url) : null);
  return key !== null && key.startsWith(`${folder}/photos/`);
}

/**
 * Deletes the files behind these URLs from R2. Links that aren't ours are skipped. Best effort: a
 * failure is logged, never thrown, so a storage hiccup can't block saving or deleting a property.
 */
export async function deleteMedia(urls: Iterable<string>): Promise<void> {
  const list = [...urls];
  // A photo goes with its card-size copy (if it has one; deleting a missing file is fine).
  const withCards = (keys: string[]) => keys.flatMap((k) => { const c = cardKeyOf(k); return c ? [k, c] : [k]; });
  // Files in the local test store (development without R2).
  await Promise.all(withCards(list.map(localKeyOf).filter((k): k is string => k !== null)).map((k) =>
    deleteLocal(k).catch((e) => console.error(`Local delete ${k} failed`, e))));
  const r2 = config();
  if (!r2) return;
  const keys = [...new Set(withCards(list.map(keyOf).filter((k): k is string => k !== null)))];
  await Promise.all(keys.map(async (key) => {
    try {
      const res = await r2.client.fetch(`${r2.endpoint}/${key}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) console.error(`R2 delete ${key} failed: ${res.status}`);
    } catch (e) {
      console.error(`R2 delete ${key} failed`, e);
    }
  }));
}
