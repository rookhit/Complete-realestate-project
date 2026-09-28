/**
 * Writing help for the admin: ready-made copy built from what the form already knows.
 *
 * Everything here is plain templates over the form's own facts: no AI service, no
 * network call, nothing invented. It exists so a busy editor can click once, then
 * adjust, instead of starting from an empty box.
 */

export type PropertyFacts = {
  title: string; type: string; listing: "For Sale" | "For Rent";
  location: string; district: string; facing: string; roadAccess: string;
  beds: number; baths: number; floors: number; builtArea: string; landArea: string;
  amenities: string[]; highlights: string[];
};

/** "a, b and c". */
const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const noun = (type: string) => ({
  "House/Bungalow": "residence", Apartment: "apartment", Flat: "flat", Land: "plot", Commercial: "commercial property",
} as Record<string, string>)[type] ?? "property";

/** The most telling amenities first, so a description names the ones buyers care about. */
const PRIORITY = [
  "Swimming Pool", "Mountain Views", "Waterfront", "Garden", "Terrace", "Heritage Architecture", "Earthquake Resistant",
  "Home Theater", "Smart Home", "Solar Power", "Elevator", "Security", "Parking", "Garage", "Fully Furnished",
  "Modular Kitchen", "Puja Room", "Balcony", "Gated Community", "Boring Water", "Drinking Water",
];

/** How an amenity reads inside a sentence ("with a swimming pool, …"). Others are lower-cased. */
const PHRASE: Record<string, string> = {
  "Swimming Pool": "a swimming pool", "Mountain Views": "mountain views", Waterfront: "waterfront living",
  Garden: "a private garden", Terrace: "a terrace", Balcony: "a balcony", "Heritage Architecture": "heritage architecture",
  "Earthquake Resistant": "earthquake-resistant construction", "Home Theater": "a home theatre", "Smart Home": "smart-home controls",
  "Solar Power": "solar power", Elevator: "a lift", Security: "round-the-clock security", Parking: "private parking",
  Garage: "a garage", "Fully Furnished": "full furnishing", "Modular Kitchen": "a modular kitchen", "Puja Room": "a puja room",
  "Gated Community": "a gated setting", "Boring Water": "its own boring water", "Drinking Water": "a reliable drinking-water supply",
  "Reserve Tank": "a reserve water tank", Internet: "high-speed internet", Marble: "marble floors", Parquet: "parquet floors",
};

/** Highlights about the surroundings ("Near …", "Walk to …") read as their own line, not as features. */
const isNearby = (h: string) => /^(near|close to|walk to|walking distance)\b/i.test(h.trim());

/** The admin's own highlights first (they are the selling points), then amenities by importance. */
const topFeatures = (f: PropertyFacts, n: number) => {
  const ranked = [...f.highlights.filter(h => !isNearby(h)), ...PRIORITY.filter(a => f.amenities.includes(a)), ...f.amenities.filter(a => !PRIORITY.includes(a))];
  return [...new Set(ranked)].slice(0, n).map(a => PHRASE[a] ?? a.toLowerCase());
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A listing description in one of three styles. Call with 0, 1, 2 (then it repeats),
 * so "Write it for me" can offer a different take each time it is pressed.
 */
export function describeProperty(f: PropertyFacts, variant: number): string {
  const place = f.location || f.district || "a sought-after neighbourhood";
  const isLand = f.type === "Land";
  const rent = f.listing === "For Rent";
  const thing = noun(f.type);
  const land = f.landArea !== "—" ? f.landArea : "";
  const built = !isLand && f.builtArea !== "—" ? f.builtArea : "";
  const subject = isLand
    ? (land ? `${land} of land` : "prime land")
    : `${f.beds > 0 ? `${f.beds}-bedroom ` : ""}${thing}`;
  const feats = topFeatures(f, 3);
  // "Location perks: Near International School and Walk to Ring Road."
  const nearby = f.highlights.filter(isNearby);
  const perks = nearby.length ? ` Location perks: ${list(nearby)}.` : "";

  // "It faces north-east and is reached by a black-topped 20ft road."
  const facing = f.facing ? `faces ${f.facing.toLowerCase()}` : "";
  const road = f.roadAccess ? `is reached by a ${f.roadAccess.toLowerCase()} road` : "";
  const setting = facing || road ? ` It ${[facing, road].filter(Boolean).join(" and ")}.` : "";

  const close = rent
    ? "Ready to move in, and ideal for anyone who wants space, light and calm."
    : isLand
      ? "A rare chance to secure land in one of the valley's most desirable settings."
      : "A rare opportunity to own a home of real character in one of the valley's most desirable settings.";

  const styles = [
    // Warm and descriptive
    `${isLand ? cap(subject) : `A beautifully presented ${subject}`} in ${place}${feats.length ? `, with ${list(feats)}` : ""}.${setting}${perks} ${close}`,
    // Short and factual, for busy buyers
    `${isLand ? cap(subject) : f.beds > 0 ? `${f.beds} bedrooms and ${f.baths} bathroom${f.baths === 1 ? "" : "s"}` : cap(thing)}${built ? `, ${built} built` : ""}${!isLand && land ? ` on ${land}` : ""} in ${place}.${feats.length ? ` Highlights include ${list(feats)}.` : ""}${f.roadAccess ? ` ${cap(f.roadAccess)} road access.` : ""}${perks} ${rent ? "Viewings available this week." : "Documents verified and ready for a smooth transfer."}`,
    // Lifestyle-led
    `Imagine ${isLand ? "building your future" : "coming home"} in ${place}. This ${isLand ? (land ? `${land} plot` : "plot") : subject} brings together ${feats.length ? list(feats) : "comfort, privacy and considered design"}${f.facing ? `, with ${f.facing.toLowerCase()}-facing light` : ""}.${perks} ${rent ? "Book a viewing and see why it rarely stays available for long." : "Book a private viewing with our advisors and see it for yourself."}`,
  ];
  return styles[((variant % 3) + 3) % 3].replace(/\s+/g, " ").replace(/ \./g, ".").trim();
}

/** Short taglines that suit the property type. */
export function taglineIdeas(type: string): string[] {
  const common = ["Refined Living", "A Rare Opportunity", "Light, Space & Calm"];
  const byType: Record<string, string[]> = {
    "House/Bungalow": ["Heritage Reimagined", "Family Sanctuary", "Quiet Hilltop Retreat"],
    Apartment: ["Sanctuary Above the City", "Urban Elegance", "City Views, Every Day"],
    Flat: ["City Centre Living", "Move-in Ready", "Urban Elegance"],
    Land: ["Build Your Vision", "Nature Reserve Living", "Prime Development Land"],
    Commercial: ["Premier Business Address", "Urban Investment", "High-Footfall Location"],
  };
  return [...(byType[type] ?? []), ...common].slice(0, 5);
}

/**
 * Selling points agents often add, offered as one-tap chips. None of these may be an
 * amenity name: amenities are picked from the icon tiles, highlights are the free-text extras.
 */
export const HIGHLIGHT_IDEAS = [
  "Walk to Ring Road", "Near International School", "Valley Views", "Newly Renovated", "Private Rooftop",
  "Two Road Access", "Peaceful Neighbourhood", "Ready to Move In", "Wide Road Frontage", "Close to Hospital",
];

/** Polished client quotes to start a testimonial from. */
export const TESTIMONIAL_IDEAS = [
  "Nepal Bhoomi found us the right home in weeks, not months. Every question was answered honestly and every document was ready on time.",
  "As an NRN buying from abroad, I needed people I could trust. The team handled the legal and banking steps with complete transparency.",
  "Professional, patient and genuinely knowledgeable about the market. They negotiated a fair price and made the whole process feel effortless.",
  "From the first viewing to the final handover, the service was calm and precise. We would not buy property in Nepal any other way.",
];

/** A short profile bio from what the team form knows. Two styles, alternating. */
export function teamBio(m: { name: string; role: string; experienceYears?: number; specialities?: string[]; languages?: string[] }, variant: number): string {
  const first = m.name.trim().split(/\s+/)[0] || "They";
  const role = m.role ? m.role.toLowerCase() : "advisor";
  const yearsN = m.experienceYears ?? 0;
  // Specialities are kept exactly as typed: they often contain place names ("Lalitpur & Patan").
  const spec = m.specialities?.length ? list(m.specialities.slice(0, 3)) : "";
  const langs = m.languages ?? [];
  const orList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);
  const styles = [
    // "Priya is our senior property consultant, with 11 years in Nepal's property market. Priya specialises in …, and speaks …."
    `${first} is our ${role}${yearsN ? `, with ${yearsN} years in Nepal's property market` : ""}.`
      + (spec ? ` ${first} specialises in ${spec}${langs.length ? `, and speaks ${list(langs)}` : ""}.` : langs.length ? ` ${first} speaks ${list(langs)}.` : "")
      + ` Clients value ${first}'s honest advice and calm, careful guidance from the first viewing to the final handover.`,
    // "Priya brings real local knowledge to every search, with a particular focus on …. With 11 years …, Priya makes … and can help you in …."
    `${first} brings real local knowledge to every search${spec ? `, with a particular focus on ${spec}` : ""}.`
      + ` ${yearsN ? `With ${yearsN} years in Nepal's property market, ${first}` : first} makes buying, selling or renting feel straightforward`
      + `${langs.length ? `, and can help you in ${orList(langs)}` : ""}.`,
  ];
  return styles[((variant % 2) + 2) % 2].replace(/\s+/g, " ").replace(/ \./g, ".").replace(/,\s*\./g, ".").trim();
}

/** The first one or two sentences of an article, trimmed to fit a card. */
export function summaryFrom(body: string): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > 220) break;
    out += s;
  }
  return (out || text.slice(0, 200) + "…").trim();
}
