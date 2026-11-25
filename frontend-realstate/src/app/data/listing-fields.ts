// Which parts of a property form a property type gets, and which amenities fit it. Used by the
// Free Listing form and the admin's property editor, so both offer the same choices. Land has no
// bedrooms or furniture; an office has a board room but no puja room. Types the admin adds in
// Dropdown Options are treated like a house.
import { AMENITIES, AMENITY_GROUPS, type AmenityGroup } from "@/app/icons/amenities";

export type ListingKind = "land" | "home" | "apartment" | "commercial";

export function kindOf(type: string): ListingKind {
  if (type === "Land") return "land";
  if (type === "Commercial") return "commercial";
  if (type === "Apartment" || type === "Flat") return "apartment";
  return "home";
}

/** The size fields each kind asks for. */
export const SIZE_FIELDS: Record<ListingKind, { land: boolean; built: boolean; rooms: boolean; floors: boolean; buildYear: boolean }> = {
  land:       { land: true,  built: false, rooms: false, floors: false, buildYear: false },
  home:       { land: true,  built: true,  rooms: true,  floors: true,  buildYear: true },
  apartment:  { land: false, built: true,  rooms: true,  floors: true,  buildYear: true },
  commercial: { land: true,  built: true,  rooms: false, floors: true,  buildYear: true },
};

const ALL = AMENITIES.map(a => a.name);
const inGroup = (g: AmenityGroup) => AMENITIES.filter(a => a.group === g).map(a => a.name);
/** "Residential Land", "Plotted Land"…: only for land. */
const LAND_TYPES = inGroup("Land Type");
/** Temple, school, bus… nearby: fits every kind. */
const NEARBY = inGroup("Nearby");
/** Services every kind can have. */
const SERVICES = ["Electricity", "Water Supply", "Street Lights"];

const LAND_AMENITIES = [
  ...LAND_TYPES,
  "Flat Land", "Drinking Water", "Boring Water", "Drainage", "Boundary Wall", "Corner Plot", "Garden", "Gated Community",
  "Mountain Views", "Waterfront", "Nature Trails",
  ...SERVICES, ...NEARBY,
];
const COMMERCIAL_AMENITIES = [
  "Earthquake Resistant", "Parking", "Garage", "Elevator", "Security", "CCTV", "Fire Safety", "Concierge", "Air Conditioning",
  "Solar Power", "Generator Backup", "Drinking Water", "Reserve Tank", "Boring Water", "Drainage", "Wheelchair Access",
  "EV Charging", "Corner Plot", "Balcony", "Terrace", "Boundary Wall",
  "Board Room", "Commercial Unit", "Open Plan", "Floors", "Store Room", "Pantry", "Kitchen", "Bathroom",
  "Fully Furnished", "Internet", "Water Purifier", "Ceiling Fans",
  ...SERVICES, ...NEARBY,
];
/** Things a home has that an office or a plot doesn't. */
const NOT_FOR_HOMES = ["Board Room", "Commercial Unit", "Flat Land", ...LAND_TYPES];
/** Things that belong to a whole plot or house, not to one flat in a building. */
const NOT_FOR_APARTMENTS = [...NOT_FOR_HOMES, "Corner Plot", "Boundary Wall", "Nature Trails", "Heritage Architecture", "Guest Cottage", "Staff Quarters", "Wine Cellar"];

const FIT: Record<ListingKind, Set<string>> = {
  land: new Set(LAND_AMENITIES),
  home: new Set(ALL.filter(n => !NOT_FOR_HOMES.includes(n))),
  apartment: new Set(ALL.filter(n => !NOT_FOR_APARTMENTS.includes(n))),
  commercial: new Set(COMMERCIAL_AMENITIES),
};

export const amenityFits = (kind: ListingKind, name: string): boolean => FIT[kind].has(name);

/** A group's heading: land calls its main features "Land Features". */
export const amenityGroupLabel = (kind: ListingKind, group: AmenityGroup): string =>
  kind === "land" && group === "Main Features" ? "Land Features" : group;

/** The amenity groups to show for a kind, in the usual order, each with only the amenities that fit. */
export function amenityGroupsFor(kind: ListingKind): { group: AmenityGroup; label: string; items: typeof AMENITIES }[] {
  return AMENITY_GROUPS
    .map(group => ({
      group,
      label: amenityGroupLabel(kind, group),
      items: AMENITIES.filter(a => a.group === group && FIT[kind].has(a.name)),
    }))
    .filter(g => g.items.length > 0);
}
