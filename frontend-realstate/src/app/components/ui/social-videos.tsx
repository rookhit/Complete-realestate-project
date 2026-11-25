// The property's videos on social media (Property.videoLinks): which platform a link is, its icon, and
// the clickable buttons on the property page. Used by the property page and the admin editor's preview.
import type { ReactNode } from "react";
import { ArrowUpRight, Facebook, Instagram, PlayCircle, Youtube } from "lucide-react";
import { BORDER_L, FG_LIGHT, GOLD, MUTED_L, WHITE, sans } from "./brand";

const TikTok = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.59-2.59 2.59 2.59 0 0 1 3.32-2.49V9.66a5.68 5.68 0 0 0-.73-.05A5.69 5.69 0 0 0 4.17 15.3 5.69 5.69 0 0 0 9.86 21a5.69 5.69 0 0 0 5.69-5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48z" />
  </svg>
);
export const XLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3zm-1.08 16.17h1.7L7.4 4.73H5.58l11.09 14.44z" />
  </svg>
);

export type Platform = { name: string; icon: (size: number) => ReactNode; color: string };

const PLATFORMS: { test: RegExp; platform: Platform }[] = [
  { test: /(^|\.)(facebook\.com|fb\.watch|fb\.com)$/i, platform: { name: "Facebook", color: "#1877F2", icon: s => <Facebook size={s} /> } },
  { test: /(^|\.)instagram\.com$/i, platform: { name: "Instagram", color: "#E4405F", icon: s => <Instagram size={s} /> } },
  { test: /(^|\.)(youtube\.com|youtu\.be)$/i, platform: { name: "YouTube", color: "#FF0000", icon: s => <Youtube size={s} /> } },
  { test: /(^|\.)tiktok\.com$/i, platform: { name: "TikTok", color: "#111111", icon: s => <TikTok size={s} /> } },
  { test: /(^|\.)(x\.com|twitter\.com)$/i, platform: { name: "X", color: "#111111", icon: s => <XLogo size={s} /> } },
];

/** The platform of a link from its address; anything else is a plain "Video". */
export function platformOf(url: string): Platform {
  let host = "";
  try { host = new URL(url.trim()).hostname.replace(/^www\.|^m\./i, ""); } catch { /* not a full link */ }
  return PLATFORMS.find(p => p.test.test(host))?.platform ?? { name: "Video", color: GOLD, icon: s => <PlayCircle size={s} /> };
}

/** A full https link, as the server accepts it. */
export const isVideoLink = (url: string) => /^https:\/\/\S+$/i.test(url.trim());

/**
 * Property page: one button per link (icon + "Watch on Facebook"), opening the post in a new tab.
 * Two links on the same platform are numbered so they can be told apart.
 */
export function SocialVideoLinks({ links }: { links: string[] }) {
  const usable = links.filter(isVideoLink);
  if (!usable.length) return null;
  const seen: Record<string, number> = {};
  const total: Record<string, number> = {};
  for (const l of usable) { const n = platformOf(l).name; total[n] = (total[n] ?? 0) + 1; }
  return (
    <div className="flex flex-wrap gap-3">
      {usable.map(link => {
        const p = platformOf(link);
        seen[p.name] = (seen[p.name] ?? 0) + 1;
        const label = `Watch on ${p.name === "Video" ? "the web" : p.name}${total[p.name] > 1 ? ` (${seen[p.name]})` : ""}`;
        return (
          <a key={link} href={link} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`}
            className="group inline-flex items-center gap-3 pl-2 pr-4 py-2 border transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2"
            style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }}>
            <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white" style={{ background: p.color }}>{p.icon(17)}</span>
            <span className="text-[14px]">{label}</span>
            <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: MUTED_L }} />
          </a>
        );
      })}
    </div>
  );
}
