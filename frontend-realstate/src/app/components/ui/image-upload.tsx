import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans } from "./brand";

/** A photo picked on this device, not uploaded yet: the file and a temporary preview URL. */
export type PickedImage = { id: string; file: File; url: string };

const MAX_MB = 8;

/** A PickedImage for a file (its preview URL must be revoked when it's removed: see ImageUpload). */
export function pickImage(file: File, id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`): PickedImage {
  return { id, file, url: URL.createObjectURL(file) };
}

/**
 * Multi-image picker for the public Free Listing form: drag-and-drop or browse, previews, the first
 * photo marked as the cover, removal. Files stay on the device until the form is sent.
 */
export function ImageUpload({ images, onChange, max = 12 }: {
  images: PickedImage[]; onChange: (next: PickedImage[]) => void; max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  // Preview URLs are leaked unless revoked: revoke whatever is still shown when the picker goes away.
  const shown = useRef(images);
  shown.current = images;
  useEffect(() => () => { shown.current.forEach(i => URL.revokeObjectURL(i.url)); }, []);

  const add = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList).filter(f => f.type.startsWith("image/"));
    if (incoming.length === 0) { setError("Those files are not images."); return; }
    const room = max - images.length;
    if (room <= 0) { setError(`You can upload up to ${max} images.`); return; }
    const tooBig = incoming.find(f => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) { setError(`"${tooBig.name}" is over ${MAX_MB} MB.`); return; }
    setError(incoming.length > room ? `Only the first ${room} were added (limit ${max}).` : "");
    onChange([...images, ...incoming.slice(0, room).map(f => pickImage(f))]);
  };

  const remove = (id: string) => {
    const gone = images.find(i => i.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    onChange(images.filter(i => i.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button" tabIndex={0}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        className="flex flex-col items-center justify-center gap-2 border border-dashed px-6 py-10 cursor-pointer transition-colors"
        style={{ borderColor: dragging ? MAROON : BORDER_L, background: dragging ? "rgba(138,32,48,0.04)" : "transparent" }}
      >
        <Upload size={22} style={{ color: GOLD }} />
        <p className="text-[14px]" style={{ color: FG_LIGHT, ...sans }}>
          Drag photos here, or <span style={{ color: MAROON }}>browse</span>
        </p>
        <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>
          JPG or PNG, up to {MAX_MB}&nbsp;MB each. {images.length}/{max} added.
        </p>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { add(e.target.files); e.target.value = ""; }} />
      </div>

      {error && <p className="text-[13px]" style={{ color: MAROON, ...sans }}>{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div key={img.id} className="relative group overflow-hidden" style={{ aspectRatio: "4/3" }}>
              <img src={img.url} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase" style={{ background: MAROON, color: WHITE, ...sans }}>Cover</span>
              )}
              <button
                type="button" onClick={() => remove(img.id)} aria-label={`Remove image ${i + 1}`}
                className="absolute top-1.5 right-1.5 p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                style={{ background: "rgba(10,9,8,0.72)", color: WHITE }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
