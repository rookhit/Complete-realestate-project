import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, ChevronDown, MessageSquare, Send, Star, X } from "lucide-react";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "./brand";
import { StarRow } from "./star-row";
import { ratingFor, reviewsFor, type Review } from "@/app/data/reviews";

/** How many reviews show before "Show all". */
const VISIBLE = 2;

// "Resident Reviews" on the property page: rating summary, two reviews (rest behind a
// button) and a write-a-review form. id="reviews" is the target of the rating link.
// Data: data/reviews.ts until GET /properties/:id/reviews exists.
export function ReviewsSection({ propId }: { propId: number }) {
  const all = reviewsFor(propId);
  const [expanded, setExpanded] = useState(false);
  const [writing, setWriting] = useState(false);

  const avg = ratingFor(propId);
  const shown = expanded ? all : all.slice(0, VISIBLE);
  const hidden = all.length - VISIBLE;

  // Share of each star value, for the distribution rules.
  const dist = [5, 4, 3, 2, 1].map(v => ({
    v, pct: all.length ? (all.filter(r => r.rating === v).length / all.length) * 100 : 0,
  }));

  return (
    <div id="reviews" style={{ scrollMarginTop: "7rem" }}>
      <p className="text-[11px] tracking-[0.3em] uppercase mb-5" style={{ color: GOLD, ...sans }}>Resident Reviews</p>

      {/* Summary */}
      <div className="p-7 md:p-9 border mb-6" style={{ background: WHITE, borderColor: BORDER_L }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-8 sm:gap-10">
          <div className="shrink-0">
            <p className="leading-none" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(2.6rem,5vw,3.6rem)" }}>
              {all.length ? avg.toFixed(1) : "—"}
            </p>
            <div className="mt-3"><StarRow value={avg} size={15} /></div>
            <p className="mt-2.5 text-[11px] tracking-[0.2em] uppercase" style={{ color: MUTED_L, ...sans }}>
              {all.length} Review{all.length === 1 ? "" : "s"}
            </p>
          </div>

          {/* Distribution, drawn as thin gold rules to match the hairlines elsewhere. */}
          <div className="hidden sm:flex flex-col gap-2 w-full max-w-[19rem]">
            {dist.map(d => (
              <div key={d.v} className="flex items-center gap-3">
                <span className="w-3 text-[11px] tabular-nums" style={{ color: MUTED_L, ...sans }}>{d.v}</span>
                <Star size={10} fill={GOLD} style={{ color: GOLD }} />
                <span className="flex-1 h-px min-w-0" style={{ background: "rgba(26,22,17,0.09)" }}>
                  <motion.span className="block h-px" style={{ background: GOLD }}
                    initial={{ width: 0 }} animate={{ width: `${d.pct}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 * (5 - d.v) }} />
                </span>
                <span className="w-8 text-right text-[11px] tabular-nums" style={{ color: MUTED_L, ...sans }}>
                  {Math.round(d.pct)}%
                </span>
              </div>
            ))}
          </div>

          {!writing && (
            <button onClick={() => setWriting(true)}
              className="shrink-0 sm:ml-auto flex items-center justify-center gap-2 px-6 py-3.5 border text-[11px] tracking-[0.25em] uppercase transition-all hover:border-[#8a2030]"
              style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>
              <MessageSquare size={14} />Write a Review
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {writing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden mb-6">
            <ReviewForm onClose={() => setWriting(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-5">
        {shown.map((r, i) => (
          <motion.div key={`${r.id}-${i}`}
            initial={i < VISIBLE ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: Math.min((i - VISIBLE) * 0.07, 0.35) }}>
            <ReviewCard r={r} />
          </motion.div>
        ))}
      </div>

      {hidden > 0 && (
        <button onClick={() => setExpanded(e => !e)}
          className="mt-6 w-full flex items-center justify-center gap-2 py-4 border text-[11px] tracking-[0.25em] uppercase transition-all hover:border-[#8a2030]"
          style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>
          {expanded ? "Show Fewer Reviews" : `Show All ${all.length} Reviews`}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }} className="flex">
            <ChevronDown size={15} />
          </motion.span>
        </button>
      )}
    </div>
  );
}

// "★ 4.8 · 5 reviews" in the property info bar; scrolls down to the reviews.
export function RatingLink({ propId }: { propId: number }) {
  const count = reviewsFor(propId).length;
  if (!count) return null;
  return (
    <button
      onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className="flex items-center gap-2 text-[14px] transition-colors hover:text-[#8a2030]"
      style={{ color: MUTED_L, ...sans }}>
      <Star size={14} fill={GOLD} style={{ color: GOLD }} />
      <span style={{ color: FG_LIGHT }}>{ratingFor(propId).toFixed(1)}</span>
      <span className="underline underline-offset-4 decoration-[rgba(26,22,17,0.2)]">
        {count} review{count === 1 ? "" : "s"}
      </span>
    </button>
  );
}

/** One review card. */
export function ReviewCard({ r }: { r: Review }) {
  return (
    <div className="p-7 md:p-8 border" style={{ background: WHITE, borderColor: BORDER_L }}>
      <div className="flex items-start gap-4">
        <img src={r.avatar} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="text-[16px]" style={{ color: FG_LIGHT, ...serif }}>{r.author}</p>
            {r.verified && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-[0.18em] uppercase"
                style={{ background: "rgba(176,136,72,0.13)", color: GOLD, ...sans }}>
                <CheckCircle2 size={10} />Verified Visit
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-2">
            <StarRow value={r.rating} size={13} />
            <span className="text-[11px] tracking-[0.2em] uppercase" style={{ color: MUTED_L, ...sans }}>{r.date}</span>
          </div>
        </div>
      </div>
      <p className="mt-5 text-[15px] leading-[1.8]" style={{ color: MUTED_L, ...sans }}>{r.text}</p>
    </div>
  );
}

// Write-a-review form. Only validates for now; POST /properties/:id/reviews
// with { rating, name, text } goes where setSent(true) is.
export function ReviewForm({ onClose }: { onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (!rating)                 { setErr("Please choose a star rating."); return; }
    if (!name.trim())            { setErr("Please enter your name."); return; }
    if (text.trim().length < 20) { setErr("Please write at least a couple of sentences."); return; }
    setErr(""); setSent(true);
  };

  if (sent) return (
    <div className="p-8 border flex flex-col items-start gap-3" style={{ background: WHITE, borderColor: BORDER_L }}>
      <CheckCircle2 size={26} style={{ color: GOLD }} />
      <p className="text-xl" style={{ color: FG_LIGHT, ...serif }}>Thank you for your review.</p>
      <p className="text-[15px]" style={{ color: MUTED_L, ...sans }}>It will appear here once our team has verified your visit.</p>
      <button onClick={onClose} className="mt-2 text-[11px] tracking-[0.25em] uppercase transition-colors hover:brightness-110" style={{ color: MAROON, ...sans }}>Close</button>
    </div>
  );

  return (
    <div className="p-7 md:p-8 border flex flex-col gap-5" style={{ background: WHITE, borderColor: BORDER_L }}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] tracking-[0.3em] uppercase" style={{ color: GOLD, ...sans }}>Write a Review</p>
        <button onClick={onClose} aria-label="Cancel review" className="p-1 transition-colors hover:text-[#8a2030]" style={{ color: MUTED_L }}><X size={16} /></button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] tracking-[0.28em] uppercase" style={{ color: MUTED_L, ...sans }}>Your Rating</label>
        <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(v => (
            <button key={v} type="button" aria-label={`${v} star${v > 1 ? "s" : ""}`}
              onClick={() => setRating(v)} onMouseEnter={() => setHover(v)}
              className="p-0.5 transition-transform hover:scale-110">
              <Star size={24} fill={v <= (hover || rating) ? GOLD : "none"}
                style={{ color: v <= (hover || rating) ? GOLD : "rgba(176,136,72,0.4)" }} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] tracking-[0.28em] uppercase" style={{ color: MUTED_L, ...sans }}>Your Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
          className="border px-4 py-3 text-[15px] outline-none transition-all focus:border-[#8a2030]"
          style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] tracking-[0.28em] uppercase" style={{ color: MUTED_L, ...sans }}>Your Review</label>
        <textarea rows={4} value={text} onChange={e => setText(e.target.value)}
          placeholder="What stood out when you visited?"
          className="border px-4 py-3 text-[15px] outline-none resize-none transition-all focus:border-[#8a2030]"
          style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }} />
      </div>

      {err && <p className="text-[14px]" style={{ color: MAROON, ...sans }}>{err}</p>}

      <button onClick={submit}
        className="flex items-center justify-center gap-2 py-3.5 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110"
        style={{ background: MAROON, color: WHITE, ...sans }}>
        <Send size={14} />Submit Review
      </button>
    </div>
  );
}
