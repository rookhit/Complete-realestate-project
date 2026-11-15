// Which parts of the Free Listing form a property type gets, and which amenities fit it. Land has
// no bedrooms or furniture; an office has a board room but no puja room. Types the admin adds in
// Dropdown Options are treated like a house.
import { AMENITIES, type AmenityGroup } from "@/app/icons/amenities";

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

const LAND_AMENITIES = [
  "Drinking Water", "Boring Water", "Drainage", "Corner Plot", "Gated Community", "Mountain Views", "Waterfront", "Nature Trails",
];
const COMMERCIAL_AMENITIES = [
  "Earthquake Resistant", "Parking", "Garage", "Elevator", "Security", "CCTV", "Fire Safety", "Concierge", "Air Conditioning",
  "Solar Power", "Generator Backup", "Drinking Water", "Reserve Tank", "Boring Water", "Drainage", "Wheelchair Access",
  "EV Charging", "Corner Plot", "Balcony", "Terrace",
  "Board Room", "Commercial Unit", "Open Plan", "Floors", "Store Room", "Pantry", "Kitchen", "Bathroom",
  "Fully Furnished", "Internet", "Water Purifier", "Ceiling Fans",
];
/** Things a home has that an office doesn't. */
const NOT_FOR_HOMES = ["Board Room", "Commercial Unit"];
/** Things that belong to a whole plot or house, not to one flat in a building. */
const NOT_FOR_APARTMENTS = [...NOT_FOR_HOMES, "Corner Plot", "Nature Trails", "Heritage Architecture", "Guest Cottage", "Staff Quarters", "Wine Cellar"];

const ALL = AMENITIES.map(a => a.name);
const FIT: Record<ListingKind, Set<string>> = {
  land: new Set(LAND_AMENITIES),
  home: new Set(ALL.filter(n => !NOT_FOR_HOMES.includes(n))),
  apartment: new Set(ALL.filter(n => !NOT_FOR_APARTMENTS.includes(n))),
  commercial: new Set(COMMERCIAL_AMENITIES),
};

export const amenityFits = (kind: ListingKind, name: string): boolean => FIT[kind].has(name);

/** The amenity groups to show for a kind, in the usual order, each with only the amenities that fit. */
export function amenityGroupsFor(kind: ListingKind): { group: AmenityGroup; label: string; items: typeof AMENITIES }[] {
  const groups: AmenityGroup[] = ["Main Features", "Rooms", "Furnished"];
  return groups
    .map(group => ({
      group,
      label: kind === "land" && group === "Main Features" ? "Land Features" : group,
      items: AMENITIES.filter(a => a.group === group && FIT[kind].has(a.name)),
    }))
    .filter(g => g.items.length > 0);
}
