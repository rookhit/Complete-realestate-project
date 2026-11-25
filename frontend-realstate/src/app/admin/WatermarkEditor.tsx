import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, RotateCcw, Trash2, Upload } from "lucide-react";
import { ApiError } from "@/app/auth";
import { fetchWatermark, saveSiteWatermark, type Watermark } from "@/api/site";
import { drawWatermark, rememberWatermark } from "@/app/media/watermark";
import { ALL_PROPS } from "@/app/data/properties";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans } from "@/app/components/ui/brand";
import { Button, Field, TextInput, Toggle } from "@/app/components/ui/form-controls";
import { SectionHeading, type Notify } from "./parts";

/** The backend's default (lib/content/watermark.ts), for "Reset". */
const DEFAULT: Watermark = { enabled: true, text: "NEPAL BHOOMI", logo: "", opacity: 45, size: 12 };
/** A logo is stored inside the setting as a data URL, so keep it small (the server allows ~300 KB). */
const LOGO_MAX_SIDE = 600;
const LOGO_MAX_CHARS = 400_000;
/** The preview is drawn at this width, then shown scaled to fit. */
const PREVIEW_W = 1200;

/** A picked logo, scaled down to LOGO_MAX_SIDE and turned into a PNG (else WebP) data URL. */
async function logoDataUrl(file: File): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error("Pick an image file (PNG with a see-through background works best).");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("That image can't be read. Try a PNG."); });
  const k = Math.min(1, LOGO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k); canvas.height = Math.round(bitmap.height * k);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const url of [canvas.toDataURL("image/png"), canvas.toDataURL("image/webp", 0.9)]) {
    if (url.length <= LOGO_MAX_CHARS && /^data:image\/(png|webp);/.test(url)) return url;
  }
  throw new Error("That logo is too large. Use a smaller image (under about 300 KB).");
}

function Slider({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-4">
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label}
        className="flex-1" style={{ accentColor: GOLD }} />
      <span className="w-12 text-right text-[14px] tabular-nums" style={{ color: FG_LIGHT, ...sans }}>{value}%</span>
    </div>
  );
}

/**
 * Admin → Watermark: the band stamped across the middle of every property photo as it uploads
 * (Add / Edit Property and sellers' Free Listing photos), with a live preview that uses the very
 * same drawing code (media/watermark.ts).
 */
export function WatermarkSection({ notify }: { notify: Notify }) {
  const [saved, setSaved] = useState<Watermark | null>(null);
  const [w, setW] = useState<Watermark>(DEFAULT);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState<CanvasImageSource | null>(null);
  const [sampleName, setSampleName] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Watermark>(k: K, v: Watermark[K]) => setW(o => ({ ...o, [k]: v }));
  const dirty = saved !== null && JSON.stringify(saved) !== JSON.stringify(w);

  useEffect(() => {
    fetchWatermark().then(v => { setSaved(v); setW(v); }, () => setLoadError("The watermark settings could not be loaded. Reload the page to try again."));
  }, []);

  // The first property's cover as the default sample; the admin can try one of their own photos.
  useEffect(() => {
    const src = ALL_PROPS.find(p => p.hero)?.hero;
    if (!src) return;
    const img = new Image();
    img.onload = () => setSample(s => s ?? img);
    img.src = src;
  }, []);

  // Redraw the preview whenever a setting or the sample changes. Only the newest drawing is kept.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let current = true;
    const sw = sample instanceof HTMLImageElement ? sample.naturalWidth : sample instanceof ImageBitmap ? sample.width : 4;
    const sh = sample instanceof HTMLImageElement ? sample.naturalHeight : sample instanceof ImageBitmap ? sample.height : 3;
    const off = document.createElement("canvas");
    off.width = PREVIEW_W; off.height = Math.round((PREVIEW_W * sh) / sw);
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.fillStyle = "#cfc6b8"; octx.fillRect(0, 0, off.width, off.height);
    if (sample) octx.drawImage(sample, 0, 0, off.width, off.height);
    void drawWatermark(octx, off.width, off.height, w).then(() => {
      if (!current) return;
      c.width = off.width; c.height = off.height;
      ctx.drawImage(off, 0, 0);
    }, err => current && notify(err instanceof Error ? err.message : "The preview could not be drawn"));
    return () => { current = false; };
  }, [w, sample, notify]);

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    logoDataUrl(file).then(url => set("logo", url), err => notify(err instanceof Error ? err.message : "That logo could not be used"));
  };
  const pickSample = (file: File | undefined) => {
    if (!file) return;
    createImageBitmap(file, { imageOrientation: "from-image" })
      .then(b => { setSample(b); setSampleName(file.name); }, () => notify("That photo can't be read here. Try a JPG or PNG."));
  };

  const save = () => {
    const next = { ...w, text: w.text.trim() };
    if (next.enabled && !next.text && !next.logo) { notify("Add text or a logo, or switch the watermark off"); return; }
    setSaving(true);
    saveSiteWatermark(next)
      .then(v => { setSaved(v); setW(v); rememberWatermark(v); notify("Watermark saved. New photo uploads will carry it."); },
        err => notify(err instanceof ApiError ? err.message : "Could not save. Please try again."))
      .finally(() => setSaving(false));
  };

  if (loadError) return <p className="text-[14px]" style={{ color: MAROON, ...sans }}>{loadError}</p>;

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading title="Watermark"
        subtitle="Stamped across the middle of every property photo as it uploads: in Add / Edit Property and on sellers' Free Listing photos. Photos already on the site keep the mark they were uploaded with."
        actions={<>
          <Button variant="quiet" onClick={() => setW(DEFAULT)} disabled={saved === null}><RotateCcw size={14} />Reset</Button>
          <Button onClick={save} disabled={saving || saved === null || !dirty}><Check size={14} />{saving ? "Saving…" : dirty ? "Save Watermark" : "Saved"}</Button>
        </>} />

      <div className="grid grid-cols-1 xl:grid-cols-[22rem_1fr] gap-8 items-start">
        <div className="border p-6 flex flex-col gap-6" style={{ borderColor: BORDER_L, background: WHITE }}>
          <Toggle checked={w.enabled} onChange={v => set("enabled", v)} label="Stamp new photos"
            description={w.enabled ? "On: every new property photo gets the band." : "Off: photos upload without a band (they are still resized and their location data removed)."} />
          <Field label="Text" hint="Shown in capitals. Leave it empty to show only the logo.">
            <TextInput value={w.text} onChange={v => set("text", v)} maxLength={40} placeholder="NEPAL BHOOMI" />
          </Field>
          <Field label="Logo" hint="Optional. A PNG with a see-through background looks best; it sits to the left of the text.">
            <div className="flex items-center gap-3">
              <div className="w-20 h-12 border flex items-center justify-center shrink-0" style={{ borderColor: BORDER_L, background: "#1a1611" }}>
                {w.logo ? <img src={w.logo} alt="Watermark logo" className="max-w-full max-h-full object-contain" /> : <ImagePlus size={18} style={{ color: MUTED_L }} />}
              </div>
              <Button variant="quiet" onClick={() => logoInput.current?.click()}><Upload size={13} />{w.logo ? "Change" : "Upload"}</Button>
              {w.logo && <Button variant="quiet" onClick={() => set("logo", "")} title="Remove the logo"><Trash2 size={13} /></Button>}
            </div>
            <input ref={logoInput} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={e => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
          </Field>
          <Field label="Strength" hint="How visible the whole mark is: band, logo and text. Lower is subtler."><Slider value={w.opacity} min={10} max={90} onChange={v => set("opacity", v)} label="Strength" /></Field>
          <Field label="Band height" hint="As a share of the photo's shorter side, so portrait phone photos get the same band as landscape ones. Lower is thinner."><Slider value={w.size} min={4} max={30} onChange={v => set("size", v)} label="Band height" /></Field>
        </div>

        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] tracking-[0.28em] uppercase" style={{ color: GOLD, ...sans }}>
              Preview{sampleName ? ` · ${sampleName}` : " · the newest property's cover"}
            </p>
            <Button variant="quiet" onClick={() => photoInput.current?.click()}><ImagePlus size={13} />Try with your own photo</Button>
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={e => { pickSample(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <canvas ref={canvas} aria-label="Watermark preview" className="w-full h-auto border block" style={{ borderColor: BORDER_L, background: "#cfc6b8" }} />
          <p className="text-[12px] leading-relaxed" style={{ color: MUTED_L, ...sans }}>
            Exactly what will be stamped. Uploaded photos are also turned upright, resized to at most 2560 px and saved
            without their hidden camera data (including the GPS location phones record).
          </p>
        </div>
      </div>
    </div>
  );
}
