import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MessageCircle, Phone } from "lucide-react";
import { MAROON, WHITE, sans } from "./brand";

/** WhatsApp number the dock links to. Replace with the real business number. */
export const WHATSAPP_URL = "https://wa.me/9779800000000";

// Quick Enquiry + WhatsApp buttons in the bottom-right corner.
// With overHero, the dock stays hidden until the visitor scrolls past the home hero
// (the hero has its own "Scroll" cue in that corner).
export function FloatingDock({ onEnquire, overHero = false }: { onEnquire: () => void; overHero?: boolean }) {
  const [shown, setShown] = useState(!overHero);

  useEffect(() => {
    if (!overHero) { setShown(true); return; }
    setShown(false);
    const fn = () => setShown(window.scrollY > window.innerHeight * 0.55);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [overHero]);

  // One automatic reveal of the label once the dock appears, so a first-time
  // visitor reads it without the button blinking forever. It does not repeat.
  const [peek, setPeek] = useState(false);
  const peeked = useRef(false);
  useEffect(() => {
    if (!shown || peeked.current) return;
    peeked.current = true;
    const a = window.setTimeout(() => setPeek(true), 700);
    const b = window.setTimeout(() => setPeek(false), 4200);
    // Collapse on cleanup too, or hiding the dock mid-peek leaves it stretched open.
    return () => { window.clearTimeout(a); window.clearTimeout(b); setPeek(false); };
  }, [shown]);

  return (
    <motion.div
      className="fixed bottom-7 right-7 z-40 flex flex-col items-end gap-3"
      initial={false}
      animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 20, scale: shown ? 1 : 0.9 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ pointerEvents: shown ? "auto" : "none" }}
      aria-hidden={!shown}
    >
      <DockButton label="Quick Enquiry" bg={MAROON} pulse icon={<Phone size={19} />} onClick={onEnquire} peek={peek} />
      <DockButton label="WhatsApp" bg="#25D366" icon={<MessageCircle size={19} />} href={WHATSAPP_URL} />
    </motion.div>
  );
}

// A round 52px button; the label slides out on hover. pulse adds a slow gold ring.
export function DockButton({ icon, label, bg, onClick, href, pulse = false, peek = false }: {
  icon: React.ReactNode; label: string; bg: string;
  onClick?: () => void; href?: string; pulse?: boolean; peek?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const open = hov || peek;

  const body = (
    <>
      <span className="w-[52px] h-[52px] shrink-0 flex items-center justify-center">{icon}</span>
      <span
        className="text-[11px] tracking-[0.2em] uppercase whitespace-nowrap overflow-hidden"
        style={{
          maxWidth: open ? 200 : 0,
          opacity: open ? 1 : 0,
          paddingRight: open ? 22 : 0,
          transition: "max-width 480ms cubic-bezier(0.16,1,0.3,1), padding-right 480ms cubic-bezier(0.16,1,0.3,1), opacity 260ms ease",
        }}
      >{label}</span>
    </>
  );

  const cls = "relative flex items-center rounded-full overflow-hidden transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97]";
  const drop = "0 6px 22px rgba(10,9,8,0.24)";
  const sty = { background: bg, color: WHITE, boxShadow: drop, ...sans };

  // The ring is a spread box-shadow rather than a child element, because the
  // label slide needs overflow-hidden here and that would clip a child. It
  // rests while the label is out so the motion never competes with reading it.
  const ringing = pulse && !open;
  const halo = ringing
    ? { boxShadow: [`${drop}, 0 0 0 0 rgba(176,136,72,0.5)`, `${drop}, 0 0 0 13px rgba(176,136,72,0)`] }
    : { boxShadow: drop };
  const haloT = ringing
    ? { duration: 2.6, repeat: Infinity, ease: "easeOut" as const, repeatDelay: 0.5 }
    : { duration: 0.3 };

  const shared = {
    "aria-label": label,
    onMouseEnter: () => setHov(true), onMouseLeave: () => setHov(false),
    onFocus: () => setHov(true), onBlur: () => setHov(false),
    className: cls, style: sty, animate: halo, transition: haloT,
  } as const;

  return href
    ? <motion.a href={href} target="_blank" rel="noopener noreferrer" {...shared}>{body}</motion.a>
    : <motion.button type="button" onClick={onClick} {...shared}>{body}</motion.button>;
}
