/**
 * Site content other than properties: the journal, testimonials, team, home-page statistics,
 * featured districts and company videos.
 *
 * For the backend: each array is mock data and each save/delete function at the bottom is where
 * the matching API call goes. Endpoints and field notes are in FRONTEND_CLAUDE.md §7.3 and §7.8.
 * Admin edits change these arrays in memory until the page is reloaded.
 */
import { img } from "@/app/components/ui/brand";
import { emitChange } from "./store";

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface BlogPost {
  id: number;
  cat: string;       // one of BLOG_CATEGORIES (or a new one the admin types)
  date: string;      // display string, "May 2025". The API should send ISO 8601
  read: string;      // "6 min"; the admin computes it from the body
  title: string;
  excerpt: string;   // the summary shown on cards and as the article's standfirst
  image: string;
  author: string;    // a team member's name
  body?: string;     // the full article; paragraphs separated by blank lines
}

export interface Testimonial { id: number; name: string; role: string; rating: number; text: string; img: string }

/**
 * A person on the team. The first four fields are what cards show; the rest fill the
 * profile pop-up and are optional, so a member can be added with just a name and photo.
 */
export interface TeamMember {
  id: number; name: string; role: string; img: string;
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
export interface FeaturedDistrict { id: number; name: string; count: number; img: string }

export const BLOG_CATEGORIES = ["Market Update", "Buyer's Guide", "Investment", "Vastu", "Legal & Documentation", "Lifestyle", "Company News"];
export const TEAM_ROLES = [
  "Founder & Principal Advisor", "Managing Director", "Senior Property Consultant", "Property Consultant",
  "Investment Specialist", "Legal Advisor", "Marketing Manager", "Client Relations", "Vastu Consultant",
];
export const MAX_FEATURED_DISTRICTS = 5;

// ─── Data ─────────────────────────────────────────────────────────────────────

export const BLOGS: BlogPost[] = [
  { id:1, cat:"Market Update", date:"May 2025", read:"6 min", title:"Nepal Real Estate Rebounds: Q1 2025 Market Report",
    excerpt:"After a cautious 2024, Nepal's property market has shown strong signs of recovery in Q1 2025, with Kathmandu Valley recording a 14% uptick in premium transactions.",
    image:img("photo-1544735716-392fe2489ffa",800,500), author:"Arjun Thapa" },
  { id:2, cat:"Buyer's Guide", date:"Apr 2025", read:"8 min", title:"How to Buy Property in Nepal: The Complete 2025 Guide",
    excerpt:"From land registration to bank financing, we break down every step of the property purchase process in Nepal in plain language.",
    image:img("photo-1512917774080-9991f1c4c750",800,500), author:"Priya Shrestha" },
  { id:3, cat:"Investment", date:"Mar 2025", read:"5 min", title:"Pokhara International Airport: What It Means for Property Prices",
    excerpt:"Pokhara's new international airport has catalyzed a significant shift in property values across the western region. Here's what investors need to know.",
    image:img("photo-1600585154526-990dced4db0d",800,500), author:"Rajan Maharjan" },
  { id:4, cat:"Vastu", date:"Feb 2025", read:"4 min", title:"Vastu Shastra for Modern Homes: Principles That Still Work",
    excerpt:"Ancient Vastu principles continue to influence homebuying decisions in Nepal. Our consultants explain which guidelines genuinely improve living quality.",
    image:img("photo-1600596542815-ffad4c1539a9",800,500), author:"Sita Karki" },
];

export const TESTIMONIALS: Testimonial[] = [
  { id:1, name:"Bijay Shrestha", role:"Property Buyer, Kathmandu", rating:5, text:"Nepal Bhoomi helped us find our dream home in Lalitpur within 3 weeks. Their knowledge of the market and genuine care for our needs was exceptional.", img:img("photo-1560250097-0b93528c311a",200,200) },
  { id:2, name:"Anita Gurung", role:"Property Investor, Pokhara", rating:5, text:"As an NRN investing from abroad, Nepal Bhoomi's advisory team guided us through every legal and financial step. Complete transparency throughout.", img:img("photo-1573497019940-1c28c88b4f3e",200,200) },
  { id:3, name:"Dr. Ramesh Poudel", role:"Commercial Buyer, Lalitpur", rating:5, text:"Purchased a commercial property through Nepal Bhoomi. Their valuation was spot-on and the transaction was completed without a single hitch. Highly recommended.", img:img("photo-1507003211169-0a1dd7228f2d",200,200) },
];

/** In display order. The About page shows the first ABOUT_TEAM_LIMIT; the Team page shows all. */
export const TEAM: TeamMember[] = [
  { id:1, name:"Arjun Thapa", role:"Founder & Principal Advisor", img:img("photo-1560250097-0b93528c311a",500,600),
    department:"Leadership", experienceYears:18, languages:["Nepali","English","Hindi"],
    specialities:["Luxury Residences","Investment Advisory","Heritage Homes"],
    bio:"Arjun founded Nepal Bhoomi to bring honesty and discretion to the valley's premium property market. He personally advises on the firm's most significant transactions.",
    phone:"+977 1 400 0000", whatsapp:"9779800000000", email:"arjun@nepalbhoomi.com" },
  { id:2, name:"Priya Shrestha", role:"Senior Property Consultant", img:img("photo-1573496359142-b8d87734a5a2",500,600), // was photo-1580489944761, which returns 404
    department:"Sales & Advisory", experienceYears:11, languages:["Nepali","English","Newari"],
    specialities:["Family Homes","Lalitpur & Patan","First-time Buyers"],
    bio:"Priya guides families through every step of buying in Lalitpur and Patan, from the first viewing to the final handover, with a calm eye for detail.",
    phone:"+977 1 400 0001", whatsapp:"9779800000001", email:"priya@nepalbhoomi.com" },
  { id:3, name:"Rajan Maharjan", role:"Investment Specialist", img:img("photo-1507003211169-0a1dd7228f2d",500,600),
    department:"Sales & Advisory", experienceYears:9, languages:["Nepali","English"],
    specialities:["Commercial Property","Land & Development","NRN Investors"],
    bio:"Rajan advises investors and NRN clients on commercial buildings and development land, with a clear view of yields, zoning and long-term value.",
    phone:"+977 1 400 0002", whatsapp:"9779800000002", email:"rajan@nepalbhoomi.com" },
];

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
  { id:1, name:"Kathmandu", count:24, img:img("photo-1613977257363-707ba9348227",900,1100) },
  { id:2, name:"Lalitpur", count:18, img:img("photo-1600596542815-ffad4c1539a9",900,1100) },
  { id:3, name:"Bhaktapur", count:7, img:img("photo-1568605114967-8130f3a36994",900,1100) },
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
