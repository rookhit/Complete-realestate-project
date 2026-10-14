// What search engines and link previews (Facebook, WhatsApp, X) see for each page: the title,
// description, canonical address, Open Graph tags and schema.org JSON-LD.
//
// Used in two places, so they always agree:
//  - in the browser, App sets the <head> on every page change (src/seo/head.ts)
//  - at build time, scripts/prerender.mjs writes a ready-made HTML file for every page, property
//    and article (crawlers that don't run JavaScript, such as link previews, read those)
// Keep this file free of imports and browser APIs: the build script loads it in Node.

/** The public address of the site. Set VITE_SITE_URL when the domain changes. */
export const DEFAULT_SITE_URL = "https://www.nepalbhoomi.com";
export const SITE_NAME = "Nepal Bhoomi Real Estate";
/** 1200×630 picture for link previews when a page has no photo of its own (public/og-image.jpg). */
export const DEFAULT_IMAGE = "/og-image.jpg";

export type SeoContact = { address: string; phone: string; email: string; hours: string };

/** The fields of a property the tags need (both the API's property and the site's Prop have them). */
export type SeoProperty = {
  id: number; nbId: string; title: string; tagline: string; description: string;
  listing: string; type: string; price: string; priceNum: number | null;
  location: string; district: string; hero: string; gallery: string[];
  beds: number; baths: number; builtArea: string; landArea: string;
  createdAt?: string; updatedAt?: string;
};

/** The fields of an article the tags need. */
export type SeoArticle = {
  id: number; slug?: string; title: string; excerpt: string; image: string; author: string;
  cat: string; publishedAt: string | null; updatedAt?: string;
};

export type PageMeta = {
  title: string;
  description: string;
  /** Path (with any query) of the canonical address, e.g. "/property/25-traditional-4bhk-house". */
  path: string;
  /** Absolute or site-relative picture for link previews. */
  image: string;
  type: "website" | "article";
  /** Sign-in, admin and similar pages: keep them out of search results. */
  noindex?: boolean;
  /** schema.org objects for this page (the company's own block is always added). */
  jsonLd: object[];
};

// ─── Addresses ────────────────────────────────────────────────────────────────

export const slugOf = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

/** /property/25-traditional-4bhk-house-in-budhanilkantha */
export const propertyPath = (p: { id: number; title?: string }) => {
  const s = p.title ? slugOf(p.title) : "";
  return `/property/${p.id}${s ? `-${s}` : ""}`;
};

/** /blog/18-nepal-property-transaction-slowdown-reasons. Nepali titles have no Latin letters, so
 *  the article's English slug is used when it has a real one (not the server's "article-2"). */
export const articlePath = (a: { id: number; slug?: string; title?: string }) => {
  const s = a.slug && !/^article(-\d+)?$/.test(a.slug) ? a.slug : a.title ? slugOf(a.title) : "";
  return `/blog/${a.id}${s ? `-${s}` : ""}`;
};

export const absolute = (siteUrl: string, pathOrUrl: string) =>
  /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${siteUrl.replace(/\/+$/, "")}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

// ─── Text helpers ─────────────────────────────────────────────────────────────

/** One line of plain text, cut at a word boundary to at most `max` characters. */
export function clip(text: string, max = 158): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[\s,.;:–-]+$/, "")}…`;
}

const sentence = (s: string) => { const t = s.trim(); return !t ? "" : /[.!?।]$/.test(t) ? t : `${t}.`; };
const phoneDigits = (phone: string) => phone.replace(/[^\d+]/g, "");

// ─── The company ──────────────────────────────────────────────────────────────

/** schema.org RealEstateAgent: name, address, phone, opening hours. On every page. */
export function organizationLd(siteUrl: string, c: SeoContact): object {
  const lines = c.address.split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${siteUrl}/#organization`,
    name: SITE_NAME,
    alternateName: ["Nepal Bhoomi", "Nepal Bhoomi Estate Agents", "नेपाल भूमि"],
    url: `${siteUrl}/`,
    logo: `${siteUrl}/logo.png`,
    image: `${siteUrl}${DEFAULT_IMAGE}`,
    description: "Real estate agency in Kathmandu, Nepal: houses, land, apartments and commercial space for sale and rent across the Kathmandu Valley.",
    telephone: phoneDigits(c.phone),
    email: c.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: lines.join(", "),
      addressLocality: "Kathmandu",
      addressRegion: "Bagmati",
      addressCountry: "NP",
    },
    areaServed: ["Kathmandu", "Lalitpur", "Bhaktapur", "Nepal"].map((name) => ({ "@type": "Place", name })),
    openingHoursSpecification: openingHours(c.hours),
    priceRange: "Negotiable",
  };
}

/** "Sunday–Friday: 9:30 AM – 6:00 PM" → schema.org opening hours (closed days are left out). */
function openingHours(hours: string): object[] {
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const to24 = (h: string, m: string, ap: string) => {
    let n = Number(h) % 12; if (/pm/i.test(ap)) n += 12;
    return `${String(n).padStart(2, "0")}:${m}`;
  };
  const out: object[] = [];
  for (const line of hours.split("\n")) {
    const m = line.match(/^\s*(\w+)\s*(?:[–-]\s*(\w+))?\s*:\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) continue;
    const a = DAYS.indexOf(m[1]), b = m[2] ? DAYS.indexOf(m[2]) : a;
    if (a < 0 || b < 0) continue;
    const days: string[] = [];
    for (let i = a; ; i = (i + 1) % 7) { days.push(DAYS[i]); if (i === b) break; }
    out.push({ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: to24(m[3], m[4], m[5]), closes: to24(m[6], m[7], m[8]) });
  }
  return out;
}

const breadcrumbs = (siteUrl: string, items: [string, string][]): object => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absolute(siteUrl, path) })),
});

// ─── Pages ────────────────────────────────────────────────────────────────────

type Static = { title: string; description: string; noindex?: boolean };

/** The fixed pages. Titles are what people search for; the brand comes last. */
export const STATIC_PAGES: Record<string, Static> = {
  "/": {
    title: "Nepal Bhoomi Real Estate | Houses, Land & Property for Sale and Rent in Kathmandu",
    description: "Nepal Bhoomi Real Estate in Lazimpat, Kathmandu: houses, land, apartments and commercial space for sale and rent in Kathmandu, Lalitpur and Bhaktapur. Call 9818783518.",
  },
  "/buy": {
    title: "Property for Sale in Kathmandu Valley: Houses & Land | Nepal Bhoomi",
    description: "Houses, land and commercial property for sale in Kathmandu, Lalitpur and Bhaktapur. Verified listings with photos, area and road access from Nepal Bhoomi Real Estate.",
  },
  "/rent": {
    title: "Property for Rent in Kathmandu: Houses, Offices & Shops | Nepal Bhoomi",
    description: "Houses, office floors and commercial space for rent in Kathmandu, Lalitpur and Bhaktapur. See photos and details, then call Nepal Bhoomi on 9818783518.",
  },
  "/hot": { title: "Hot Properties | Nepal Bhoomi Real Estate", description: "The most popular houses, land and commercial properties at Nepal Bhoomi Real Estate right now." },
  "/new-listings": { title: "New Property Listings in Kathmandu | Nepal Bhoomi", description: "The newest houses, land and commercial spaces for sale and rent from Nepal Bhoomi Real Estate." },
  "/map": { title: "Property Map: Kathmandu Valley | Nepal Bhoomi", description: "Find houses, land and commercial property for sale and rent on a map of the Kathmandu Valley." },
  "/about": {
    title: "About Nepal Bhoomi Real Estate | Trusted Property Agents in Kathmandu",
    description: "Nepal Bhoomi Real Estate helps people buy, sell, rent and manage property across Nepal. Meet the company, its values and its team in Lazimpat, Kathmandu.",
  },
  "/team": { title: "Our Team | Nepal Bhoomi Real Estate", description: "Meet the Nepal Bhoomi Real Estate team: sales, client relations, marketing and operations, in Lazimpat, Kathmandu." },
  "/services": {
    title: "Real Estate Services: Buying, Selling, Renting & Valuation | Nepal Bhoomi",
    description: "Property buying and selling, rentals, building management, valuation and legal paperwork help in Nepal, from Nepal Bhoomi Real Estate.",
  },
  "/blog": {
    title: "Property News & Guides Nepal (घरजग्गा समाचार) | Nepal Bhoomi Journal",
    description: "Real estate news, bank interest rates, land laws and buying guides for Nepal, in Nepali and English, from Nepal Bhoomi Real Estate.",
  },
  "/emi-calculator": { title: "Home Loan EMI Calculator Nepal | Nepal Bhoomi", description: "Work out the monthly EMI on a home loan in Nepal: loan amount, interest rate and term." },
  "/contact": {
    title: "Contact Nepal Bhoomi Real Estate | Lazimpat, Kathmandu | 9818783518",
    description: "Visit Nepal Bhoomi Real Estate in Lazimpat, Kathmandu (opposite Image Channel building), Sunday to Friday 9:30 AM to 6 PM, or call 9818783518.",
  },
  "/free-listing": { title: "List Your Property for Free | Nepal Bhoomi", description: "Selling or renting out a house, land or commercial space in Nepal? List it with Nepal Bhoomi Real Estate for free." },
  "/videos": { title: "Property Videos | Nepal Bhoomi Real Estate", description: "Video tours of houses, land and commercial properties from Nepal Bhoomi Real Estate." },
  "/login": { title: "Sign In | Nepal Bhoomi", description: "Sign in to your Nepal Bhoomi account.", noindex: true },
  "/register": { title: "Register | Nepal Bhoomi", description: "Create a Nepal Bhoomi account.", noindex: true },
  "/admin": { title: "Admin | Nepal Bhoomi", description: "Nepal Bhoomi admin.", noindex: true },
};

/** A fixed page, or a Buy/Rent page for one district (/buy?district=Lalitpur). */
export function staticPageMeta(siteUrl: string, path: string, district?: string): PageMeta {
  const base = path.startsWith("/admin") ? STATIC_PAGES["/admin"] : STATIC_PAGES[path] ?? STATIC_PAGES["/"];
  let { title, description } = base;
  let canonical = path;
  if (district && (path === "/buy" || path === "/rent")) {
    const sale = path === "/buy";
    title = `${sale ? "Property for Sale" : "Property for Rent"} in ${district}: Houses, Land & Commercial | Nepal Bhoomi`;
    description = `${sale ? "Houses, land and commercial property for sale" : "Houses, offices and commercial space for rent"} in ${district}, Nepal. Photos, area and prices from Nepal Bhoomi Real Estate. Call 9818783518.`;
    canonical = `${path}?district=${encodeURIComponent(district)}`;
  }
  const ld: object[] = [];
  if (path !== "/" && !base.noindex) ld.push(breadcrumbs(siteUrl, [["Home", "/"], [title.split(" | ")[0].split(":")[0], canonical]]));
  return { title, description, path: canonical, image: DEFAULT_IMAGE, type: "website", noindex: base.noindex, jsonLd: ld };
}

/** Whether a title already says sale or rent. */
const saysListing = (t: string) => /\b(for (sale|rent)|to let)\b/i.test(t);

export function propertyMeta(siteUrl: string, p: SeoProperty): PageMeta {
  const sale = p.listing !== "For Rent";
  const title = `${p.title}${saysListing(p.title) ? "" : ` – ${sale ? "For Sale" : "For Rent"}`} | Nepal Bhoomi`;
  const facts = [
    p.beds > 0 ? `${p.beds} bedrooms` : "",
    p.landArea && p.landArea !== "—" ? `land ${p.landArea}` : "",
    p.builtArea && p.builtArea !== "—" ? `built-up ${p.builtArea}` : "",
  ].filter(Boolean).join(", ");
  // The phone number is the call to action, so it stays inside the ~160 characters search shows.
  const kind = p.type === "House/Bungalow" ? "House" : p.type === "Commercial" ? "Commercial property" : p.type;
  const price = p.price && !/negotiable/i.test(p.price) ? `Price ${p.price}. ` : "";
  const description = clip([
    sentence(p.tagline),
    `${kind} ${sale ? "for sale" : "for rent"} in ${p.location}${facts ? ` (${facts})` : ""}.`,
    `${price}Ref ${p.nbId}, call 9818783518.`,
  ].filter(Boolean).join(" "), 170);
  const path = propertyPath(p);
  const url = absolute(siteUrl, path);
  const images = (p.gallery?.length ? p.gallery : [p.hero]).filter(Boolean).slice(0, 6);
  const listingLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": `${url}#listing`,
    name: p.title,
    description: clip(p.description || p.tagline, 500),
    url,
    image: images,
    ...(p.createdAt ? { datePosted: p.createdAt.slice(0, 10) } : {}),
    identifier: p.nbId,
    offers: {
      "@type": "Offer",
      businessFunction: sale ? "http://purl.org/goodrelations/v1#Sell" : "http://purl.org/goodrelations/v1#LeaseOut",
      ...(p.priceNum ? { price: p.priceNum, priceCurrency: "NPR" } : {}),
      availability: "https://schema.org/InStock",
      seller: { "@id": `${siteUrl}/#organization` },
    },
    contentLocation: {
      "@type": "Place",
      name: p.location,
      address: { "@type": "PostalAddress", addressLocality: p.location.split(",")[0].trim(), addressRegion: p.district, addressCountry: "NP" },
    },
  };
  return {
    title, description, path, image: images[0] || DEFAULT_IMAGE, type: "website",
    jsonLd: [
      listingLd,
      breadcrumbs(siteUrl, [["Home", "/"], [sale ? "Property for Sale" : "Property for Rent", sale ? "/buy" : "/rent"], [p.title, path]]),
    ],
  };
}

export function articleMeta(siteUrl: string, a: SeoArticle): PageMeta {
  const path = articlePath(a);
  const url = absolute(siteUrl, path);
  return {
    title: `${a.title} | Nepal Bhoomi`,
    description: clip(a.excerpt),
    path, image: a.image || DEFAULT_IMAGE, type: "article",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: clip(a.title, 110),
        description: clip(a.excerpt, 300),
        image: a.image ? [absolute(siteUrl, a.image)] : undefined,
        datePublished: a.publishedAt ?? undefined,
        dateModified: a.updatedAt ?? a.publishedAt ?? undefined,
        articleSection: a.cat,
        inLanguage: /[ऀ-ॿ]/.test(a.title) ? "ne" : "en",
        author: { "@type": "Organization", name: a.author || SITE_NAME, url: `${siteUrl}/` },
        publisher: { "@id": `${siteUrl}/#organization` },
        mainEntityOfPage: url,
      },
      breadcrumbs(siteUrl, [["Home", "/"], ["Journal", "/blog"], [clip(a.title, 80), path]]),
    ],
  };
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** JSON for a <script> block: "</script>" inside a string can't end it early. */
export const jsonForScript = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");

/**
 * Everything in <head> for a page, as HTML (used by the build script). `canonical: false` leaves out
 * the canonical address, for a file the host also serves for other addresses (index.html is the
 * fallback for every path; /buy also answers /buy?district=…): the browser adds the right one.
 */
export function headHtml(siteUrl: string, m: PageMeta, c: SeoContact, { canonical = true } = {}): string {
  const url = absolute(siteUrl, m.path), img = absolute(siteUrl, m.image);
  const tags = [
    `<title>${escapeHtml(m.title)}</title>`,
    `<meta name="description" content="${escapeHtml(m.description)}" />`,
    `<meta name="robots" content="${m.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}" />`,
    ...(canonical ? [`<link rel="canonical" href="${escapeHtml(url)}" />`] : []),
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:title" content="${escapeHtml(m.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(m.description)}" />`,
    ...(canonical ? [`<meta property="og:url" content="${escapeHtml(url)}" />`] : []),
    `<meta property="og:image" content="${escapeHtml(img)}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...[organizationLd(siteUrl, c), ...m.jsonLd].map((o) => `<script type="application/ld+json">${jsonForScript(o)}</script>`),
  ];
  return tags.join("\n    ");
}
