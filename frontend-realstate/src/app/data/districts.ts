/**
 * All 77 districts of Nepal, grouped by province.
 *
 * This replaces the previous 9-item AREAS list. `district` on a property is an
 * exact-match filter key, so these strings are the canonical spellings — the
 * API must send exactly these or a filter silently returns nothing
 * (CLAUDE.md section 6).
 *
 * Romanisation follows the spellings in common use on Nepali government and
 * property listings. Where a district is widely known by two names, the
 * alternate is listed in DISTRICT_ALIASES so search still finds it.
 */

export type Province =
  | "Koshi"
  | "Madhesh"
  | "Bagmati"
  | "Gandaki"
  | "Lumbini"
  | "Karnali"
  | "Sudurpashchim";

export const DISTRICTS_BY_PROVINCE: Record<Province, string[]> = {
  Koshi: [
    "Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga",
    "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung",
    "Terhathum", "Udayapur",
  ],
  Madhesh: [
    "Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi",
    "Siraha",
  ],
  Bagmati: [
    "Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", "Kavrepalanchok",
    "Lalitpur", "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa", "Sindhuli",
    "Sindhupalchok",
  ],
  Gandaki: [
    "Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi",
    "Nawalpur", "Parbat", "Syangja", "Tanahun",
  ],
  Lumbini: [
    "Arghakhanchi", "Banke", "Bardiya", "Dang", "Gulmi", "Kapilvastu",
    "Palpa", "Parasi", "Pyuthan", "Rolpa", "Rukum East", "Rupandehi",
  ],
  Karnali: [
    "Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", "Kalikot", "Mugu",
    "Rukum West", "Salyan", "Surkhet",
  ],
  Sudurpashchim: [
    "Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", "Darchula", "Doti",
    "Kailali", "Kanchanpur",
  ],
};

export const PROVINCES = Object.keys(DISTRICTS_BY_PROVINCE) as Province[];

/** Flat, alphabetical. 77 entries. */
export const DISTRICTS: string[] = PROVINCES
  .flatMap((p) => DISTRICTS_BY_PROVINCE[p])
  .sort((a, b) => a.localeCompare(b));

/** Province lookup for a district, for grouping suggestions. */
export const PROVINCE_OF: Record<string, Province> = Object.fromEntries(
  PROVINCES.flatMap((p) => DISTRICTS_BY_PROVINCE[p].map((d) => [d, p] as const)),
) as Record<string, Province>;

/**
 * Alternate spellings people actually type. Typing either side matches.
 * Keys are lowercase; values are the canonical district.
 */
export const DISTRICT_ALIASES: Record<string, string> = {
  "nawalparasi east": "Nawalpur",
  "nawalparasi west": "Parasi",
  nawalparasi: "Nawalpur",
  kavre: "Kavrepalanchok",
  kabhrepalanchok: "Kavrepalanchok",
  sindhupalchowk: "Sindhupalchok",
  "kathmandu valley": "Kathmandu",
  patan: "Lalitpur",
  pokhara: "Kaski",
  butwal: "Rupandehi",
  biratnagar: "Morang",
  birgunj: "Parsa",
  dharan: "Sunsari",
  nepalgunj: "Banke",
  hetauda: "Makwanpur",
  bhairahawa: "Rupandehi",
  itahari: "Sunsari",
  janakpur: "Dhanusha",
  damak: "Jhapa",
  tikapur: "Kailali",
  dhangadhi: "Kailali",
  mahendranagar: "Kanchanpur",
  sauraha: "Chitwan",
  bharatpur: "Chitwan",
  lukla: "Solukhumbu",
  namche: "Solukhumbu",
};

/**
 * Typeahead matcher.
 *
 * Ranks prefix matches above substring matches, so typing "g" surfaces
 * Gorkha and Gulmi before Baglung. Also resolves the alias table, so "pokhara"
 * finds Kaski.
 */
export function searchDistricts(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return DISTRICTS.slice(0, limit);

  const aliasHit = Object.entries(DISTRICT_ALIASES)
    .filter(([alias]) => alias.startsWith(q))
    .map(([, district]) => district);

  const startsWith = DISTRICTS.filter((d) => d.toLowerCase().startsWith(q));
  const contains = DISTRICTS.filter(
    (d) => !d.toLowerCase().startsWith(q) && d.toLowerCase().includes(q),
  );

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const d of [...startsWith, ...aliasHit, ...contains]) {
    if (seen.has(d)) continue;
    seen.add(d);
    ordered.push(d);
    if (ordered.length >= limit) break;
  }
  return ordered;
}
