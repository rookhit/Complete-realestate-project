import { Calendar, Clock, Play, Star } from "lucide-react";
import type { BlogPost, TeamMember, Testimonial } from "@/app/data/content";
import { BORDER_L, CREAM, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";

/**
 * Live previews for the content editors. Each one repeats the markup of the public
 * section it previews (named on each component); if that section's design changes,
 * change its preview here too.
 */

const Placeholder = ({ ratio, label }: { ratio: string; label: string }) => (
  <div className="w-full flex items-center justify-center text-[12px]" style={{ aspectRatio: ratio, background: "#e2dbcf", color: MUTED_L, ...sans }}>{label}</div>
);
const Note = ({ children }: { children: string }) => <p className="mt-3 text-[12px] text-center" style={{ color: MUTED_L, ...sans }}>{children}</p>;

/** Mirrors the article cards in BlogPage (App.tsx). */
export function ArticlePreview({ a }: { a: BlogPost }) {
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="flex flex-col text-left p-4" style={{ background: "#f7f3ed" }}>
        <div className="overflow-hidden mb-4" style={{ aspectRatio: "16/10" }}>
          {a.image ? <img src={a.image} alt="" className="w-full h-full object-cover" /> : <Placeholder ratio="16/10" label="Cover photo" />}
        </div>
        <span className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: GOLD, ...sans }}>{a.cat || "Category"}</span>
        <h3 className="text-[1.05rem] leading-snug mb-2" style={{ color: FG_LIGHT, ...serif }}>{a.title || "Your article title"}</h3>
        <p className="text-[14px] leading-relaxed" style={{ color: MUTED_L, ...sans }}>{a.excerpt || "The summary appears here."}</p>
        <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: BORDER_L }}>
          <span className="flex items-center gap-3 text-[11px]" style={{ color: MUTED_L, ...sans }}>
            <span className="flex items-center gap-1"><Calendar size={11} style={{ color: GOLD }} />{a.date}</span>
            <span className="flex items-center gap-1"><Clock size={11} style={{ color: GOLD }} />{a.read}</span>
          </span>
          <span className="text-[11px] tracking-[0.2em] uppercase" style={{ color: MAROON, ...sans }}>Read &rarr;</span>
        </div>
      </div>
      <Note>As on the Property Journal page.</Note>
    </div>
  );
}

/** Mirrors TeamCard and a condensed TeamProfile (components/ui/team-profile.tsx). */
export function TeamPreview({ m }: { m: TeamMember }) {
  return (
    <div className="mx-auto w-full max-w-[320px] flex flex-col gap-5">
      <div>
        <div className="p-4 mx-auto max-w-[240px]" style={{ background: WHITE }}>
          <div className="overflow-hidden mb-4" style={{ aspectRatio: "4/5" }}>
            {m.img ? <img src={m.img} alt="" className="w-full h-full object-cover grayscale" /> : <Placeholder ratio="4/5" label="Portrait" />}
          </div>
          <p className="text-base" style={{ color: FG_LIGHT, ...serif }}>{m.name || "Full name"}</p>
          <p className="text-[12px] tracking-[0.15em] mt-0.5" style={{ color: MUTED_L, ...sans }}>{m.role || "Role"}</p>
        </div>
        <Note>The card. Portraits turn to colour on hover.</Note>
      </div>
      <div>
        <div className="p-5 flex flex-col gap-3" style={{ background: WHITE }}>
          <div className="flex items-center gap-2">
            <div style={{ width: "1.5rem", height: "0.5px", background: GOLD }} />
            <span className="text-[9px] tracking-[0.3em] uppercase" style={{ color: GOLD, ...sans }}>{m.department || "Department"}</span>
          </div>
          <p className="text-[20px] leading-tight" style={{ color: FG_LIGHT, ...serif }}>{m.name || "Full name"}</p>
          {!!m.experienceYears && <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>{m.experienceYears} years with Nepal’s property market</p>}
          <p className="text-[13px] leading-relaxed line-clamp-4" style={{ color: MUTED_L, ...sans }}>{m.bio || "The short bio appears here."}</p>
          {!!m.specialities?.length && (
            <div className="flex flex-wrap gap-1.5">{m.specialities.slice(0, 4).map(s => <span key={s} className="px-2 py-1 text-[11px] border" style={{ borderColor: "rgba(176,136,72,0.45)", color: FG_LIGHT, ...sans }}>{s}</span>)}</div>
          )}
          <div className="flex gap-1.5 mt-1">
            {[m.phone && "Call", m.whatsapp && "WhatsApp", m.email && "Email"].filter(Boolean).map(b => (
              <span key={b as string} className="flex-1 text-center py-2 text-[10px] tracking-[0.2em] uppercase" style={{ background: b === "Call" ? MAROON : "transparent", color: b === "Call" ? WHITE : FG_LIGHT, border: b === "Call" ? "none" : `1px solid ${BORDER_L}`, ...sans }}>{b}</span>
            ))}
          </div>
        </div>
        <Note>The profile that opens when the card is clicked.</Note>
      </div>
    </div>
  );
}

/** Mirrors the highlighted card in TestimonialsSection (App.tsx). */
export function TestimonialPreview({ t }: { t: Testimonial }) {
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="p-8 border" style={{ background: CREAM, borderColor: BORDER_L }}>
        <div className="flex gap-0.5 mb-5">{Array.from({ length: t.rating }).map((_, j) => <Star key={j} size={15} fill={GOLD} style={{ color: GOLD }} />)}</div>
        <p className="text-[15px] leading-[1.75] mb-6" style={{ color: MUTED_L, ...sans }}>“{t.text || "What the client said appears here."}”</p>
        <div className="flex items-center gap-3 pt-5 border-t" style={{ borderColor: BORDER_L }}>
          {t.img ? <img src={t.img} alt="" className="w-10 h-10 object-cover rounded-full" /> : <span className="w-10 h-10 rounded-full" style={{ background: "#e2dbcf" }} />}
          <div>
            <p className="text-[15px] font-medium" style={{ color: FG_LIGHT, ...sans }}>{t.name || "Client name"}</p>
            <p className="text-[12px]" style={{ color: MUTED_L, ...sans }}>{t.role || "Who they are"}</p>
          </div>
        </div>
      </div>
      <Note>In “What Our Clients Say” on the home page.</Note>
    </div>
  );
}

/** Mirrors the centre card of VideoSection (App.tsx). */
export function VideoPreview({ title, duration, poster, isYouTube }: { title: string; duration: string; poster: string; isYouTube: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <div className="relative overflow-hidden" style={{ aspectRatio: "16/9", background: "#1a1611" }}>
        {poster && <img src={poster} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,9,8,0.88) 0%, rgba(10,9,8,0.2) 55%, rgba(10,9,8,0.05) 100%)" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-white/80 bg-black/25"><Play size={20} fill="white" style={{ color: "white", marginLeft: 2 }} /></span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[9px] tracking-[0.28em] uppercase" style={{ color: GOLD, ...sans }}>{duration || "0:00"}</span>
            {isYouTube && <span className="text-[9px] tracking-[0.2em] uppercase" style={{ color: "rgba(240,235,224,0.5)", ...sans }}>YouTube</span>}
          </div>
          <p className="leading-[1.1] text-[1.05rem]" style={{ color: WHITE, ...serif }}>{title || "Video title"}</p>
        </div>
      </div>
      <Note>In “Explore in Video” on the home page.</Note>
    </div>
  );
}
