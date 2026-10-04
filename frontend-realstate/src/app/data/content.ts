/**
 * Site content other than properties: the journal, testimonials, team, home-page statistics,
 * featured districts, company videos, contact details and services.
 *
 * For the backend: each array is mock data and each save/delete function at the bottom is where
 * the matching API call goes. Endpoints and field notes are in FRONTEND_CLAUDE.md §7.3 and §7.8.
 * Admin edits change these arrays in memory until the page is reloaded.
 */
import { img } from "@/app/components/ui/brand";
import { fetchArticles, toBlog } from "@/api/articles";
import { fetchTeam, toMember } from "@/api/team";
import { fetchTestimonials, toTestimonial } from "@/api/testimonials";
import { fetchSite, saveSiteContact, saveSiteDistricts, saveSiteServices, saveSiteStats } from "@/api/site";
import { emitChange } from "./store";

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface BlogPost {
  id: number;
  slug?: string;     // from the API; for /articles/:slug and future page URLs
  cat: string;       // free text typed by the admin, e.g. "Market Report"
  date: string;      // display string, "May 2025" ("Draft" when unpublished); the API sends ISO 8601
  publishedAt?: string | null;  // that ISO date as the API sent it
  read: string;      // "6 min"; the admin computes it from the body
  title: string;
  excerpt: string;   // the summary shown on cards and as the article's standfirst
  image: string;
  author: string;    // always ARTICLE_AUTHOR ("Nepal Bhoomi")
  body?: string;     // the full article; paragraphs separated by blank lines
}

/** A client testimonial. The photo is optional: the site shows the client's initials without one. */
export interface Testimonial { id: number; name: string; role: string; rating: number; text: string; img?: string }

/**
 * A person on the team. The first four fields are what cards show; the rest fill the
 * profile pop-up and are optional, so a member can be added with just a name and photo.
 */
export interface TeamMember {
  id: number; name: string; role: string;
  img?: string;               // optional: cards show the initials without one
  department?: string;        // one of DEPARTMENTS; drives the filter chips on the Team page
  bio?: string;               // two or three sentences
  experienceYears?: number;
  specialities?: string[];    // from SPECIALITIES or free text
  languages?: string[];       // from LANGUAGES
  phone?: string;             // "+977 98…"; shown as a Call button
  whatsapp?: string;          // digits with country code, e.g. "9779800000000"
  email?: string;
}

/** A figure in the home page's statistics band, e.g. { value: "180+", label: "Properties Sold" }. */
export interface Stat { id: number; value: string; label: string }

/** A tile in the home page's "Prestige Properties Across Nepal" strip. 1–5 tiles fit the design. */
/** A district tile on the home page. Its property count is not stored: the site counts the district's listings. */
export interface FeaturedDistrict { id: number; name: string; img: string }

/** Every article is published under the firm's name. */
export const ARTICLE_AUTHOR = "Nepal Bhoomi";
export const TEAM_ROLES = [
  "Founder & Principal Advisor", "Managing Director", "Senior Property Consultant", "Property Consultant",
  "Investment Specialist", "Legal Advisor", "Marketing Manager", "Client Relations", "Vastu Consultant",
];
export const MAX_FEATURED_DISTRICTS = 5;

// ─── Data ─────────────────────────────────────────────────────────────────────

/**
 * The Property Journal, in display order (the first is the featured story on the home page).
 * Loaded from the API by loadArticles() below; the admin's list includes drafts.
 */
export const BLOGS: BlogPost[] = [];
export let articlesStatus: "loading" | "ready" | "error" = "loading";
let articlesRun = 0;

/** Fill BLOGS from the API. A failure leaves the journal empty (the pages hide it) rather than blocking the site. */
export async function loadArticles(admin: boolean): Promise<void> {
  const run = ++articlesRun;
  try {
    const list = await fetchArticles(admin);
    if (run !== articlesRun) return;
    BLOGS.splice(0, BLOGS.length, ...list.map(toBlog));
    articlesStatus = "ready";
  } catch {
    if (run !== articlesRun) return;
    articlesStatus = "error";
  }
  emitChange();
}

/** "What Our Clients Say", in display order. Loaded from the API by loadTestimonials() below. */
export const TESTIMONIALS: Testimonial[] = [];
export let testimonialsStatus: "loading" | "ready" | "error" = "loading";
let testimonialsRun = 0;

/** Fill TESTIMONIALS from the API. A failure leaves it empty (the home page hides the section). */
export async function loadTestimonials(): Promise<void> {
  const run = ++testimonialsRun;
  try {
    const list = await fetchTestimonials();
    if (run !== testimonialsRun) return;
    TESTIMONIALS.splice(0, TESTIMONIALS.length, ...list.map(toTestimonial));
    testimonialsStatus = "ready";
  } catch {
    if (run !== testimonialsRun) return;
    testimonialsStatus = "error";
  }
  emitChange();
}

/** In display order. The About page shows the first ABOUT_TEAM_LIMIT; the Team page shows all. */
/**
 * The team, in display order (the About page shows the first ABOUT_TEAM_LIMIT). Loaded from the
 * API by loadTeam() below.
 */
export const TEAM: TeamMember[] = [];
export let teamStatus: "loading" | "ready" | "error" = "loading";
let teamRun = 0;

/** Fill TEAM from the API. A failure leaves it empty (the pages hide the team) rather than blocking the site. */
export async function loadTeam(): Promise<void> {
  const run = ++teamRun;
  try {
    const list = await fetchTeam();
    if (run !== teamRun) return;
    TEAM.splice(0, TEAM.length, ...list.map(toMember));
    teamStatus = "ready";
  } catch {
    if (run !== teamRun) return;
    teamStatus = "error";
  }
  emitChange();
}

/** How many team members the About page shows before "Meet the full team". */
export const ABOUT_TEAM_LIMIT = 6;
export const DEPARTMENTS = ["Leadership", "Sales & Advisory", "Lettings", "Legal & Documentation", "Marketing", "Client Relations"];
export const LANGUAGES = ["Nepali", "English", "Hindi", "Newari", "Maithili", "Bhojpuri", "Tamang", "Chinese", "Japanese", "Korean"];
export const SPECIALITIES = [
  "Luxury Residences", "Family Homes", "Apartments", "Land & Development", "Commercial Property", "Rentals & Lettings",
  "NRN Investors", "First-time Buyers", "Heritage Homes", "Investment Advisory", "Legal & Documentation", "Vastu",
];

export const STATS: Stat[] = [
  { id:1, value:"180+", label:"Properties Sold" },
  { id:2, value:"12", label:"Years in Nepal" },
  { id:3, value:"NPR 2B+", label:"Total Value" },
  { id:4, value:"9", label:"Districts Covered" },
];

export const FEATURED_DISTRICTS: FeaturedDistrict[] = [
  { id:1, name:"Kathmandu", img:img("photo-1613977257363-707ba9348227",900,1100) },
  { id:2, name:"Lalitpur", img:img("photo-1600596542815-ffad4c1539a9",900,1100) },
  { id:3, name:"Bhaktapur", img:img("photo-1568605114967-8130f3a36994",900,1100) },
];

// ─── Company videos ───────────────────────────────────────────────────────────
//
// These are company films, not property listings, so the card shows only a
// title — the location line was removed. Each entry is either a self-hosted
// file (one or more quality renditions) or a YouTube id.

export type VideoCaption = { start:string; end:string; text:string };
export type VideoSource  = { label:string; src:string; type?:string };

export type CompanyVideo = {
  id:number;
  title:string;
  poster:string;
  duration:string;
  sources?:VideoSource[];
  youtubeId?:string;
  captions?:VideoCaption[];
};

// How a video is written in the list below. For YouTube, paste the normal share link as
// `youtubeUrl` (youtu.be/..., youtube.com/watch?v=..., /shorts/...); `poster` can be left out
// and the video's own YouTube thumbnail is used.
export type CompanyVideoInput = Omit<CompanyVideo,"poster"> & { poster?:string; youtubeUrl?:string };

// Accepts any usual YouTube link or a bare 11-character video id; returns the id.
export function youtubeIdFrom(input?:string):string|undefined {
  if(!input) return undefined;
  if(/^[\w-]{11}$/.test(input)) return input;
  try {
    const u=new URL(input);
    if(u.hostname.endsWith("youtu.be")) return u.pathname.slice(1,12)||undefined;
    const v=u.searchParams.get("v");
    if(v) return v;
    return u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1];
  } catch { return undefined; }
}

// maxresdefault is sharp but missing on some videos; hqdefault always exists (see onError below).
export const youtubeThumb=(id:string, q:"maxresdefault"|"hqdefault"="maxresdefault")=>`https://i.ytimg.com/vi/${id}/${q}.jpg`;

// The first entry is the one shown in the centre when the page loads; the order here is the
// order on the site. To add a video, paste its YouTube share link as `youtubeUrl`. A self-hosted
// MP4 also works via `sources` (several entries make the quality menu work, highest first).
export const VIDEO_LIST: CompanyVideoInput[] = [
  { id:6, title:"Sitapaila Elite Colony — 2 Minutes from Ring Road", duration:"1:19",
    youtubeUrl:"https://youtu.be/gHsBz7OJDHk" },
  { id:7, title:"Commercial Space for Rent — Kamaladi, Kathmandu", duration:"1:01",
    youtubeUrl:"https://youtu.be/7wxOvLCa1BA" },
  { id:8, title:"Buying Land Across Kathmandu? Talk to Nepal Bhoomi", duration:"0:52",
    youtubeUrl:"https://youtu.be/qP_ZmzMgBlE" },
  { id:9, title:"Stay Aware, Stay Alert — Property Awareness", duration:"0:34",
    youtubeUrl:"https://youtu.be/_rU-4grC0k0" },
];

/** The videos as the player needs them: YouTube ids resolved and posters filled in. */
export function companyVideos(): CompanyVideo[] {
  return VIDEO_LIST.map(({ youtubeUrl, ...v }) => {
    const youtubeId = youtubeIdFrom(youtubeUrl ?? v.youtubeId);
    return { ...v, youtubeId, poster: v.poster ?? (youtubeId ? youtubeThumb(youtubeId) : "") };
  });
}

// ─── Contact details and services ─────────────────────────────────────────────
// Edited in Admin → Contact & Services. Used by the Contact page, the footer, every
// WhatsApp button and the Services lists (home, About, Services).

export interface ContactInfo {
  address: string;   // shown as typed; line breaks kept
  phone: string;     // "+977 1 400 0000"
  whatsapp: string;  // any format; only the digits are used in wa.me links
  email: string;
  hours: string;     // line breaks kept
  instagram: string; facebook: string; youtube: string; linkedin: string;  // full URLs, or empty to hide
}

export const CONTACT: ContactInfo = {
  address: "Jhamsikhel Road, Lalitpur\nKathmandu Valley, Nepal",
  phone: "+977 1 400 0000",
  whatsapp: "+977 980 000 0000",
  email: "info@nepalbhoomi.com",
  hours: "Sunday–Friday: 9:00 AM – 6:00 PM\nSaturday: By Appointment",
  instagram: "", facebook: "", youtube: "", linkedin: "",
};

/** wa.me link to the business number, optionally with a message typed in. */
export const whatsappLink = (text?: string) =>
  `https://wa.me/${CONTACT.whatsapp.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** Save the contact details (PUT /admin/site/contact), then show what the server stored. */
export async function saveContact(c: ContactInfo): Promise<void> {
  Object.assign(CONTACT, await saveSiteContact(c));
  emitChange();
}

/** Icon names a service can use; components/ui/service-icon.tsx draws them. */
export const SERVICE_ICONS = ["home", "key", "briefcase", "award", "building", "landmark", "scale", "hammer", "compass", "chart", "shield", "handshake"] as const;
export type ServiceIcon = (typeof SERVICE_ICONS)[number];
export interface Service { id: number; icon: ServiceIcon; title: string; desc: string }

export const SERVICES: Service[] = [
  { id: 1, icon: "home", title: "Property Sales", desc: "Full-service representation for residential and commercial property transactions across Nepal." },
  { id: 2, icon: "key", title: "Letting", desc: "Specialist letting advisory for landlords and tenants seeking premium rental properties." },
  { id: 3, icon: "briefcase", title: "Property Consulting", desc: "Expert market analysis, investment advisory and portfolio strategy for all property types." },
  { id: 4, icon: "award", title: "Vastu Advisory", desc: "Authentic Vastu Shastra assessment and consultation for new constructions and existing properties." },
  { id: 5, icon: "building", title: "Construction Works", desc: "End-to-end construction project management for residential and commercial developments." },
  { id: 6, icon: "landmark", title: "Engineering Consulting", desc: "Structural, civil and MEP engineering consulting for projects of all scales across Nepal." },
];

/** Save the whole services list in display order (PUT /admin/site/services). */
export async function saveServices(list: Service[]): Promise<void> {
  const saved = await saveSiteServices(list.map(({ icon, title, desc }) => ({ icon, title, desc })));
  SERVICES.splice(0, SERVICES.length, ...saved);
  emitChange();
}

/** Save the home page statistics (PUT /admin/site/stats). */
export async function saveStats(list: Stat[]): Promise<void> {
  const saved = await saveSiteStats(list.map(({ value, label }) => ({ value, label })));
  STATS.splice(0, STATS.length, ...saved);
  emitChange();
}

/** Save the featured district tiles in order (PUT /admin/site/featured-districts). */
export async function saveFeaturedDistricts(list: FeaturedDistrict[]): Promise<void> {
  const saved = await saveSiteDistricts(list.map(({ name, img }) => ({ name, img })));
  FEATURED_DISTRICTS.splice(0, FEATURED_DISTRICTS.length, ...saved);
  emitChange();
}

/**
 * The statistics, featured districts, contact details and services the admin has saved
 * (GET /site), applied over the defaults above. A setting never saved keeps its default; a
 * failure keeps them all (the site still works).
 */
export let siteStatus: "loading" | "ready" | "error" = "loading";
export async function loadSiteSettings(): Promise<void> {
  try {
    const s = await fetchSite();
    if (s.stats) STATS.splice(0, STATS.length, ...s.stats);
    if (s.featuredDistricts) FEATURED_DISTRICTS.splice(0, FEATURED_DISTRICTS.length, ...s.featuredDistricts);
    if (s.contact) Object.assign(CONTACT, s.contact);
    if (s.services) SERVICES.splice(0, SERVICES.length, ...s.services);
    siteStatus = "ready";
  } catch {
    siteStatus = "error";
  }
  emitChange();
}

// ─── Save / delete / reorder ──────────────────────────────────────────────────
// One generic set of helpers for every list above. API calls go here:
//   Journal       POST/PATCH/DELETE /api/v1/admin/articles[/:id]
//   Testimonials  POST/PATCH/DELETE /api/v1/admin/testimonials[/:id]
//   Team          POST/PATCH/DELETE /api/v1/admin/team[/:id]   (+ PUT /admin/team/order)
//   Videos        POST/PATCH/DELETE /api/v1/admin/videos[/:id] (+ PUT /admin/videos/order)
//   Statistics    PUT /api/v1/admin/site/stats
//   Districts     PUT /api/v1/admin/site/featured-districts

type WithId = { id: number };

export const nextId = (list: WithId[]) => list.reduce((m, x) => Math.max(m, x.id), 0) + 1;

/** Replace the item with the same id, or add it (at the start when `front`). */
export function upsert<T extends WithId>(list: T[], item: T, front = false): void {
  const i = list.findIndex(x => x.id === item.id);
  if (i >= 0) list[i] = item; else if (front) list.unshift(item); else list.push(item);
  emitChange();
}

export function removeById<T extends WithId>(list: T[], id: number): void {
  const i = list.findIndex(x => x.id === id);
  if (i >= 0) { list.splice(i, 1); emitChange(); }
}

/** Move an item one place up (-1) or down (+1). Order is what the site shows. */
export function moveById<T extends WithId>(list: T[], id: number, dir: -1 | 1): void {
  const i = list.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  emitChange();
}

/** Reading time from the article text at ~200 words a minute, at least 1. */
export function readingTime(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min`;
}

/** "May 2025" for today, the format the journal shows. */
export const monthYear = (d = new Date()) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
