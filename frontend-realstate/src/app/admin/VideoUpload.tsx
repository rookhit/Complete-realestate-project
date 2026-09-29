import { useEffect, useRef, useState } from "react";
import { Camera, Check, Film, Upload } from "lucide-react";
import { VIDEO_LIST, nextId, upsert, type CompanyVideoInput } from "@/app/data/content";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans } from "@/app/components/ui/brand";
import { Button, Field, TextInput } from "@/app/components/ui/form-controls";
import { Drawer, type Notify } from "./parts";
import { VideoPreview } from "./previews";

/** Largest file accepted here. The upload endpoint should enforce its own limit. */
const MAX_MB = 500;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Upload a video file from the computer. The browser plays it straight from the file,
 * reads its length, and takes a cover image from a frame (the admin can pick another).
 *
 * For the backend: today the file lives as a temporary browser link and is gone after a
 * reload. POST it to /admin/uploads/video (multipart) and store the returned URL in
 * `sources[0].src`; send the cover (a JPEG data URL) to /admin/uploads (FRONTEND_CLAUDE.md §7.8).
 */
export function VideoUploadEditor({ video, open, onClose, notify }: { video: CompanyVideoInput | null; open: boolean; onClose: () => void; notify: Notify }) {
  const blank = (): CompanyVideoInput => ({ id: nextId(VIDEO_LIST), title: "", duration: "", sources: [], poster: "" });
  const [d, setD] = useState<CompanyVideoInput>(blank);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [tried, setTried] = useState(false);
  const [over, setOver] = useState(false);
  const [base, setBase] = useState("");
  const player = useRef<HTMLVideoElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const start = video ?? blank();
    setD(start); setBase(JSON.stringify(start)); setTried(false); setError(""); setFileName("");
  }, [open, video]);

  const src = d.sources?.[0]?.src ?? "";
  const dirty = base !== "" && JSON.stringify(d) !== base;

  const take = (file: File | undefined) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("video/")) { setError("That file isn’t a video. Choose an MP4, MOV or WebM file."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`That file is over ${MAX_MB} MB. Please compress it first.`); return; }
    setFileName(file.name);
    setD(o => ({
      ...o,
      title: o.title || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim(),
      sources: [{ label: "Original", src: URL.createObjectURL(file), type: file.type }],
      poster: "", duration: "",
    }));
  };

  const gotLength = (v: HTMLVideoElement) => {
    setD(o => ({ ...o, duration: o.duration || clock(v.duration) }));
    v.currentTime = Math.min(1, v.duration / 3);   // a frame from early on becomes the first cover
  };

  /** The frame on screen, as a JPEG, becomes the cover. */
  const grabFrame = () => {
    const v = player.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = Math.min(1280, v.videoWidth);
    c.height = Math.round((c.width / v.videoWidth) * v.videoHeight);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    try { setD(o => ({ ...o, poster: c.toDataURL("image/jpeg", 0.82) })); } catch { /* frame not readable: keep the old cover */ }
  };

  const issues = [
    !src && "Choose a video file.",
    d.title.trim().length < 3 && "Give the video a title.",
    !/^\d{1,2}:\d{2}$/.test(d.duration.trim()) && "Enter the length as minutes:seconds, e.g. 1:19.",
    !d.poster && "Wait for the cover image, or press “Use this frame”.",
  ].filter(Boolean) as string[];

  const save = () => {
    setTried(true);
    if (issues.length) return;
    upsert(VIDEO_LIST, { ...d, title: d.title.trim(), youtubeUrl: undefined, youtubeId: undefined });
    notify(video ? "Video updated" : "Video added");
    onClose();
  };

  return (
    <Drawer open={open} onClose={onClose} backLabel="Back to Videos" dirty={dirty} onSave={save} width={720}
      title={video ? "Edit Uploaded Video" : "Upload a Video"} subtitle="From your computer: MP4, MOV or WebM, up to 500 MB."
      preview={<VideoPreview title={d.title} duration={d.duration} poster={d.poster ?? ""} isYouTube={false} />}
      footer={<>
        {tried && issues[0] && <p className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{issues[0]}</p>}
        <Button onClick={save}><Check size={14} />{video ? "Save" : "Add Video"}</Button>
      </>}>
      <div className="flex flex-col gap-6 border p-6 md:p-8" style={{ borderColor: BORDER_L, background: WHITE }}>
        <input ref={picker} type="file" accept="video/*" className="hidden" onChange={e => { take(e.target.files?.[0]); e.target.value = ""; }} />

        {!src ? (
          <button type="button" onClick={() => picker.current?.click()}
            onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed text-center px-6 transition-colors"
            style={{ aspectRatio: "16/9", borderColor: over ? MAROON : "rgba(176,136,72,0.5)", background: over ? "rgba(138,32,48,0.04)" : "rgba(176,136,72,0.05)" }}>
            <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: `1px solid ${GOLD}`, color: GOLD }}><Upload size={22} /></span>
            <span className="text-[16px]" style={{ color: FG_LIGHT, ...sans }}>Drag a video here, or <u>choose a file</u></span>
            <span className="text-[12px]" style={{ color: MUTED_L, ...sans }}>MP4, MOV or WebM · up to {MAX_MB} MB</span>
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <video ref={player} src={src} controls playsInline preload="metadata" className="w-full" style={{ aspectRatio: "16/9", background: "#0a0908" }}
              // Some WebM files (screen and browser recordings) report no length until the end is
              // reached, so seek far ahead once; durationchange then gives the real length.
              onLoadedMetadata={e => { const v = e.currentTarget; if (Number.isFinite(v.duration)) gotLength(v); else v.currentTime = 1e9; }}
              onDurationChange={e => { const v = e.currentTarget; if (Number.isFinite(v.duration) && v.duration > 0 && !d.duration) gotLength(v); }}
              onSeeked={() => { if (!d.poster) grabFrame(); }} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="quiet" onClick={grabFrame}><Camera size={14} />Use this frame as the cover</Button>
              <Button variant="quiet" onClick={() => picker.current?.click()}><Film size={14} />Choose another file</Button>
              <span className="text-[12px] ml-auto" style={{ color: MUTED_L, ...sans }}>{fileName || "Uploaded video"}</span>
            </div>
          </div>
        )}
        {error && <p className="text-[13px]" style={{ color: MAROON, ...sans }}>{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-5">
          <Field label="Title"><TextInput value={d.title} onChange={v => setD(o => ({ ...o, title: v }))} placeholder="e.g. Sitapaila Elite Colony" maxLength={90} /></Field>
          <Field label="Length" hint="Filled in from the file"><TextInput value={d.duration} onChange={v => setD(o => ({ ...o, duration: v.replace(/[^\d:]/g, "") }))} placeholder="0:00" maxLength={5} /></Field>
        </div>
        {d.poster && (
          <Field label="Cover" hint="Play or scrub the video, then press “Use this frame” to change it.">
            <img src={d.poster} alt="Video cover" className="w-48 border" style={{ aspectRatio: "16/9", objectFit: "cover", borderColor: BORDER_L }} />
          </Field>
        )}
      </div>
    </Drawer>
  );
}
