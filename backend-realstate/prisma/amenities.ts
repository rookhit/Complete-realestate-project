// The canonical amenity names, copied from the frontend's AMENITIES (frontend-realstate/src/app/icons/amenities.tsx).
// The names are the contract with the frontend: keep the spelling identical. Order = display order.
export const AMENITY_SEED: Record<"MAIN_FEATURES" | "ROOMS" | "FURNISHED", string[]> = {
  MAIN_FEATURES: [
    "Earthquake Resistant", "Marble", "Parquet", "Balcony", "Terrace", "Garden", "Swimming Pool",
    "Parking", "Garage", "Elevator", "Security", "Concierge", "Gym", "Solar Power", "Generator Backup",
    "Drinking Water", "Reserve Tank", "Drainage", "Mountain Views", "Waterfront", "Nature Trails",
    "Heritage Architecture", "Air Conditioning", "CCTV", "Fire Safety", "Boring Water",
    "Solar Water Heater", "Gated Community", "Kids Play Area", "Pet Friendly", "Wheelchair Access",
    "EV Charging", "Corner Plot",
  ],
  ROOMS: [
    "Bedroom", "Master Bedroom", "Living Room", "Dining Room", "Kitchen", "Bathroom", "Pantry",
    "Home Theater", "Wine Cellar", "Staff Quarters", "Guest Cottage", "Board Room", "Commercial Unit",
    "Open Plan", "Floors", "Puja Room", "Study Room", "Store Room", "Laundry Room", "Guest Room",
    "Attached Bathroom",
  ],
  FURNISHED: [
    "Fully Furnished", "Modular Kitchen", "Internet", "Smart Home", "Dining Table", "Bed", "Closet",
    "Sofa", "Refrigerator", "Washing Machine", "Microwave", "Television", "Water Purifier",
    "Curtains & Blinds", "Ceiling Fans",
  ],
};
