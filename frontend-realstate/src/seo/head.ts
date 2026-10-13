// Keeps <head> in step with the page in the browser: title, description, canonical address, link
// previews and JSON-LD (see meta.ts). The pre-rendered HTML files start with the same tags.
import { DEFAULT_SITE_URL, absolute, jsonForScript, organizationLd, type PageMeta, type SeoContact } from "./meta";

export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || DEFAULT_SITE_URL).replace(/\/+$/, "");

function meta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  if (el.content !== content) el.content = content;
}

let lastLd = "";

export function applyHead(m: PageMeta, contact: SeoContact) {
  const url = absolute(SITE_URL, m.path), img = absolute(SITE_URL, m.image);
  if (document.title !== m.title) document.title = m.title;
  meta("name", "description", m.description);
  meta("name", "robots", m.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
  if (canonical.href !== url) canonical.href = url;
  meta("property", "og:type", m.type);
  meta("property", "og:title", m.title);
  meta("property", "og:description", m.description);
  meta("property", "og:url", url);
  meta("property", "og:image", img);
  meta("name", "twitter:card", "summary_large_image");

  const blocks = [organizationLd(SITE_URL, contact), ...m.jsonLd].map(jsonForScript);
  const key = blocks.join("\n");
  if (key === lastLd) return;
  lastLd = key;
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
  for (const b of blocks) {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = b;
    document.head.appendChild(s);
  }
}
