import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2, Upload, X } from "lucide-react";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans } from "./brand";

// Photo pickers for the admin.
// PhotoManager with `upload` (the property editor) sends each picked file to Cloudflare R2 at once
// and keeps the URL it gets back. Without it (and in ImageField), picked files are temporary
// blob: URLs that don't survive a reload, until those editors get uploads too.

const MAX_MB = 8;

/** The picked files that are images under the size limit, with the same checks as the public Free Listing form. */
function checkImages(files: FileList | null, room: number): { files: File[]; error: string } {
  if (!files || files.length === 0) return { files: [], error: "" };
  const images = Array.from(files).filter(f => f.type.startsWith("image/"));
  if (images.length === 0) return { files: [], error: "Those files are not images." };
  const tooBig = images.find(f => f.size > MAX_MB * 1024 * 1024);
  if (tooBig) return { files: [], error: `"${tooBig.name}" is over ${MAX_MB} MB.` };
  if (room <= 0) return { files: [], error: "The photo limit has been reached." };
  return { files: images.slice(0, room), error: images.length > room ? `Only the first ${room} were added.` : "" };
}

/** Turn picked files into temporary preview URLs (for editors that don't upload yet). */
function readImages(files: FileList | null, room: number): { urls: string[]; error: string } {
  const r = checkImages(files, room);
  return { urls: r.files.map(f => URL.createObjectURL(f)), error: r.error };
}

/**
 * One image with a large drop area, e.g. a team portrait or an article cover. With `upload`, the
 * picked file is uploaded straight away (the old image stays until it is done); `onBusy` reports
 * while it is uploading.
 */
export function ImageField({ value, onChange, aspect = "16/10", label = "Upload a photo", upload, onBusy }: {
  value: string; onChange: (url: string) => void; aspect?: string; label?: string;
  upload?: Uploader; onBusy?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState<{ preview: string; progress: number } | null>(null);
  const take = (files: FileList | null) => {
    if (!upload) {
      const r = readImages(files, 1);
      setError(r.error);
      if (r.urls[0]) onChange(r.urls[0]);
      return;
    }
    if (sending) return;
    const r = checkImages(files, 1);
    setError(r.error);
    const file = r.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setSending({ preview, progress: 0 });
    onBusy?.(true);
    upload(file, progress => setSending({ preview, progress })).then(
      url => onChange(url),
      err => setError(err instanceof Error ? err.message : "Upload failed"),
    ).finally(() => { URL.revokeObjectURL(preview); setSending(null); onBusy?.(false); });
  };
  return (
    <div className="flex flex-col gap-2">
      <div
        role="button" tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
        className="relative overflow-hidden border border-dashed cursor-pointer group"
        style={{ aspectRatio: aspect, borderColor: drag ? MAROON : "rgba(176,136,72,0.5)", background: drag ? "rgba(138,32,48,0.04)" : "#fbf9f5" }}
      >
        {sending ? (
          <>
            <img src={sending.preview} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin" style={{ color: MAROON }} />
              <span className="text-[11px] tracking-[0.15em] uppercase tabular-nums" style={{ color: FG_LIGHT, ...sans }}>Uploading {Math.round(sending.progress * 100)}%</span>
            </div>
            <div className="absolute left-0 bottom-0 h-[3px]" style={{ width: `${sending.progress * 100}%`, background: GOLD }} />
          </>
        ) : value ? (
          <>
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
            {upload && !isMediaLink(value) && (
              <span className="absolute inset-x-0 bottom-0 px-2 py-1 text-[11px] leading-snug" style={{ background: MAROON, color: WHITE, ...sans }}>
                Not uploaded. Choose the photo again.
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(10,9,8,0.45)" }}>
              <span className="flex items-center gap-2 px-4 py-2 text-[11px] tracking-[0.2em] uppercase" style={{ background: WHITE, color: FG_LIGHT, ...sans }}>
                <ImagePlus size={14} />Replace
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <Upload size={22} style={{ color: GOLD }} />
            <span className="text-[14px]" style={{ color: FG_LIGHT, ...sans }}>{label}</span>
            <span className="text-[12px]" style={{ color: MUTED_L, ...sans }}>Drag it here or click · JPG, PNG or WebP up to {MAX_MB} MB</span>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={e => { take(e.target.files); e.target.value = ""; }} />
      {error && <p className="text-[13px]" style={{ color: MAROON, ...sans }}>{error}</p>}
    </div>
  );
}

/** A saved file's address (http/https), as opposed to a temporary blob: preview. */
export const isMediaLink = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

/** Sends one file and resolves to its public URL (see src/api/uploads.ts). */
export type Uploader = (file: File, onProgress: (fraction: number) => void) => Promise<string>;

type Pending = { id: number; preview: string; progress: number; error?: string };
let pendingId = 0;

// A property's photos: add several, reorder, pick the cover (always the first), remove.
// With `upload`, picked files are uploaded straight away: each shows its progress, and `onAdd`
// receives the URL when it is done (onAdd must append to the latest list, as uploads finish in
// any order).
export function PhotoManager({ photos, onChange, max = 20, upload, onAdd }: {
  photos: string[]; onChange: (next: string[]) => void; max?: number;
  upload?: Uploader; onAdd?: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);

  const patch = (id: number, p: Partial<Pending>) => setPending(list => list.map(x => (x.id === id ? { ...x, ...p } : x)));
  const drop = (id: number) => setPending(list => {
    const gone = list.find(x => x.id === id);
    if (gone) URL.revokeObjectURL(gone.preview);
    return list.filter(x => x.id !== id);
  });

  const add = (files: FileList | null) => {
    if (!upload) {
      const r = readImages(files, max - photos.length);
      setError(r.error);
      if (r.urls.length) onChange([...photos, ...r.urls]);
      return;
    }
    const busy = pending.filter(p => !p.error).length;
    const r = checkImages(files, max - photos.length - busy);
    setError(r.error);
    for (const file of r.files) {
      const id = ++pendingId;
      setPending(list => [...list, { id, preview: URL.createObjectURL(file), progress: 0 }]);
      upload(file, f => patch(id, { progress: f })).then(
        url => { onAdd?.(url); drop(id); },
        err => patch(id, { error: err instanceof Error ? err.message : "Upload failed" }),
      );
    }
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const makeCover = (i: number) => onChange([photos[i], ...photos.filter((_, k) => k !== i)]);
  const remove = (i: number) => onChange(photos.filter((_, k) => k !== i));

  const tool = "w-8 h-8 flex items-center justify-center transition-colors hover:text-[#8a2030] disabled:opacity-30";

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button" tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className="flex flex-col items-center justify-center gap-2 border border-dashed px-6 py-9 cursor-pointer text-center transition-colors"
        style={{ borderColor: drag ? MAROON : "rgba(176,136,72,0.5)", background: drag ? "rgba(138,32,48,0.04)" : "#fbf9f5" }}
      >
        <Upload size={22} style={{ color: GOLD }} />
        <p className="text-[14px]" style={{ color: FG_LIGHT, ...sans }}>Drag photos here, or <span style={{ color: MAROON }}>browse</span></p>
        <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>Several at once is fine · JPG, PNG or WebP up to {MAX_MB} MB · {photos.length}/{max}</p>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { add(e.target.files); e.target.value = ""; }} />
      {error && <p className="text-[13px]" style={{ color: MAROON, ...sans }}>{error}</p>}

      {photos.length + pending.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((url, i) => (
            <figure key={`${url}-${i}`} className="border flex flex-col" style={{ borderColor: i === 0 ? GOLD : BORDER_L, background: WHITE }}>
              <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                {upload && !isMediaLink(url) && (
                  <span className="absolute inset-x-0 bottom-0 px-2 py-1 text-[11px] leading-snug" style={{ background: MAROON, color: WHITE, ...sans }}>
                    Not uploaded. Remove it and add the photo again.
                  </span>
                )}
                {i === 0 && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase" style={{ background: MAROON, color: WHITE, ...sans }}>
                    <Star size={9} fill={WHITE} />Cover
                  </span>
                )}
              </div>
              <figcaption className="flex items-center justify-between px-1 py-1" style={{ color: MUTED_L }}>
                <div className="flex">
                  <button type="button" className={tool} aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft size={14} /></button>
                  <button type="button" className={tool} aria-label="Move later" disabled={i === photos.length - 1} onClick={() => move(i, 1)}><ArrowRight size={14} /></button>
                </div>
                <div className="flex">
                  {i !== 0 && <button type="button" className={tool} aria-label="Make cover photo" title="Make cover" onClick={() => makeCover(i)}><Star size={14} /></button>}
                  <button type="button" className={tool} aria-label="Remove photo" title="Remove" onClick={() => remove(i)}><Trash2 size={14} /></button>
                </div>
              </figcaption>
            </figure>
          ))}
          {pending.map(p => (
            <figure key={p.id} className="border flex flex-col" style={{ borderColor: p.error ? MAROON : BORDER_L, background: WHITE }}>
              <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
                <img src={p.preview} alt="" className="w-full h-full object-cover" style={{ opacity: 0.45 }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
                  {p.error
                    ? <span className="text-[11px] leading-snug px-2 py-1" style={{ background: MAROON, color: WHITE, ...sans }}>{p.error}</span>
                    : <>
                        <Loader2 size={18} className="animate-spin" style={{ color: MAROON }} />
                        <span className="text-[11px] tracking-[0.15em] uppercase tabular-nums" style={{ color: FG_LIGHT, ...sans }}>Uploading {Math.round(p.progress * 100)}%</span>
                      </>}
                </div>
                {!p.error && <div className="absolute left-0 bottom-0 h-[3px]" style={{ width: `${p.progress * 100}%`, background: GOLD }} />}
              </div>
              <figcaption className="flex items-center justify-end px-1 py-1" style={{ color: MUTED_L }}>
                {p.error
                  ? <button type="button" className={tool} aria-label="Dismiss" title="Dismiss" onClick={() => drop(p.id)}><X size={14} /></button>
                  : <span className="h-8" />}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
