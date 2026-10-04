// Every list of choices the admin picks from (dropdowns, chips, suggestion ideas), editable in
// Admin → Dashboard → Dropdown Options. Each entry points at the array the site already uses
// and changes it in place, so every dropdown sees the new options straight away.
//
// Saved in the database (SiteSetting "options:<key>"): loadSiteOptions() applies the saved lists
// at startup (GET /site/options); setOptions() shows a change at once and saves it
// (PUT /admin/site/options/:key). A list the admin never saved keeps the defaults below.
import { fetchSavedOptions, saveOptionList } from "@/api/options";
import { ApiError } from "@/app/auth";
import { emitChange } from "./store";
import {
  ALL_PROPS, BADGES, BUILT_UNITS, FACINGS, FLOOR_NAMES, LAND_UNITS, PROPERTY_TYPES, PROP_TYPES, ROAD_SURFACES,
} from "./properties";
import { DEPARTMENTS, LANGUAGES, SPECIALITIES, TEAM, TEAM_ROLES } from "./content";

/** Topics in the Contact page's "I'm interested in" dropdown. */
export const CONTACT_TOPICS = ["General Enquiry", "Buy Property", "Rent Property", "Investment Advisory", "Free Listing"];
/** Times offered in the home page "Let us call you" form. */
export const CALLBACK_TIMES = ["Morning (9am-12pm)", "Afternoon (12pm-4pm)", "Evening (4pm-6pm)"];

/**
 * Selling points offered as one-tap chips in the property editor. None of these may be an
 * amenity name: amenities are picked from the icon tiles, highlights are the free-text extras.
 */
export const HIGHLIGHT_IDEAS = [
  "Walk to Ring Road", "Near International School", "Valley Views", "Newly Renovated", "Private Rooftop",
  "Two Road Access", "Peaceful Neighbourhood", "Ready to Move In", "Wide Road Frontage", "Close to Hospital",
];
/** Tagline suggestions in the property editor. */
export const TAGLINE_IDEAS = [
  "Heritage Reimagined", "Family Sanctuary", "Sanctuary Above the City", "Urban Elegance", "City Centre Living",
  "Build Your Vision", "Premier Business Address", "Refined Living", "A Rare Opportunity", "Light, Space & Calm",
];
/** Client quotes the admin can start a testimonial from. */
export const TESTIMONIAL_IDEAS = [
  "Nepal Bhoomi found us the right home in weeks, not months. Every question was answered honestly and every document was ready on time.",
  "As an NRN buying from abroad, I needed people I could trust. The team handled the legal and banking steps with complete transparency.",
  "Professional, patient and genuinely knowledgeable about the market. They negotiated a fair price and made the whole process feel effortless.",
  "From the first viewing to the final handover, the service was calm and precise. We would not buy property in Nepal any other way.",
];

export interface OptionList {
  key: string;
  group: "Properties" | "Team" | "Testimonials" | "Website Forms";
  label: string;
  where: string;          // where the admin will see these options
  items: string[];        // the live array; edited in place
  defaults: string[];
  min?: number;           // lists the site can't work without keep at least this many
  long?: boolean;         // long entries (quotes): shown one per line
  usedBy?: (item: string) => number;
  unit?: string;          // what usedBy counts, e.g. "property"
  afterChange?: () => void;
}

const count = <T,>(list: T[], test: (x: T) => boolean) => list.filter(test).length;

export const OPTION_LISTS: OptionList[] = [
  { key: "propertyTypes", group: "Properties", label: "Property types", where: "Property editor, Buy / Rent filters, Free Listing form",
    items: PROPERTY_TYPES, defaults: [...PROPERTY_TYPES], min: 1, unit: "property", usedBy: t => count(ALL_PROPS, p => p.type === t),
    afterChange: () => PROP_TYPES.splice(0, PROP_TYPES.length, "All Types", ...PROPERTY_TYPES) },
  { key: "badges", group: "Properties", label: "Badges", where: "Property editor → Badge (the coloured label on the photo)",
    items: BADGES, defaults: [...BADGES], min: 1, unit: "property", usedBy: b => count(ALL_PROPS, p => p.badge === b) },
  { key: "facings", group: "Properties", label: "Facing", where: "Property editor → Location → Facing",
    items: FACINGS, defaults: [...FACINGS], min: 1, unit: "property", usedBy: f => count(ALL_PROPS, p => p.facing === f) },
  { key: "roadSurfaces", group: "Properties", label: "Road surfaces", where: "Property editor → Location → Road Surface",
    items: ROAD_SURFACES, defaults: [...ROAD_SURFACES], min: 1, unit: "property", usedBy: r => count(ALL_PROPS, p => p.roadAccess.startsWith(r)) },
  { key: "landUnits", group: "Properties", label: "Land area units", where: "Property editor → Size → Land Area unit",
    items: LAND_UNITS, defaults: [...LAND_UNITS], min: 1 },
  { key: "builtUnits", group: "Properties", label: "Built area units", where: "Property editor → Size → Built Area unit",
    items: BUILT_UNITS, defaults: [...BUILT_UNITS], min: 1 },
  { key: "floorNames", group: "Properties", label: "Floor-plan box names", where: "Property editor → Floor Plans (quick names for new boxes)",
    items: FLOOR_NAMES, defaults: [...FLOOR_NAMES] },
  { key: "highlightIdeas", group: "Properties", label: "Highlight ideas", where: "Property editor → Amenities → Highlights (one-tap chips)",
    items: HIGHLIGHT_IDEAS, defaults: [...HIGHLIGHT_IDEAS] },
  { key: "taglineIdeas", group: "Properties", label: "Tagline ideas", where: "Property editor → Short Tagline (one-tap chips)",
    items: TAGLINE_IDEAS, defaults: [...TAGLINE_IDEAS] },
  { key: "teamRoles", group: "Team", label: "Positions", where: "Team editor → Role",
    items: TEAM_ROLES, defaults: [...TEAM_ROLES], min: 1, unit: "person", usedBy: r => count(TEAM, m => m.role === r) },
  { key: "departments", group: "Team", label: "Departments", where: "Team editor → Department, and the Team page filter",
    items: DEPARTMENTS, defaults: [...DEPARTMENTS], min: 1, unit: "person", usedBy: d => count(TEAM, m => m.department === d) },
  { key: "languages", group: "Team", label: "Languages", where: "Team editor → Languages",
    items: LANGUAGES, defaults: [...LANGUAGES], unit: "person", usedBy: l => count(TEAM, m => !!m.languages?.includes(l)) },
  { key: "specialities", group: "Team", label: "Specialities", where: "Team editor → Specialities",
    items: SPECIALITIES, defaults: [...SPECIALITIES], unit: "person", usedBy: s => count(TEAM, m => !!m.specialities?.includes(s)) },
  { key: "testimonialIdeas", group: "Testimonials", label: "Quote starters", where: "Testimonial editor (one-tap starting quotes)",
    items: TESTIMONIAL_IDEAS, defaults: [...TESTIMONIAL_IDEAS], long: true },
  { key: "contactTopics", group: "Website Forms", label: "Contact form topics", where: "Contact page → “I’m interested in”",
    items: CONTACT_TOPICS, defaults: [...CONTACT_TOPICS], min: 1 },
  { key: "callbackTimes", group: "Website Forms", label: "Callback times", where: "Home page → “Let us call you” → best time",
    items: CALLBACK_TIMES, defaults: [...CALLBACK_TIMES], min: 1 },
];

export const optionList = (key: string) => OPTION_LISTS.find(l => l.key === key)!;

/** Puts a list's options in place (no saving). */
function apply(l: OptionList, items: string[]): void {
  l.items.splice(0, l.items.length, ...items);
  l.afterChange?.();
}

/** What the server last confirmed for each list: a failed save goes back to it. */
const confirmed = new Map<string, string[]>(OPTION_LISTS.map(l => [l.key, [...l.items]]));
/** One save at a time per list, in order, so quick edits can't arrive out of order. */
const queue = new Map<string, Promise<void>>();
const saveFailedListeners = new Set<(message: string) => void>();

/** Called with a message when a save fails (the list has then gone back to what was saved). */
export function onOptionSaveFailed(f: (message: string) => void): () => void {
  saveFailedListeners.add(f);
  return () => { saveFailedListeners.delete(f); };
}

/** Apply the lists the admin has saved (at startup). A failure keeps the defaults. */
export async function loadSiteOptions(): Promise<void> {
  try {
    const saved = await fetchSavedOptions();
    for (const l of OPTION_LISTS) {
      const items = saved[l.key];
      if (!items) continue;
      apply(l, items);
      confirmed.set(l.key, [...items]);
    }
    emitChange();
  } catch { /* offline: the defaults stay */ }
}

/** Replace a list's options: shown at once, then saved (admin only). */
export function setOptions(key: string, items: string[]): void {
  const l = optionList(key);
  apply(l, items);
  emitChange();
  const next = [...items];
  const run = (queue.get(key) ?? Promise.resolve()).then(async () => {
    try {
      confirmed.set(key, await saveOptionList(key, next));
    } catch (err) {
      const back = confirmed.get(key) ?? [...l.defaults];
      apply(l, back);
      emitChange();
      const why = err instanceof ApiError ? err.message : "Check the connection and try again.";
      saveFailedListeners.forEach(f => f(`${l.label} could not be saved: ${why}`));
    }
  });
  queue.set(key, run);
}

/** Add one option (ignored when it is empty or already there, in any letter case). */
export function addOption(key: string, item: string): boolean {
  const v = item.trim();
  const l = optionList(key);
  if (!v || l.items.some(x => x.toLowerCase() === v.toLowerCase())) return false;
  setOptions(key, [...l.items, v]);
  return true;
}
