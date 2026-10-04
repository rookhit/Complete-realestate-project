import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/auth/guards";

// The admin-editable dropdown lists (Admin → Dropdown Options). Saved lists live in SiteSetting
// under "options:<key>" (GET /api/v1/site/options, PUT /api/v1/admin/site/options/:key); a list
// the admin never saved uses the frontend's defaults (frontend-realstate/src/app/data/options.ts).
// The property lists are also checked here when a property is saved: those fields are plain
// text in the database, so these lists take the place of an enum.

/** The lists that property saves are checked against (defaults copied from data/properties.ts). */
export type OptionKey = "propertyTypes" | "badges" | "facings" | "roadSurfaces" | "landUnits" | "builtUnits";

const DEFAULTS: Record<OptionKey, readonly string[]> = {
  propertyTypes: ["House/Bungalow", "Land", "Apartment", "Commercial", "Flat"],
  badges: ["Hot", "Featured", "New", "Prime", "Rare", "Verified", "Exclusive"],
  facings: ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"],
  roadSurfaces: ["Black-topped", "Concrete", "Graveled", "Earthen"],
  landUnits: ["Ropani", "Aana", "Bigha", "Kattha", "Dhur", "sq.ft"],
  builtUnits: ["sq.ft", "sq.m"],
};

/**
 * Every list the admin can edit, with its rules: `min` = the fewest options the site works with,
 * `maxLength` = the longest option (quote starters are whole sentences).
 */
export const OPTION_RULES = {
  propertyTypes: { min: 1, maxLength: 40 },
  badges: { min: 1, maxLength: 40 },
  facings: { min: 1, maxLength: 40 },
  roadSurfaces: { min: 1, maxLength: 40 },
  landUnits: { min: 1, maxLength: 20 },
  builtUnits: { min: 1, maxLength: 20 },
  floorNames: { min: 0, maxLength: 40 },
  highlightIdeas: { min: 0, maxLength: 80 },
  taglineIdeas: { min: 0, maxLength: 120 },
  teamRoles: { min: 1, maxLength: 60 },
  departments: { min: 1, maxLength: 60 },
  languages: { min: 0, maxLength: 40 },
  specialities: { min: 0, maxLength: 40 },
  testimonialIdeas: { min: 0, maxLength: 1000 },
  contactTopics: { min: 1, maxLength: 60 },
  callbackTimes: { min: 1, maxLength: 60 },
} as const;
export type AnyOptionKey = keyof typeof OPTION_RULES;
export const isOptionKey = (key: string): key is AnyOptionKey => Object.hasOwn(OPTION_RULES, key);
const MAX_ITEMS = 200;

/** Ropani-Aana-Paisa-Dam: always allowed as a land unit (the value is then "4-4-0-1"). */
export const RAPD_UNIT = "R-A-P-D";

const settingKey = (key: string): string => `options:${key}`;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** The property lists (one query), with the defaults filled in, for checking a property save. */
export async function loadOptions(): Promise<Record<OptionKey, readonly string[]>> {
  const keys = Object.keys(DEFAULTS) as OptionKey[];
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: keys.map(settingKey) } },
    select: { key: true, value: true },
  });
  const saved = new Map(rows.map((r) => [r.key.slice("options:".length), r.value]));
  const out = { ...DEFAULTS };
  for (const key of keys) {
    const value = saved.get(key);
    if (isStringArray(value) && value.length > 0) out[key] = value;
  }
  return out;
}

/** Every list the admin has saved, by key. Lists never saved are left out (the site uses its defaults). */
export async function loadSavedOptions(): Promise<Partial<Record<AnyOptionKey, string[]>>> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.keys(OPTION_RULES).map(settingKey) } },
    select: { key: true, value: true },
  });
  const out: Partial<Record<AnyOptionKey, string[]>> = {};
  for (const r of rows) {
    const key = r.key.slice("options:".length);
    if (isOptionKey(key) && isStringArray(r.value)) out[key] = r.value;
  }
  return out;
}

/**
 * Replaces one list. Options are trimmed, empty ones dropped, and the same option twice (in any
 * letter case) kept once. Properties already using a removed option keep it until edited.
 */
export async function saveOptions(key: string, items: string[]): Promise<string[]> {
  if (!isOptionKey(key)) throw new HttpError(404, "NOT_FOUND", "No such option list");
  const { min, maxLength } = OPTION_RULES[key];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of items) {
    const v = raw.trim().replace(/\s+/g, " ");
    if (!v || seen.has(v.toLowerCase())) continue;
    if (v.length > maxLength) throw new HttpError(400, "VALIDATION_FAILED", `“${v.slice(0, 40)}…” is too long (at most ${maxLength} characters)`, { items: "Too long" });
    seen.add(v.toLowerCase());
    clean.push(v);
  }
  if (clean.length < min) throw new HttpError(400, "VALIDATION_FAILED", `Keep at least ${min} option${min === 1 ? "" : "s"} in this list`, { items: "Too few" });
  if (clean.length > MAX_ITEMS) throw new HttpError(400, "VALIDATION_FAILED", `At most ${MAX_ITEMS} options`, { items: "Too many" });
  await prisma.siteSetting.upsert({ where: { key: settingKey(key) }, create: { key: settingKey(key), value: clean }, update: { value: clean } });
  return clean;
}
