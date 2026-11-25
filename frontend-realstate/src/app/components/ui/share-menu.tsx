// The property page's Share button.
//
// Phones (touch screen with the browser's share sheet): the phone's own sheet, as before: every app
// on the phone is in it. Computers get our menu: WhatsApp, Facebook, X, Email, Copy link, plus "More
// options…" where the browser has a share sheet (Safari on a Mac, Windows). Before, a computer without
// a share sheet (Chrome / Brave / Firefox on a Mac) only copied the link silently, so the owner saw
// no way to share to social media. Admin or visitor makes no difference.
import { useEffect, useRef, useState } from "react";
import { Check, Facebook, Link2, Mail, MoreHorizontal, Share2 } from "lucide-react";
import { BORDER_L, FG_LIGHT, MUTED_L, WHITE, sans } from "./brand";
import { XLogo } from "./social-videos";

/** WhatsApp's mark: a chat bubble with a handset (drawn like the other icons: stroke, currentColor). */
const WhatsApp = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 20.5 4.8 16A8.5 8.5 0 1 1 8 19.2z" />
    <path d="M9.2 8.6c.2-.5.6-.6.9-.5l.6 1.4c.1.3 0 .5-.2.7l-.4.4c.4.9 1.2 1.8 2.3 2.4l.5-.5c.2-.2.4-.3.7-.2l1.4.6c.2.3 0 .8-.4 1.1-.6.5-1.5.5-2.6 0a7.6 7.6 0 0 1-3.4-3.4c-.4-.8-.4-1.5.6-2z" fill="currentColor" stroke="none" />
  </svg>
);

/** A touch-first device that has the browser's share sheet: use it directly. */
const phoneSheet = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function" &&
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function ShareButton({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // The page's own address without filters or anchors, so every share points to the same page.
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
  const message = `${text}\n${url}`;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const nativeShare = async () => {
    try { await navigator.share({ title, text, url }); } catch { /* dismissed */ }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked (old browser, insecure page): select-and-copy fallback.
      const t = document.createElement("textarea");
      t.value = url; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1400);
  };
  const enc = encodeURIComponent;
  const links = [
    { name: "WhatsApp", color: "#25D366", icon: <WhatsApp />, href: `https://wa.me/?text=${enc(message)}` },
    { name: "Facebook", color: "#1877F2", icon: <Facebook size={16} />, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { name: "X", color: "#111111", icon: <XLogo size={15} />, href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}` },
    { name: "Email", color: "#8a2030", icon: <Mail size={16} />, href: `mailto:?subject=${enc(title)}&body=${enc(message)}` },
  ];
  const row = "w-full flex items-center gap-3 px-3 py-2.5 text-left text-[14px] font-normal transition-colors hover:bg-[#f6f2ea]";
  const dot = (color: string, icon: React.ReactNode) => (
    <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white" style={{ background: color }}>{icon}</span>
  );

  return (
    <div ref={box} className="relative">
      <button type="button" aria-label="Share property" aria-haspopup="menu" aria-expanded={open}
        onClick={() => (phoneSheet() ? void nativeShare() : setOpen(o => !o))}
        className="p-2.5 border transition-all hover:border-[#8a2030]" style={{ borderColor: open ? "#8a2030" : BORDER_L, color: MUTED_L }}>
        <Share2 size={14} />
      </button>
      {open && (
        <div role="menu" aria-label="Share this property" className="absolute right-0 top-full mt-2 z-[70] w-60 border py-1.5 shadow-xl"
          style={{ background: WHITE, borderColor: BORDER_L, ...sans }}>
          <p className="px-3 pt-1 pb-2 text-[10px] tracking-[0.24em] uppercase" style={{ color: MUTED_L }}>Share this property</p>
          {links.map(l => (
            <a key={l.name} role="menuitem" href={l.href} target={l.name === "Email" ? undefined : "_blank"} rel="noopener noreferrer"
              onClick={() => setOpen(false)} className={row} style={{ color: FG_LIGHT }}>
              {dot(l.color, l.icon)}{l.name}
            </a>
          ))}
          <button type="button" role="menuitem" onClick={() => void copy()} className={row} style={{ color: FG_LIGHT }}>
            {dot(copied ? "#2e7d4f" : "#6b6154", copied ? <Check size={16} /> : <Link2 size={16} />)}{copied ? "Link copied" : "Copy link"}
          </button>
          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); void nativeShare(); }} className={row} style={{ color: FG_LIGHT }}>
              {dot("#b08848", <MoreHorizontal size={16} />)}More options…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
