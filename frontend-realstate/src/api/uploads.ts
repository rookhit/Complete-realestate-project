// Photo / video uploads to Cloudflare R2 (backend-realstate/app/api/v1/admin/uploads, …/listings/uploads).
// 1. The server is asked for a signed upload URL (admin, or a signed-in seller for free listings).
// 2. The file is PUT straight to R2 with it, so big videos never pass through our server.
// 3. The returned public `url` is what gets stored (gallery, videoUrl, a cover…).
import { authFetch } from "@/app/auth";

export type UploadKind = "image" | "video";
/** 0 to 1 while the file is sent. */
export type Progress = (fraction: number) => void;

type Signed = { data: { uploadUrl: string; url: string; headers: Record<string, string> } };

/** Asks `path` for a signed link with `body`, sends the file to it, resolves to its public URL. */
async function upload(path: string, body: object, file: File, onProgress?: Progress): Promise<string> {
  const { data } = await authFetch<Signed>(path, { method: "POST", body: JSON.stringify({ ...body, contentType: file.type, size: file.size }) });
  // XMLHttpRequest rather than fetch: fetch can't report upload progress.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", data.uploadUrl);
    for (const [k, v] of Object.entries(data.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}). Please try again.`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check the connection and try again."));
    xhr.send(file);
  });
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

/** A signed-in seller: one photo for a free listing (stored under listings/). */
export function uploadListingPhoto(file: File, onProgress?: Progress): Promise<string> {
  return upload("/listings/uploads", {}, file, onProgress);
}
