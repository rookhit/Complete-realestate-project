import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

// FOR TESTING ONLY: a stand-in for Cloudflare R2 while its env vars aren't set, in development.
// The same upload flow (POST /admin/uploads → PUT the file → keep the URL) writes files to
// backend-realstate/.uploads/ (gitignored) instead, served by GET /api/v1/media/<key>. Journal
// covers go under articles/, team portraits under team/, testimonial photos under testimonials/, property media under properties/, as in R2. Never used in production
// (uploads answer 503 there until R2 is set up), and files saved here are not moved to R2 later.

const ROOT = path.join(process.cwd(), ".uploads");
const SIGNED_URL_SECONDS = 15 * 60;

/** Only in development, and only while R2 isn't configured (r2.ts decides). */
export const localUploadsAllowed = (): boolean => process.env.NODE_ENV !== "production";

/** properties|articles|team|testimonials|site|listings / photos|videos / 2026-10 / <uuid>.<ext> — anything else is refused (no path tricks). */
const KEY = /^(properties|articles|team|testimonials|site|listings)\/(photos|videos)\/\d{4}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;
export const isLocalKey = (key: string): boolean => KEY.test(key);

const TYPES: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};
export const contentTypeOf = (key: string): string => TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream";

function secret(): string {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error("JWT_ACCESS_SECRET is not set");
  return s;
}
const sign = (key: string, contentType: string, exp: number): string =>
  createHmac("sha256", secret()).update(`local-upload|${key}|${contentType}|${exp}`).digest("base64url");

/** Where the browser PUTs the file and the URL the file will have, both on this server. */
export function createLocalUpload(key: string, contentType: string, origin: string): { uploadUrl: string; url: string } {
  const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_SECONDS;
  const q = new URLSearchParams({ exp: String(exp), sig: sign(key, contentType, exp) });
  return { uploadUrl: `${origin}/api/v1/uploads/local/${key}?${q}`, url: `${origin}/api/v1/media/${key}` };
}

/** The signature from createLocalUpload is valid, unexpired, and for this key and Content-Type. */
export function verifyLocalUpload(key: string, contentType: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  const want = Buffer.from(sign(key, contentType, Number(exp)));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

const fileOf = (key: string): string => path.join(ROOT, ...key.split("/"));

/** Writes the request body to the key's file, refusing more than maxBytes. */
export async function writeLocal(key: string, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<void> {
  const file = fileOf(key);
  await mkdir(path.dirname(file), { recursive: true });
  let size = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, done) {
      size += chunk.length;
      done(size > maxBytes ? new Error("TOO_LARGE") : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]), limit, createWriteStream(file));
  } catch (e) {
    await rm(file, { force: true });
    throw e;
  }
}

/** The file as a stream with its size, or null when there is none. */
export async function readLocal(key: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null> {
  const file = fileOf(key);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return null;
  return { stream: Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>, size: info.size };
}

export async function deleteLocal(key: string): Promise<void> {
  await rm(fileOf(key), { force: true });
}

/** The key behind one of this server's /api/v1/media/ URLs, or null. */
export function localKeyOf(url: string): string | null {
  const m = url.match(/^https?:\/\/[^/]+\/api\/v1\/media\/([^?#]+)$/);
  return m && isLocalKey(m[1]) ? m[1] : null;
}
