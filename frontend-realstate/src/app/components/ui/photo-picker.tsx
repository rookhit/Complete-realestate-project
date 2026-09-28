import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2, Upload } from "lucide-react";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans } from "./brand";

// Photo pickers for the admin.
// Picked files become temporary blob: URLs. When uploads exist, upload each blob: URL
// on save (POST /api/v1/admin/uploads) and store the URL the server returns instead.

const MAX_MB = 8;

/** Turn picked files into preview URLs, with the same checks as the public Free Listing form. */
function readImages(files: FileList | null, room: number): { urls: string[]; error: string } {
  if (!files || files.length === 0) return { urls: [], error: "" };
  const images = Array.from(files).filter(f => f.type.startsWith("image/"));
  if (images.length === 0) return { urls: [], error: "Those files are not images." };
  const tooBig = images.find(f => f.size > MAX_MB * 1024 * 1024);
  if (tooBig) return { urls: [], error: `"${tooBig.name}" is over ${MAX_MB} MB.` };
  if (room <= 0) return { urls: [], error: "The photo limit has been reached." };
  return {
    urls: images.slice(0, room).map(f => URL.createObjectURL(f)),
    error: images.length > room ? `Only the first ${room} were added.` : "",
  };
}

/** One image with a large drop area, e.g. a team portrait or an article cover. */
export function ImageField({ value, onChange, aspect = "16/10", label = "Upload a photo" }: {
  value: string; onChange: (url: string) => void; aspect?: string; label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const take = (files: FileList | null) => {
    const r = readImages(files, 1);
    setError(r.error);
    if (r.urls[0]) onChange(r.urls[0]);
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
        {value ? (
          <>
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
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
            <span className="text-[12px]" style={{ color: MUTED_L, ...sans }}>Drag it here or click · JPG or PNG up to {MAX_MB} MB</span>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={e => { take(e.target.files); e.target.value = ""; }} />
      {error && <p className="text-[13px]" style={{ color: MAROON, ...sans }}>{error}</p>}
    </div>
  );
}

// A property's photos: add several, reorder, pick the cover (always the first), remove.
export function PhotoManager({ photos, onChange, max = 20 }: {
  photos: string[]; onChange: (next: string[]) => void; max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");

  const add = (files: FileList | null) => {
    const r = readImages(files, max - photos.length);
    setError(r.error);
    if (r.urls.length) onChange([...photos, ...r.urls]);
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
        <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>Several at once is fine · JPG or PNG up to {MAX_MB} MB · {photos.length}/{max}</p>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { add(e.target.files); e.target.value = ""; }} />
      {error && <p className="text-[13px]" style={{ color: MAROON, ...sans }}>{error}</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((url, i) => (
            <figure key={`${url}-${i}`} className="border flex flex-col" style={{ borderColor: i === 0 ? GOLD : BORDER_L, background: WHITE }}>
              <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
                <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
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
        </div>
      )}
    </div>
  );
}
