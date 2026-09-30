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
  buildYear: number; price: string; verified: boolean;
  amenities: string[]; highlights: string[];
};

/** "a, b and c". */
const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const noun = (type: string) => ({
  "House/Bungalow": "house", Apartment: "apartment", Flat: "flat", Land: "plot of land", Commercial: "commercial property",
} as Record<string, string>)[type] ?? "property";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** Highlights about the surroundings ("Near …", "Walk to …") read as their own sentence. */
const isNearby = (h: string) => /^(near|close to|walk to|walking distance)\b/i.test(h.trim());

/**
 * A listing description built only from what the form holds: nothing is added that the
 * admin did not enter (no "sought-after", no "ready to move in"). Every filled-in field
 * is used; empty ones are simply left out. Three wordings, for 0, 1, 2 (then it repeats),
 * so "Write it for me" can offer a different take each time.
 */
export function describeProperty(f: PropertyFacts, variant: number): string {
  const isLand = f.type === "Land";
  const rent = f.listing === "For Rent";
  const place = f.location || f.district;
  const where = place ? ` in ${place}` : "";
  const land = f.landArea !== "—" ? f.landArea : "";
  const built = !isLand && f.builtArea !== "—" ? f.builtArea : "";
  const nearby = f.highlights.filter(isNearby).map(h => h.charAt(0).toLowerCase() + h.slice(1));
  const features = [...f.highlights.filter(h => !isNearby(h)), ...f.amenities];

  const rooms = !isLand ? [f.beds > 0 && plural(f.beds, "bedroom"), f.baths > 0 && plural(f.baths, "bathroom"), f.floors > 0 && plural(f.floors, "floor")].filter(Boolean) as string[] : [];
  const size = [built && `${built} built`, land && (isLand ? land : `on ${land} of land`)].filter(Boolean).join(" ");
  const year = !isLand && f.buildYear > 0 ? f.buildYear : 0;
  const orient = [f.facing && `faces ${f.facing.toLowerCase()}`, f.roadAccess && `has ${f.roadAccess.toLowerCase()} road access`].filter(Boolean) as string[];

  const s = {
    intro: `${f.title ? `${f.title} is a` : "A"} ${noun(f.type)} ${rent ? "for rent" : "for sale"}${where}.`,
    rooms: rooms.length ? `It has ${list(rooms)}.` : "",
    size: isLand ? (land ? `The plot measures ${land}.` : "") : size ? `${cap(size)}.` : "",
    year: year ? `Built in ${year}.` : "",
    orient: orient.length ? `It ${list(orient)}.` : "",
    feats: features.length ? `Features: ${list(features)}.` : "",
    near: nearby.length ? `Location: ${list(nearby)}.` : "",
    price: f.price ? `${rent ? "Rent" : "Asking price"}: ${f.price}.` : "",
    verified: f.verified ? "Documents verified by Nepal Bhoomi." : "",
  };

  const styles = [
    // Complete sentences, in the order a buyer reads a listing
    [s.intro, s.rooms, s.size, s.year, s.orient, s.feats, s.near, s.price, s.verified],
    // Short and factual: figures first
    [
      `${rooms.length ? cap(list(rooms)) : cap(noun(f.type))}${size ? `, ${size}` : ""}${place ? `, in ${place}` : ""}${rent ? ", for rent" : ", for sale"}.`,
      s.year, s.orient, s.feats, s.near, s.price, s.verified,
    ],
    // Features first
    [
      features.length ? `${f.title || cap(noun(f.type))}${where}, with ${list(features)}.` : s.intro,
      s.rooms, s.size, s.year, s.orient, s.near, s.price, s.verified,
    ],
  ][((variant % 3) + 3) % 3];
  return styles.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

// Tagline, highlight and testimonial ideas are admin-editable lists in data/options.ts.

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
