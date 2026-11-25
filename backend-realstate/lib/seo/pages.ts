import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";
import { getPublicProperty, type PublicProperty } from "@/lib/content/properties";
import { toArticle, type ArticleOut } from "@/lib/content/articles";
import { loadSite } from "@/lib/content/site";
import {
  DEFAULT_SITE_URL, articleMeta, headHtml, propertyMeta, staticPageMeta, type PageMeta, type SeoContact,
} from "@/lib/seo/meta";

// The HTML for one property or article page, built on request (since 2026-11-22; before, the frontend
// build wrote one file per property, so a property added or changed after a deploy had no page of its
// own for Google and link previews until the next deploy).
//
// The page is the site's own index.html, fetched from the frontend (FRONTEND_ORIGIN) each time, so its
// script and style addresses always belong to the deployment that is live. Only two marked blocks change:
//  - <!-- seo:start --> … <!-- seo:end -->: title, description, Open Graph, JSON-LD (lib/seo/meta.ts,
//    a copy of the frontend's src/seo/meta.ts, so the browser and this agree);
//  - <!-- prerender:content --> … : a plain readable version for crawlers that don't run JavaScript
//    (hidden from visitors by index.html until the app replaces it).
// The frontend host forwards /property/* and /blog/* here (frontend-realstate/vercel.json).

/** The public address of the site, for canonical links and absolute picture addresses. */
const siteUrl = (): string => (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
const TEL = "+9779818783518";

// Same as the frontend's CONTACT (src/app/data/content.ts); the admin's saved contact wins.
const DEFAULT_CONTACT: SeoContact = {
  address: "Lazimpat, Kathmandu\nOpposite Image Channel building",
  phone: "+977 9818783518",
  email: "info@nepalbhoomi.com",
  hours: "Sunday–Friday: 9:30 AM – 6:00 PM\nSaturday: Closed",
};

async function contact(): Promise<SeoContact> {
  const saved = (await loadSite()).contact;
  return saved ? { address: saved.address, phone: saved.phone, email: saved.email, hours: saved.hours } : DEFAULT_CONTACT;
}

/** The live site's index.html (the home page as built). Throws if it can't be fetched or lacks the markers. */
async function template(): Promise<string> {
  const origin = (process.env.FRONTEND_ORIGIN || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const res = await fetch(`${origin}/`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`template: ${origin}/ answered ${res.status}`);
  const html = await res.text();
  if (!html.includes("<!-- seo:start") || !html.includes("<!-- seo:end -->") || !html.includes("<!-- prerender:content -->")) {
    throw new Error("template: the site's index.html lacks the seo / prerender markers");
  }
  return html;
}

// ─── Plain content (same look as scripts/prerender.mjs) ─────────────────────────

const esc = (s: unknown): string => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const S = {
  wrap: "background:#0a0908;color:#d9d2c4;font:16px/1.7 Arial,Helvetica,sans-serif;padding:32px 20px;box-sizing:border-box",
  inner: "max-width:760px;margin:0 auto",
  brand: "color:#b08848;letter-spacing:.3em;text-transform:uppercase;font-size:12px;text-decoration:none",
  nav: "display:flex;flex-wrap:wrap;gap:6px 18px;margin:14px 0 36px;font-size:13px",
  link: "color:#f0ebe0",
  h1: "font:400 34px/1.25 Georgia,serif;color:#f0ebe0;margin:0 0 14px",
  h2: "font:400 22px/1.3 Georgia,serif;color:#f0ebe0;margin:32px 0 10px",
  muted: "color:#9a9182;font-size:14px",
  img: "width:100%;height:auto;margin:18px 0;display:block",
};
const NAV: [string, string][] = [["/buy", "Buy"], ["/rent", "Rent"], ["/blog", "Journal"], ["/services", "Services"], ["/about", "About"], ["/team", "Our Team"], ["/contact", "Contact"]];

function shell(inner: string, c: SeoContact, lang?: string): string {
  return `<div class="nb-static" style="${S.wrap}"${lang ? ` lang="${lang}"` : ""}><div style="${S.inner}">` +
    `<a href="/" style="${S.brand}">Nepal Bhoomi Real Estate</a>` +
    `<nav style="${S.nav}">${NAV.map(([h, l]) => `<a href="${h}" style="${S.link}">${l}</a>`).join("")}</nav>` +
    inner +
    `<p style="${S.muted};margin-top:40px">Nepal Bhoomi Real Estate · ${esc(c.address.replace(/\n/g, ", "))} · ` +
    `<a href="tel:${TEL}" style="${S.link}">${esc(c.phone)}</a> · <a href="mailto:${esc(c.email)}" style="${S.link}">${esc(c.email)}</a></p>` +
    `</div></div>`;
}

const paragraphs = (text: string): string => String(text || "").split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
  .map((t) => !t.includes("\n") && t.length <= 70 && !/[।.!:;,"”']$/.test(t) && !t.startsWith("•")
    ? `<h2 style="${S.h2}">${esc(t)}</h2>` : `<p>${esc(t).replace(/\n/g, "<br>")}</p>`).join("");

function propertyContent(p: PublicProperty, c: SeoContact): string {
  const rent = p.listing === "For Rent";
  const facts = [
    ["Reference", p.nbId], ["Listing", p.listing], ["Type", p.type], ["Price", p.price], ["Location", p.location],
    ["Bedrooms", p.beds || ""], ["Bathrooms", p.baths || ""], ["Land area", p.landArea !== "—" ? p.landArea : ""],
    ["Built-up area", p.builtArea !== "—" ? p.builtArea : ""], ["Road access", p.roadAccess !== "—" ? p.roadAccess : ""],
  ].filter(([, v]) => v);
  const photos = (p.gallery.length ? p.gallery : [p.hero]).filter(Boolean).slice(0, 3);
  return shell(
    `<p style="${S.muted}"><a href="/" style="${S.link}">Home</a> / <a href="${rent ? "/rent" : "/buy"}" style="${S.link}">${rent ? "Property for Rent" : "Property for Sale"}</a></p>` +
    `<h1 style="${S.h1}">${esc(p.title)}</h1><p>${esc(p.tagline)}</p>` +
    photos.map((src, i) => `<img src="${esc(src)}" alt="${esc(`${p.title}, photo ${i + 1}`)}" style="${S.img}" loading="lazy" />`).join("") +
    `<ul>${facts.map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join("")}</ul>` +
    paragraphs(p.description) +
    (p.highlights.length ? `<h2 style="${S.h2}">Highlights</h2><ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : "") +
    `<p>Interested? Call <a href="tel:${TEL}" style="${S.link}">${esc(c.phone)}</a> and quote ${esc(p.nbId)}.</p>`, c);
}

function articleContent(a: ArticleOut, c: SeoContact): string {
  const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  return shell(
    `<p style="${S.muted}"><a href="/" style="${S.link}">Home</a> / <a href="/blog" style="${S.link}">Journal</a> / ${esc(a.cat)}</p>` +
    `<h1 style="${S.h1}">${esc(a.title)}</h1><p style="${S.muted}">${esc(date)} · ${esc(a.author)}</p>` +
    (a.image ? `<img src="${esc(a.image)}" alt="${esc(a.title)}" style="${S.img}" />` : "") +
    `<p><strong>${esc(a.excerpt)}</strong></p>` + paragraphs(a.body), c, /[ऀ-ॿ]/.test(a.title) ? "ne" : undefined);
}

// The first photo starts downloading at once (same rule as scripts/prerender.mjs and card-photo.ts: our
// uploaded photos have an 800 px copy, so a phone fetches only that).
const OUR_PHOTO = /(\/photos\/\d{4}-\d{2}\/[0-9a-f-]{36})\.(jpe?g|png|webp|avif)(?=$|[?#])/i;
const preloadTag = (url: string): string => OUR_PHOTO.test(url)
  ? `<link rel="preload" as="image" href="${esc(url)}" imagesrcset="${esc(url.replace(OUR_PHOTO, "$1.w800.jpg"))} 800w, ${esc(url)} 2000w" imagesizes="100vw" fetchpriority="high" />`
  : `<link rel="preload" as="image" href="${esc(url)}" fetchpriority="high" />`;

/**
 * The picture link previews use (og:image): the photo's 800 px copy when it exists, else the photo.
 * WhatsApp shows no picture at all when og:image is larger than about 600 KB, and a full-size phone
 * photo often is (1.4 MB on NBS001), so those links were shared as bare text while others had a
 * picture. The copies are 20-170 KB. Checked with a quick HEAD (the page is edge-cached), so a photo
 * whose copy failed to upload still gets a preview.
 */
async function previewImage(url: string): Promise<string> {
  if (!OUR_PHOTO.test(url)) return url;
  const card = url.replace(OUR_PHOTO, "$1.w800.jpg");
  try {
    const res = await fetch(card, { method: "HEAD", signal: AbortSignal.timeout(2_000) });
    return res.ok ? card : url;
  } catch {
    return url;
  }
}

function fill(html: string, meta: PageMeta, c: SeoContact, content: string | null, { canonical = true, preload = "" } = {}): string {
  const head = headHtml(siteUrl(), meta, c, { canonical }) + (preload ? `\n    ${preloadTag(preload)}` : "");
  const out = html.replace(/<!-- seo:start[\s\S]*?<!-- seo:end -->/, () => `<!-- seo:start -->\n    ${head}\n    <!-- seo:end -->`);
  if (content === null) return out;
  const marker = out.includes("<!-- prerender:end -->") ? /<!-- prerender:content -->[\s\S]*?<!-- prerender:end -->/ : /<!-- prerender:content -->/;
  return out.replace(marker, () => `<!-- prerender:content -->${content}<!-- prerender:end -->`);
}

// ─── Pages ──────────────────────────────────────────────────────────────────────

export type SeoPage = { status: number; html: string };

/** "25-traditional-4bhk-house" → 25 (the words after the id don't matter, as in the app). */
const idOf = (slug: string): number | null => {
  const m = /^(\d{1,9})(?:-|$)/.exec(decodeURIComponent(slug));
  return m ? Number(m[1]) : null;
};

/**
 * Not listed (never was, sold / rented out, deleted, a draft): the plain app page with "noindex" and
 * 404, so search engines drop it. Visitors still get the app, which says "no longer listed".
 */
function gone(html: string, c: SeoContact): SeoPage {
  const meta = { ...staticPageMeta(siteUrl(), "/"), noindex: true };
  return { status: 404, html: fill(html, meta, c, shell(`<h1 style="${S.h1}">This page is no longer listed</h1><p><a href="/buy" style="${S.link}">See the properties for sale</a> or <a href="/rent" style="${S.link}">for rent</a>.</p>`, c), { canonical: false }) };
}

export async function propertyPage(slug: string): Promise<SeoPage> {
  const [html, c] = await Promise.all([template(), contact()]);
  const id = idOf(slug);
  let p: PublicProperty;
  try {
    if (id === null) return gone(html, c);
    p = await getPublicProperty(id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return gone(html, c);
    throw e;
  }
  const meta = propertyMeta(siteUrl(), p);
  meta.image = await previewImage(meta.image);
  return { status: 200, html: fill(html, meta, c, propertyContent(p, c), { preload: p.gallery[0] || p.hero }) };
}

export async function articlePage(slug: string): Promise<SeoPage> {
  const [html, c] = await Promise.all([template(), contact()]);
  const id = idOf(slug);
  const row = id === null ? null : await prisma.article.findUnique({ where: { id } });
  if (!row || !row.publishedAt) return gone(html, c);
  const a = toArticle(row);
  const meta = articleMeta(siteUrl(), a);
  meta.image = await previewImage(meta.image);
  return { status: 200, html: fill(html, meta, c, articleContent(a, c)) };
}
