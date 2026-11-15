// Photo / video uploads to Cloudflare R2 (backend-realstate/app/api/v1/admin/uploads, …/listings/uploads).
// 1. The server is asked for a signed upload URL (admin, or a signed-in seller for free listings).
// 2. The file is PUT straight to R2 with it, so big videos never pass through our server.
// 3. The returned public `url` is what gets stored (gallery, videoUrl, a cover…).
// Property photos (the admin's and sellers') are stamped with the watermark first (media/watermark.ts)
// and sent with an 800 px card copy, which cards and lists show (components/ui/card-photo.tsx).
import { authFetch } from "@/app/auth";
import { preparePhoto } from "@/app/media/watermark";
import { UserFacingError } from "@/app/errors";

export type UploadKind = "image" | "video";
/** 0 to 1 while the file is sent. */
export type Progress = (fraction: number) => void;

type SignedPut = { uploadUrl: string; url: string; headers: Record<string, string> };
type Signed = { data: SignedPut & { card?: SignedPut } };

/** PUTs one file to a signed URL. XMLHttpRequest rather than fetch: fetch can't report upload progress. */
function put(target: SignedPut, file: File, onProgress?: Progress): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.uploadUrl);
    for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UserFacingError(`Upload failed (${xhr.status}). Please try again.`)));
    // A network error is also what the browser reports when the storage refuses this website's
    // address (its CORS settings), so only blame the connection when the device really is offline.
    xhr.onerror = () => {
      console.error("[upload] the browser could not send the file to storage:", new URL(target.uploadUrl).host);
      reject(new UserFacingError(navigator.onLine
        ? "The photo could not be uploaded right now. Please try again in a moment; if it keeps happening, contact us."
        : "You seem to be offline. Check your internet connection and try again."));
    };
    xhr.send(file);
  });
}

/**
 * Asks `path` for a signed link with `body`, sends the file (and its card copy, if any) and resolves
 * to the file's public URL. The card copy is best effort: without it the site shows the photo itself.
 */
async function upload(path: string, body: object, file: File, onProgress?: Progress, card?: File | null): Promise<string> {
  const { data } = await authFetch<Signed>(path, { method: "POST",
    body: JSON.stringify({ ...body, contentType: file.type, size: file.size, ...(card ? { cardSize: card.size } : {}) }) });
  await put(data, file, onProgress);
  if (card && data.card) await put(data.card, card).catch(err => console.warn("[upload] card copy not stored; the full photo will be used", err));
  onProgress?.(1);
  return data.url;
}

/**
 * Admin: uploads one file and resolves to its public URL. Throws an Error with a message to show.
 * `folder` keeps them apart in the bucket: "properties" (default), "articles" (journal covers),
 * "team" (portraits), "testimonials" (client photos) or "site" (district tiles).
 */
export function uploadMedia(kind: UploadKind, file: File, onProgress?: Progress, folder: "properties" | "articles" | "team" | "testimonials" | "site" = "properties"): Promise<string> {
  return upload("/admin/uploads", { kind, folder }, file, onProgress);
}

/** Admin: one property photo, upright, resized and stamped with the watermark before it is sent. */
export async function uploadPropertyPhoto(file: File, onProgress?: Progress): Promise<string> {
  const { photo, card } = await preparePhoto(file);
  return upload("/admin/uploads", { kind: "image", folder: "properties" }, photo, onProgress, card);
}

/** A signed-in seller: one photo for a free listing (stored under listings/), stamped the same way. */
export async function uploadListingPhoto(file: File, onProgress?: Progress): Promise<string> {
  const { photo, card } = await preparePhoto(file);
  return upload("/listings/uploads", {}, photo, onProgress, card);
}
