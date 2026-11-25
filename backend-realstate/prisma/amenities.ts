// The canonical amenity names, copied from the frontend's AMENITIES (frontend-realstate/src/app/icons/amenities.tsx).
// The names are the contract with the frontend: keep the spelling identical. Order = display order on the property
// page. The database group is only a label (the frontend decides the headings): the frontend's "Land Type" and
// "Nearby" groups (2026-11-25) are stored as MAIN_FEATURES, so no enum change was needed.
type Group = "MAIN_FEATURES" | "ROOMS" | "FURNISHED";

export const AMENITY_SEED: { group: Group; names: string[] }[] = [
  { group: "MAIN_FEATURES", names: [
    // Land type
    "Residential Land", "Commercial Land", "Agricultural Land", "Plotted Land", "Individual Plot",
    // Main features
    "Earthquake Resistant", "Marble", "Parquet", "Balcony", "Terrace", "Garden", "Swimming Pool",
    "Parking", "Garage", "Elevator", "Security", "Concierge", "Gym", "Solar Power", "Generator Backup",
    "Drinking Water", "Reserve Tank", "Drainage", "Mountain Views", "Waterfront", "Nature Trails",
    "Heritage Architecture", "Air Conditioning", "CCTV", "Fire Safety", "Boring Water",
    "Solar Water Heater", "Gated Community", "Kids Play Area", "Pet Friendly", "Wheelchair Access",
    "EV Charging", "Corner Plot", "Flat Land", "Electricity", "Water Supply", "Boundary Wall", "Street Lights",
  ] },
  { group: "ROOMS", names: [
    "Bedroom", "Master Bedroom", "Living Room", "Dining Room", "Kitchen", "Bathroom", "Pantry",
    "Home Theater", "Wine Cellar", "Staff Quarters", "Guest Cottage", "Board Room", "Commercial Unit",
    "Open Plan", "Floors", "Puja Room", "Study Room", "Store Room", "Laundry Room", "Guest Room",
    "Attached Bathroom",
  ] },
  { group: "FURNISHED", names: [
    "Fully Furnished", "Modular Kitchen", "Internet", "Smart Home", "Dining Table", "Bed", "Closet",
    "Sofa", "Refrigerator", "Washing Machine", "Microwave", "Television", "Water Purifier",
    "Curtains & Blinds", "Ceiling Fans",
  ] },
  { group: "MAIN_FEATURES", names: [
    // Nearby
    "Temple Nearby", "School Nearby", "College Nearby", "Hospital Nearby", "Police Station Nearby",
    "Mart Nearby", "Market Nearby", "Bank Nearby", "Public Transport",
  ] },
];

type AmenityClient = {
  amenity: {
    upsert(args: {
      where: { name: string };
      update: { group: Group; position: number };
      create: { name: string; group: Group; position: number };
    }): Promise<unknown>;
  };
};

/** Adds missing names and fixes group / order. Never deletes (properties may link to old ones). Returns the count. */
export async function upsertAmenities(prisma: AmenityClient): Promise<number> {
  let position = 0;
  for (const { group, names } of AMENITY_SEED) {
    for (const name of names) {
      position++;
      await prisma.amenity.upsert({ where: { name }, update: { group, position }, create: { name, group, position } });
    }
  }
  return position;
}
