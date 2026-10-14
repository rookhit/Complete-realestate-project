// Runs after `vite build` (npm run build). Writes a ready-made HTML file for every page, property
// and article, plus sitemap.xml and robots.txt, so search engines and link previews (Facebook,
// WhatsApp, X), which may not run JavaScript, see each page's own title, description, picture,
// structured data, text and links. In the browser React replaces the static content as soon as
// the app starts.
//
// Files: dist/index.html (home), dist/buy/index.html, dist/property/25-…/index.html,
// dist/blog/18-…/index.html, … The host serves "/buy" from dist/buy/index.html and every other path
// from dist/index.html (single-page app fallback, see PRODUCTION_CHECKLIST.md).
//
// Data comes from the public API (VITE_API_URL). If it can't be reached, only the fixed pages are
// written and the build still succeeds.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv, transformWithEsbuild } from "vite";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const env = { ...loadEnv("production", root, "VITE_"), ...process.env };

// meta.ts has no imports: strip its types and load it as a plain module.
const metaSrc = path.join(root, "src", "seo", "meta.ts");
const { code } = await transformWithEsbuild(fs.readFileSync(metaSrc, "utf8"), metaSrc, { loader: "ts", format: "esm" });
const metaJs = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "nb-seo-")), "meta.mjs");
fs.writeFileSync(metaJs, code);
const M = await import(pathToFileURL(metaJs).href);
fs.rmSync(path.dirname(metaJs), { recursive: true, force: true });

const SITE = (env.VITE_SITE_URL || M.DEFAULT_SITE_URL).replace(/\/+$/, "");
const API = `${(env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "")}/api/v1`;
const TEL = "+9779818783518";

// Same as CONTACT in src/app/data/content.ts; the API's copy wins when it can be reached.
let contact = {
  address: "Lazimpat, Kathmandu\nOpposite Image Channel building",
  phone: "+977 9818783518",
  email: "info@nepalbhoomi.com",
  hours: "Sunday–Friday: 9:30 AM – 6:00 PM\nSaturday: Closed",
};

async function get(p) {
  const res = await fetch(API + p, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  return res.json();
}

let properties = [], articles = [];
try {
  for (let page = 1; ; page++) {
    const r = await get(`/properties?limit=100&page=${page}&sort=newest`);
    properties.push(...r.data);
    if (page >= (r.meta?.totalPages ?? 1)) break;
  }
  articles = (await get("/articles?limit=100")).data;
  const site = (await get("/site")).data;
  if (site?.contact) contact = { ...contact, ...site.contact };
} catch (e) {
  console.warn(`prerender: the API at ${API} could not be reached (${e.message}); writing the fixed pages only.`);
  properties = []; articles = [];
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// The markers stay in every written file, so running this again (npm run prerender) works too.
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
if (!template.includes("<!-- seo:start") || !template.includes("<!-- prerender:content -->")) {
  throw new Error("prerender: dist/index.html lacks the seo:start / prerender:content markers (see index.html)");
}
// Fresh from `vite build` the content marker is empty; after a run it wraps the home page's content.
const CONTENT = template.includes("<!-- prerender:end -->") ? /<!-- prerender:content -->[\s\S]*?<!-- prerender:end -->/ : /<!-- prerender:content -->/;

// A plain, readable page in the site's colours. Only shown until the app starts.
const S = {
  wrap: "min-height:100vh;background:#0a0908;color:#d9d2c4;font:16px/1.7 Arial,Helvetica,sans-serif;padding:32px 20px;box-sizing:border-box",
  inner: "max-width:760px;margin:0 auto",
  brand: "color:#b08848;letter-spacing:.3em;text-transform:uppercase;font-size:12px;text-decoration:none",
  nav: "display:flex;flex-wrap:wrap;gap:6px 18px;margin:14px 0 36px;font-size:13px",
  link: "color:#f0ebe0",
  h1: "font:400 34px/1.25 Georgia,serif;color:#f0ebe0;margin:0 0 14px",
  h2: "font:400 22px/1.3 Georgia,serif;color:#f0ebe0;margin:32px 0 10px",
  muted: "color:#9a9182;font-size:14px",
  img: "width:100%;height:auto;margin:18px 0;display:block",
};
const NAV = [["/buy", "Buy"], ["/rent", "Rent"], ["/blog", "Journal"], ["/services", "Services"], ["/about", "About"], ["/team", "Our Team"], ["/contact", "Contact"]];

function shell(inner, lang) {
  return `<div style="${S.wrap}"${lang ? ` lang="${lang}"` : ""}><div style="${S.inner}">` +
    `<a href="/" style="${S.brand}">Nepal Bhoomi Real Estate</a>` +
    `<nav style="${S.nav}">${NAV.map(([h, l]) => `<a href="${h}" style="${S.link}">${l}</a>`).join("")}</nav>` +
    inner +
    `<p style="${S.muted};margin-top:40px">Nepal Bhoomi Real Estate · ${esc(contact.address.replace(/\n/g, ", "))} · ` +
    `<a href="tel:${TEL}" style="${S.link}">${esc(contact.phone)}</a> · <a href="mailto:${esc(contact.email)}" style="${S.link}">${esc(contact.email)}</a></p>` +
    `</div></div>`;
}

const propLink = (p) => `<li><a href="${M.propertyPath(p)}" style="${S.link}">${esc(p.title)}</a> <span style="${S.muted}">· ${esc(p.location)} · ${esc(p.listing)} · ${esc(p.price)} · ${esc(p.nbId)}</span></li>`;
const propList = (list) => list.length ? `<ul>${list.map(propLink).join("")}</ul>` : "";
const articleLink = (a) => `<li><a href="${M.articlePath(a)}" style="${S.link}">${esc(a.title)}</a> <span style="${S.muted}">· ${esc(a.cat)}</span></li>`;
const paragraphs = (text) => String(text || "").split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
  .map((t) => !t.includes("\n") && t.length <= 70 && !/[।.!:;,"”']$/.test(t) && !t.startsWith("•")
    ? `<h2 style="${S.h2}">${esc(t)}</h2>` : `<p>${esc(t).replace(/\n/g, "<br>")}</p>`).join("");

const sale = properties.filter((p) => p.listing === "For Sale");
const rent = properties.filter((p) => p.listing === "For Rent");

function staticContent(p, meta) {
  const intro = `<h1 style="${S.h1}">${esc(meta.title.split(" | ")[0])}</h1><p>${esc(meta.description)}</p>`;
  switch (p) {
    case "/": return shell(`<h1 style="${S.h1}">Nepal Bhoomi Real Estate</h1><p>${esc(meta.description)}</p>` +
      (sale.length ? `<h2 style="${S.h2}">Property for sale</h2>${propList(sale)}` : "") +
      (rent.length ? `<h2 style="${S.h2}">Property for rent</h2>${propList(rent)}` : "") +
      (articles.length ? `<h2 style="${S.h2}">From the journal</h2><ul>${articles.slice(0, 6).map(articleLink).join("")}</ul>` : ""));
    case "/buy": return shell(intro + propList(sale));
    case "/rent": return shell(intro + propList(rent));
    case "/hot": case "/new-listings": case "/map": return shell(intro + propList(properties));
    case "/blog": return shell(intro + `<ul>${articles.map(articleLink).join("")}</ul>`);
    case "/contact": return shell(intro + `<h2 style="${S.h2}">Office</h2><p>${esc(contact.address).replace(/\n/g, "<br>")}</p>` +
      `<h2 style="${S.h2}">Opening hours</h2><p>${esc(contact.hours).replace(/\n/g, "<br>")}</p>`);
    default: return shell(intro);
  }
}

function propertyContent(p) {
  const facts = [
    ["Reference", p.nbId], ["Listing", p.listing], ["Type", p.type], ["Price", p.price], ["Location", p.location],
    ["Bedrooms", p.beds || ""], ["Bathrooms", p.baths || ""], ["Land area", p.landArea !== "—" ? p.landArea : ""],
    ["Built-up area", p.builtArea !== "—" ? p.builtArea : ""], ["Road access", p.roadAccess !== "—" ? p.roadAccess : ""],
  ].filter(([, v]) => v);
  const photos = (p.gallery?.length ? p.gallery : [p.hero]).filter(Boolean).slice(0, 3);
  const similar = properties.filter((x) => x.id !== p.id && x.listing === p.listing).slice(0, 6);
  return shell(
    `<p style="${S.muted}"><a href="/" style="${S.link}">Home</a> / <a href="${p.listing === "For Rent" ? "/rent" : "/buy"}" style="${S.link}">${p.listing === "For Rent" ? "Property for Rent" : "Property for Sale"}</a></p>` +
    `<h1 style="${S.h1}">${esc(p.title)}</h1><p>${esc(p.tagline)}</p>` +
    photos.map((src, i) => `<img src="${esc(src)}" alt="${esc(`${p.title}, photo ${i + 1}`)}" style="${S.img}" loading="lazy" />`).join("") +
    `<ul>${facts.map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join("")}</ul>` +
    paragraphs(p.description) +
    (p.highlights?.length ? `<h2 style="${S.h2}">Highlights</h2><ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : "") +
    `<p>Interested? Call <a href="tel:${TEL}" style="${S.link}">${esc(contact.phone)}</a> and quote ${esc(p.nbId)}.</p>` +
    (similar.length ? `<h2 style="${S.h2}">More ${p.listing === "For Rent" ? "property for rent" : "property for sale"}</h2>${propList(similar)}` : ""));
}

function articleContent(a) {
  const nepali = /[ऀ-ॿ]/.test(a.title);
  const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  return shell(
    `<p style="${S.muted}"><a href="/" style="${S.link}">Home</a> / <a href="/blog" style="${S.link}">Journal</a> / ${esc(a.cat)}</p>` +
    `<h1 style="${S.h1}">${esc(a.title)}</h1><p style="${S.muted}">${esc(date)} · ${esc(a.author)}</p>` +
    (a.image ? `<img src="${esc(a.image)}" alt="${esc(a.title)}" style="${S.img}" />` : "") +
    `<p><strong>${esc(a.excerpt)}</strong></p>` + paragraphs(a.body) +
    `<h2 style="${S.h2}">More from the journal</h2><ul>${articles.filter((x) => x.id !== a.id).slice(0, 5).map(articleLink).join("")}</ul>`,
    nepali ? "ne" : undefined);
}

function page(meta, content, { canonical = true } = {}) {
  const head = M.headHtml(SITE, meta, contact, { canonical });
  return template
    .replace(/<!-- seo:start[\s\S]*?<!-- seo:end -->/, () => `<!-- seo:start -->\n    ${head}\n    <!-- seo:end -->`)
    .replace(CONTENT, () => `<!-- prerender:content -->${content}<!-- prerender:end -->`);
}

// Written twice, as buy/index.html and buy.html: hosts differ in which one they serve for "/buy"
// (Netlify, Vercel and Cloudflare Pages use buy.html; Nginx try_files and `vite preview` the folder).
function write(urlPath, html) {
  if (urlPath === "/") { fs.writeFileSync(path.join(dist, "index.html"), html); return; }
  const parts = urlPath.split("/").filter(Boolean);
  const dir = path.join(dist, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(`${dir}.html`, html);
}

// ─── Pages ────────────────────────────────────────────────────────────────────

// Fixed pages. These files also answer other addresses (index.html: every unknown path; /buy and
// /rent: their ?district= versions), so their canonical address is set in the browser instead.
const SHARED = new Set(["/", "/buy", "/rent", "/hot", "/new-listings", "/map"]);
const FIXED = Object.keys(M.STATIC_PAGES).filter((p) => p !== "/admin");
for (const p of FIXED) {
  const meta = M.staticPageMeta(SITE, p);
  write(p, page(meta, staticContent(p, meta), { canonical: !SHARED.has(p) }));
}
for (const p of properties) write(M.propertyPath(p), page(M.propertyMeta(SITE, p), propertyContent(p)));
for (const a of articles) write(M.articlePath(a), page(M.articleMeta(SITE, a), articleContent(a)));

// ─── sitemap.xml and robots.txt ───────────────────────────────────────────────

const day = (iso) => (iso ? String(iso).slice(0, 10) : undefined);
const newest = (list, key) => list.map((x) => x[key]).filter(Boolean).sort().at(-1);
const urls = [
  { loc: "/", lastmod: day(newest(properties, "updatedAt")), priority: "1.0" },
  { loc: "/buy", lastmod: day(newest(sale, "updatedAt")), priority: "0.9" },
  { loc: "/rent", lastmod: day(newest(rent, "updatedAt")), priority: "0.9" },
  ...[...new Set(sale.map((p) => p.district).filter(Boolean))].map((d) => ({ loc: `/buy?district=${encodeURIComponent(d)}`, priority: "0.8" })),
  ...[...new Set(rent.map((p) => p.district).filter(Boolean))].map((d) => ({ loc: `/rent?district=${encodeURIComponent(d)}`, priority: "0.8" })),
  ...properties.map((p) => ({ loc: M.propertyPath(p), lastmod: day(p.updatedAt), priority: "0.8" })),
  { loc: "/blog", lastmod: day(newest(articles, "publishedAt")), priority: "0.7" },
  ...articles.map((a) => ({ loc: M.articlePath(a), lastmod: day(a.updatedAt ?? a.publishedAt), priority: "0.6" })),
  ...["/about", "/team", "/services", "/contact", "/emi-calculator", "/new-listings", "/hot", "/free-listing"].map((loc) => ({ loc, priority: "0.5" })),
];
fs.writeFileSync(path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${esc(SITE + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`).join("\n") +
  `\n</urlset>\n`);

fs.writeFileSync(path.join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nDisallow: /register\nDisallow: /reset-password\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`prerender: ${FIXED.length} pages, ${properties.length} properties, ${articles.length} articles; sitemap.xml has ${urls.length} addresses (${SITE})`);
