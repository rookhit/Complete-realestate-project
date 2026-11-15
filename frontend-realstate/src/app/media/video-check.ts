// How heavy a video is to stream, read from the file before it is uploaded. A phone video straight
// from the camera is often 15–20 Mbit/s; a typical 4G connection in Nepal gives 5–10, so such a
// video keeps stopping to load (measured 2026-11-15: 9 s of 30 s played on ~6 Mbit/s, 5 stops).
// The same video at 720p and ~2 Mbit/s played without a stop and was a tenth of the size.

/** Above this many Mbit/s a video can't stream smoothly on a phone. */
export const SMOOTH_MBPS = 4;

/** The video's average bitrate in Mbit/s (size ÷ length), or null if the browser can't read its length. */
export function videoBitrate(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let settled = false;
    const done = (mbps: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      v.removeAttribute("src"); v.load();
      URL.revokeObjectURL(url);
      resolve(mbps);
    };
    const timer = setTimeout(() => done(null), 10_000);   // never hold up the upload
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? (file.size * 8) / v.duration / 1e6 : null);
    v.onerror = () => done(null);
    v.src = url;
  });
}
