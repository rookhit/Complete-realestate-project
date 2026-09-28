// Properties: the shape, the mock listings, and the dropdown values the admin uses.
// Each save/delete function at the bottom is where its API call goes (FRONTEND_CLAUDE.md §7.8):
//   GET    /api/v1/properties               public list (filters in §7.2)
//   GET    /api/v1/properties/:id
//   POST   /api/v1/admin/properties         ADMIN
//   PATCH  /api/v1/admin/properties/:id     ADMIN
//   DELETE /api/v1/admin/properties/:id     ADMIN
// Until then, admin edits live in memory and are lost on reload.
import { img } from "@/app/components/ui/brand";
import { emitChange } from "./store";

export type Listing = "For Sale" | "For Rent";

/** One room on a floor plan, e.g. { name: "Kitchen", dims: "5.2 × 4.8 m" }. */
export interface FloorPlanRoom { name: string; dims: string }

/**
 * One floor of a property's floor plan: a drawing (image URL, optional) plus its rooms.
 * A property can have several: Basement, Ground Floor, First Floor, …
 */
export interface FloorPlan { id: string; label: string; image?: string; rooms: FloorPlanRoom[] }

export interface Prop {
  id: number; propId: string; badge: string; title: string; tagline: string;
  location: string; district: string; price: string; priceNum: number;
  listing: Listing; type: string;
  beds: number; baths: number; builtArea: string; landArea: string;
  roadAccess: string; facing: string; buildYear: number; floors: number;
  verified: boolean; featured: boolean;
  hero: string; gallery: string[]; description: string; features: string[];
  mapX: number; mapY: number;
  /** Added by the admin editor. Properties without it show the illustrative plan. */
  floorPlans?: FloorPlan[];
}

export const ALL_PROPS: Prop[] = [
  { id:1, propId:"NB-001", badge:"Hot", title:"The Patan Residence", tagline:"Heritage Reimagined",
    location:"Jawlakhel, Lalitpur", district:"Lalitpur", price:"NPR 8.5 Cr", priceNum:85000000,
    listing:"For Sale", type:"House/Bungalow", beds:5, baths:4, builtArea:"4,850 sq.ft", landArea:"12 Ropani",
    roadAccess:"Black-topped 20ft", facing:"North-East", buildYear:2019, floors:3, verified:true, featured:true,
    hero:img("photo-1600596542815-ffad4c1539a9",1920,1080),
    gallery:[img("photo-1600596542815-ffad4c1539a9"),img("photo-1586023492125-27b2c045efd7"),img("photo-1631049307264-da0ec9d70304"),img("photo-1556909114-f6e7ad7d3136")],
    description:"A masterfully crafted contemporary residence in the heart of Lalitpur, blending the architectural legacy of the Kathmandu Valley with the refined sensibility of modern luxury living.",
    features:["Infinity Pool","Home Theater","Smart Home","Rooftop Garden","3-Car Garage","Staff Quarters","Wine Cellar","Solar Power","Earthquake Resistant","Marble","Balcony","Parking","Terrace","Master Bedroom","Modular Kitchen","Internet","Reserve Tank","Drinking Water"],
    mapX:55, mapY:48 },
  { id:2, propId:"NB-002", badge:"Featured", title:"Boudha Heights Penthouse", tagline:"Sanctuary Above the City",
    location:"Boudhanath, Kathmandu", district:"Kathmandu", price:"NPR 4.2 Cr", priceNum:42000000,
    listing:"For Sale", type:"Apartment", beds:3, baths:3, builtArea:"2,800 sq.ft", landArea:"—",
    roadAccess:"Black-topped 30ft", facing:"South", buildYear:2021, floors:1, verified:true, featured:true,
    hero:img("photo-1613977257363-707ba9348227",1920,1080),
    gallery:[img("photo-1613977257363-707ba9348227"),img("photo-1560185007-cde436f6a4d0"),img("photo-1586023492125-27b2c045efd7")],
    description:"Perched above the sacred Boudhanath stupa, this rare penthouse commands 270-degree views of the valley and distant Himalayan peaks.",
    features:["Panoramic Views","Private Terrace","Concierge","Smart Home","Wine Cellar","Balcony","Parking","Terrace","Master Bedroom","Modular Kitchen","Internet","Marble","Closet","Sofa"],
    mapX:61, mapY:34 },
  { id:3, propId:"NB-003", badge:"New", title:"Pokhara Lakeside Villa", tagline:"Himalayan Vistas & Serenity",
    location:"Lakeside, Pokhara", district:"Kaski", price:"NPR 12 Cr", priceNum:120000000,
    listing:"For Sale", type:"House/Bungalow", beds:6, baths:5, builtArea:"6,800 sq.ft", landArea:"18 Ropani",
    roadAccess:"Black-topped 16ft", facing:"East", buildYear:2020, floors:2, verified:true, featured:false,
    hero:img("photo-1600585154526-990dced4db0d",1920,1080),
    gallery:[img("photo-1600585154526-990dced4db0d"),img("photo-1568605114967-8130f3a36994"),img("photo-1631049307264-da0ec9d70304")],
    description:"A rare lakeside estate with direct Phewa Lake frontage and unobstructed Annapurna views. The pinnacle of refined living in Pokhara.",
    features:["Lakefront Access","Heated Pool","Boat Dock","Mountain Deck","Guest Cottage","Yoga Terrace","Earthquake Resistant","Parquet","Balcony","Parking","Terrace","Master Bedroom","Living Room","Dining Room","Internet","Drinking Water"],
    mapX:28, mapY:38 },
  { id:4, propId:"NB-004", badge:"Prime", title:"Godavari Forest Estate", tagline:"Nature Reserve Living",
    location:"Godavari, Lalitpur", district:"Lalitpur", price:"NPR 6.8 Cr", priceNum:68000000,
    listing:"For Sale", type:"Land", beds:0, baths:0, builtArea:"—", landArea:"25 Ropani",
    roadAccess:"Graveled 12ft", facing:"North", buildYear:0, floors:0, verified:true, featured:false,
    hero:img("photo-1512917774080-9991f1c4c750",1920,1080),
    gallery:[img("photo-1512917774080-9991f1c4c750"),img("photo-1500382017468-9049fed747ef")],
    description:"25 ropani of pristine forested land at the foot of the Godavari botanical reserve. Complete privacy and a profound connection to nature.",
    features:["Private Forest","Botanical Access","Spring Water","Trekking Trails","Development Ready","Drinking Water","Drainage","Parking","Reserve Tank"],
    mapX:68, mapY:56 },
  { id:5, propId:"NB-005", badge:"Verified", title:"Thamel Commercial Tower", tagline:"Urban Investment",
    location:"Thamel, Kathmandu", district:"Kathmandu", price:"NPR 15 Cr", priceNum:150000000,
    listing:"For Sale", type:"Commercial", beds:0, baths:6, builtArea:"8,200 sq.ft", landArea:"4 Ropani",
    roadAccess:"Black-topped 40ft", facing:"South-East", buildYear:2018, floors:5, verified:true, featured:false,
    hero:img("photo-1497366216548-37526070297c",1920,1080),
    gallery:[img("photo-1497366216548-37526070297c"),img("photo-1497366811353-6870744d04b2")],
    description:"A prime commercial building in Kathmandu's most cosmopolitan district. Fully tenanted with excellent rental yield.",
    features:["5 Floors","Elevator","Generator Backup","24/7 Security","Ground Floor Retail","4 Commercial Units","Earthquake Resistant","Parking","Drainage","Reserve Tank","Internet","Bathroom","Pantry"],
    mapX:48, mapY:30 },
  { id:6, propId:"NB-006", badge:"Rare", title:"Bhaktapur Heritage Villa", tagline:"Living Within History",
    location:"Suryabinayak, Bhaktapur", district:"Bhaktapur", price:"NPR 5.5 Cr", priceNum:55000000,
    listing:"For Sale", type:"House/Bungalow", beds:4, baths:4, builtArea:"3,800 sq.ft", landArea:"8 Ropani",
    roadAccess:"Black-topped 14ft", facing:"East", buildYear:2015, floors:3, verified:true, featured:false,
    hero:img("photo-1568605114967-8130f3a36994",1920,1080),
    gallery:[img("photo-1568605114967-8130f3a36994"),img("photo-1600596542815-ffad4c1539a9")],
    description:"A sensitively restored heritage villa near Bhaktapur's UNESCO-listed Durbar Square, blending Newari architecture with modern amenities.",
    features:["Heritage Architecture","Traditional Courtyard","Durbar Views","Restored Woodwork","Earthquake Resistant","Marble","Parquet","Balcony","Terrace","Master Bedroom","Living Room","Dining Room","Kitchen","Bathroom"],
    mapX:73, mapY:39 },
  { id:7, propId:"NB-007", badge:"Featured", title:"Jhamsikhel Luxury Flat", tagline:"Urban Elegance",
    location:"Jhamsikhel, Lalitpur", district:"Lalitpur", price:"NPR 85,000/mo", priceNum:85000,
    listing:"For Rent", type:"Flat", beds:3, baths:2, builtArea:"1,850 sq.ft", landArea:"—",
    roadAccess:"Black-topped 20ft", facing:"South", buildYear:2022, floors:1, verified:true, featured:true,
    hero:img("photo-1522708323590-d24dbb6b0267",1920,1080),
    gallery:[img("photo-1522708323590-d24dbb6b0267"),img("photo-1560448204-e02f11c3d0e2")],
    description:"A beautifully finished luxury flat in one of Lalitpur's most sought-after addresses. Fully furnished and ready to move in.",
    features:["Fully Furnished","Parking","Security","Gym Access","Balcony Views","Balcony","Modular Kitchen","Internet","Bed","Closet","Sofa","Dining Table","Bathroom"],
    mapX:59, mapY:44 },
  { id:8, propId:"NB-008", badge:"Verified", title:"Lazimpat Premium Apartment", tagline:"Diplomatic Quarter",
    location:"Lazimpat, Kathmandu", district:"Kathmandu", price:"NPR 1.2 L/mo", priceNum:120000,
    listing:"For Rent", type:"Apartment", beds:4, baths:3, builtArea:"2,400 sq.ft", landArea:"—",
    roadAccess:"Black-topped 30ft", facing:"North-East", buildYear:2020, floors:1, verified:true, featured:false,
    hero:img("photo-1560448204-e02f11c3d0e2",1920,1080),
    gallery:[img("photo-1560448204-e02f11c3d0e2"),img("photo-1555041469-a586c61ea9bc")],
    description:"Premium 4-bedroom apartment in Kathmandu's prestigious diplomatic quarter. Minutes from embassies and international schools.",
    features:["4 Bedrooms","Gym","Swimming Pool","24/7 Concierge","International Kitchen","Balcony","Parking","Terrace","Master Bedroom","Living Room","Modular Kitchen","Internet","Closet","Sofa"],
    mapX:44, mapY:40 },
  { id:9, propId:"NB-009", badge:"New", title:"Budhanilkantha Villa", tagline:"Quiet Hilltop Retreat",
    location:"Budhanilkantha, Kathmandu", district:"Kathmandu", price:"NPR 95,000/mo", priceNum:95000,
    listing:"For Rent", type:"House/Bungalow", beds:5, baths:4, builtArea:"4,200 sq.ft", landArea:"6 Ropani",
    roadAccess:"Black-topped 16ft", facing:"South", buildYear:2017, floors:3, verified:false, featured:false,
    hero:img("photo-1580587771525-78b9dba3b914",1920,1080),
    gallery:[img("photo-1580587771525-78b9dba3b914"),img("photo-1568605114967-8130f3a36994")],
    description:"A tranquil hilltop villa above the city, offering complete privacy and sweeping valley views. Ideal for families seeking space and calm.",
    features:["Garden","Parking for 4","Generator","Water Tank","Mountain Views","Earthquake Resistant","Parking","Terrace","Balcony","Reserve Tank","Drinking Water","Kitchen","Bathroom","Living Room"],
    mapX:57, mapY:22 },
  { id:10, propId:"NB-010", badge:"Hot", title:"Durbar Marg Office Suite", tagline:"Premier Business Address",
    location:"Durbar Marg, Kathmandu", district:"Kathmandu", price:"NPR 2.5 L/mo", priceNum:250000,
    listing:"For Rent", type:"Commercial", beds:0, baths:2, builtArea:"3,500 sq.ft", landArea:"—",
    roadAccess:"Black-topped 40ft", facing:"East", buildYear:2016, floors:1, verified:true, featured:true,
    hero:img("photo-1497366811353-6870744d04b2",1920,1080),
    gallery:[img("photo-1497366811353-6870744d04b2"),img("photo-1497366216548-37526070297c")],
    description:"Full-floor office suite on Kathmandu's most prestigious commercial address. Perfect for corporate headquarters and premium businesses.",
    features:["3,500 sq.ft Open Plan","Board Room","Reception Area","Pantry","High-speed Internet","Parking","Drainage","Reserve Tank","Internet","Bathroom"],
    mapX:69, mapY:27 },
  { id:11, propId:"NB-011", badge:"Verified", title:"Pulchowk Modern Flat", tagline:"City Centre Living",
    location:"Pulchowk, Lalitpur", district:"Lalitpur", price:"NPR 45,000/mo", priceNum:45000,
    listing:"For Rent", type:"Flat", beds:2, baths:1, builtArea:"950 sq.ft", landArea:"—",
    roadAccess:"Black-topped 20ft", facing:"West", buildYear:2023, floors:1, verified:true, featured:false,
    hero:img("photo-1555041469-a586c61ea9bc",1920,1080),
    gallery:[img("photo-1555041469-a586c61ea9bc"),img("photo-1522708323590-d24dbb6b0267")],
    description:"A modern 2-bedroom flat in vibrant Pulchowk. Walking distance to restaurants, cafes and the Lalitpur commercial district.",
    features:["Modern Interiors","Covered Parking","Security","Balcony","WiFi Ready","Parking","Modular Kitchen","Internet","Bed","Closet","Bathroom"],
    mapX:36, mapY:52 },
  { id:12, propId:"NB-012", badge:"New", title:"Sauraha Riverside Retreat", tagline:"Nature at Your Doorstep",
    location:"Sauraha, Chitwan", district:"Chitwan", price:"NPR 3.2 Cr", priceNum:32000000,
    listing:"For Sale", type:"House/Bungalow", beds:4, baths:3, builtArea:"3,200 sq.ft", landArea:"15 Ropani",
    roadAccess:"Graveled 14ft", facing:"South", buildYear:2021, floors:2, verified:false, featured:false,
    // Was photo-1507003211169, a studio portrait of a man (also used as a
    // testimonial avatar), so this listing led with a stranger's face.
    hero:img("photo-1520250497591-112f2f40a3f4",1920,1080),
    gallery:[img("photo-1520250497591-112f2f40a3f4"),img("photo-1582719478250-c89cae4dc85b"),img("photo-1500382017468-9049fed747ef")],
    description:"An extraordinary riverside retreat at the edge of the Chitwan National Park. Wake up to jungle sounds and sunset river views every day.",
    features:["River Frontage","Private Garden","Nature Trails","Open Verandah","Jungle Views","Earthquake Resistant","Drinking Water","Parking","Terrace","Living Room","Dining Room","Kitchen","Bathroom"],
    mapX:45, mapY:65 },
];

export const PROP_TYPES = ["All Types","House/Bungalow","Land","Apartment","Commercial","Flat"];
export const PRICE_RANGES: Record<"For Sale"|"For Rent", {label:string;min:number;max:number}[]> = {
  "For Sale": [
    { label:"Any Price", min:0, max:Infinity },
    { label:"Under 5 Cr", min:0, max:50000000 },
    { label:"5 - 10 Cr", min:50000000, max:100000000 },
    { label:"Above 10 Cr", min:100000000, max:Infinity },
  ],
  "For Rent": [
    { label:"Any Price", min:0, max:Infinity },
    { label:"Under 1 Lakh", min:0, max:100000 },
    { label:"1 - 2 Lakh", min:100000, max:200000 },
    { label:"Above 2 Lakh", min:200000, max:Infinity },
  ],
};

// ─── Vocabulary for the admin dropdowns ───────────────────────────────────────
// Every value below is what gets stored. The API should accept exactly these strings.

export const LISTINGS: Listing[] = ["For Sale", "For Rent"];
/** PROP_TYPES without the "All Types" filter option. */
export const PROPERTY_TYPES = PROP_TYPES.filter(t => t !== "All Types");
export const BADGES = ["Hot", "Featured", "New", "Prime", "Rare", "Verified", "Exclusive"];
export const FACINGS = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
export const ROAD_SURFACES = ["Black-topped", "Concrete", "Graveled", "Earthen"];
/** Nepali land units first, then square feet. */
export const LAND_UNITS = ["Ropani", "Aana", "Bigha", "Kattha", "Dhur", "sq.ft"];
export const BUILT_UNITS = ["sq.ft", "sq.m"];
export const FLOOR_LABELS = ["Basement", "Ground Floor", "First Floor", "Second Floor", "Third Floor", "Fourth Floor", "Fifth Floor", "Rooftop"];
export const ROOM_NAMES = [
  "Living Room", "Dining Room", "Kitchen", "Master Bedroom", "Bedroom", "Guest Room", "Kids Room",
  "Bathroom", "Attached Bathroom", "Puja Room", "Study", "Store Room", "Laundry", "Balcony",
  "Terrace", "Garage", "Office", "Shop", "Hall", "Reception", "Staff Room",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The display price, from the number in rupees. Matches the seeded strings exactly:
 * 85000000 → "NPR 8.5 Cr", 120000 for rent → "NPR 1.2 L/mo", 85000 for rent → "NPR 85,000/mo".
 */
export function formatPrice(priceNum: number, listing: Listing): string {
  const CR = 10_000_000, LAKH = 100_000;
  const short = (n: number) => String(Math.round(n * 100) / 100);
  const rent = listing === "For Rent";
  let body: string;
  if (priceNum >= CR) body = `${short(priceNum / CR)} Cr`;
  else if (priceNum >= LAKH) body = `${short(priceNum / LAKH)} ${rent ? "L" : "Lakh"}`;
  else body = priceNum.toLocaleString("en-IN");
  return `NPR ${body}${rent ? "/mo" : ""}`;
}

/** Next numeric id and the next "NB-013"-style reference. The API assigns both once it exists. */
export const nextPropertyId = () => ALL_PROPS.reduce((m, p) => Math.max(m, p.id), 0) + 1;
export function nextPropRef(): string {
  const n = ALL_PROPS.reduce((m, p) => Math.max(m, Number(p.propId.replace(/\D/g, "")) || 0), 0) + 1;
  return `NB-${String(n).padStart(3, "0")}`;
}

/** Create or update. API: POST /admin/properties (new) or PATCH /admin/properties/:id. */
export function saveProperty(p: Prop): void {
  const i = ALL_PROPS.findIndex(x => x.id === p.id);
  if (i >= 0) ALL_PROPS[i] = p; else ALL_PROPS.unshift(p);
  emitChange();
}

/** Put a deleted property back where it was (the admin's Undo). API: re-create it, or soft-delete instead. */
export function restoreProperty(p: Prop, index: number): void {
  if (ALL_PROPS.some(x => x.id === p.id)) return;
  ALL_PROPS.splice(Math.min(Math.max(index, 0), ALL_PROPS.length), 0, p);
  emitChange();
}

/** API: DELETE /admin/properties/:id. The site needs at least one listing, so the last one stays. */
export function deleteProperty(id: number): boolean {
  if (ALL_PROPS.length <= 1) return false;
  const i = ALL_PROPS.findIndex(x => x.id === id);
  if (i < 0) return false;
  ALL_PROPS.splice(i, 1);
  emitChange();
  return true;
}
