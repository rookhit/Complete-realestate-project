import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Menu, X, MapPin, ArrowRight, Search, ChevronDown, ChevronLeft, ChevronRight,
  Phone, Mail, MessageCircle, Send, Bed, Bath, Square, Share2, Heart,
  Play, Filter, Grid3X3, List as ListIcon, Map, Calculator, Star,
  Building2, Home, Landmark, Briefcase, Layers, CheckCircle2, Award,
  Instagram, Facebook, Youtube, Linkedin, Globe, MessageSquare, ZoomIn,
  SlidersHorizontal, RotateCcw, User, Users, FileText, PlusCircle,
  Eye, EyeOff, Upload, Trash2, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  Settings, Subtitles, Check,
} from "lucide-react";
import logoImg from "@/imports/image.png";
import { DISTRICTS, PROVINCE_OF, searchDistricts } from "@/app/data/districts";
import { AMENITIES, AMENITY_GROUPS, amenityIcon } from "@/app/icons/amenities";
import { API_URL, ApiError, AuthProvider, authFetch, useAuth } from "@/app/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
type Page =
  | "home" | "buy" | "rent" | "property" | "hot" | "new-listings"
  | "about" | "blog" | "blog-post" | "services" | "emi" | "contact"
  | "login" | "register" | "free-listing" | "area" | "videos" | "map" | "admin";

type NavOpts = {
  type?: string; district?: string; view?: "list"|"grid"|"map";
  preset?: "hot"|"new"; scrollTo?: string; blog?: number;
};
type Go = (p: Page, o?: NavOpts) => void;

// ─── Brand ────────────────────────────────────────────────────────────────────
const BG_DARK   = "#0e0d0b";
const BG_LIGHT  = "#f7f3ed";
const FG_DARK   = "#f0ebe0";
const FG_LIGHT  = "#1a1611";
const CREAM     = "#f7f3ed";
const WHITE     = "#ffffff";
const MAROON    = "#8a2030";
const GOLD      = "#b08848";
const GOLD_DIM  = "rgba(176,136,72,0.45)";
const MUTED_D   = "#7a7060";
const MUTED_L   = "#6b6154";
const BORDER_L  = "rgba(26,22,17,0.1)";
const BORDER_D  = "rgba(240,235,224,0.08)";

const serif = { fontFamily: "'Gloock', Georgia, serif" } as const;
const sans  = { fontFamily: "'Jost', system-ui, sans-serif" } as const;
const img   = (id: string, w = 1200, h = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format`;

// ─── Mock Data ────────────────────────────────────────────────────────────────
interface Prop {
  id: number; propId: string; badge: string; title: string; tagline: string;
  location: string; district: string; price: string; priceNum: number;
  listing: "For Sale" | "For Rent"; type: string;
  beds: number; baths: number; builtArea: string; landArea: string;
  roadAccess: string; facing: string; buildYear: number; floors: number;
  verified: boolean; featured: boolean;
  hero: string; gallery: string[]; description: string; features: string[];
  mapX: number; mapY: number;
}

const ALL_PROPS: Prop[] = [
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
    hero:img("photo-1507003211169-0a1dd7228f2d",1920,1080),
    gallery:[img("photo-1507003211169-0a1dd7228f2d"),img("photo-1500382017468-9049fed747ef")],
    description:"An extraordinary riverside retreat at the edge of the Chitwan National Park. Wake up to jungle sounds and sunset river views every day.",
    features:["River Frontage","Private Garden","Nature Trails","Open Verandah","Jungle Views","Earthquake Resistant","Drinking Water","Parking","Terrace","Living Room","Dining Room","Kitchen","Bathroom"],
    mapX:45, mapY:65 },
];

const BLOGS = [
  { id:1, cat:"Market Update", date:"May 2025", read:"6 min", title:"Nepal Real Estate Rebounds: Q1 2025 Market Report",
    excerpt:"After a cautious 2024, Nepal's property market has shown strong signs of recovery in Q1 2025, with Kathmandu Valley recording a 14% uptick in premium transactions.",
    image:img("photo-1544735716-392fe2489ffa",800,500), author:"Arjun Thapa" },
  { id:2, cat:"Buyer's Guide", date:"Apr 2025", read:"8 min", title:"How to Buy Property in Nepal: The Complete 2025 Guide",
    excerpt:"From land registration to bank financing, we break down every step of the property purchase process in Nepal in plain language.",
    image:img("photo-1512917774080-9991f1c4c750",800,500), author:"Priya Shrestha" },
  { id:3, cat:"Investment", date:"Mar 2025", read:"5 min", title:"Pokhara International Airport: What It Means for Property Prices",
    excerpt:"Pokhara's new international airport has catalyzed a significant shift in property values across the western region. Here's what investors need to know.",
    image:img("photo-1600585154526-990dced4db0d",800,500), author:"Rajan Maharjan" },
  { id:4, cat:"Vastu", date:"Feb 2025", read:"4 min", title:"Vastu Shastra for Modern Homes: Principles That Still Work",
    excerpt:"Ancient Vastu principles continue to influence homebuying decisions in Nepal. Our consultants explain which guidelines genuinely improve living quality.",
    image:img("photo-1600596542815-ffad4c1539a9",800,500), author:"Sita Karki" },
];

const TESTIMONIALS = [
  { name:"Bijay Shrestha", role:"Property Buyer, Kathmandu", rating:5, text:"Nepal Bhoomi helped us find our dream home in Lalitpur within 3 weeks. Their knowledge of the market and genuine care for our needs was exceptional.", img:img("photo-1560250097-0b93528c311a",200,200) },
  { name:"Anita Gurung", role:"Property Investor, Pokhara", rating:5, text:"As an NRN investing from abroad, Nepal Bhoomi's advisory team guided us through every legal and financial step. Complete transparency throughout.", img:img("photo-1580489944761-15a19d674349",200,200) },
  { name:"Dr. Ramesh Poudel", role:"Commercial Buyer, Lalitpur", rating:5, text:"Purchased a commercial property through Nepal Bhoomi. Their valuation was spot-on and the transaction was completed without a single hitch. Highly recommended.", img:img("photo-1507003211169-0a1dd7228f2d",200,200) },
];

// Every district in Nepal. Was a 9-item hand-picked list.
const AREAS = DISTRICTS;
const PROP_TYPES = ["All Types","House/Bungalow","Land","Apartment","Commercial","Flat"];
const PRICE_RANGES: Record<"For Sale"|"For Rent", {label:string;min:number;max:number}[]> = {
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
const SERVICES_LIST = [
  { icon:<Home size={22}/>, title:"Property Sales", desc:"Full-service representation for residential and commercial property transactions across Nepal." },
  { icon:<Layers size={22}/>, title:"Letting", desc:"Specialist letting advisory for landlords and tenants seeking premium rental properties." },
  { icon:<Briefcase size={22}/>, title:"Property Consulting", desc:"Expert market analysis, investment advisory and portfolio strategy for all property types." },
  { icon:<Award size={22}/>, title:"Vastu Advisory", desc:"Authentic Vastu Shastra assessment and consultation for new constructions and existing properties." },
  { icon:<Building2 size={22}/>, title:"Construction Works", desc:"End-to-end construction project management for residential and commercial developments." },
  { icon:<Landmark size={22}/>, title:"Engineering Consulting", desc:"Structural, civil and MEP engineering consulting for projects of all scales across Nepal." },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
const Tag = ({ c, children }: { c?: string; children: React.ReactNode }) => (
  <span className="text-[10px] tracking-[0.34em] uppercase" style={{ color: c ?? GOLD, ...sans }}>{children}</span>
);
const GoldLine = () => <div style={{ width:"2rem", height:"0.5px", background:GOLD }} />;
const SectionTitle = ({ tag, h, dark=true }: { tag:string; h:string; dark?:boolean }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-3"><GoldLine /><Tag>{tag}</Tag></div>
    <h2 className="leading-[0.93]" style={{ color:dark?FG_DARK:FG_LIGHT, ...serif, fontSize:"clamp(2.2rem,4.4vw,4rem)" }}>{h}</h2>
  </div>
);
const PillBtn = ({ active, onClick, children }: { active?:boolean; onClick?:()=>void; children:React.ReactNode }) => (
  <button onClick={onClick}
    className="flex items-center gap-1.5 px-5 py-2.5 text-[12px] tracking-[0.15em] border transition-all duration-200 whitespace-nowrap"
    style={{ borderRadius:"9999px", borderColor:active?"transparent":BORDER_L, background:active?"#1a1611":"transparent", color:active?WHITE:FG_LIGHT, ...sans }}>
    {children}
  </button>
);
const StatusBadge = ({ verified, featured }: { verified:boolean; featured:boolean }) => (
  <div className="flex gap-1.5">
    {featured && <span className="px-2 py-0.5 text-[10px] tracking-[0.25em] uppercase" style={{ background:MAROON, color:WHITE, ...sans }}>Featured</span>}
    {verified && <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-[0.2em] uppercase" style={{ background:"rgba(176,136,72,0.15)", color:GOLD, ...sans }}><CheckCircle2 size={11}/>Verified</span>}
  </div>
);

// ─── Shared inputs ────────────────────────────────────────────────────────────

/** Password field with a show/hide eye. */
function PasswordInput({ value, onChange, placeholder="********", onEnter, autoComplete }: {
  value:string; onChange:(v:string)=>void; placeholder?:string; onEnter?:()=>void; autoComplete?:string;
}) {
  const [show,setShow]=useState(false);
  return (
    <div className="relative">
      <input
        type={show?"text":"password"}
        value={value}
        autoComplete={autoComplete}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>{ if(e.key==="Enter"&&onEnter) onEnter(); }}
        placeholder={placeholder}
        className="w-full border pl-4 pr-12 py-3 text-[15px] outline-none transition-all focus:border-[#8a2030]"
        style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}
      />
      <button
        type="button"
        onClick={()=>setShow(s=>!s)}
        aria-label={show?"Hide password":"Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 transition-colors hover:text-[#8a2030]"
        style={{color:MUTED_L}}
      >
        {show?<EyeOff size={16}/>:<Eye size={16}/>}
      </button>
    </div>
  );
}

/**
 * District typeahead over all 77 districts.
 *
 * Typing "g" lists every district starting with G before any that merely
 * contain it, and the alias table means "pokhara" finds Kaski. Full keyboard
 * support: arrows move, Enter picks, Escape closes.
 */
function DistrictCombobox({ value, onChange, placeholder="Type a district...", dark=false }: {
  value:string; onChange:(v:string)=>void; placeholder?:string; dark?:boolean;
}) {
  const [query,setQuery]=useState(value);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const wrapRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ setQuery(value); },[value]);

  useEffect(()=>{
    const onDocDown=(e:MouseEvent)=>{
      if(wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown",onDocDown);
    return ()=>document.removeEventListener("mousedown",onDocDown);
  },[]);

  const results=searchDistricts(query,8);
  const fg=dark?FG_DARK:FG_LIGHT;
  const muted=dark?MUTED_D:MUTED_L;
  const border=dark?BORDER_D:BORDER_L;
  const panelBg=dark?"#14120f":WHITE;

  const pick=(d:string)=>{ onChange(d); setQuery(d); setOpen(false); };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2.5 border px-4" style={{borderColor:border}}>
        <MapPin size={15} style={{color:GOLD,flexShrink:0}}/>
        <input
          value={query}
          onChange={e=>{ setQuery(e.target.value); setActive(0); setOpen(true); if(e.target.value==="") onChange(""); }}
          onFocus={()=>setOpen(true)}
          onKeyDown={e=>{
            if(e.key==="ArrowDown"){ e.preventDefault(); setOpen(true); setActive(a=>Math.min(a+1,results.length-1)); }
            else if(e.key==="ArrowUp"){ e.preventDefault(); setActive(a=>Math.max(a-1,0)); }
            else if(e.key==="Enter"){ if(open&&results[active]){ e.preventDefault(); pick(results[active]); } }
            else if(e.key==="Escape"){ setOpen(false); }
          }}
          placeholder={placeholder}
          role="combobox" aria-expanded={open} aria-autocomplete="list"
          className="flex-1 bg-transparent py-3 text-[15px] outline-none"
          style={{color:fg,...sans}}
        />
        {query && (
          <button type="button" onClick={()=>{ setQuery(""); onChange(""); setOpen(true); }} aria-label="Clear district" className="p-1" style={{color:muted}}>
            <X size={14}/>
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && results.length>0 && (
          <motion.ul
            initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}}
            transition={{duration:0.14}}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto border shadow-lg"
            style={{background:panelBg,borderColor:border}}
            role="listbox"
          >
            {results.map((d,i)=>(
              <li key={d}>
                <button
                  type="button"
                  onMouseEnter={()=>setActive(i)}
                  onClick={()=>pick(d)}
                  role="option" aria-selected={i===active}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{ background: i===active ? (dark?"rgba(176,136,72,0.12)":"#f7f3ed") : "transparent" }}
                >
                  <span className="text-[14px]" style={{color:fg,...sans}}>{d}</span>
                  <span className="text-[10px] tracking-[0.18em] uppercase" style={{color:muted,...sans}}>{PROVINCE_OF[d]}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
        {open && results.length===0 && (
          <motion.div
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="absolute left-0 right-0 top-full z-50 mt-1 border px-4 py-3 shadow-lg"
            style={{background:panelBg,borderColor:border}}
          >
            <span className="text-[14px]" style={{color:muted,...sans}}>No district matches &ldquo;{query}&rdquo;</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Multi-image picker with drag-and-drop, previews and removal. */
type PickedImage = { id:string; file:File; url:string };

function ImageUpload({ images, onChange, max=12 }: {
  images:PickedImage[]; onChange:(next:PickedImage[])=>void; max?:number;
}) {
  const inputRef=useRef<HTMLInputElement>(null);
  const [dragging,setDragging]=useState(false);
  const [error,setError]=useState("");

  // Object URLs are leaked unless revoked; do it when the component unmounts.
  useEffect(()=>()=>{ images.forEach(i=>URL.revokeObjectURL(i.url)); },[]);

  const add=(fileList:FileList|null)=>{
    if(!fileList) return;
    const incoming=Array.from(fileList).filter(f=>f.type.startsWith("image/"));
    if(incoming.length===0){ setError("Those files are not images."); return; }
    const room=max-images.length;
    if(room<=0){ setError(`You can upload up to ${max} images.`); return; }
    const tooBig=incoming.find(f=>f.size>8*1024*1024);
    if(tooBig){ setError(`"${tooBig.name}" is over 8 MB.`); return; }
    setError(incoming.length>room ? `Only the first ${room} were added (limit ${max}).` : "");
    const next=incoming.slice(0,room).map(f=>({
      id:`${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2,7)}`,
      file:f,
      url:URL.createObjectURL(f),
    }));
    onChange([...images,...next]);
  };

  const remove=(id:string)=>{
    const gone=images.find(i=>i.id===id);
    if(gone) URL.revokeObjectURL(gone.url);
    onChange(images.filter(i=>i.id!==id));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={e=>{ e.preventDefault(); setDragging(true); }}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{ e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
        onClick={()=>inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 border border-dashed px-6 py-10 cursor-pointer transition-colors"
        style={{ borderColor: dragging?MAROON:BORDER_L, background: dragging?"rgba(138,32,48,0.04)":"transparent" }}
      >
        <Upload size={22} style={{color:GOLD}}/>
        <p className="text-[14px]" style={{color:FG_LIGHT,...sans}}>
          Drag photos here, or <span style={{color:MAROON}}>browse</span>
        </p>
        <p className="text-[12px]" style={{color:MUTED_L,...sans}}>
          JPG or PNG, up to 8&nbsp;MB each. {images.length}/{max} added.
        </p>
        <input
          ref={inputRef} type="file" accept="image/*" multiple hidden
          onChange={e=>{ add(e.target.files); e.target.value=""; }}
        />
      </div>

      {error && <p className="text-[13px]" style={{color:MAROON,...sans}}>{error}</p>}

      {images.length>0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((img,i)=>(
            <div key={img.id} className="relative group overflow-hidden" style={{aspectRatio:"4/3"}}>
              <img src={img.url} alt={`Upload ${i+1}`} className="w-full h-full object-cover"/>
              {i===0 && (
                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase" style={{background:MAROON,color:WHITE,...sans}}>Cover</span>
              )}
              <button
                type="button" onClick={()=>remove(img.id)} aria-label={`Remove image ${i+1}`}
                className="absolute top-1.5 right-1.5 p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                style={{background:"rgba(10,9,8,0.72)",color:WHITE}}
              >
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen({ onDone }: { onDone:()=>void }) {
  useEffect(()=>{ const t=setTimeout(onDone,2600); return ()=>clearTimeout(t); },[onDone]);
  return (
    <motion.div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden" style={{background:"#0a0908"}}
      exit={{ clipPath:"inset(0 0 100% 0)", transition:{duration:1.05,ease:[0.76,0,0.24,1]} }}>
      <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)'/%3E%3C/svg%3E")`,backgroundSize:"192px 192px"}} />
      <motion.div className="absolute left-0 right-0" style={{top:"50%",height:"0.5px",background:"rgba(138,32,48,0.5)",transformOrigin:"left center"}} initial={{scaleX:0}} animate={{scaleX:1}} transition={{duration:1.8,ease:[0.16,1,0.3,1],delay:0.1}} />
      <motion.div className="absolute top-0 bottom-0" style={{left:"50%",width:"0.5px",background:"rgba(176,136,72,0.28)",transformOrigin:"top center"}} initial={{scaleY:0}} animate={{scaleY:1}} transition={{duration:1.8,ease:[0.16,1,0.3,1],delay:0.3}} />
      <div className="relative flex flex-col items-center gap-6">
        <motion.div className="relative" initial={{opacity:0,scale:0.88}} animate={{opacity:1,scale:1}} transition={{duration:1.2,ease:[0.16,1,0.3,1],delay:0.5}}>
          {["top-0 left-0 border-t border-l","top-0 right-0 border-t border-r","bottom-0 left-0 border-b border-l","bottom-0 right-0 border-b border-r"].map((c,i)=>(
            <motion.div key={i} className={`absolute -inset-5 ${c} w-4 h-4`} style={{borderColor:GOLD_DIM}} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.9+i*0.07}} />
          ))}
          <img src={logoImg} alt="Nepal Bhoomi" className="w-20 h-20 object-contain" />
        </motion.div>
        <motion.p className="text-[10px] tracking-[0.38em] uppercase" style={{color:MUTED_D,...sans}} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:1.05}}>Luxury Real Estate · Nepal</motion.p>
        <motion.div style={{width:"0.5px",background:GOLD_DIM}} initial={{height:0,opacity:0}} animate={{height:44,opacity:1}} transition={{delay:1.5,duration:0.8}} />
      </div>
    </motion.div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ page, go }: { page:Page; go:Go }) {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const signOut = () => { setMenu(false); void logout().then(()=>go("home")); };
  const [dropdown, setDropdown] = useState<string|null>(null);
  useEffect(()=>{ const fn=()=>setScrolled(window.scrollY>56); window.addEventListener("scroll",fn,{passive:true}); return ()=>window.removeEventListener("scroll",fn); },[]);
  useEffect(()=>{ document.body.style.overflow = menu ? "hidden" : ""; return ()=>{ document.body.style.overflow=""; }; },[menu]);
  const sub = (type:string, listing:"For Sale"|"For Rent") => {
    go(listing==="For Sale"?"buy":"rent",{type}); setDropdown(null); setMenu(false);
  };
  const subItems = ["House/Bungalow","Land","Apartment","Commercial","Flat"];
  const navLinks = [
    { label:"Buy", page:"buy" as Page, items:subItems.map(s=>({label:s,action:()=>sub(s,"For Sale")})) },
    { label:"Rent", page:"rent" as Page, items:subItems.map(s=>({label:s,action:()=>sub(s,"For Rent")})) },
    { label:"Blog", page:"blog" as Page },
    { label:"Services", page:"services" as Page },
    { label:"About", page:"about" as Page },
    { label:"Contact", page:"contact" as Page },
  ];
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-400"
        style={{ background: scrolled||page!=="home"?"#0a0908":"transparent", borderBottom:scrolled||page!=="home"?`1px solid ${BORDER_D}`:"1px solid transparent", backdropFilter:scrolled?"blur(20px)":"none" }}>
        <div className="flex items-center gap-7 px-6 md:px-12 lg:px-20 h-20">
          {/* Logo */}
          <button onClick={()=>go("home")} className="flex items-center gap-2.5 shrink-0">
            <img src={logoImg} alt="NB" className="h-8 w-8 object-contain" />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-[14px] tracking-[0.2em] uppercase" style={{color:FG_DARK,...sans,fontWeight:500}}>Nepal Bhoomi</span>
              <span className="text-[9px] tracking-[0.28em] uppercase" style={{color:MUTED_D,...sans}}>Estate Agents</span>
            </div>
          </button>
          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1 ml-4">
            {navLinks.map(n => (
              <div key={n.label} className="relative" onMouseEnter={()=>n.items&&setDropdown(n.label)} onMouseLeave={()=>setDropdown(null)}>
                <button onClick={()=>n.page&&go(n.page)}
                  className="group/nav relative flex items-center gap-1 px-3 py-2 text-[12px] tracking-[0.2em] uppercase transition-colors"
                  style={{color:page===(n.page)?GOLD:"rgba(240,235,224,0.72)",...sans}}>
                  {n.label}{n.items&&<ChevronDown size={13} className="transition-transform duration-300 group-hover/nav:rotate-180"/>}
                  {/* Same gesture as the district tiles: a gold rule that grows
                      out from the centre on hover and retracts on leave. */}
                  <span
                    className={`pointer-events-none absolute left-1/2 bottom-0.5 h-px -translate-x-1/2 transition-all duration-400 ease-out group-hover/nav:w-[calc(100%-1.5rem)] ${page===(n.page)?"w-[calc(100%-1.5rem)]":"w-0"}`}
                    style={{ background: GOLD }}
                  />
                </button>
                {n.items&&dropdown===n.label&&(
                  <motion.div className="absolute top-full left-0 w-52 border py-2 z-50"
                    style={{background:"#0a0908",borderColor:BORDER_D}}
                    initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} transition={{duration:0.15}}>
                    <button className="w-full flex items-center px-4 py-2 text-[12px] text-left transition-colors hover:text-accent"
                      style={{color:"rgba(240,235,224,0.5)",...sans}} onClick={()=>{go(n.label.toLowerCase() as Page);setDropdown(null);}}>
                      All {n.label} Properties
                    </button>
                    <div className="mx-4 my-1" style={{height:"0.5px",background:BORDER_D}} />
                    {n.items.map(it=>(
                      <button key={it.label} onClick={it.action}
                        className="w-full flex items-center px-4 py-2 text-[12px] text-left transition-colors hover:text-accent"
                        style={{color:"rgba(240,235,224,0.72)",...sans}}>
                        {it.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            ))}
            <button onClick={()=>go("emi")} className="group/nav relative flex items-center gap-1.5 px-3 py-2 text-[12px] tracking-[0.2em] uppercase transition-colors" style={{color:page==="emi"?GOLD:"rgba(240,235,224,0.72)",...sans}}>
              <Calculator size={14}/>EMI
              <span
                className={`pointer-events-none absolute left-1/2 bottom-0.5 h-px -translate-x-1/2 transition-all duration-400 ease-out group-hover/nav:w-[calc(100%-1.5rem)] ${page==="emi"?"w-[calc(100%-1.5rem)]":"w-0"}`}
                style={{ background: GOLD }}
              />
            </button>
          </div>
          {/* Right side */}
          <div className="hidden lg:flex items-center gap-3 ml-auto">
            <button onClick={()=>go("free-listing")} className="flex items-center gap-1.5 px-4 py-2 text-[11px] tracking-[0.2em] uppercase border transition-all hover:border-accent"
              style={{color:FG_DARK,borderColor:GOLD_DIM,...sans}}><PlusCircle size={14}/>Free Listing</button>
            {user ? (<>
              {user.role==="ADMIN"&&<button onClick={()=>go("admin")} className="flex items-center gap-1.5 px-4 py-2 text-[11px] tracking-[0.2em] uppercase border transition-all hover:border-accent" style={{color:page==="admin"?GOLD:FG_DARK,borderColor:GOLD_DIM,...sans}}><Settings size={14}/>Admin</button>}
              <span className="flex items-center gap-1.5 px-2 text-[12px] max-w-[180px] truncate" title={user.email} style={{color:"rgba(240,235,224,0.72)",...sans}}><User size={14}/>{user.name||user.email}</span>
              <button onClick={signOut} className="px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition-colors hover:text-accent" style={{color:"rgba(240,235,224,0.72)",...sans}}>Logout</button>
            </>) : (<>
              <button onClick={()=>go("login")} className="px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition-colors hover:text-accent" style={{color:"rgba(240,235,224,0.72)",...sans}}>Login</button>
              <button onClick={()=>go("register")} className="px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Register</button>
            </>)}
          </div>
          <button onClick={()=>setMenu(!menu)} className="lg:hidden ml-auto p-1" style={{color:FG_DARK}}>
            {menu?<X size={20}/>:<Menu size={20}/>}
          </button>
        </div>
      </nav>
      {/* Mobile menu */}
      <AnimatePresence>
        {menu&&(
          <motion.div className="fixed inset-0 z-40 flex flex-col pt-20 overflow-y-auto"
            style={{background:"rgba(10,9,8,0.98)",backdropFilter:"blur(24px)"}}
            initial={{opacity:0,clipPath:"inset(0 0 100% 0)"}} animate={{opacity:1,clipPath:"inset(0 0 0% 0)"}} exit={{opacity:0,clipPath:"inset(0 0 100% 0)"}} transition={{duration:0.4}}>
            <div className="flex flex-col px-8 py-6 gap-0">
              {[{l:"Buy",p:"buy"},{l:"Rent",p:"rent"},{l:"Blog",p:"blog"},{l:"Services",p:"services"},{l:"About",p:"about"},{l:"Contact",p:"contact"},{l:"EMI Calculator",p:"emi"},...(user?.role==="ADMIN"?[{l:"Admin",p:"admin"}]:[])].map((n,i)=>(
                <motion.button key={n.l} onClick={()=>{go(n.p as Page);setMenu(false);}} className="text-3xl py-5 border-b text-left flex items-center justify-between group"
                  style={{color:FG_DARK,borderColor:BORDER_D,...serif}} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{delay:i*0.06+0.1}}>
                  {n.l}<ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{color:GOLD}}/>
                </motion.button>
              ))}
            </div>
            <div className="px-8 py-6 flex gap-3 mt-auto border-t" style={{borderColor:BORDER_D}}>
              {user ? (<>
                <span className="flex-1 py-3 text-[13px] truncate" style={{color:FG_DARK,...sans}}>{user.name||user.email}</span>
                <button onClick={signOut} className="flex-1 py-3 text-[12px] tracking-[0.2em] uppercase border" style={{color:FG_DARK,borderColor:BORDER_D,...sans}}>Logout</button>
              </>) : (<>
                <button onClick={()=>{go("login");setMenu(false);}} className="flex-1 py-3 text-[12px] tracking-[0.2em] uppercase border" style={{color:FG_DARK,borderColor:BORDER_D,...sans}}>Login</button>
                <button onClick={()=>{go("register");setMenu(false);}} className="flex-1 py-3 text-[12px] tracking-[0.2em] uppercase" style={{background:MAROON,color:WHITE,...sans}}>Register</button>
              </>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ go }: { go:Go }) {
  return (
    <footer style={{background:"#060504"}}>
      <div className="px-6 md:px-12 lg:px-20 py-20 md:py-24 border-b" style={{borderColor:BORDER_D}}>
        <p className="max-w-2xl leading-snug" style={{color:FG_DARK,...serif,fontSize:"clamp(1.7rem,3.2vw,2.9rem)"}}>
          "Nepal's finest addresses, curated for those who understand that a home is the most significant statement a person makes."
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-14 px-6 md:px-12 lg:px-20 py-16 border-b" style={{borderColor:BORDER_D}}>
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <img src={logoImg} alt="NB" className="h-9 w-9 object-contain"/>
            <div><div className="text-[14px] tracking-[0.2em] uppercase" style={{color:FG_DARK,...sans,fontWeight:500}}>Nepal Bhoomi</div><div className="text-[9px] tracking-[0.28em] uppercase" style={{color:MUTED_D,...sans}}>Estate Agents</div></div>
          </div>
          <p className="text-[14px] leading-relaxed mb-5" style={{color:MUTED_D,...sans}}>Nepal's premier luxury real estate advisory, representing the country's most exceptional residential and investment properties.</p>
          <div className="flex gap-3">{[Instagram,Facebook,Youtube,Linkedin].map((I,i)=><a key={i} href="#" onClick={e=>e.preventDefault()} aria-label="Social" className="transition-opacity hover:opacity-70" style={{color:MUTED_D}}><I size={15}/></a>)}</div>
        </div>
        {[
          {title:"Properties",links:[{l:"Buy Property",p:"buy"},{l:"Rent Property",p:"rent"},{l:"Hot Properties",p:"hot"},{l:"New Listings",p:"new-listings"},{l:"View All",p:"buy"}]},
          {title:"Company",links:[{l:"About Us",p:"about"},{l:"Services",p:"services"},{l:"Blog & News",p:"blog"},{l:"Videos",p:"home",o:{scrollTo:"videos"}},{l:"Contact",p:"contact"}]},
          {title:"Tools",links:[{l:"EMI Calculator",p:"emi"},{l:"Free Listing",p:"free-listing"},{l:"Register",p:"register"},{l:"Login",p:"login"}]},
        ].map(col=>(
          <div key={col.title}>
            <p className="text-[10px] tracking-[0.32em] uppercase mb-4" style={{color:GOLD,...sans}}>{col.title}</p>
            <div className="flex flex-col gap-2.5">
              {col.links.map(({l,p,o}:any)=>(
                <button key={l} onClick={()=>go(p as Page,o)} className="text-[14px] text-left transition-colors hover:text-foreground" style={{color:MUTED_D,...sans}}>{l}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 md:px-12 lg:px-20 py-8">
        <p className="text-[12px]" style={{color:MUTED_D,...sans}}>© 2025 Nepal Bhoomi Estate Agents. All rights reserved.</p>
        <div className="flex gap-5">{["Privacy Policy","Terms of Use","Sitemap"].map(t=><a key={t} href="#" onClick={e=>e.preventDefault()} className="text-[12px] hover:opacity-70" style={{color:MUTED_D,...sans}}>{t}</a>)}</div>
      </div>
    </footer>
  );
}

// ─── Callback form ────────────────────────────────────────────────────────────
// One implementation, used by the section at the bottom of the home page and by
// the Quick Enquiry popup. They were the same form twice; now they cannot drift.
function CallbackForm({ onClose }: { onClose?: () => void }) {
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [time,setTime]=useState("Morning (9am-12pm)");
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState(false);

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 size={32} style={{color:GOLD}}/>
        <p className="text-base" style={{color:FG_LIGHT,...serif}}>Thank you. We will call you shortly.</p>
        {onClose && (
          <button onClick={onClose} className="mt-1 px-7 py-3 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your Full Name" className="border px-4 py-3.5 text-[15px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone Number (+977...)" className="border px-4 py-3.5 text-[15px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
      </div>
      <div className="relative">
        <select value={time} onChange={e=>setTime(e.target.value)} className="w-full border px-4 py-3.5 text-[15px] outline-none appearance-none cursor-pointer" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}>
          {["Morning (9am-12pm)","Afternoon (12pm-4pm)","Evening (4pm-6pm)"].map(t=><option key={t}>{t}</option>)}
        </select>
        <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:MUTED_L}}/>
      </div>
      <button onClick={()=>{ if(name.trim()&&phone.trim()){setSent(true);setErr(false);} else setErr(true); }} className="py-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>
        Request a Callback
      </button>
      {err&&<p className="text-[14px]" style={{color:MAROON,...sans}}>Please enter your name and phone number.</p>}
    </div>
  );
}

// ─── Float Elements ───────────────────────────────────────────────────────────
// The AI concierge was removed: it only ever returned one canned reply, so it
// promised a conversation it could not hold. Its slot now opens the real
// callback form, which reaches an actual advisor.
function QuickEnquiryFloat() {
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    if(!open) return;
    const onKey=(e:KeyboardEvent)=>{ if(e.key==="Escape") setOpen(false); };
    window.addEventListener("keydown",onKey);
    document.body.style.overflow="hidden";
    return ()=>{ window.removeEventListener("keydown",onKey); document.body.style.overflow=""; };
  },[open]);

  return (
    <>
      <motion.button
        onClick={()=>setOpen(true)}
        aria-label="Quick enquiry"
        className="fixed bottom-24 right-6 z-40 flex items-center gap-2.5 pl-4 pr-5 py-3 shadow-lg"
        style={{background:MAROON,color:WHITE,...sans}}
        animate={{ opacity:[1,0.66,1] }}
        transition={{ duration:1.9, repeat:Infinity, ease:"easeInOut" }}
        whileHover={{ scale:1.04 }}
        whileTap={{ scale:0.98 }}
      >
        <Phone size={15}/>
        <span className="text-[11px] tracking-[0.22em] uppercase whitespace-nowrap">Quick Enquiry</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-5"
            style={{background:"rgba(10,9,8,0.72)", backdropFilter:"blur(6px)"}}
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setOpen(false)}
          >
            <motion.div
              className="relative w-full max-w-xl border max-h-[90vh] overflow-y-auto"
              style={{background:WHITE,borderColor:BORDER_L}}
              initial={{opacity:0,y:24,scale:0.97}}
              animate={{opacity:1,y:0,scale:1}}
              exit={{opacity:0,y:16,scale:0.98}}
              transition={{duration:0.28,ease:[0.16,1,0.3,1]}}
              onClick={e=>e.stopPropagation()}
              role="dialog" aria-modal="true" aria-label="Quick enquiry"
            >
              <button onClick={()=>setOpen(false)} aria-label="Close" className="absolute top-4 right-4 p-2 transition-colors hover:text-[#8a2030]" style={{color:MUTED_L}}>
                <X size={18}/>
              </button>
              <div className="px-7 md:px-10 py-10 text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div style={{width:"2rem",height:"0.5px",background:GOLD}}/>
                  <Tag c={GOLD}>Quick Enquiry</Tag>
                  <div style={{width:"2rem",height:"0.5px",background:GOLD}}/>
                </div>
                <h2 className="leading-tight mb-3" style={{color:FG_LIGHT,...serif,fontSize:"clamp(1.8rem,3.4vw,2.6rem)"}}>Let Us Call You</h2>
                <p className="text-[15px] mb-8 leading-relaxed" style={{color:MUTED_L,...sans}}>Leave your details and one of our senior advisors will call you within 2 hours during business hours.</p>
                <CallbackForm onClose={()=>setOpen(false)}/>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const WhatsAppFloat = () => (
  <a href="https://wa.me/9779800000000" target="_blank" rel="noopener noreferrer"
    aria-label="Chat on WhatsApp" className="fixed bottom-6 right-6 z-40 w-12 h-12 flex items-center justify-center transition-all hover:scale-105 shadow-lg" style={{background:"#25D366"}}>
    <MessageCircle size={18} style={{color:"#fff"}}/>
  </a>
);

// ─── PropertyCard ─────────────────────────────────────────────────────────────
function PropertyCard({ p, go, setId, light=false }: { p:Prop; go:Go; setId:(id:number)=>void; light?:boolean }) {
  const [hov,setHov]=useState(false);
  const nav=()=>{ setId(p.id); go("property"); window.scrollTo(0,0); };
  return (
    <div className="group cursor-pointer flex flex-col" onClick={nav} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div className="relative overflow-hidden" style={{aspectRatio:"4/3"}}>
        <img src={p.hero} alt={p.title} className="w-full h-full object-cover transition-transform duration-700" style={{transform:hov?"scale(1.05)":"scale(1)"}}/>
        <div className="absolute inset-0 transition-opacity duration-400" style={{background:"linear-gradient(to top, rgba(10,9,8,0.75) 0%, transparent 55%)",opacity:hov?1:0.5}}/>
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className="px-2.5 py-1 text-[10px] tracking-[0.25em] uppercase" style={{background:MAROON,color:WHITE,...sans}}>{p.badge}</span>
        </div>
        <div className="absolute top-3 right-3"><StatusBadge verified={p.verified} featured={p.featured}/></div>
        <motion.div className="absolute bottom-3 left-3 right-3 flex gap-3" animate={{opacity:hov?1:0,y:hov?0:6}} transition={{duration:0.25}}>
          {p.beds>0&&<span className="flex items-center gap-1 text-[11px]" style={{color:"rgba(240,235,224,0.8)",...sans}}><Bed size={12}/>{p.beds}</span>}
          {p.baths>0&&<span className="flex items-center gap-1 text-[11px]" style={{color:"rgba(240,235,224,0.8)",...sans}}><Bath size={12}/>{p.baths}</span>}
          {p.builtArea!=="—"&&<span className="flex items-center gap-1 text-[11px]" style={{color:"rgba(240,235,224,0.8)",...sans}}><Square size={12}/>{p.builtArea}</span>}
        </motion.div>
      </div>
      <div className={`flex flex-col ${light?"px-7 pt-7 pb-8":"pt-6"}`} style={{background:light?WHITE:"transparent"}}>
        <span className="text-[10px] tracking-[0.24em] uppercase mb-3" style={{color:light?MUTED_L:MUTED_D,...sans}}>{p.type}</span>
        <h3 className="leading-[1.22] text-[1.3rem] mb-2.5" style={{color:light?FG_LIGHT:FG_DARK,...serif}}>{p.title}</h3>
        <div className="flex items-center gap-1.5 min-w-0 mb-4">
          <MapPin size={12} style={{color:GOLD,flexShrink:0}}/>
          <span className="text-[13px] truncate" style={{color:light?MUTED_L:MUTED_D,...sans}}>{p.location}</span>
        </div>
        <span className="text-[17px] font-medium tracking-[0.01em]" style={{color:light?MAROON:GOLD,...sans}}>{p.price}</span>
      </div>
    </div>
  );
}

// ─── Favourites ───────────────────────────────────────────────────────────────
const FAVS = new Set<number>();
function FavButton({ id, light=false }: { id:number; light?:boolean }) {
  const [on,setOn]=useState(FAVS.has(id));
  const toggle=(e:React.MouseEvent)=>{ e.stopPropagation(); const n=!on; if(n)FAVS.add(id); else FAVS.delete(id); setOn(n); };
  return (
    <button aria-label={on?"Remove from saved":"Save property"} onClick={toggle}
      className="p-2 border transition-all hover:border-[#8a2030]"
      style={{borderColor:on?MAROON:(light?"rgba(255,255,255,0.6)":BORDER_L),color:on?MAROON:MUTED_L,background:light?"rgba(255,255,255,0.9)":"transparent"}}>
      <Heart size={15} fill={on?MAROON:"none"}/>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection({ go, setId }: { go:Go; setId:(id:number)=>void }) {
  const [active,setActive]=useState(0);
  const featured=ALL_PROPS.filter(p=>p.featured).slice(0,3);
  const prop=featured[active]||ALL_PROPS[0];
  useEffect(()=>{ const t=setInterval(()=>setActive(a=>(a+1)%featured.length),6500); return ()=>clearInterval(t); },[]);
  return (
    <section className="relative h-screen min-h-[600px] overflow-hidden flex flex-col justify-end">
      <AnimatePresence mode="wait">
        <motion.div key={active} className="absolute inset-0" initial={{opacity:0,scale:1.06}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:1.4,ease:[0.16,1,0.3,1]}}>
          <img src={prop.hero} alt={prop.title} className="w-full h-full object-cover"/>
          <div className="absolute inset-0" style={{background:"linear-gradient(to top, rgba(10,9,8,0.95) 0%, rgba(10,9,8,0.4) 45%, rgba(10,9,8,0.08) 100%)"}}/>
          <div className="absolute inset-0" style={{background:"linear-gradient(to right, rgba(10,9,8,0.55) 0%, transparent 65%)"}}/>
        </motion.div>
      </AnimatePresence>
      <div className="relative z-10 px-6 md:px-12 lg:px-20 pb-20 w-full">
        <div className="flex items-center gap-4 mb-6"><div style={{width:"3rem",height:"0.5px",background:GOLD}}/><Tag>{prop.badge} · {prop.type}</Tag></div>
        <AnimatePresence mode="wait">
          <motion.h1 key={active} className="mb-6 leading-[0.9]" style={{color:FG_DARK,...serif,fontSize:"clamp(2.8rem,7.5vw,6.5rem)"}} initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.85,ease:[0.16,1,0.3,1]}}>{prop.title}</motion.h1>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div key={`m${active}`} className="flex flex-wrap items-center gap-x-7 gap-y-3 mb-9" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:0.06}}>
            <div className="flex items-center gap-1.5"><MapPin size={13} style={{color:GOLD}}/><span className="text-[14px] tracking-[0.12em]" style={{color:"rgba(240,235,224,0.62)",...sans}}>{prop.location}</span></div>
            <span className="w-px h-3" style={{background:"rgba(240,235,224,0.18)"}}/>
            <span className="text-[14px] tracking-[0.12em]" style={{color:"rgba(240,235,224,0.62)",...sans}}>{prop.listing}</span>
            <span className="w-px h-3" style={{background:"rgba(240,235,224,0.18)"}}/>
            <span className="text-[14px] font-medium tracking-[0.18em]" style={{color:GOLD,...sans}}>{prop.price}</span>
          </motion.div>
        </AnimatePresence>
        <div className="flex flex-wrap items-center justify-between gap-6 pr-20 sm:pr-0">
          <div className="flex gap-3">
            <button onClick={()=>{setId(prop.id);go("property");window.scrollTo(0,0);}} className="flex items-center gap-2.5 px-8 py-4 text-[11px] tracking-[0.25em] uppercase group transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>
              View Property<ArrowRight size={14} className="transition-transform group-hover:translate-x-1"/>
            </button>
            <button onClick={()=>go("buy")} className="flex items-center gap-2.5 px-8 py-4 text-[11px] tracking-[0.25em] uppercase border transition-all hover:border-accent" style={{color:"rgba(240,235,224,0.65)",borderColor:"rgba(240,235,224,0.2)",...sans}}>All Properties</button>
          </div>
          <div className="flex items-center gap-4">
            {featured.map((_,i)=>(
              <button key={i} onClick={()=>setActive(i)} className="flex items-center gap-2">
                <motion.div animate={{width:i===active?28:14,background:i===active?GOLD:"rgba(240,235,224,0.22)"}} transition={{duration:0.4}} style={{height:"1px"}}/>
                <span className="text-[10px] tracking-[0.25em]" style={{color:i===active?GOLD:"rgba(240,235,224,0.3)",...sans}}>{String(i+1).padStart(2,"0")}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute right-6 md:right-12 bottom-12 flex flex-col items-center gap-3 z-10">
        <span className="text-[9px] tracking-[0.34em] uppercase" style={{color:"rgba(240,235,224,0.3)",writingMode:"vertical-rl",...sans}}>Scroll</span>
        <motion.div animate={{y:[0,8,0]}} transition={{duration:2.2,repeat:Infinity}} style={{width:"0.5px",height:36,background:`linear-gradient(to bottom, ${GOLD_DIM}, transparent)`}}/>
      </div>
    </section>
  );
}

// (The dark "For Sale / For Rent / Location / All Types / Search" strip that used
// to sit under the hero was removed: it competed with the hero's own call to
// action and its dark bar cut the page in half. Search now lives on the results
// page, where the filter bar already does the same job better.)

// ─── Hot Properties (Image 1 style — horizontal scroll with video thumbnails) ─
function HotPropertiesSection({ go, setId }: { go:Go; setId:(id:number)=>void }) {
  const scrollRef=useRef<HTMLDivElement>(null);
  const hot=ALL_PROPS.filter(p=>p.badge==="Hot"||p.featured);
  const scroll=(dir:number)=>{ scrollRef.current?.scrollBy({left:dir*400,behavior:"smooth"}); };
  return (
    <section className="py-28 md:py-36" style={{background:WHITE}}>
      <div className="px-6 md:px-12 lg:px-20 flex flex-col lg:flex-row gap-10 lg:gap-16">
        {/* Left text panel */}
        <div className="lg:w-80 shrink-0 flex flex-col justify-between gap-10">
          <div>
            <h2 className="leading-[0.9] mb-4" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.4rem,4.4vw,4rem)"}}>Hot Properties</h2>
            <p className="text-[15px] leading-relaxed" style={{color:MUTED_L,...sans}}>Discover the homes capturing attention right now. This curated selection showcases Nepal's most sought-after properties.</p>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={()=>go("hot")} className="flex items-center justify-center py-4 text-[12px] tracking-[0.22em] uppercase transition-all hover:brightness-110" style={{background:FG_LIGHT,color:WHITE,...sans}}>See all Hot Properties</button>
            <div className="flex gap-3">
              <button onClick={()=>scroll(-1)} className="w-10 h-10 flex items-center justify-center border transition-all hover:border-current" style={{borderColor:BORDER_L,color:FG_LIGHT}}><ChevronLeft size={18}/></button>
              <button onClick={()=>scroll(1)} className="w-10 h-10 flex items-center justify-center border transition-all hover:border-current" style={{borderColor:BORDER_L,color:FG_LIGHT}}><ChevronRight size={18}/></button>
            </div>
          </div>
        </div>
        {/* Horizontal scroll */}
        <div ref={scrollRef} className="flex gap-6 overflow-x-auto pb-2 flex-1" style={{scrollbarWidth:"none",msOverflowStyle:"none",scrollBehavior:"smooth"}}>
          {hot.map(p=>(
            <div key={p.id} className="shrink-0 flex flex-col gap-4 cursor-pointer group" style={{width:"clamp(300px,30vw,380px)"}} onClick={()=>{setId(p.id);go("property");window.scrollTo(0,0);}}>
              {/* Video thumbnail style */}
              <div className="relative overflow-hidden" style={{aspectRatio:"4/3"}}>
                <img src={p.hero} alt={p.title} className="w-full h-full object-cover transition-transform duration-600 group-hover:scale-[1.04]"/>
                <div className="absolute inset-0" style={{background:"rgba(0,0,0,0.28)"}}/>
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 flex items-center justify-center border-2 border-white rounded-full bg-black/30 group-hover:bg-white/20 transition-all">
                    <Play size={18} fill="white" style={{color:"white",marginLeft:2}}/>
                  </div>
                </div>
                <div className="absolute top-3 left-3"><span className="px-2 py-0.5 text-[10px] tracking-[0.25em] uppercase" style={{background:MAROON,color:WHITE,...sans}}>{p.badge}</span></div>
                {p.verified&&<div className="absolute top-3 right-3"><CheckCircle2 size={16} style={{color:"rgba(176,136,72,0.9)"}}/></div>}
              </div>
              <div>
                <p className="text-[15px] font-medium" style={{color:FG_LIGHT,...sans}}>{p.price}</p>
                <p className="text-[14px] leading-snug" style={{color:FG_LIGHT,...sans}}>{p.title}</p>
                <p className="text-[12px] mt-0.5" style={{color:MUTED_L,...sans}}>{p.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── New Listings ─────────────────────────────────────────────────────────────
function NewListingsSection({ go, setId }: { go:Go; setId:(id:number)=>void }) {
  const news=ALL_PROPS.filter(p=>p.badge==="New"||p.badge==="Prime");
  return (
    <section className="py-28 md:py-36 border-t" style={{background:CREAM,borderColor:BORDER_L}}>
      <div className="px-6 md:px-12 lg:px-20">
        <div className="flex items-end justify-between gap-8 mb-14">
          <SectionTitle tag="Just Listed" h={"New Listings"} dark={false}/>
          <button onClick={()=>go("new-listings")} className="hidden md:flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase border px-6 py-3.5 transition-all hover:border-[#1a1611]" style={{color:MUTED_L,borderColor:BORDER_L,...sans}}>All New <ArrowRight size={14}/></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
          {news.slice(0,3).map(p=><PropertyCard key={p.id} p={p} go={go} setId={setId} light/>)}
        </div>
      </div>
    </section>
  );
}

// ─── Properties by Location (Image 3 style) ───────────────────────────────────
function LocationStripsSection({ go }: { go:Go }) {
  const locs = [
    {name:"Kathmandu",count:24,img:img("photo-1613977257363-707ba9348227",900,1100)},
    {name:"Lalitpur",count:18,img:img("photo-1600596542815-ffad4c1539a9",900,1100)},
    {name:"Bhaktapur",count:7,img:img("photo-1568605114967-8130f3a36994",900,1100)},
  ];
  // Each tile takes an equal share of the row, so the strip fills the width
  // however many districts are published. Height follows that same share so
  // the proportion holds as the list grows, instead of the tiles turning into
  // tall slivers. Clamped at both ends: it cannot balloon at two districts or
  // collapse at eight. Past roughly five the row overflows into a horizontal
  // scroll, and the partly visible last tile is what signals there is more.
  const share = 100 / locs.length;
  const tileH = `clamp(340px, ${share.toFixed(2)}vw, 520px)`;
  return (
    <section className="py-20 border-t" style={{background:WHITE,borderColor:BORDER_L}}>
      <div className="px-6 md:px-12 lg:px-20 mb-10">
        <h2 className="leading-tight" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.1rem,4vw,3.4rem)"}}>Prestige Properties Across Nepal</h2>
        <p className="mt-1.5 text-[15px]" style={{color:MUTED_L,...sans}}>Major cities or exclusive destinations. Choose the location that suits you.</p>
      </div>
      {/* Full-bleed horizontal image strip (Image 3 style) */}
      <div className="flex overflow-x-auto" style={{scrollbarWidth:"none"}}>
        {locs.map(l=>(
          <button key={l.name} onClick={()=>go("buy",{district:l.name})} className="relative shrink-0 overflow-hidden group"
            style={{width:`${share}%`,minWidth:"280px",height:tileH}}>
            <img src={l.img} alt={l.name} className="w-full h-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.05]"/>
            <div className="absolute inset-0" style={{background:"linear-gradient(to top, rgba(10,9,8,0.94) 0%, rgba(10,9,8,0.58) 36%, rgba(10,9,8,0.06) 76%)"}}/>
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10 text-left">
              <p className="text-[10px] tracking-[0.28em] uppercase mb-2.5" style={{color:GOLD,...sans}}>{l.count} Properties</p>
              <p className="leading-[1.04]" style={{color:WHITE,...serif,fontSize:"clamp(1.8rem,2.6vw,2.6rem)"}}>{l.name}</p>
              <div className="mt-5 h-px w-10 transition-all duration-500 ease-out group-hover:w-24" style={{background:GOLD}}/>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── Company videos ───────────────────────────────────────────────────────────
//
// These are company films, not property listings, so the card shows only a
// title — the location line was removed. Each entry is either a self-hosted
// file (one or more quality renditions) or a YouTube id.

type VideoCaption = { start:string; end:string; text:string };
type VideoSource  = { label:string; src:string; type?:string };

type CompanyVideo = {
  id:number;
  title:string;
  poster:string;
  duration:string;
  sources?:VideoSource[];
  youtubeId?:string;
  captions?:VideoCaption[];
};

// How a video is written in the list below. For YouTube, paste the normal share link as
// `youtubeUrl` (youtu.be/..., youtube.com/watch?v=..., /shorts/...); `poster` can be left out
// and the video's own YouTube thumbnail is used.
type CompanyVideoInput = Omit<CompanyVideo,"poster"> & { poster?:string; youtubeUrl?:string };

// Accepts any usual YouTube link or a bare 11-character video id; returns the id.
function youtubeIdFrom(input?:string):string|undefined {
  if(!input) return undefined;
  if(/^[\w-]{11}$/.test(input)) return input;
  try {
    const u=new URL(input);
    if(u.hostname.endsWith("youtu.be")) return u.pathname.slice(1,12)||undefined;
    const v=u.searchParams.get("v");
    if(v) return v;
    return u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1];
  } catch { return undefined; }
}

// maxresdefault is sharp but missing on some videos; hqdefault always exists (see onError below).
const youtubeThumb=(id:string, q:"maxresdefault"|"hqdefault"="maxresdefault")=>`https://i.ytimg.com/vi/${id}/${q}.jpg`;

// The first entry is the one shown in the centre when the page loads.
// File videos (`sources`) are still placeholder clips from test-videos.co.uk; replace them with
// YouTube links the same way as the first entry. Supplying several entries in `sources` is what
// makes the quality menu work — order them highest first.
const VIDEO_LIST: CompanyVideoInput[] = [
  { id:6, title:"Sitapaila Elite Colony — 2 Minutes from Ring Road", duration:"1:19",
    youtubeUrl:"https://youtu.be/gHsBz7OJDHk" },
  { id:1, title:"Inside The Patan Residence", duration:"0:10",
    poster:img("photo-1600596542815-ffad4c1539a9",1200,700),
    sources:[
      {label:"1080p",src:"https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_5MB.mp4",type:"video/mp4"},
      {label:"720p", src:"https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4",type:"video/mp4"},
      {label:"360p", src:"https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",type:"video/mp4"},
    ],
    captions:[
      {start:"00:00:00.000",end:"00:00:04.000",text:"Welcome to The Patan Residence."},
      {start:"00:00:04.000",end:"00:00:09.000",text:"Five bedrooms across three floors in Jawlakhel."},
      {start:"00:00:09.000",end:"00:00:14.000",text:"Nepal Bhoomi — Nepal's finest addresses."},
    ] },
  { id:2, title:"Boudha Heights — A Walkthrough", duration:"0:10",
    poster:img("photo-1613977257363-707ba9348227",1200,700),
    sources:[
      {label:"1080p",src:"https://test-videos.co.uk/vids/sintel/mp4/h264/1080/Sintel_1080_10s_5MB.mp4",type:"video/mp4"},
      {label:"720p", src:"https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_2MB.mp4",type:"video/mp4"},
      {label:"360p", src:"https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4",type:"video/mp4"},
    ],
    captions:[
      {start:"00:00:00.000",end:"00:00:05.000",text:"Above the Boudhanath stupa."},
      {start:"00:00:05.000",end:"00:00:10.000",text:"Two hundred and seventy degrees of valley view."},
    ] },
  { id:3, title:"Meet the Nepal Bhoomi Advisory Team", duration:"0:10",
    poster:img("photo-1600585154526-990dced4db0d",1200,700),
    sources:[
      {label:"1080p",src:"https://test-videos.co.uk/vids/jellyfish/mp4/h264/1080/Jellyfish_1080_10s_5MB.mp4",type:"video/mp4"},
      {label:"720p", src:"https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_2MB.mp4",type:"video/mp4"},
    ] },
  { id:5, title:"Godavari Forest Estate from the Air", duration:"0:30",
    poster:img("photo-1512917774080-9991f1c4c750",1200,700),
    sources:[{label:"720p",src:"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",type:"video/mp4"}] },
];

const COMPANY_VIDEOS: CompanyVideo[] = VIDEO_LIST.map(({ youtubeUrl, ...v })=>{
  const youtubeId=youtubeIdFrom(youtubeUrl ?? v.youtubeId);
  return { ...v, youtubeId, poster: v.poster ?? (youtubeId ? youtubeThumb(youtubeId) : "") };
});

const fmtTime = (s:number) => {
  if(!isFinite(s)||s<0) return "0:00";
  const m=Math.floor(s/60), sec=Math.floor(s%60);
  return `${m}:${String(sec).padStart(2,"0")}`;
};

// ─── Video player ─────────────────────────────────────────────────────────────
function VideoPlayer({ video, onClose }: { video:CompanyVideo; onClose:()=>void }) {
  const ref=useRef<HTMLVideoElement>(null);
  const shellRef=useRef<HTMLDivElement>(null);
  const [playing,setPlaying]=useState(false);
  const [time,setTime]=useState(0);
  const [dur,setDur]=useState(0);
  const [buffered,setBuffered]=useState(0);
  const [volume,setVolume]=useState(1);
  const [muted,setMuted]=useState(false);
  const [rate,setRate]=useState(1);
  const [quality,setQuality]=useState(0);
  const [captionsOn,setCaptionsOn]=useState(false);
  const [menu,setMenu]=useState<null|"speed"|"quality">(null);
  const [full,setFull]=useState(false);
  const [theatre,setTheatre]=useState(false);
  const isYouTube=!!video.youtubeId;

  // Captions become a real <track> via an object URL built from the data.
  const vttUrl=useMemo(()=>{
    if(!video.captions?.length) return null;
    const body="WEBVTT\n\n"+video.captions.map((c,i)=>`${i+1}\n${c.start} --> ${c.end}\n${c.text}`).join("\n\n");
    return URL.createObjectURL(new Blob([body],{type:"text/vtt"}));
  },[video]);
  useEffect(()=>()=>{ if(vttUrl) URL.revokeObjectURL(vttUrl); },[vttUrl]);

  const toggle=()=>{ const v=ref.current; if(!v) return; if(v.paused){ v.play().catch(()=>{}); } else { v.pause(); } };
  const seekBy=(d:number)=>{ const v=ref.current; if(v) v.currentTime=Math.min(Math.max(0,v.currentTime+d),v.duration||0); };

  useEffect(()=>{ const v=ref.current; if(v){ v.playbackRate=rate; } },[rate]);
  useEffect(()=>{ const v=ref.current; if(v){ v.volume=volume; v.muted=muted; } },[volume,muted]);
  useEffect(()=>{
    const t=ref.current?.textTracks?.[0];
    if(t) t.mode=captionsOn?"showing":"hidden";
  },[captionsOn,vttUrl]);

  // Keyboard: space/k play, arrows seek, m mute, f fullscreen, c captions, Esc close.
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){ if(document.fullscreenElement) return; onClose(); return; }
      if(isYouTube) return;
      if(e.key===" "||e.key.toLowerCase()==="k"){ e.preventDefault(); toggle(); }
      else if(e.key==="ArrowRight") seekBy(5);
      else if(e.key==="ArrowLeft") seekBy(-5);
      else if(e.key.toLowerCase()==="m") setMuted(m=>!m);
      else if(e.key.toLowerCase()==="f") toggleFull();
      else if(e.key.toLowerCase()==="c") setCaptionsOn(c=>!c);
    };
    window.addEventListener("keydown",onKey);
    document.body.style.overflow="hidden";
    return ()=>{ window.removeEventListener("keydown",onKey); document.body.style.overflow=""; };
  },[isYouTube]);

  const toggleFull=()=>{
    const el=shellRef.current; if(!el) return;
    if(document.fullscreenElement){ document.exitFullscreen(); } else { el.requestFullscreen?.(); }
  };
  useEffect(()=>{
    const onFs=()=>setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange",onFs);
    return ()=>document.removeEventListener("fullscreenchange",onFs);
  },[]);

  const pct=dur?(time/dur)*100:0;
  const src=video.sources?.[quality];

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8"
      style={{background:"rgba(6,5,4,0.94)",backdropFilter:"blur(8px)"}}
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      onClick={onClose}
    >
      <motion.div
        ref={shellRef}
        className="relative w-full overflow-hidden bg-black"
        style={{maxWidth: theatre?"100%":"1100px"}}
        initial={{opacity:0,scale:0.96,y:18}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.97,y:12}}
        transition={{duration:0.3,ease:[0.16,1,0.3,1]}}
        onClick={e=>e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={video.title}
      >
        {/* Brand bar — logo and title stay visible while the film plays */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-4 px-5 py-4 pointer-events-none"
          style={{background:"linear-gradient(to bottom, rgba(6,5,4,0.8), transparent)"}}>
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Nepal Bhoomi" className="h-8 w-8 object-contain"/>
            <div>
              <p className="text-[10px] tracking-[0.28em] uppercase" style={{color:GOLD,...sans}}>Nepal Bhoomi</p>
              <p className="text-[14px] leading-tight" style={{color:WHITE,...serif}}>{video.title}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close video" className="pointer-events-auto p-2 transition-colors hover:text-white" style={{color:"rgba(255,255,255,0.75)"}}>
            <X size={20}/>
          </button>
        </div>

        {isYouTube ? (
          <div style={{aspectRatio:"16/9"}}>
            <iframe
              className="w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&cc_load_policy=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <>
            <video
              ref={ref}
              className="w-full h-auto max-h-[80vh] bg-black"
              poster={video.poster}
              onClick={toggle}
              onPlay={()=>setPlaying(true)}
              onPause={()=>setPlaying(false)}
              onLoadedMetadata={e=>setDur(e.currentTarget.duration)}
              onTimeUpdate={e=>{
                setTime(e.currentTarget.currentTime);
                const b=e.currentTarget.buffered;
                if(b.length) setBuffered(b.end(b.length-1));
              }}
              /* No crossOrigin: the sample host sends no Access-Control-Allow-Origin,
                 and setting it makes the load fail outright. The caption track is a
                 same-origin blob: URL, so it does not need CORS either. */
              playsInline
           >
              {src && <source src={src.src} type={src.type??"video/mp4"}/>}
              {vttUrl && <track kind="captions" srcLang="en" label="English" src={vttUrl} default={false}/>}
            </video>

            {/* Centre play affordance when paused */}
            {!playing && (
              <button onClick={toggle} aria-label="Play" className="absolute inset-0 z-10 flex items-center justify-center">
                <span className="w-20 h-20 flex items-center justify-center rounded-full border-2 border-white/80 bg-black/30 transition-all hover:bg-white/20">
                  <Play size={30} fill="white" style={{color:"white",marginLeft:4}}/>
                </span>
              </button>
            )}

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3 pt-10"
              style={{background:"linear-gradient(to top, rgba(6,5,4,0.9), transparent)"}}>
              {/* Seek */}
              <div
                className="relative h-1.5 mb-3 cursor-pointer group/seek"
                style={{background:"rgba(255,255,255,0.22)"}}
                onClick={e=>{
                  const r=e.currentTarget.getBoundingClientRect();
                  const v=ref.current; if(v&&dur) v.currentTime=((e.clientX-r.left)/r.width)*dur;
                }}
              >
                <div className="absolute inset-y-0 left-0" style={{width:`${dur?(buffered/dur)*100:0}%`,background:"rgba(255,255,255,0.32)"}}/>
                <div className="absolute inset-y-0 left-0" style={{width:`${pct}%`,background:MAROON}}/>
                <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover/seek:opacity-100 transition-opacity"
                  style={{left:`calc(${pct}% - 6px)`,background:GOLD}}/>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={toggle} aria-label={playing?"Pause":"Play"} style={{color:WHITE}}>
                  {playing?<Pause size={18}/>:<Play size={18}/>}
                </button>

                <div className="flex items-center gap-2 group/vol">
                  <button onClick={()=>setMuted(m=>!m)} aria-label={muted?"Unmute":"Mute"} style={{color:WHITE}}>
                    {muted||volume===0?<VolumeX size={17}/>:<Volume2 size={17}/>}
                  </button>
                  <input
                    type="range" min={0} max={1} step={0.05} value={muted?0:volume}
                    onChange={e=>{ setVolume(Number(e.target.value)); setMuted(Number(e.target.value)===0); }}
                    aria-label="Volume"
                    className="w-0 group-hover/vol:w-20 transition-all duration-300 h-1 cursor-pointer"
                    style={{accentColor:GOLD}}
                  />
                </div>

                <span className="text-[12px] tabular-nums" style={{color:"rgba(255,255,255,0.8)",...sans}}>
                  {fmtTime(time)} / {fmtTime(dur)}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  {vttUrl && (
                    <button onClick={()=>setCaptionsOn(c=>!c)} aria-label="Toggle captions" aria-pressed={captionsOn}
                      className="p-2" style={{color:captionsOn?GOLD:WHITE}}>
                      <Subtitles size={17}/>
                    </button>
                  )}

                  {/* Speed */}
                  <div className="relative">
                    <button onClick={()=>setMenu(m=>m==="speed"?null:"speed")} aria-label="Playback speed" className="p-2 text-[12px]" style={{color:menu==="speed"?GOLD:WHITE,...sans}}>
                      {rate}&times;
                    </button>
                    {menu==="speed" && (
                      <div className="absolute bottom-full right-0 mb-2 border py-1 min-w-[90px]" style={{background:"#14120f",borderColor:BORDER_D}}>
                        {[0.5,0.75,1,1.25,1.5,2].map(r=>(
                          <button key={r} onClick={()=>{ setRate(r); setMenu(null); }}
                            className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[12px] text-left"
                            style={{color:r===rate?GOLD:FG_DARK,...sans}}>
                            {r}&times;{r===rate&&<Check size={12}/>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quality */}
                  <div className="relative">
                    <button onClick={()=>setMenu(m=>m==="quality"?null:"quality")} aria-label="Quality" className="p-2" style={{color:menu==="quality"?GOLD:WHITE}}>
                      <Settings size={17}/>
                    </button>
                    {menu==="quality" && (
                      <div className="absolute bottom-full right-0 mb-2 border py-1 min-w-[140px]" style={{background:"#14120f",borderColor:BORDER_D}}>
                        <p className="px-3 py-1 text-[9px] tracking-[0.22em] uppercase" style={{color:MUTED_D,...sans}}>Quality</p>
                        {(video.sources??[]).map((s,i)=>(
                          <button key={s.label} onClick={()=>{
                              const v=ref.current; const at=v?.currentTime??0; const wasPlaying=!!v&&!v.paused;
                              setQuality(i); setMenu(null);
                              // Switching <source> reloads the element, so restore position.
                              requestAnimationFrame(()=>{ const nv=ref.current; if(nv){ nv.load(); nv.currentTime=at; if(wasPlaying) nv.play().catch(()=>{}); } });
                            }}
                            className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[12px] text-left"
                            style={{color:i===quality?GOLD:FG_DARK,...sans}}>
                            {s.label}{i===quality&&<Check size={12}/>}
                          </button>
                        ))}
                        {(video.sources??[]).length<2 && (
                          <p className="px-3 py-1.5 text-[11px] leading-snug" style={{color:MUTED_D,...sans}}>
                            Only one rendition available for this film.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Theatre / compact */}
                  <button onClick={()=>setTheatre(t=>!t)} aria-label={theatre?"Compact size":"Theatre size"} className="p-2" style={{color:WHITE}}>
                    {theatre?<Minimize2 size={17}/>:<Maximize2 size={17}/>}
                  </button>

                  {/* Fullscreen */}
                  <button onClick={toggleFull} aria-label={full?"Exit full screen":"Full screen"} className="p-2 text-[11px] tracking-[0.15em] uppercase" style={{color:WHITE,...sans}}>
                    {full?"Exit":"Full"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Video carousel ───────────────────────────────────────────────────────────
function VideoSection() {
  const [index,setIndex]=useState(0);
  const [open,setOpen]=useState<CompanyVideo|null>(null);
  const [paused,setPaused]=useState(false);
  const count=COMPANY_VIDEOS.length;

  const go=(d:number)=>setIndex(i=>(i+d+count)%count);

  // Gentle auto-rotation; stops while hovered or while a film is open.
  useEffect(()=>{
    if(paused||open) return;
    const t=setInterval(()=>go(1),5200);
    return ()=>clearInterval(t);
  },[paused,open,count]);

  /** Shortest signed distance from the active card, so the ring wraps. */
  const offsetOf=(i:number)=>{
    let o=i-index;
    if(o>count/2) o-=count;
    if(o<-count/2) o+=count;
    return o;
  };

  return (
    <section id="videos" className="py-28 md:py-36 border-t overflow-hidden" style={{background:"#0e0d0b",borderColor:BORDER_D}}>
      <div className="px-6 md:px-12 lg:px-20">
        <div className="flex items-end justify-between gap-8 mb-14">
          <SectionTitle tag="Property Tours" h={"Explore in Video"}/>
          <div className="flex gap-2">
            <button onClick={()=>go(-1)} aria-label="Previous video" className="w-10 h-10 flex items-center justify-center border transition-colors hover:border-[#b08848]" style={{borderColor:BORDER_D,color:FG_DARK}}><ChevronLeft size={18}/></button>
            <button onClick={()=>go(1)} aria-label="Next video" className="w-10 h-10 flex items-center justify-center border transition-colors hover:border-[#b08848]" style={{borderColor:BORDER_D,color:FG_DARK}}><ChevronRight size={18}/></button>
          </div>
        </div>
      </div>

      <div
        className="relative mx-auto"
        style={{height:"clamp(300px,42vw,520px)",maxWidth:"1500px"}}
        onMouseEnter={()=>setPaused(true)}
        onMouseLeave={()=>setPaused(false)}
      >
        {COMPANY_VIDEOS.map((v,i)=>{
          const o=offsetOf(i);
          const abs=Math.abs(o);
          const isCentre=o===0;
          return (
            <motion.button
              key={v.id}
              onClick={()=>isCentre?setOpen(v):setIndex(i)}
              aria-label={isCentre?`Play ${v.title}`:`Show ${v.title}`}
              className="absolute top-1/2 left-1/2 overflow-hidden group"
              style={{width:"clamp(280px,46vw,760px)",aspectRatio:"16/9",transformOrigin:"center"}}
              animate={{
                x:`calc(-50% + ${o*46}%)`,
                y:"-50%",
                scale:isCentre?1:0.76,
                opacity:abs>1?0:1,
                filter:isCentre?"brightness(1)":"brightness(0.5)",
                zIndex:30-abs,
              }}
              transition={{duration:0.75,ease:[0.16,1,0.3,1]}}
           >
              <img src={v.poster} alt="" className="w-full h-full object-cover"
                onError={e=>{ if(v.youtubeId && e.currentTarget.src.includes("maxresdefault")) e.currentTarget.src=youtubeThumb(v.youtubeId,"hqdefault"); }}/>
              <div className="absolute inset-0" style={{background:"linear-gradient(to top, rgba(10,9,8,0.88) 0%, rgba(10,9,8,0.2) 55%, rgba(10,9,8,0.05) 100%)"}}/>

              {isCentre && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center rounded-full border-2 border-white/80 bg-black/25 transition-all group-hover:bg-white/20 group-hover:scale-105">
                      <Play size={28} fill="white" style={{color:"white",marginLeft:3}}/>
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] tracking-[0.28em] uppercase" style={{color:GOLD,...sans}}>{v.duration}</span>
                      {v.youtubeId && <span className="text-[10px] tracking-[0.2em] uppercase" style={{color:"rgba(240,235,224,0.5)",...sans}}>YouTube</span>}
                    </div>
                    <p className="leading-[1.1]" style={{color:WHITE,...serif,fontSize:"clamp(1.3rem,2.2vw,2.1rem)"}}>{v.title}</p>
                    <div className="mt-4 h-px w-10 transition-all duration-500 ease-out group-hover:w-24" style={{background:GOLD}}/>
                  </div>
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Position markers */}
      <div className="flex items-center justify-center gap-3 mt-10">
        {COMPANY_VIDEOS.map((v,i)=>(
          <button key={v.id} onClick={()=>setIndex(i)} aria-label={`Go to ${v.title}`} className="py-2">
            <motion.div
              animate={{width:i===index?34:14,background:i===index?GOLD:"rgba(240,235,224,0.22)"}}
              transition={{duration:0.4}}
              style={{height:"1px"}}
            />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open && <VideoPlayer video={open} onClose={()=>setOpen(null)}/>}
      </AnimatePresence>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function TestimonialsSection() {
  const [idx,setIdx]=useState(0);
  return (
    <section className="py-28 md:py-36 border-t" style={{background:WHITE,borderColor:BORDER_L}}>
      <div className="px-6 md:px-12 lg:px-20">
        <div className="flex items-end justify-between gap-8 mb-16">
          <div>
            <div className="flex items-center gap-3 mb-3"><div style={{width:"2rem",height:"0.5px",background:GOLD}}/><Tag c={GOLD}>Client Stories</Tag></div>
            <h2 className="leading-[0.93]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.2rem,4.2vw,3.4rem)"}}>What Our Clients Say</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setIdx(i=>(i-1+TESTIMONIALS.length)%TESTIMONIALS.length)} className="w-9 h-9 flex items-center justify-center border transition-all hover:border-current" style={{borderColor:BORDER_L,color:FG_LIGHT}}><ChevronLeft size={16}/></button>
            <button onClick={()=>setIdx(i=>(i+1)%TESTIMONIALS.length)} className="w-9 h-9 flex items-center justify-center border transition-all hover:border-current" style={{borderColor:BORDER_L,color:FG_LIGHT}}><ChevronRight size={16}/></button>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={idx} className="grid grid-cols-1 lg:grid-cols-3 gap-8" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.4}}>
            {TESTIMONIALS.map((t,i)=>(
              <div key={t.name} className={`p-9 border transition-all duration-300 ${i===idx?"":"opacity-60"}`} style={{background:i===idx?CREAM:WHITE,borderColor:BORDER_L}}>
                <div className="flex gap-0.5 mb-5">{Array.from({length:t.rating}).map((_,j)=><Star key={j} size={15} fill={GOLD} style={{color:GOLD}}/>)}</div>
                <p className="text-[15px] leading-[1.75] mb-6" style={{color:MUTED_L,...sans}}>"{t.text}"</p>
                <div className="flex items-center gap-3 pt-5 border-t" style={{borderColor:BORDER_L}}>
                  <img src={t.img} alt={t.name} className="w-10 h-10 object-cover rounded-full"/>
                  <div><p className="text-[15px] font-medium" style={{color:FG_LIGHT,...sans}}>{t.name}</p><p className="text-[12px]" style={{color:MUTED_L,...sans}}>{t.role}</p></div>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

// ─── Blog Section ─────────────────────────────────────────────────────────────
function BlogSection({ go }: { go:Go }) {
  const [feat,...rest]=BLOGS;
  return (
    <section className="py-28 md:py-36 border-t" style={{background:CREAM,borderColor:BORDER_L}}>
      <div className="px-6 md:px-12 lg:px-20">
        <div className="flex items-end justify-between gap-8 mb-14">
          <SectionTitle tag="Insights & News" h={"Property Journal"} dark={false}/>
          <button onClick={()=>go("blog")} className="hidden md:flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase border px-6 py-3.5 transition-all hover:border-[#1a1611]" style={{color:MUTED_L,borderColor:BORDER_L,...sans}}>All Articles<ArrowRight size={14}/></button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          <button onClick={()=>go("blog-post",{blog:feat.id})} className="lg:col-span-3 flex flex-col group text-left">
            <div className="relative overflow-hidden mb-4" style={{aspectRatio:"16/9"}}>
              <img src={feat.image} alt={feat.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"/>
              <div className="absolute top-4 left-4"><span className="px-3 py-1 text-[10px] tracking-[0.25em] uppercase" style={{background:MAROON,color:WHITE,...sans}}>{feat.cat}</span></div>
            </div>
            <p className="text-[11px] tracking-[0.28em] uppercase mb-2" style={{color:MUTED_L,...sans}}>{feat.date} · {feat.read}</p>
            <h3 className="text-xl leading-snug mb-2 group-hover:text-[#8a2030] transition-colors" style={{color:FG_LIGHT,...serif}}>{feat.title}</h3>
            <p className="text-[14px] leading-relaxed" style={{color:MUTED_L,...sans}}>{feat.excerpt}</p>
          </button>
          <div className="lg:col-span-2 flex flex-col gap-8">
            {rest.map(a=>(
              <button key={a.id} onClick={()=>go("blog-post",{blog:a.id})} className="flex gap-4 group text-left">
                <div className="w-36 h-28 overflow-hidden shrink-0"><img src={a.image} alt={a.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"/></div>
                <div>
                  <span className="text-[10px] tracking-[0.26em] uppercase" style={{color:GOLD,...sans}}>{a.cat}</span>
                  <p className="text-[15px] leading-snug mt-1 group-hover:text-[#8a2030] transition-colors" style={{color:FG_LIGHT,...serif}}>{a.title}</p>
                  <p className="text-[11px] mt-1" style={{color:MUTED_L,...sans}}>{a.date}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Services Section ─────────────────────────────────────────────────────────
function ServicesSectionHome({ go }: { go:Go }) {
  return (
    <section className="py-28 md:py-36 border-t" style={{background:"#0e0d0b",borderColor:BORDER_D}}>
      <div className="px-6 md:px-12 lg:px-20">
        <div className="flex items-end justify-between gap-8 mb-16">
          <SectionTitle tag="What We Do" h={"Our Services"}/>
          <button onClick={()=>go("services")} className="hidden md:flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase border px-6 py-3.5 transition-all hover:border-accent" style={{color:"rgba(240,235,224,0.6)",borderColor:BORDER_D,...sans}}>All Services<ArrowRight size={14}/></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l" style={{borderColor:BORDER_D}}>
          {SERVICES_LIST.map(s=>(
            <div key={s.title} className="border-b border-r p-10 flex flex-col gap-5 group cursor-pointer hover:bg-white/[0.02] transition-all" style={{borderColor:BORDER_D}}>
              <div style={{color:GOLD}}>{s.icon}</div>
              <h4 className="text-base" style={{color:FG_DARK,...serif}}>{s.title}</h4>
              <p className="text-[14px] leading-relaxed flex-1" style={{color:MUTED_D,...sans}}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Statistics Section ────────────────────────────────────────────────────────
function StatisticsSection() {
  const stats=[{n:"180+",l:"Properties Sold"},{n:"12",l:"Years in Nepal"},{n:"NPR 2B+",l:"Total Value"},{n:"9",l:"Districts Covered"}];
  return (
    <section className="py-28 md:py-36 border-t border-b" style={{background:"#080706",borderColor:BORDER_D}}>
      <div className="px-6 md:px-12 lg:px-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-t" style={{borderColor:BORDER_D}}>
          {stats.map(s=>(
            <div key={s.n} className="border-r last:border-0 py-14 pr-10" style={{borderColor:BORDER_D}}>
              <p className="leading-none mb-2" style={{color:FG_DARK,...serif,fontSize:"clamp(2rem,4.5vw,3.8rem)"}}>{s.n}</p>
              <p className="text-[11px] tracking-[0.22em] uppercase" style={{color:MUTED_D,...sans}}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── "Let Us Call You" Callback Form ─────────────────────────────────────────
function CallbackSection() {
  return (
    <section className="py-28 md:py-36 border-t" style={{background:WHITE,borderColor:BORDER_L}}>
      <div className="px-6 md:px-12 lg:px-20 max-w-3xl mx-auto text-center">
        <div className="flex items-center justify-center gap-3 mb-4"><div style={{width:"2rem",height:"0.5px",background:GOLD}}/><Tag c={GOLD}>Quick Enquiry</Tag><div style={{width:"2rem",height:"0.5px",background:GOLD}}/></div>
        <h2 className="leading-tight mb-3" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.1rem,4vw,3.4rem)"}}>Let Us Call You</h2>
        <p className="text-[15px] mb-8 leading-relaxed" style={{color:MUTED_L,...sans}}>Leave your details and one of our senior advisors will call you within 2 hours during business hours.</p>
        <CallbackForm/>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUY / RENT PAGE (LuxuryEstate Image 2 style)
// ═══════════════════════════════════════════════════════════════════════════════
function BuyRentPage({ listing, go, setId, nav={} }: { listing:"For Sale"|"For Rent"; go:Go; setId:(id:number)=>void; nav?:NavOpts }) {
  const [view,setView]=useState<"list"|"grid"|"map">(nav.view??"list");
  const [typeF,setTypeF]=useState(nav.type??"All Types");
  const [distF,setDistF]=useState(nav.district??"All");
  const [priceF,setPriceF]=useState("Any Price");
  const [showFilters,setShowFilters]=useState(false);
  const resultsRef=useRef<HTMLDivElement>(null);
  const preset=nav.preset;
  const ranges=PRICE_RANGES[listing];
  const range=ranges.find(r=>r.label===priceF);
  const props=ALL_PROPS.filter(p=>{
    if(p.listing!==listing) return false;
    if(preset==="hot"&&!(p.badge==="Hot"||p.featured)) return false;
    if(preset==="new"&&!(p.badge==="New"||p.badge==="Prime")) return false;
    if(typeF!=="All Types"&&p.type!==typeF) return false;
    if(distF!=="All"&&p.district!==distF) return false;
    if(range&&(p.priceNum<range.min||p.priceNum>range.max)) return false;
    return true;
  });
  const types=PROP_TYPES;
  const dists=["All",...AREAS.filter(a=>ALL_PROPS.some(x=>x.district===a&&x.listing===listing))];
  const dirty=typeF!=="All Types"||distF!=="All"||priceF!=="Any Price";
  const reset=()=>{ setTypeF("All Types"); setDistF("All"); setPriceF("Any Price"); };
  const heading=preset==="hot"?"Hot Properties":preset==="new"?"New Listings":(listing==="For Sale"?"Properties for Sale":"Properties for Rent");
  const scrollToResults=()=>resultsRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      {/* Sticky filter bar */}
      <div className="sticky top-20 z-30 border-b" style={{background:"rgba(247,243,237,0.97)",backdropFilter:"blur(20px)",borderColor:BORDER_L}}>
        <div className="px-6 md:px-12 lg:px-20 py-4 flex items-center gap-2.5 flex-wrap">
          <button onClick={()=>setShowFilters(f=>!f)} className="flex items-center gap-1.5 px-5 py-2.5 text-[12px] tracking-[0.15em] border transition-all" style={{borderRadius:"9999px",borderColor:showFilters?"transparent":BORDER_L,background:showFilters?"#1a1611":"transparent",color:showFilters?WHITE:FG_LIGHT,...sans}}>
            <SlidersHorizontal size={14}/>All Filters
          </button>
          <div className="w-px h-5" style={{background:BORDER_L}}/>
          {(["For Sale","For Rent"] as const).map(l=>(
            <button key={l} onClick={()=>{ go(l==="For Sale"?"buy":"rent"); }} className="flex items-center gap-1.5 px-5 py-2.5 text-[12px] tracking-[0.15em] border transition-all" style={{borderRadius:"9999px",borderColor:listing===l?"transparent":BORDER_L,background:listing===l?"#1a1611":"transparent",color:listing===l?WHITE:FG_LIGHT,...sans}}>{l}</button>
          ))}
          <div className="hidden 2xl:flex items-center gap-2.5">
            <div className="w-px h-5" style={{background:BORDER_L}}/>
            {types.slice(1).map(t=>(
              <button key={t} onClick={()=>setTypeF(typeF===t?"All Types":t)} className="flex items-center gap-1.5 px-5 py-2.5 text-[12px] tracking-[0.15em] border transition-all" style={{borderRadius:"9999px",borderColor:typeF===t?"transparent":BORDER_L,background:typeF===t?MAROON:"transparent",color:typeF===t?WHITE:FG_LIGHT,...sans}}>{t}</button>
            ))}
          </div>
          <div className="w-px h-5" style={{background:BORDER_L}}/>
          <button onClick={()=>setShowFilters(f=>!f)} className="flex items-center gap-1.5 px-5 py-2.5 text-[12px] tracking-[0.15em] border transition-all" style={{borderRadius:"9999px",borderColor:priceF!=="Any Price"?"transparent":BORDER_L,background:priceF!=="Any Price"?MAROON:"transparent",color:priceF!=="Any Price"?WHITE:FG_LIGHT,...sans}}>
            {priceF==="Any Price"?"Price":priceF}<ChevronDown size={13} style={{transform:showFilters?"rotate(180deg)":"none",transition:"transform .2s"}}/>
          </button>
          {typeF!=="All Types"&&(
            <button onClick={()=>setTypeF("All Types")} className="2xl:hidden flex items-center gap-1.5 px-5 py-2.5 text-[12px] tracking-[0.15em] border transition-all" style={{borderRadius:"9999px",borderColor:"transparent",background:MAROON,color:WHITE,...sans}}>
              {typeF}<X size={13}/>
            </button>
          )}
          {distF!=="All"&&(
            <button onClick={()=>setDistF("All")} className="flex items-center gap-1.5 px-5 py-2.5 text-[12px] tracking-[0.15em] border transition-all" style={{borderRadius:"9999px",borderColor:GOLD,background:"rgba(176,136,72,0.12)",color:GOLD,...sans}}>
              {distF}<X size={13}/>
            </button>
          )}
          {dirty&&(
            <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 text-[12px] tracking-[0.15em] transition-all" style={{color:MAROON,...sans}}>
              <RotateCcw size={14}/>Reset
            </button>
          )}
          <div className="ml-auto flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              {([["list",ListIcon],["grid",Grid3X3],["map",Map]] as const).map(([v,I])=>(
                <button key={v} onClick={()=>setView(v)} aria-label={v+" view"} className="p-2.5 border transition-all" style={{background:view===v?"#1a1611":"transparent",borderColor:BORDER_L,color:view===v?WHITE:MUTED_L}}>
                  <I size={14}/>
                </button>
              ))}
            </div>
            <button onClick={scrollToResults} className="flex items-center gap-1.5 px-6 py-2.5 text-[12px] tracking-[0.15em]" style={{borderRadius:"9999px",background:"#1a1611",color:WHITE,...sans}}>
              <Search size={14}/>Search
            </button>
          </div>
        </div>
        {/* Expanded filter panel */}
        <AnimatePresence>
          {showFilters&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.25}} className="overflow-hidden border-t" style={{borderColor:BORDER_L}}>
              <div className="px-6 md:px-12 lg:px-20 py-5 flex flex-col gap-4">
                <div className="flex flex-col gap-2.5">
                  <p className="text-[10px] tracking-[0.28em] uppercase" style={{color:GOLD,...sans}}>Price Range</p>
                  <div className="flex flex-wrap gap-2">
                    {ranges.map(r=>(
                      <button key={r.label} onClick={()=>setPriceF(r.label)} className="px-5 py-2.5 text-[12px] tracking-[0.15em] border transition-all" style={{borderRadius:"9999px",borderColor:priceF===r.label?"transparent":BORDER_L,background:priceF===r.label?MAROON:"transparent",color:priceF===r.label?WHITE:FG_LIGHT,...sans}}>{r.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  <p className="text-[10px] tracking-[0.28em] uppercase" style={{color:GOLD,...sans}}>Property Type</p>
                  <div className="flex flex-wrap gap-2">
                    {types.map(t=>(
                      <button key={t} onClick={()=>setTypeF(t)} className="px-5 py-2.5 text-[12px] tracking-[0.15em] border transition-all" style={{borderRadius:"9999px",borderColor:typeF===t?"transparent":BORDER_L,background:typeF===t?"#1a1611":"transparent",color:typeF===t?WHITE:FG_LIGHT,...sans}}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* District filter row */}
        <div className="px-6 md:px-12 lg:px-20 pb-3 flex gap-2.5 overflow-x-auto" style={{scrollbarWidth:"none"}}>
          {dists.map(d=>(
            <button key={d} onClick={()=>setDistF(d)} className="shrink-0 px-4 py-2 text-[11px] tracking-[0.15em] border transition-all" style={{borderRadius:"9999px",borderColor:distF===d?GOLD:BORDER_L,background:distF===d?"rgba(176,136,72,0.12)":"transparent",color:distF===d?GOLD:MUTED_L,...sans}}>{d}</button>
          ))}
        </div>
      </div>
      {/* Category breakdown */}
      <div className="px-6 md:px-12 lg:px-20 py-7 border-b" style={{borderColor:BORDER_L}}>
        <p className="text-[14px] mb-3" style={{color:MUTED_L,...sans}}>{props.length} {props.length===1?"property":"properties"} found &middot; {heading} in Nepal</p>
        <div className="flex flex-wrap gap-x-8 gap-y-1">
          {types.slice(1).map(t=>{ const c=ALL_PROPS.filter(x=>x.listing===listing&&x.type===t).length; return c>0&&(<button key={t} onClick={()=>setTypeF(typeF===t?"All Types":t)} className="text-[14px] transition-colors hover:text-[#8a2030]" style={{color:typeF===t?MAROON:MUTED_L,...sans}}>{t} ({c})</button>); })}
        </div>
      </div>
      {/* Results */}
      <div ref={resultsRef} className="px-6 md:px-12 lg:px-20 py-14" style={{scrollMarginTop:"13rem"}}>
        {props.length===0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-2xl" style={{color:FG_LIGHT,...serif}}>No properties match these filters</p>
            <p className="text-[15px]" style={{color:MUTED_L,...sans}}>Try widening your price range or choosing a different district.</p>
            <button onClick={reset} className="mt-2 flex items-center gap-2 px-8 py-4 text-[11px] tracking-[0.25em] uppercase" style={{background:MAROON,color:WHITE,...sans}}><RotateCcw size={14}/>Reset Filters</button>
          </div>
        ) : view==="map" ? (
          <MapView props={props} go={go} setId={setId}/>
        ) : view==="grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {props.map(p=><PropertyCard key={p.id} p={p} go={go} setId={setId} light/>)}
          </div>
        ) : (
          <div className="flex flex-col gap-0 border-t" style={{borderColor:BORDER_L}}>
            {props.map(p=>(
              <div key={p.id} className="flex flex-col sm:flex-row items-start gap-0 border-b group cursor-pointer transition-colors hover:bg-[#f0ebe0]/50"
                style={{borderColor:BORDER_L}} onClick={()=>{setId(p.id);go("property");}}>
                <div className="w-full sm:w-80 shrink-0 relative overflow-hidden" style={{aspectRatio:"4/3"}}>
                  <img src={p.hero} alt={p.title} className="w-full h-full object-cover transition-transform duration-600 group-hover:scale-[1.03]"/>
                  <div className="absolute bottom-3 left-3 flex gap-1.5">
                    <span className="px-2 py-0.5 text-[10px] tracking-[0.25em] uppercase" style={{background:MAROON,color:WHITE,...sans}}>{p.badge}</span>
                    {p.verified&&<span className="flex items-center gap-1 px-2 py-0.5 text-[10px]" style={{background:"rgba(176,136,72,0.15)",color:GOLD,...sans}}><CheckCircle2 size={11}/>Verified</span>}
                  </div>
                </div>
                <div className="flex-1 p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-1.5">
                      <div><span className="text-[11px] tracking-[0.25em] uppercase mb-1 block" style={{color:MUTED_L,...sans}}>{p.type} &middot; {p.propId}</span>
                        <h3 className="text-lg leading-tight" style={{color:FG_LIGHT,...serif}}>{p.title}</h3></div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-medium" style={{color:MAROON,...sans}}>{p.price}</p>
                        {p.listing==="For Rent"&&<p className="text-[11px]" style={{color:MUTED_L,...sans}}>per month</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mb-3"><MapPin size={12} style={{color:GOLD}}/><span className="text-[12px]" style={{color:MUTED_L,...sans}}>{p.location}</span></div>
                    <div className="flex flex-wrap gap-4 mb-3">
                      {p.beds>0&&<span className="flex items-center gap-1.5 text-[12px]" style={{color:MUTED_L,...sans}}><Bed size={14}/>{p.beds} Beds</span>}
                      {p.baths>0&&<span className="flex items-center gap-1.5 text-[12px]" style={{color:MUTED_L,...sans}}><Bath size={14}/>{p.baths} Baths</span>}
                      {p.builtArea!=="—"&&<span className="flex items-center gap-1.5 text-[12px]" style={{color:MUTED_L,...sans}}><Square size={14}/>{p.builtArea}</span>}
                      {p.landArea!=="—"&&<span className="flex items-center gap-1.5 text-[12px]" style={{color:MUTED_L,...sans}}><Landmark size={14}/>{p.landArea}</span>}
                    </div>
                    <p className="text-[14px] leading-relaxed line-clamp-2" style={{color:MUTED_L,...sans}}>{p.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 mt-3 border-t" style={{borderColor:BORDER_L}}>
                    <div className="flex items-center gap-2">
                      <img src={logoImg} alt="NB" className="w-6 h-6 object-contain opacity-60"/>
                      <span className="text-[11px]" style={{color:MUTED_L,...sans}}>Nepal Bhoomi</span>
                    </div>
                    <div className="flex gap-2">
                      <button aria-label="Enquire" className="p-2 border transition-all hover:border-[#8a2030]" style={{borderColor:BORDER_L,color:MUTED_L}} onClick={e=>{e.stopPropagation();setId(p.id);go("property");}}><Mail size={15}/></button>
                      <FavButton id={p.id}/>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Map View (Image 4 style — sidebar + map) ─────────────────────────────────
function MapView({ props, go, setId }: { props:Prop[]; go:Go; setId:(id:number)=>void }) {
  const [hovPin,setHovPin]=useState<number|null>(null);
  const [activeCard,setActiveCard]=useState<number|null>(null);
  const [zoom,setZoom]=useState(1);
  const hovProp=hovPin?props.find(p=>p.id===hovPin):null;
  return (
    <div className="flex gap-0 border h-[760px] overflow-hidden" style={{borderColor:BORDER_L}}>
      {/* Sidebar list */}
      <div className="w-96 shrink-0 overflow-y-auto border-r" style={{borderColor:BORDER_L}}>
        {props.map(p=>(
          <div key={p.id} className={`flex flex-col cursor-pointer border-b transition-all ${activeCard===p.id?"bg-[#f0ebe0]":""}`}
            style={{borderColor:BORDER_L}}
            onMouseEnter={()=>{setActiveCard(p.id);setHovPin(p.id);}} onMouseLeave={()=>{setActiveCard(null);setHovPin(null);}}
            onClick={()=>{setId(p.id);go("property");}}>
            <div className="relative overflow-hidden" style={{height:180}}>
              <img src={p.hero} alt={p.title} className="w-full h-full object-cover"/>
              <div className="absolute bottom-2 left-2"><span className="text-base font-semibold px-1.5 py-0.5 text-[15px]" style={{background:"rgba(255,255,255,0.95)",color:FG_LIGHT,...sans}}>{p.price}</span></div>
              <div className="absolute top-2 right-2 flex gap-1.5">
                <FavButton id={p.id} light/>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[14px] leading-tight font-medium" style={{color:FG_LIGHT,...sans}}>{p.title}</p>
              <p className="text-[11px] mt-0.5" style={{color:MUTED_L,...sans}}>{p.location}</p>
              <div className="flex gap-3 mt-1.5">
                {p.builtArea!=="—"&&<span className="flex items-center gap-1 text-[11px]" style={{color:MUTED_L,...sans}}><Square size={11}/>{p.builtArea}</span>}
                {p.beds>0&&<span className="flex items-center gap-1 text-[11px]" style={{color:MUTED_L,...sans}}><Bed size={11}/>{p.beds}</span>}
                {p.baths>0&&<span className="flex items-center gap-1 text-[11px]" style={{color:MUTED_L,...sans}}><Bath size={11}/>{p.baths}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Map canvas */}
      <div className="flex-1 relative overflow-hidden" style={{background:"#e8e4df"}}>
        <div className="absolute inset-0" style={{transform:`scale(${zoom})`,transformOrigin:"center center",transition:"transform 0.28s ease"}}>
          {/* Grid background (street-map aesthetic) */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            {Array.from({length:20}).map((_,i)=><line key={`h${i}`} x1="0%" y1={`${i*5.5}%`} x2="100%" y2={`${i*5.5}%`} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>)}
            {Array.from({length:30}).map((_,i)=><line key={`v${i}`} x1={`${i*3.8}%`} y1="0%" x2={`${i*3.8}%`} y2="100%" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>)}
            {[15,35,55,75].map(v=><line key={`mh${v}`} x1="0%" y1={`${v}%`} x2="100%" y2={`${v}%`} stroke="white" strokeWidth="4"/>)}
            {[20,40,60,80].map(v=><line key={`mv${v}`} x1={`${v}%`} y1="0%" x2={`${v}%`} y2="100%" stroke="white" strokeWidth="4"/>)}
          </svg>
          {/* Property markers */}
          {props.map(p=>(
            <div key={p.id} className="absolute" style={{left:`${p.mapX}%`,top:`${p.mapY}%`,transform:"translate(-50%,-100%)",zIndex:hovPin===p.id?30:5}}>
              <button className="relative flex flex-col items-center group"
                onMouseEnter={()=>setHovPin(p.id)} onMouseLeave={()=>setHovPin(null)}
                onClick={()=>{setId(p.id);go("property");}}>
                <div className="px-2.5 py-1 text-[12px] font-medium mb-0.5 transition-all group-hover:scale-105" style={{background:hovPin===p.id?"#8a2030":"#1a1611",color:WHITE,...sans,borderRadius:2}}>{p.price}</div>
                <div className="w-0 h-0" style={{borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:`6px solid ${hovPin===p.id?"#8a2030":"#1a1611"}`}}/>
              </button>
            </div>
          ))}
        </div>
        {/* Zoom controls */}
        <div className="absolute top-3 left-3 flex flex-col border bg-white z-10" style={{borderColor:BORDER_L}}>
          <button aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(2.2,+(z+0.2).toFixed(2)))} className="px-3 py-2 text-lg leading-none border-b transition-colors hover:bg-gray-50" style={{borderColor:BORDER_L,color:FG_LIGHT}}>+</button>
          <button aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(0.6,+(z-0.2).toFixed(2)))} className="px-3 py-2 text-lg leading-none border-b transition-colors hover:bg-gray-50" style={{borderColor:BORDER_L,color:FG_LIGHT}}>&minus;</button>
          <button aria-label="Reset zoom" onClick={()=>setZoom(1)} className="px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase transition-colors hover:bg-gray-50" style={{color:MUTED_L,...sans}}>{Math.round(zoom*100)}%</button>
        </div>
        {/* Hover popup card */}
        <AnimatePresence>
          {hovProp&&(
            <motion.div className="absolute z-20 w-64 border bg-white overflow-hidden shadow-lg pointer-events-none"
              style={{left:hovProp.mapX>65?`calc(${hovProp.mapX}% - 280px)`:`${hovProp.mapX}%`,top:`${Math.min(hovProp.mapY+2,62)}%`,borderColor:BORDER_L}}
              initial={{opacity:0,scale:0.92}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.92}} transition={{duration:0.18}}>
              <div className="relative">
                <img src={hovProp.hero} alt={hovProp.title} className="w-full h-28 object-cover"/>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[15px] leading-tight" style={{color:MAROON,...sans,fontWeight:600}}>{hovProp.price}</p>
                  {hovProp.verified&&<CheckCircle2 size={15} style={{color:GOLD,flexShrink:0}}/>}
                </div>
                <p className="text-[14px] leading-snug" style={{color:FG_LIGHT,...sans}}>{hovProp.title}</p>
                <div className="flex gap-3 mt-1.5">
                  {hovProp.builtArea!=="—"&&<span className="flex items-center gap-1 text-[11px]" style={{color:MUTED_L,...sans}}><Square size={11}/>{hovProp.builtArea}</span>}
                  {hovProp.beds>0&&<span className="flex items-center gap-1 text-[11px]" style={{color:MUTED_L,...sans}}><Bed size={11}/>{hovProp.beds}</span>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function PropertyDetailPage({ propId, go, setId }: { propId:number; go:Go; setId:(id:number)=>void }) {
  const p=ALL_PROPS.find(x=>x.id===propId)||ALL_PROPS[0];
  const [galIdx,setGalIdx]=useState(0);
  const [lightbox,setLightbox]=useState(false);
  const [hovRoom,setHovRoom]=useState<string|null>(null);
  const [form,setForm]=useState({name:"",email:"",phone:"",msg:""});
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState(false);
  const [fav,setFav]=useState(false);
  const [shared,setShared]=useState(false);
  useEffect(()=>{ setGalIdx(0); setSent(false); setErr(false); setShared(false); },[propId]);
  useEffect(()=>{
    if(!lightbox) return;
    const k=(e:KeyboardEvent)=>{
      if(e.key==="Escape") setLightbox(false);
      if(e.key==="ArrowLeft") setGalIdx(i=>(i-1+p.gallery.length)%p.gallery.length);
      if(e.key==="ArrowRight") setGalIdx(i=>(i+1)%p.gallery.length);
    };
    window.addEventListener("keydown",k);
    document.body.style.overflow="hidden";
    return ()=>{ window.removeEventListener("keydown",k); document.body.style.overflow=""; };
  },[lightbox,p.gallery.length]);
  const share=async()=>{
    const url=typeof window!=="undefined"?window.location.href:"";
    try{
      if(navigator.share) await navigator.share({title:p.title,text:`${p.title} — ${p.location}`,url});
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(()=>setShared(false),2200); }
    }catch{ /* dismissed by the user */ }
  };
  const rooms=[
    {id:"living",label:"Living Room",x:18,y:18,w:40,h:42,dims:"8.5×6.2m"},
    {id:"kitchen",label:"Kitchen",x:18,y:63,w:23,h:28,dims:"5.2×4.8m"},
    {id:"master",label:"Master Bed",x:62,y:18,w:34,h:38,dims:"7.0×5.5m"},
    {id:"bed2",label:"Bedroom 2",x:62,y:59,w:20,h:30,dims:"4.5×4.2m"},
    {id:"bath",label:"Bathroom",x:83,y:59,w:13,h:30,dims:"3.0×4.2m"},
    {id:"dining",label:"Dining",x:44,y:63,w:14,h:28,dims:"4.0×4.8m"},
  ];
  const details=[
    {l:"Property ID",v:p.propId},{l:"Property Type",v:p.type},{l:"Listing",v:p.listing},
    {l:"Built Area",v:p.builtArea},{l:"Land Area",v:p.landArea},{l:"Floors",v:p.floors>0?String(p.floors):"—"},
    {l:"Bedrooms",v:p.beds>0?String(p.beds):"—"},{l:"Bathrooms",v:p.baths>0?String(p.baths):"—"},
    {l:"Road Access",v:p.roadAccess},{l:"Facing",v:p.facing},{l:"Build Year",v:p.buildYear>0?String(p.buildYear):"—"},
    {l:"Verified",v:p.verified?"Yes":"No"},
  ];
  return (
    <div className="pt-20 min-h-screen" style={{background:BG_LIGHT}}>
      {/* Breadcrumb */}
      <div className="px-6 md:px-12 lg:px-20 py-4 border-b flex items-center gap-2 text-[12px]" style={{borderColor:BORDER_L,background:WHITE}}>
        <button onClick={()=>go("home")} className="transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>Home</button>
        <span style={{color:MUTED_L}}>/</span>
        <button onClick={()=>go(p.listing==="For Sale"?"buy":"rent")} className="transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>{p.listing==="For Sale"?"Buy":"Rent"}</button>
        <span style={{color:MUTED_L}}>/</span>
        <span style={{color:FG_LIGHT,...sans}}>{p.title}</span>
      </div>
      {/* Hero gallery */}
      <div className="relative overflow-hidden" style={{height:"68vh",minHeight:460}}>
        <img src={p.gallery[galIdx]} alt={p.title} className="w-full h-full object-cover"/>
        <div className="absolute inset-0" style={{background:"linear-gradient(to bottom, transparent 50%, rgba(14,13,11,0.7) 100%)"}}/>
        {/* Thumbs */}
        <div className="absolute bottom-5 left-5 md:left-10 flex gap-2 z-10">
          {p.gallery.map((g,i)=>(
            <button key={i} onClick={()=>setGalIdx(i)} aria-label={`Photo ${i+1}`} className="w-20 h-14 overflow-hidden border-2 transition-all" style={{borderColor:i===galIdx?GOLD:"transparent",opacity:i===galIdx?1:0.55}}>
              <img src={g} alt="" className="w-full h-full object-cover"/>
            </button>
          ))}
        </div>
        <button onClick={()=>setLightbox(true)} className="absolute top-5 right-5 p-2.5 border" style={{borderColor:"rgba(255,255,255,0.3)",color:WHITE,background:"rgba(0,0,0,0.3)"}}>
          <ZoomIn size={16}/>
        </button>
        {p.gallery.length>1&&<>
          <button onClick={()=>setGalIdx(i=>(i-1+p.gallery.length)%p.gallery.length)} className="absolute left-3 top-1/2 -translate-y-1/2 p-3 border" style={{borderColor:"rgba(255,255,255,0.3)",color:WHITE,background:"rgba(0,0,0,0.3)"}}><ChevronLeft size={18}/></button>
          <button onClick={()=>setGalIdx(i=>(i+1)%p.gallery.length)} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 border" style={{borderColor:"rgba(255,255,255,0.3)",color:WHITE,background:"rgba(0,0,0,0.3)"}}><ChevronRight size={18}/></button>
        </>}
      </div>
      {/* Info bar */}
      <div className="px-6 md:px-12 lg:px-20 py-6 border-b flex flex-wrap items-center gap-x-8 gap-y-3" style={{background:WHITE,borderColor:BORDER_L}}>
        <StatusBadge verified={p.verified} featured={p.featured}/>
        {[p.type,p.builtArea,p.landArea].filter(v=>v!=="—").map(v=><span key={v} className="flex items-center gap-1.5 text-[14px]" style={{color:MUTED_L,...sans}}>{v}</span>)}
        {p.beds>0&&<span className="flex items-center gap-1.5 text-[14px]" style={{color:MUTED_L,...sans}}><Bed size={14}/>{p.beds} Beds</span>}
        {p.baths>0&&<span className="flex items-center gap-1.5 text-[14px]" style={{color:MUTED_L,...sans}}><Bath size={14}/>{p.baths} Baths</span>}
        <div className="ml-auto flex gap-2.5">
          <button aria-label={fav?"Remove from saved":"Save property"} onClick={()=>setFav(f=>!f)} className="p-2.5 border transition-all hover:border-[#8a2030]" style={{borderColor:fav?MAROON:BORDER_L,color:fav?MAROON:MUTED_L}}><Heart size={14} fill={fav?MAROON:"none"}/></button>
          <button aria-label="Share property" onClick={share} className="relative p-2.5 border transition-all hover:border-[#8a2030]" style={{borderColor:BORDER_L,color:MUTED_L}}>
            <Share2 size={14}/>
            {shared&&<span className="absolute -top-8 right-0 whitespace-nowrap px-2 py-1 text-[11px]" style={{background:"#1a1611",color:WHITE,...sans}}>Link copied</span>}
          </button>
          <a href="https://wa.me/9779800000000" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] tracking-[0.2em] uppercase transition-all hover:brightness-110" style={{background:"#25D366",color:WHITE,...sans}}><MessageCircle size={15}/>WhatsApp</a>
        </div>
      </div>
      {/* Content */}
      <div className="px-6 md:px-12 lg:px-20 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-20">
        {/* Left */}
        <div className="lg:col-span-2 flex flex-col gap-14">
          <div>
            <div className="flex items-center gap-3 mb-3"><GoldLine/><Tag c={GOLD}>{p.badge}</Tag></div>
            <h1 className="leading-[0.92] mb-2" style={{color:FG_LIGHT,...serif,fontSize:"clamp(1.8rem,4vw,3.5rem)"}}>{p.title}</h1>
            <div className="flex items-center gap-1.5 mb-3"><MapPin size={14} style={{color:GOLD}}/><span className="text-[14px]" style={{color:MUTED_L,...sans}}>{p.location}</span></div>
            <div className="flex items-baseline gap-3"><span className="text-2xl font-medium" style={{color:MAROON,...sans}}>{p.price}</span>{p.listing==="For Rent"&&<span className="text-sm" style={{color:MUTED_L,...sans}}>per month</span>}</div>
          </div>
          <div className="h-px" style={{background:BORDER_L}}/>
          {/* Property Details table */}
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-5" style={{color:GOLD,...sans}}>Property Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 border-t border-l" style={{borderColor:BORDER_L}}>
              {details.map(d=>(
                <div key={d.l} className="border-b border-r px-5 py-4" style={{borderColor:BORDER_L}}>
                  <p className="text-[10px] tracking-[0.25em] uppercase mb-0.5" style={{color:MUTED_L,...sans}}>{d.l}</p>
                  <p className="text-[15px] font-medium" style={{color:FG_LIGHT,...sans}}>{d.v}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="h-px" style={{background:BORDER_L}}/>
          {/* Description */}
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{color:GOLD,...sans}}>Description</p>
            <p className="leading-[1.85]" style={{color:MUTED_L,...sans,fontSize:"1.05rem"}}>{p.description}</p>
          </div>
          <div className="h-px" style={{background:BORDER_L}}/>
          {/* Features */}
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-5" style={{color:GOLD,...sans}}>Features & Amenities</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1">
              {p.features.map(f=>{
                const Icon=amenityIcon(f);
                return (
                  <div key={f} className="flex items-center gap-3 py-4 border-b" style={{borderColor:BORDER_L}}>
                    {/* Fixed-width slot so rows with an icon and rows still on the
                        old gold dot line up with each other. */}
                    <span className="w-5 flex items-center justify-center shrink-0" style={{color:GOLD}}>
                      {Icon ? <Icon size={19}/> : <span className="w-1.5 h-1.5 rounded-full" style={{background:GOLD}}/>}
                    </span>
                    <span className="text-[14px]" style={{color:MUTED_L,...sans}}>{f}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {p.beds>0&&<>
            <div className="h-px" style={{background:BORDER_L}}/>
            {/* Interactive Floor Plan */}
            <div>
              <p className="text-[11px] tracking-[0.3em] uppercase mb-5" style={{color:GOLD,...sans}}>Floor Plan</p>
              <div className="relative border p-5" style={{background:CREAM,borderColor:BORDER_L}}>
                <svg viewBox="0 0 100 95" className="w-full" style={{maxHeight:300}}>
                  <rect x="16" y="16" width="66" height="75" fill="none" stroke={BORDER_L} strokeWidth="0.8"/>
                  {rooms.map(r=>(
                    <g key={r.id} onMouseEnter={()=>setHovRoom(r.id)} onMouseLeave={()=>setHovRoom(null)} className="cursor-pointer">
                      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={hovRoom===r.id?"rgba(138,32,48,0.1)":"rgba(26,22,17,0.03)"} stroke={hovRoom===r.id?MAROON:BORDER_L} strokeWidth="0.5" className="transition-all duration-150"/>
                      <text x={r.x+r.w/2} y={r.y+r.h/2-1.5} textAnchor="middle" fontSize="3.2" fill={hovRoom===r.id?MAROON:MUTED_L} style={{fontFamily:"Jost,sans-serif",pointerEvents:"none"}}>{r.label}</text>
                      {hovRoom===r.id&&<text x={r.x+r.w/2} y={r.y+r.h/2+3.5} textAnchor="middle" fontSize="2.6" fill={MUTED_L} style={{fontFamily:"Jost,sans-serif"}}>{r.dims}</text>}
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </>}
        </div>
        {/* Right — sticky enquiry */}
        <div className="lg:col-span-1">
          <div className="sticky top-28 border p-8 flex flex-col gap-5" style={{background:WHITE,borderColor:BORDER_L}}>
            <p className="text-[11px] tracking-[0.3em] uppercase" style={{color:GOLD,...sans}}>Enquire About This Property</p>
            {sent?(
              <div className="flex flex-col items-center text-center gap-3 py-8">
                <CheckCircle2 size={30} style={{color:GOLD}}/>
                <p className="text-lg" style={{color:FG_LIGHT,...serif}}>Enquiry sent</p>
                <p className="text-[14px] leading-relaxed" style={{color:MUTED_L,...sans}}>An advisor will be in touch about {p.title} within 24 hours.</p>
                <button onClick={()=>{setSent(false);setForm({name:"",email:"",phone:"",msg:""});}} className="mt-1 text-[11px] tracking-[0.25em] uppercase transition-colors hover:brightness-110" style={{color:MAROON,...sans}}>Send another</button>
              </div>
            ):(<>
              <p className="text-[12px] leading-relaxed" style={{color:MUTED_L,...sans}}>Our advisors respond within 24 hours with full details.</p>
              {[{k:"name",l:"Full Name",t:"text",ph:"Your name"},{k:"email",l:"Email",t:"email",ph:"your@email.com"},{k:"phone",l:"Phone",t:"tel",ph:"+977 ..."}].map(f=>(
                <div key={f.k} className="flex flex-col gap-1">
                  <label className="text-[10px] tracking-[0.25em] uppercase" style={{color:MUTED_L,...sans}}>{f.l}</label>
                  <input type={f.t} placeholder={f.ph} value={form[f.k as keyof typeof form]} onChange={e=>setForm(v=>({...v,[f.k]:e.target.value}))} className="border px-3 py-2.5 text-[14px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] tracking-[0.25em] uppercase" style={{color:MUTED_L,...sans}}>Message</label>
                <textarea rows={3} value={form.msg} onChange={e=>setForm(v=>({...v,msg:e.target.value}))} className="border px-3 py-2.5 text-[14px] outline-none resize-none transition-all focus:border-[#8a2030]" placeholder="I'm interested in this property..." style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
              </div>
              <button onClick={()=>{ if(form.name.trim()&&(form.email.trim()||form.phone.trim())){setSent(true);setErr(false);} else setErr(true); }} className="flex items-center justify-center gap-2 py-3.5 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}><Send size={14}/>Send Enquiry</button>
              {err&&<p className="text-[12px]" style={{color:MAROON,...sans}}>Please add your name and either an email or a phone number.</p>}
            </>)}
            <div className="flex gap-2.5">
              <a href="tel:+9771400000" className="flex-1 flex items-center justify-center gap-1.5 py-3 border text-[11px] tracking-[0.2em] uppercase transition-all hover:border-[#8a2030]" style={{borderColor:BORDER_L,color:MUTED_L,...sans}}><Phone size={14}/>Call</a>
              <a href="https://wa.me/9779800000000" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-3 border text-[11px] tracking-[0.2em] uppercase transition-all" style={{borderColor:"#25D366",color:"#25D366",...sans,background:"rgba(37,211,102,0.07)"}}><MessageCircle size={14}/>WhatsApp</a>
            </div>
          </div>
        </div>
      </div>
      {/* Related */}
      <div className="border-t px-6 md:px-12 lg:px-20 py-16" style={{borderColor:BORDER_L,background:CREAM}}>
        <p className="text-[11px] tracking-[0.32em] uppercase mb-8" style={{color:GOLD,...sans}}>You May Also Like</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {ALL_PROPS.filter(x=>x.id!==p.id&&x.listing===p.listing).slice(0,3).map(x=><PropertyCard key={x.id} p={x} go={go} setId={setId} light/>)}
        </div>
      </div>
      {/* Lightbox */}
      <AnimatePresence>
        {lightbox&&(
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(0,0,0,0.95)"}} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setLightbox(false)}>
            <button onClick={()=>setLightbox(false)} aria-label="Close" className="absolute top-5 right-5 p-2.5 border" style={{borderColor:"rgba(255,255,255,0.2)",color:WHITE}}><X size={18}/></button>
            <div className="relative max-w-5xl w-full px-10" onClick={e=>e.stopPropagation()}>
              <img src={p.gallery[galIdx]} alt="" className="w-full h-auto max-h-[80vh] object-contain"/>
              <button onClick={()=>setGalIdx(i=>(i-1+p.gallery.length)%p.gallery.length)} className="absolute left-0 top-1/2 -translate-y-1/2 p-3" style={{color:WHITE}}><ChevronLeft size={24}/></button>
              <button onClick={()=>setGalIdx(i=>(i+1)%p.gallery.length)} className="absolute right-0 top-1/2 -translate-y-1/2 p-3" style={{color:WHITE}}><ChevronRight size={24}/></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMI CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
function EMICalculator() {
  const [loan,setLoan]=useState(5000000);
  const [rate,setRate]=useState(8.5);
  const [months,setMonths]=useState(120);
  const r=rate/12/100;
  const emi=r>0?Math.round(loan*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1)):Math.round(loan/months);
  const total=emi*months;
  const interest=total-loan;
  const denom=total>0?total:1;
  const fmt=(n:number)=>"NPR "+n.toLocaleString("en-IN");
  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      <div className="px-6 md:px-12 lg:px-20 py-20 border-b" style={{borderColor:BORDER_L}}>
        <div className="flex items-center gap-3 mb-4"><GoldLine/><Tag c={GOLD}>Financial Tools</Tag></div>
        <h1 className="leading-[0.92]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.6rem,5.4vw,4.6rem)"}}>EMI Calculator</h1>
        <p className="mt-3 text-[15px]" style={{color:MUTED_L,...sans}}>Calculate your monthly home loan instalment based on loan amount, interest rate and duration.</p>
      </div>
      <div className="px-6 md:px-12 lg:px-20 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Inputs */}
        <div className="flex flex-col gap-12">
          {[
            {label:"Loan Amount (NPR)",val:loan,set:setLoan,min:500000,max:50000000,step:100000,fmt:(v:number)=>fmt(v)},
            {label:"Annual Interest Rate (%)",val:rate,set:setRate,min:1,max:25,step:0.5,fmt:(v:number)=>`${v}%`},
            {label:"Loan Duration (Months)",val:months,set:setMonths,min:12,max:360,step:12,fmt:(v:number)=>`${v} months (${Math.round(v/12)} years)`},
          ].map(f=>(
            <div key={f.label} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] tracking-[0.25em] uppercase" style={{color:MUTED_L,...sans}}>{f.label}</label>
                <span className="text-[15px] font-medium" style={{color:FG_LIGHT,...sans}}>{f.fmt(f.val)}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={f.val}
                onChange={e=>f.set(Number(e.target.value))} className="w-full h-1 appearance-none cursor-pointer"
                style={{accentColor:MAROON,background:`linear-gradient(to right, ${MAROON} ${((f.val-f.min)/(f.max-f.min))*100}%, ${BORDER_L} ${((f.val-f.min)/(f.max-f.min))*100}%)`}}/>
              <div className="flex justify-between text-[11px]" style={{color:MUTED_L,...sans}}><span>{f.fmt(f.min)}</span><span>{f.fmt(f.max)}</span></div>
              <input type="number" min={f.min} max={f.max} step={f.step} value={f.val}
                onChange={e=>f.set(Math.min(f.max,Number(e.target.value)||0))}
                onBlur={e=>f.set(Math.min(f.max,Math.max(f.min,Number(e.target.value)||f.min)))}
                className="border px-3 py-2 text-[15px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
            </div>
          ))}
        </div>
        {/* Results */}
        <div className="flex flex-col gap-6">
          <div className="p-10 border" style={{background:WHITE,borderColor:BORDER_L}}>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{color:GOLD,...sans}}>Your Monthly EMI</p>
            <p className="leading-none mb-6" style={{color:MAROON,...serif,fontSize:"clamp(2.5rem,5vw,4rem)"}}>{fmt(emi)}</p>
            <div className="flex flex-col gap-0 border-t" style={{borderColor:BORDER_L}}>
              {[{l:"Principal Amount",v:fmt(loan)},{l:"Total Interest Payable",v:fmt(interest)},{l:"Total Amount Payable",v:fmt(total)},{l:"Loan Tenure",v:`${months} months`}].map(r=>(
                <div key={r.l} className="flex items-center justify-between py-4 border-b" style={{borderColor:BORDER_L}}>
                  <span className="text-[14px]" style={{color:MUTED_L,...sans}}>{r.l}</span>
                  <span className="text-[15px] font-medium" style={{color:FG_LIGHT,...sans}}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Donut visual */}
          <div className="p-8 border" style={{background:CREAM,borderColor:BORDER_L}}>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-6" style={{color:GOLD,...sans}}>Repayment Breakdown</p>
            <div className="flex items-center gap-8">
              <svg viewBox="0 0 100 100" className="w-36 h-36">
                {(() => {
                  const pPct=loan/denom*100;
                  const iPct=interest/denom*100;
                  const r=40; const cx=50; const cy=50;
                  const toXY=(pct:number,prev:number)=>{ const a=(prev+pct/2)*3.6-90; return {x:cx+r*Math.cos(a*Math.PI/180),y:cy+r*Math.sin(a*Math.PI/180)}; };
                  const arc=(start:number,pct:number,col:string)=>{
                    const s=start*3.6-90; const e=(start+pct)*3.6-90; const large=pct>50?1:0;
                    const sx=cx+r*Math.cos(s*Math.PI/180),sy=cy+r*Math.sin(s*Math.PI/180);
                    const ex=cx+r*Math.cos(e*Math.PI/180),ey=cy+r*Math.sin(e*Math.PI/180);
                    return <path key={col} d={`M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} Z`} fill={col}/>;
                  };
                  return [arc(0,pPct,MAROON),arc(pPct,iPct,GOLD)];
                })()}
                <circle cx="50" cy="50" r="28" fill={WHITE}/>
              </svg>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3" style={{background:MAROON}}/><span className="text-[12px]" style={{color:MUTED_L,...sans}}>Principal: {Math.round(loan/denom*100)}%</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3" style={{background:GOLD}}/><span className="text-[12px]" style={{color:MUTED_L,...sans}}>Interest: {Math.round(interest/denom*100)}%</span></div>
              </div>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed" style={{color:MUTED_L,...sans}}>* This calculation is for indicative purposes only. Actual EMI may vary based on your lender's terms and conditions.</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABOUT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function AboutPage({ go }: { go:Go }) {
  return (
    <div className="pt-20 min-h-screen" style={{background:BG_LIGHT}}>
      <div className="relative overflow-hidden" style={{height:"55vh",minHeight:300}}>
        <img src={img("photo-1544735716-392fe2489ffa",1920,800)} alt="Nepal" className="w-full h-full object-cover opacity-50"/>
        <div className="absolute inset-0" style={{background:"linear-gradient(to top, rgba(14,13,11,1) 0%, rgba(14,13,11,0.25) 100%)"}}/>
        <div className="absolute bottom-10 left-6 md:left-12 lg:left-20 right-6">
          <div className="flex items-center gap-3 mb-4"><GoldLine/><Tag>Our Story</Tag></div>
          <h1 className="leading-[0.9] max-w-3xl" style={{color:FG_DARK,...serif,fontSize:"clamp(2.6rem,5.4vw,5rem)"}}>Nepal's Most Trusted Luxury Real Estate Advisory</h1>
        </div>
      </div>
      {/* Mission + Vision */}
      <div className="grid grid-cols-1 lg:grid-cols-2 border-b" style={{borderColor:BORDER_L,background:WHITE}}>
        {[{title:"Our Mission",text:"To connect Nepal's most discerning buyers, sellers and investors with exceptional properties — delivered with honesty, expertise and unwavering client focus."},
          {title:"Our Vision",text:"To be the benchmark of luxury real estate advisory in Nepal, recognised internationally for the quality of our portfolio, the expertise of our team and the integrity of our practice."}].map(s=>(
          <div key={s.title} className="border-r last:border-0 px-10 py-16" style={{borderColor:BORDER_L}}>
            <div className="flex items-center gap-3 mb-5"><GoldLine/><Tag c={GOLD}>Nepal Bhoomi</Tag></div>
            <h2 className="text-2xl mb-4" style={{color:FG_LIGHT,...serif}}>{s.title}</h2>
            <p className="text-[15px] leading-[1.8]" style={{color:MUTED_L,...sans}}>{s.text}</p>
          </div>
        ))}
      </div>
      {/* What We Offer */}
      <div className="px-6 md:px-12 lg:px-20 py-20 border-b" style={{background:CREAM,borderColor:BORDER_L}}>
        <h2 className="text-3xl mb-12" style={{color:FG_LIGHT,...serif}}>What We Offer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l" style={{borderColor:BORDER_L}}>
          {SERVICES_LIST.map(s=>(
            <div key={s.title} className="border-b border-r px-8 py-10" style={{borderColor:BORDER_L}}>
              <div className="mb-3" style={{color:MAROON}}>{s.icon}</div>
              <p className="text-[15px] mb-2" style={{color:FG_LIGHT,...serif}}>{s.title}</p>
              <p className="text-[14px] leading-relaxed" style={{color:MUTED_L,...sans}}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Team */}
      <div className="px-6 md:px-12 lg:px-20 py-20 border-b" style={{background:WHITE,borderColor:BORDER_L}}>
        <h2 className="text-3xl mb-12" style={{color:FG_LIGHT,...serif}}>Our Team</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[{name:"Arjun Thapa",role:"Founder & Principal Advisor",img:img("photo-1560250097-0b93528c311a",500,600)},
            {name:"Priya Shrestha",role:"Senior Property Consultant",img:img("photo-1580489944761-15a19d674349",500,600)},
            {name:"Rajan Maharjan",role:"Investment Specialist",img:img("photo-1507003211169-0a1dd7228f2d",500,600)}].map(m=>(
            <div key={m.name}>
              <div className="overflow-hidden mb-4" style={{aspectRatio:"4/5"}}><img src={m.img} alt={m.name} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"/></div>
              <p className="text-base" style={{color:FG_LIGHT,...serif}}>{m.name}</p>
              <p className="text-[12px] tracking-[0.15em] mt-0.5" style={{color:MUTED_L,...sans}}>{m.role}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Why Choose Us */}
      <div className="px-6 md:px-12 lg:px-20 py-20" style={{background:CREAM}}>
        <h2 className="text-3xl mb-12" style={{color:FG_LIGHT,...serif}}>Why Choose Nepal Bhoomi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border-t" style={{borderColor:BORDER_L}}>
          {[{n:"01",t:"Verified Properties",d:"Every listing on Nepal Bhoomi is personally verified by our team for accuracy, documentation and quality."},
            {n:"02",t:"Expert Advisors",d:"Our advisors bring decades of combined experience across Nepal's residential, commercial and investment markets."},
            {n:"03",t:"Complete Transparency",d:"From pricing to documentation, we maintain complete transparency at every stage of your property journey."},
            {n:"04",t:"Client Journey Support",d:"We stay with you from initial search through legal completion, ensuring a seamless and stress-free experience."}].map(r=>(
            <div key={r.n} className="flex gap-7 py-10 pr-8 border-b border-r" style={{borderColor:BORDER_L}}>
              <span className="text-[11px] tracking-[0.28em] mt-1 shrink-0" style={{color:GOLD,...sans}}>{r.n}</span>
              <div><p className="text-[15px] mb-1.5" style={{color:FG_LIGHT,...serif}}>{r.t}</p><p className="text-[14px] leading-relaxed" style={{color:MUTED_L,...sans}}>{r.d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOG PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function BlogPage({ go }: { go:Go }) {
  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      <div className="px-6 md:px-12 lg:px-20 py-16 md:py-20 border-b" style={{borderColor:BORDER_L,background:WHITE}}>
        <div className="flex items-center gap-3 mb-4"><GoldLine/><Tag c={GOLD}>Insights &amp; News</Tag></div>
        <h1 className="leading-[0.92]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.6rem,5.4vw,4.6rem)"}}>Property Journal</h1>
      </div>
      <div className="px-6 md:px-12 lg:px-20 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-14">
          {BLOGS.map(a=>(
            <button key={a.id} onClick={()=>go("blog-post",{blog:a.id})} className="flex flex-col group text-left">
              <div className="overflow-hidden mb-4" style={{aspectRatio:"16/10"}}>
                <img src={a.image} alt={a.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"/>
              </div>
              <span className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{color:GOLD,...sans}}>{a.cat}</span>
              <h3 className="text-[1.05rem] leading-snug mb-2 group-hover:text-[#8a2030] transition-colors" style={{color:FG_LIGHT,...serif}}>{a.title}</h3>
              <p className="text-[14px] leading-relaxed flex-1" style={{color:MUTED_L,...sans}}>{a.excerpt}</p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{borderColor:BORDER_L}}>
                <span className="text-[11px]" style={{color:MUTED_L,...sans}}>{a.date} &middot; {a.read}</span>
                <span className="text-[11px] tracking-[0.2em] uppercase" style={{color:MAROON,...sans}}>Read &rarr;</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Blog Post ─────────────────────────────────────────────────────────────────
function BlogPostPage({ id, go }: { id:number; go:Go }) {
  const a=BLOGS.find(b=>b.id===id)||BLOGS[0];
  const more=BLOGS.filter(b=>b.id!==a.id);
  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      <div className="px-6 md:px-12 lg:px-20 py-4 border-b flex items-center gap-2 text-[12px]" style={{borderColor:BORDER_L,background:WHITE}}>
        <button onClick={()=>go("home")} className="transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>Home</button>
        <span style={{color:MUTED_L}}>/</span>
        <button onClick={()=>go("blog")} className="transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>Journal</button>
        <span style={{color:MUTED_L}}>/</span>
        <span style={{color:FG_LIGHT,...sans}}>{a.cat}</span>
      </div>
      <div className="relative overflow-hidden" style={{height:"52vh",minHeight:320}}>
        <img src={a.image} alt={a.title} className="w-full h-full object-cover"/>
        <div className="absolute inset-0" style={{background:"linear-gradient(to top, rgba(14,13,11,0.55) 0%, transparent 60%)"}}/>
        <div className="absolute top-5 left-6 md:left-12 lg:left-20"><span className="px-3 py-1 text-[10px] tracking-[0.25em] uppercase" style={{background:MAROON,color:WHITE,...sans}}>{a.cat}</span></div>
      </div>
      <article className="px-6 md:px-12 lg:px-20 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-5"><GoldLine/><Tag c={GOLD}>{a.date} &middot; {a.read} read</Tag></div>
          <h1 className="leading-[0.95]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2rem,4.5vw,3.4rem)"}}>{a.title}</h1>
          <p className="mt-8 pt-8 border-t leading-[1.75]" style={{borderColor:BORDER_L,color:MUTED_L,...sans,fontSize:"1.05rem"}}>{a.excerpt}</p>
          <div className="flex items-center gap-3 mt-10 pt-6 border-t" style={{borderColor:BORDER_L}}>
            <div className="w-9 h-9 flex items-center justify-center rounded-full" style={{background:"rgba(176,136,72,0.14)",color:GOLD}}><FileText size={15}/></div>
            <div>
              <p className="text-[15px] font-medium" style={{color:FG_LIGHT,...sans}}>{a.author}</p>
              <p className="text-[12px]" style={{color:MUTED_L,...sans}}>Nepal Bhoomi Editorial</p>
            </div>
          </div>
        </div>
      </article>
      <div className="border-t px-6 md:px-12 lg:px-20 py-16" style={{borderColor:BORDER_L,background:CREAM}}>
        <p className="text-[11px] tracking-[0.32em] uppercase mb-8" style={{color:GOLD,...sans}}>More From The Journal</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {more.map(b=>(
            <button key={b.id} onClick={()=>go("blog-post",{blog:b.id})} className="flex flex-col group text-left">
              <div className="overflow-hidden mb-4" style={{aspectRatio:"16/10"}}>
                <img src={b.image} alt={b.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"/>
              </div>
              <span className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{color:GOLD,...sans}}>{b.cat}</span>
              <h3 className="text-[1.05rem] leading-snug group-hover:text-[#8a2030] transition-colors" style={{color:FG_LIGHT,...serif}}>{b.title}</h3>
              <span className="text-[11px] mt-2" style={{color:MUTED_L,...sans}}>{b.date} &middot; {b.read}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Services Page ─────────────────────────────────────────────────────────────
function ServicesPage({ go }: { go:Go }) {
  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      <div className="px-6 md:px-12 lg:px-20 py-16 md:py-20 border-b" style={{borderColor:BORDER_L,background:WHITE}}>
        <div className="flex items-center gap-3 mb-4"><GoldLine/><Tag c={GOLD}>What We Do</Tag></div>
        <h1 className="leading-[0.92]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.6rem,5.4vw,4.6rem)"}}>Our Services</h1>
        <p className="mt-3 text-[15px] max-w-xl" style={{color:MUTED_L,...sans}}>A full-spectrum real estate advisory service crafted around the unique requirements of Nepal's property market.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-l px-0" style={{borderColor:BORDER_L}}>
        {SERVICES_LIST.map(s=>(
          <div key={s.title} className="border-b border-r px-10 py-12" style={{borderColor:BORDER_L}}>
            <div className="w-14 h-14 flex items-center justify-center border mb-6" style={{borderColor:BORDER_L,color:MAROON}}>{s.icon}</div>
            <h3 className="text-xl mb-3" style={{color:FG_LIGHT,...serif}}>{s.title}</h3>
            <p className="text-[15px] leading-[1.75]" style={{color:MUTED_L,...sans}}>{s.desc}</p>
            <button onClick={()=>go("contact")} className="mt-6 flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase group/btn" style={{color:MAROON,...sans}}>Learn More <ArrowRight size={13} className="transition-transform group-hover/btn:translate-x-1"/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Contact Page ──────────────────────────────────────────────────────────────
function ContactPage() {
  const [form,setForm]=useState({name:"",email:"",phone:"",interest:"General Enquiry",msg:""});
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState(false);
  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      <div className="px-6 md:px-12 lg:px-20 py-16 md:py-20 border-b" style={{borderColor:BORDER_L,background:WHITE}}>
        <div className="flex items-center gap-3 mb-4"><GoldLine/><Tag c={GOLD}>Get In Touch</Tag></div>
        <h1 className="leading-[0.92]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.6rem,5.4vw,4.6rem)"}}>Contact Us</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="px-8 md:px-12 py-16 border-r" style={{borderColor:BORDER_L,background:WHITE}}>
          {sent?(<div className="flex flex-col items-start gap-4 py-8"><CheckCircle2 size={32} style={{color:GOLD}}/><p className="text-xl" style={{color:FG_LIGHT,...serif}}>Thank you for your enquiry.</p><p className="text-[15px]" style={{color:MUTED_L,...sans}}>We will be in contact within 24 hours.</p></div>):(
            <div className="flex flex-col gap-5 max-w-lg">
              {[{k:"name",l:"Full Name",t:"text",ph:"Your name"},{k:"email",l:"Email",t:"email",ph:"your@email.com"},{k:"phone",l:"Phone",t:"tel",ph:"+977 ..."}].map(f=>(
                <div key={f.k} className="flex flex-col gap-1.5">
                  <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>{f.l}</label>
                  <input type={f.t} placeholder={f.ph} value={form[f.k as keyof typeof form]} onChange={e=>setForm(v=>({...v,[f.k]:e.target.value}))} className="border px-4 py-3 text-[15px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Interest</label>
                <div className="relative"><select value={form.interest} onChange={e=>setForm(v=>({...v,interest:e.target.value}))} className="w-full border px-4 py-3 text-[15px] outline-none appearance-none" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}>
                  {["General Enquiry","Buy Property","Rent Property","Investment Advisory","Free Listing"].map(o=><option key={o}>{o}</option>)}
                </select><ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:MUTED_L}}/></div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Message</label>
                <textarea rows={4} value={form.msg} onChange={e=>setForm(v=>({...v,msg:e.target.value}))} className="border px-4 py-3 text-[15px] outline-none resize-none" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
              </div>
              <button onClick={()=>{ if(form.name.trim()&&form.email.trim()){setSent(true);setErr(false);} else setErr(true); }} className="py-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Send Enquiry</button>
              {err&&<p className="text-[14px]" style={{color:MAROON,...sans}}>Please enter your name and email address.</p>}
            </div>
          )}
        </div>
        <div className="px-8 md:px-12 py-16 flex flex-col gap-10" style={{background:CREAM}}>
          <div><p className="text-[10px] tracking-[0.32em] uppercase mb-3" style={{color:GOLD,...sans}}>Our Office</p><p className="text-[15px] leading-relaxed" style={{color:MUTED_L,...sans}}>Jhamsikhel Road, Lalitpur<br/>Kathmandu Valley, Nepal</p></div>
          {[{i:<Phone size={14}/>,l:"Telephone",v:"+977 1 400 0000"},{i:<Mail size={14}/>,l:"Email",v:"info@nepalbhoomi.com"},{i:<MessageCircle size={14}/>,l:"WhatsApp",v:"+977 980 000 0000"}].map(c=>(
            <div key={c.l} className="flex items-start gap-4 border-t pt-6" style={{borderColor:BORDER_L}}>
              <span style={{color:GOLD,marginTop:1}}>{c.i}</span>
              <div><p className="text-[10px] tracking-[0.28em] uppercase mb-1" style={{color:MUTED_L,...sans}}>{c.l}</p><p className="text-[15px]" style={{color:FG_LIGHT,...sans}}>{c.v}</p></div>
            </div>
          ))}
          <div className="border-t pt-6" style={{borderColor:BORDER_L}}>
            <p className="text-[10px] tracking-[0.32em] uppercase mb-3" style={{color:GOLD,...sans}}>Office Hours</p>
            {["Sunday–Friday: 9:00 AM – 6:00 PM","Saturday: By Appointment"].map(t=><p key={t} className="text-[15px] mb-1" style={{color:MUTED_L,...sans}}>{t}</p>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Login Page ────────────────────────────────────────────────────────────────
type GoogleResult = "success" | "mfa" | "error" | null;
const GOOGLE_ERROR="Google sign-in failed. Please try again.";

function LoginPage({ go, googleResult=null }: { go:Go; googleResult?:GoogleResult }) {
  const [mode,setMode]=useState<"signin"|"forgot">("signin");
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const { user, status, login, verifyMfa } = useAuth();
  const [err,setErr]=useState(googleResult==="error" ? GOOGLE_ERROR : "");
  const [busy,setBusy]=useState(false);
  // Second step for accounts with 2FA. token is undefined after Google sign-in (it's in a cookie).
  const [mfa,setMfa]=useState<{ token?:string }|null>(googleResult==="mfa" ? {} : null);
  const [code,setCode]=useState("");
  const [resetSent,setResetSent]=useState(false);
  // The AuthProvider finishes Google sign-in on load (refresh cookie -> access token -> /me).
  const googleFailed=googleResult==="success" && status==="anonymous";
  const shownErr=err || (googleFailed ? GOOGLE_ERROR : "");

  const emailLooksValid=(v:string)=>/^\S+@\S+\.\S+$/.test(v.trim());

  const submit=async()=>{
    if(busy) return;
    if(!email.trim()||!pw){ setErr("Please enter your email and password."); return; }
    if(!emailLooksValid(email)){ setErr("Please enter a valid email address."); return; }
    setErr(""); setBusy(true);
    try {
      const r=await login(email.trim(), pw);
      setPw("");
      if("mfaRequired" in r){ setMfa({ token:r.mfaToken }); setCode(""); }
    }
    catch(e){ setErr(e instanceof ApiError ? e.message : "Sign in failed. Please try again."); }
    finally { setBusy(false); }
  };

  const submitCode=async()=>{
    if(busy||!mfa) return;
    if(!code.trim()){ setErr("Enter the 6-digit code from your authenticator app."); return; }
    setErr(""); setBusy(true);
    try { await verifyMfa(code.trim(), mfa.token); setMfa(null); }
    catch(e){
      setErr(e instanceof ApiError ? e.message : "Verification failed. Please try again.");
      // The 5-minute sign-in window ran out: start again from the password step.
      if(e instanceof ApiError && e.message.startsWith("Your sign-in expired")) setMfa(null);
    }
    finally { setBusy(false); setCode(""); }
  };

  const sendReset=()=>{
    if(!email.trim()){ setErr("Please enter your email address."); return; }
    if(!emailLooksValid(email)){ setErr("Please enter a valid email address."); return; }
    setErr(""); setResetSent(true);
  };

  const switchMode=(next:"signin"|"forgot")=>{ setMode(next); setErr(""); setResetSent(false); };

  // The backend builds the Google URL (it holds the client secret) and handles the callback.
  const signInWithGoogle=()=>{ window.location.assign(`${API_URL}/api/v1/auth/google`); };

  return (
    <div className="min-h-screen pt-20 flex items-center justify-center py-16" style={{background:BG_LIGHT}}>
      <div className="w-full max-w-md border p-12" style={{background:WHITE,borderColor:BORDER_L}}>
        <div className="flex justify-center mb-8"><img src={logoImg} alt="NB" className="h-12 w-12 object-contain"/></div>

        {status==="loading" && googleResult==="success" ? (
          <p className="text-center text-[15px] py-10" style={{color:MUTED_L,...sans}}>Signing you in...</p>
        ) : !user && mfa ? (
          <>
            <h2 className="text-2xl text-center mb-2" style={{color:FG_LIGHT,...serif}}>Two-step verification</h2>
            <p className="text-[14px] text-center mb-8" style={{color:MUTED_L,...sans}}>Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
            <div className="flex flex-col gap-1.5 mb-2">
              <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Code</label>
              <input value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitCode()} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" maxLength={20} className="border px-4 py-3 text-[18px] tracking-[0.3em] text-center outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
            </div>
            {err&&<p className="text-[14px] mt-2 mb-1" style={{color:MAROON,...sans}}>{err}</p>}
            <button onClick={submitCode} disabled={busy} className="w-full py-4 mt-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}>{busy?"Verifying...":"Verify"}</button>
            <button onClick={()=>{ setMfa(null); setErr(""); }} className="w-full mt-5 flex items-center justify-center gap-2 text-[13px] transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>
              <ChevronLeft size={14}/>Back to sign in
            </button>
          </>
        ) : user ? (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <CheckCircle2 size={34} style={{color:GOLD}}/>
            <h2 className="text-2xl" style={{color:FG_LIGHT,...serif}}>Welcome back</h2>
            <p className="text-[15px] leading-relaxed" style={{color:MUTED_L,...sans}}>You are signed in as {user.email}.</p>
            <button onClick={()=>go("home")} className="mt-2 px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Continue Browsing</button>
          </div>
        ) : mode==="forgot" ? (
          resetSent ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <Mail size={30} style={{color:GOLD}}/>
              <h2 className="text-2xl" style={{color:FG_LIGHT,...serif}}>Check your inbox</h2>
              <p className="text-[15px] leading-relaxed" style={{color:MUTED_L,...sans}}>
                If an account exists for {email}, a password reset link is on its way. The link expires in one hour.
              </p>
              <button onClick={()=>switchMode("signin")} className="mt-2 flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase transition-colors hover:text-[#8a2030]" style={{color:MAROON,...sans}}>
                <ChevronLeft size={14}/>Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl text-center mb-2" style={{color:FG_LIGHT,...serif}}>Reset your password</h2>
              <p className="text-[14px] text-center mb-8" style={{color:MUTED_L,...sans}}>Enter your email and we will send you a reset link.</p>
              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Email Address</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendReset()} placeholder="your@email.com" className="border px-4 py-3 text-[15px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
              </div>
              {err&&<p className="text-[14px] mb-2" style={{color:MAROON,...sans}}>{err}</p>}
              <button onClick={sendReset} className="w-full py-4 mt-2 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Send Reset Link</button>
              <button onClick={()=>switchMode("signin")} className="w-full mt-5 flex items-center justify-center gap-2 text-[13px] transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>
                <ChevronLeft size={14}/>Back to sign in
              </button>
            </>
          )
        ) : (
          <>
            <h2 className="text-2xl text-center mb-2" style={{color:FG_LIGHT,...serif}}>Sign In</h2>
            <p className="text-[14px] text-center mb-8" style={{color:MUTED_L,...sans}}>Access your Nepal Bhoomi account</p>
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Email Address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="your@email.com" autoComplete="email" className="border px-4 py-3 text-[15px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
            </div>
            <div className="flex flex-col gap-1.5 mb-2">
              <div className="flex items-baseline justify-between gap-3">
                <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Password</label>
                <button onClick={()=>switchMode("forgot")} className="text-[12px] transition-colors hover:text-[#8a2030]" style={{color:MAROON,...sans}}>Forgot password?</button>
              </div>
              <PasswordInput value={pw} onChange={setPw} onEnter={submit} autoComplete="current-password"/>
            </div>
            {shownErr&&<p className="text-[14px] mt-2 mb-1" style={{color:MAROON,...sans}}>{shownErr}</p>}
            <button onClick={submit} disabled={busy} className="w-full py-4 mt-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}>{busy?"Signing In...":"Sign In"}</button>
            <div className="flex items-center gap-4 my-5">
              <span className="flex-1 h-px" style={{background:BORDER_L}}/>
              <span className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>or</span>
              <span className="flex-1 h-px" style={{background:BORDER_L}}/>
            </div>
            <button onClick={signInWithGoogle} className="w-full py-3.5 flex items-center justify-center gap-3 border text-[13px] transition-colors hover:bg-[#f7f4ef]" style={{borderColor:BORDER_L,color:FG_LIGHT,background:WHITE,...sans}}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
            <p className="text-center text-[14px] mt-5" style={{color:MUTED_L,...sans}}>Don&apos;t have an account? <button onClick={()=>go("register")} className="transition-colors hover:text-[#8a2030]" style={{color:FG_LIGHT}}>Register</button></p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Register Page ─────────────────────────────────────────────────────────────
function RegisterPage({ go }: { go:Go }) {
  // Agency and agent sign-up were removed. They implied a licence-verification
  // and approval flow that does not exist on either side, and an unverified
  // "agent" listing property is a fraud vector. Members only for now.
  const { user, register } = useAuth();
  const [vals,setVals]=useState<Record<string,string>>({});
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);

  const textFields=[
    {l:"Full Name",t:"text",ph:"Your full name",ac:"name"},
    {l:"Email",t:"email",ph:"your@email.com",ac:"email"},
    {l:"Phone",t:"tel",ph:"+977 ...",ac:"tel"},
  ];
  const set=(k:string,v:string)=>setVals(o=>({...o,[k]:v}));

  const submit=async()=>{
    if(busy) return;
    const missing=[...textFields.map(f=>f.l),"Password","Confirm Password"].find(k=>!(vals[k]||"").trim());
    if(missing){ setErr(`Please fill in "${missing}".`); return; }
    if(!/^\S+@\S+\.\S+$/.test((vals["Email"]||"").trim())){ setErr("Please enter a valid email address."); return; }
    // Same rule as the backend (lib/validation/auth.ts), so the user gets a clear message early.
    if(!/^(?:\+977[- ]?)?9\d{9}$/.test((vals["Phone"]||"").trim())){ setErr("Please enter a valid Nepal mobile number, e.g. 98XXXXXXXX."); return; }
    if((vals["Password"]||"").length<8){ setErr("Password must be at least 8 characters."); return; }
    if(vals["Password"]!==vals["Confirm Password"]){ setErr("The two passwords do not match."); return; }
    setErr(""); setBusy(true);
    try {
      await register({
        name:vals["Full Name"].trim(), email:vals["Email"].trim(), phone:vals["Phone"].trim(),
        password:vals["Password"], confirmPassword:vals["Confirm Password"],
      });
    } catch(e){ setErr(e instanceof ApiError ? e.message : "Registration failed. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen pt-20 py-16" style={{background:BG_LIGHT}}>
      <div className="max-w-xl mx-auto px-6">
        <div className="flex justify-center mb-6"><img src={logoImg} alt="NB" className="h-12 w-12 object-contain"/></div>
        {user?(
          <div className="border p-10 flex flex-col items-center text-center gap-4" style={{background:WHITE,borderColor:BORDER_L}}>
            <CheckCircle2 size={34} style={{color:GOLD}}/>
            <h2 className="text-2xl" style={{color:FG_LIGHT,...serif}}>{vals["Full Name"] ? "Account created" : "You are signed in"}</h2>
            <p className="text-[15px] leading-relaxed" style={{color:MUTED_L,...sans}}>Welcome to Nepal Bhoomi, {user.name||user.email}.</p>
            <button onClick={()=>go("home")} className="mt-2 px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Start Browsing</button>
          </div>
        ):(<>
          <h2 className="text-2xl text-center mb-2" style={{color:FG_LIGHT,...serif}}>Create Account</h2>
          <p className="text-[14px] text-center mb-8" style={{color:MUTED_L,...sans}}>Join Nepal Bhoomi to save properties and contact advisors</p>
          <div className="border p-8 flex flex-col gap-4" style={{background:WHITE,borderColor:BORDER_L}}>
            {textFields.map(f=>(
              <div key={f.l} className="flex flex-col gap-1.5">
                <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>{f.l}</label>
                <input type={f.t} autoComplete={f.ac} placeholder={f.ph} value={vals[f.l]||""} onChange={e=>set(f.l,e.target.value)} className="border px-4 py-3 text-[15px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Password</label>
              <PasswordInput value={vals["Password"]||""} onChange={v=>set("Password",v)} autoComplete="new-password"/>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Confirm Password</label>
              <PasswordInput value={vals["Confirm Password"]||""} onChange={v=>set("Confirm Password",v)} onEnter={submit} autoComplete="new-password"/>
            </div>
            {err&&<p className="text-[14px]" style={{color:MAROON,...sans}}>{err}</p>}
            <button onClick={submit} disabled={busy} className="py-4 mt-2 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}>{busy?"Creating Account...":"Create Account"}</button>
            <p className="text-center text-[14px]" style={{color:MUTED_L,...sans}}>Already registered? <button onClick={()=>go("login")} className="transition-colors hover:text-[#8a2030]" style={{color:FG_LIGHT}}>Sign In</button></p>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
// First version: a read-only list of registered users. More admin tools (listings, enquiries,
// moderation) will be added here later. The backend enforces access (ADMIN role + 2FA); the
// role check below only decides what to show.
type AdminUserRow = { id:string; email:string; name:string|null; phone:string; role:"USER"|"ADMIN"; createdAt:string };

function AdminPage({ go }: { go:Go }) {
  const { user, status } = useAuth();
  const [users,setUsers]=useState<AdminUserRow[]|null>(null);
  const [err,setErr]=useState("");
  const isAdmin=user?.role==="ADMIN";

  useEffect(()=>{
    if(!isAdmin) return;
    let cancelled=false;
    authFetch<{ users:AdminUserRow[] }>("/admin/users")
      .then(r=>{ if(!cancelled) setUsers(r.users); })
      .catch(e=>{ if(!cancelled) setErr(e instanceof ApiError ? e.message : "Could not load users."); });
    return ()=>{ cancelled=true; };
  },[isAdmin]);

  const weekAgo=Date.now()-7*24*60*60*1000;
  const joined=(iso:string)=>new Date(iso).toLocaleDateString("en-GB",{ day:"numeric", month:"short", year:"numeric" });

  if(status!=="loading" && !isAdmin) return (
    <div className="min-h-screen pt-20 flex items-center justify-center" style={{background:BG_LIGHT}}>
      <div className="text-center px-6">
        <p className="text-2xl mb-3" style={{color:FG_LIGHT,...serif}}>Admins only</p>
        <p className="text-[15px] mb-6" style={{color:MUTED_L,...sans}}>You need to be signed in as the administrator to view this page.</p>
        <button onClick={()=>go(user?"home":"login")} className="px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>{user?"Back to Home":"Sign In"}</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      <div className="px-6 md:px-12 lg:px-20 py-14 md:py-16 border-b" style={{borderColor:BORDER_L,background:WHITE}}>
        <div className="flex items-center gap-3 mb-4"><GoldLine/><Tag c={GOLD}>Administration</Tag></div>
        <h1 className="leading-[0.92]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.2rem,4.6vw,3.8rem)"}}>Admin Dashboard</h1>
        <p className="text-[15px] mt-4" style={{color:MUTED_L,...sans}}>Signed in as {user?.name||user?.email}. More tools will be added here soon.</p>
      </div>

      <div className="px-6 md:px-12 lg:px-20 py-12">
        {err ? (
          <p className="text-[15px] border px-5 py-4" style={{color:MAROON,borderColor:BORDER_L,background:WHITE,...sans}}>{err}</p>
        ) : !users ? (
          <p className="text-[15px]" style={{color:MUTED_L,...sans}}>Loading users...</p>
        ) : (<>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {[
              {l:"Registered users", v:users.length},
              {l:"Members", v:users.filter(u=>u.role==="USER").length},
              {l:"Joined this week", v:users.filter(u=>new Date(u.createdAt).getTime()>=weekAgo).length},
            ].map(t=>(
              <div key={t.l} className="border px-6 py-5" style={{borderColor:BORDER_L,background:WHITE}}>
                <p className="text-[10px] tracking-[0.28em] uppercase mb-2" style={{color:MUTED_L,...sans}}>{t.l}</p>
                <p className="text-3xl" style={{color:FG_LIGHT,...serif}}>{t.v}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-4"><Users size={16} style={{color:GOLD}}/><h2 className="text-xl" style={{color:FG_LIGHT,...serif}}>Users</h2></div>
          <div className="border overflow-x-auto" style={{borderColor:BORDER_L,background:WHITE}}>
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b" style={{borderColor:BORDER_L}}>
                  {["Name","Email","Phone","Role","Joined"].map(h=>(
                    <th key={h} className="px-5 py-3 text-[10px] tracking-[0.28em] uppercase font-normal" style={{color:MUTED_L,...sans}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u.id} className="border-b last:border-b-0" style={{borderColor:BORDER_L}}>
                    <td className="px-5 py-3.5 text-[14px]" style={{color:FG_LIGHT,...sans}}>{u.name||"—"}</td>
                    <td className="px-5 py-3.5 text-[14px]" style={{color:FG_LIGHT,...sans}}>{u.email}</td>
                    <td className="px-5 py-3.5 text-[14px]" style={{color:MUTED_L,...sans}}>{u.phone||"—"}</td>
                    <td className="px-5 py-3.5"><span className="text-[10px] tracking-[0.2em] uppercase px-2 py-1" style={{color:u.role==="ADMIN"?WHITE:FG_LIGHT,background:u.role==="ADMIN"?MAROON:BG_LIGHT,...sans}}>{u.role==="ADMIN"?"Admin":"Member"}</span></td>
                    <td className="px-5 py-3.5 text-[14px] whitespace-nowrap" style={{color:MUTED_L,...sans}}>{joined(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─── Free Listing Page ─────────────────────────────────────────────────────────
function FreeListingPage() {
  const [vals,setVals]=useState<Record<string,string>>({});
  const [district,setDistrict]=useState("");
  const [images,setImages]=useState<PickedImage[]>([]);
  const [amenities,setAmenities]=useState<string[]>([]);
  const [err,setErr]=useState("");
  const [done,setDone]=useState(false);

  const textFields=[
    {l:"Property Title",t:"text",ph:"e.g. Patan 5-Bedroom Villa"},
    {l:"Contact Name",t:"text",ph:"Your name"},
    {l:"Contact Phone",t:"tel",ph:"+977 ..."},
    {l:"Contact Email",t:"email",ph:"your@email.com"},
    {l:"Price (NPR)",t:"text",ph:"e.g. 5,00,00,000"},
    {l:"Built Area",t:"text",ph:"e.g. 3,500 sq.ft"},
    {l:"Land Area",t:"text",ph:"e.g. 8 Ropani"},
    {l:"Build Year",t:"number",ph:"2020"},
  ];
  const set=(k:string,v:string)=>setVals(o=>({...o,[k]:v}));
  const toggleAmenity=(name:string)=>
    setAmenities(a=>a.includes(name)?a.filter(x=>x!==name):[...a,name]);

  const submit=()=>{
    const missing=["Property Title","Contact Name","Contact Phone"].find(k=>!(vals[k]||"").trim());
    if(missing){ setErr(`Please fill in "${missing}".`); return; }
    if(!district.trim()){ setErr("Please choose a district."); return; }
    if(images.length===0){ setErr("Please add at least one photo — listings with photos get far more enquiries."); return; }
    setErr(""); setDone(true);
  };

  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      <div className="px-6 md:px-12 lg:px-20 py-16 md:py-20 border-b" style={{borderColor:BORDER_L,background:WHITE}}>
        <div className="flex items-center gap-3 mb-4"><GoldLine/><Tag c={GOLD}>List Your Property</Tag></div>
        <h1 className="leading-[0.92]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2rem,4vw,3.5rem)"}}>Free Property Listing</h1>
        <p className="mt-3 text-[15px]" style={{color:MUTED_L,...sans}}>Reach Nepal&apos;s most discerning buyers and renters. List your property with Nepal Bhoomi at no charge.</p>
      </div>

      <div className="px-6 md:px-12 lg:px-20 py-16 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 border p-8" style={{background:WHITE,borderColor:BORDER_L}}>
          {done?(
            <div className="flex flex-col items-center text-center gap-4 py-16">
              <CheckCircle2 size={36} style={{color:GOLD}}/>
              <h2 className="text-2xl" style={{color:FG_LIGHT,...serif}}>Listing submitted</h2>
              <p className="text-[15px] leading-relaxed max-w-md" style={{color:MUTED_L,...sans}}>
                Thank you. Our listings team will review {vals["Property Title"]} in {district} with {images.length} photo{images.length===1?"":"s"} and contact {vals["Contact Name"]} within one working day.
              </p>
              <button onClick={()=>{ setDone(false); setVals({}); setDistrict(""); setImages([]); setAmenities([]); }} className="mt-2 px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Submit Another</button>
            </div>
          ):(<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {textFields.map(f=>(
                <div key={f.l} className="flex flex-col gap-1.5">
                  <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>{f.l}</label>
                  <input type={f.t} placeholder={f.ph} value={vals[f.l]||""} onChange={e=>set(f.l,e.target.value)} className="border px-3 py-3 text-[15px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
                </div>
              ))}

              {[{l:"Property Type",opts:PROP_TYPES},{l:"Listing Type",opts:["For Sale","For Rent"]}].map(s=>(
                <div key={s.l} className="flex flex-col gap-1.5">
                  <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>{s.l}</label>
                  <div className="relative">
                    <select value={vals[s.l]||""} onChange={e=>set(s.l,e.target.value)} className="w-full border px-3 py-3 text-[15px] outline-none appearance-none cursor-pointer" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}>
                      {s.opts.map(t=><option key={t}>{t}</option>)}
                    </select>
                    <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:MUTED_L}}/>
                  </div>
                </div>
              ))}

              {/* Typeahead over all 77 districts, replacing the long dropdown. */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>District</label>
                <DistrictCombobox value={district} onChange={setDistrict} placeholder="Type to search all 77 districts"/>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Property Description</label>
                <textarea rows={4} value={vals["desc"]||""} onChange={e=>set("desc",e.target.value)} className="border px-3 py-3 text-[15px] outline-none resize-none transition-all focus:border-[#8a2030]" placeholder="Describe your property..." style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
              </div>
            </div>

            {/* Photos */}
            <div className="mt-8 pt-8 border-t" style={{borderColor:BORDER_L}}>
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <p className="text-[11px] tracking-[0.3em] uppercase" style={{color:GOLD,...sans}}>Photos</p>
                <span className="text-[12px]" style={{color:MUTED_L,...sans}}>First photo becomes the cover</span>
              </div>
              <ImageUpload images={images} onChange={setImages}/>
            </div>

            {/* Amenities */}
            <div className="mt-8 pt-8 border-t" style={{borderColor:BORDER_L}}>
              <div className="flex items-baseline justify-between gap-3 mb-5">
                <p className="text-[11px] tracking-[0.3em] uppercase" style={{color:GOLD,...sans}}>Amenities</p>
                <span className="text-[12px]" style={{color:MUTED_L,...sans}}>{amenities.length} selected</span>
              </div>
              {AMENITY_GROUPS.map(group=>(
                <div key={group} className="mb-6 last:mb-0">
                  <p className="text-[10px] tracking-[0.24em] uppercase mb-3" style={{color:MUTED_L,...sans}}>{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {AMENITIES.filter(a=>a.group===group).map(({name,Icon})=>{
                      const on=amenities.includes(name);
                      return (
                        <button
                          key={name} type="button" onClick={()=>toggleAmenity(name)}
                          aria-pressed={on}
                          className="flex items-center gap-2 px-3.5 py-2.5 border text-[13px] transition-all"
                          style={{
                            borderColor: on?MAROON:BORDER_L,
                            background: on?"rgba(138,32,48,0.06)":"transparent",
                            color: on?MAROON:MUTED_L, ...sans,
                          }}
                        >
                          <Icon size={17}/>{name}
                          {on && <Check size={13}/>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {err && <p className="mt-6 text-[14px]" style={{color:MAROON,...sans}}>{err}</p>}
            <button onClick={submit} className="mt-6 w-full py-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Submit Free Listing</button>
          </>)}
        </div>

        <div className="flex flex-col gap-5">
          <div className="border p-6" style={{background:CREAM,borderColor:BORDER_L}}>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{color:GOLD,...sans}}>Why List With Us?</p>
            {["Free to list","Reach premium buyers","Professional presentation","Verified listing badge","Agent follow-up support"].map(b=>(
              <div key={b} className="flex items-center gap-3 py-3 border-b" style={{borderColor:BORDER_L}}>
                <div className="w-5 h-5 flex items-center justify-center shrink-0" style={{background:"rgba(138,32,48,0.1)",color:MAROON}}><CheckCircle2 size={15}/></div>
                <span className="text-[14px]" style={{color:MUTED_L,...sans}}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Homepage ─────────────────────────────────────────────────────────────────
function HomePage({ go, setId, scrollTo }: { go:Go; setId:(id:number)=>void; scrollTo?:string }) {
  useEffect(()=>{
    if(!scrollTo) return;
    const t=setTimeout(()=>{ document.getElementById(scrollTo)?.scrollIntoView({behavior:"smooth",block:"start"}); },420);
    return ()=>clearTimeout(t);
  },[scrollTo]);
  return (
    <>
      <HeroSection go={go} setId={setId}/>
      <HotPropertiesSection go={go} setId={setId}/>
      <NewListingsSection go={go} setId={setId}/>
      <LocationStripsSection go={go}/>
      <VideoSection/>
      <TestimonialsSection/>
      <BlogSection go={go}/>
      <ServicesSectionHome go={go}/>
      <StatisticsSection/>
      <CallbackSection/>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading]=useState(true);
  // The backend's Google callback lands back here with ?auth=google or ?auth_error=google.
  const [googleResult]=useState<GoogleResult>(()=>{
    const q=new URLSearchParams(window.location.search);
    const auth=q.get("auth");
    return auth==="google" ? "success" : auth==="google_mfa" ? "mfa" : q.get("auth_error")==="google" ? "error" : null;
  });
  useEffect(()=>{
    if(googleResult) window.history.replaceState(null,"",window.location.pathname);
  },[googleResult]);
  const [page, setPage]=useState<Page>(googleResult ? "login" : "home");
  const [selId, setSelId]=useState(1);
  const [blogId, setBlogId]=useState(1);
  const [nav, setNav]=useState<NavOpts>({});
  const handleDone=useCallback(()=>setLoading(false),[]);
  const go=useCallback<Go>((p,o={})=>{
    setPage(p); setNav(o);
    if(o.blog!==undefined) setBlogId(o.blog);
    window.scrollTo(0,0);
  },[]);
  const navKey=[nav.type,nav.district,nav.preset,nav.view,nav.scrollTo].join("|");
  return (
    <AuthProvider>
    <div className="min-h-screen bg-background">
      <AnimatePresence>
        {loading&&<LoadingScreen key="loader" onDone={handleDone}/>}
      </AnimatePresence>
      <motion.div animate={{opacity:loading?0:1}} transition={{duration:0.6}} style={{pointerEvents:loading?"none":"auto"}}>
        <Navbar page={page} go={go}/>
        <AnimatePresence mode="wait">
          <motion.div key={`${page}|${selId}|${blogId}|${navKey}`} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.38,ease:[0.16,1,0.3,1]}}>
            {page==="home"&&<HomePage go={go} setId={setSelId} scrollTo={nav.scrollTo}/>}
            {page==="buy"&&<BuyRentPage listing="For Sale" go={go} setId={setSelId} nav={nav}/>}
            {page==="rent"&&<BuyRentPage listing="For Rent" go={go} setId={setSelId} nav={nav}/>}
            {page==="hot"&&<BuyRentPage listing="For Sale" go={go} setId={setSelId} nav={{...nav,preset:"hot"}}/>}
            {page==="new-listings"&&<BuyRentPage listing="For Sale" go={go} setId={setSelId} nav={{...nav,preset:"new"}}/>}
            {page==="map"&&<BuyRentPage listing="For Sale" go={go} setId={setSelId} nav={{...nav,view:"map"}}/>}
            {page==="area"&&<BuyRentPage listing="For Sale" go={go} setId={setSelId} nav={nav}/>}
            {page==="property"&&<PropertyDetailPage propId={selId} go={go} setId={setSelId}/>}
            {page==="about"&&<AboutPage go={go}/>}
            {page==="blog"&&<BlogPage go={go}/>}
            {page==="blog-post"&&<BlogPostPage id={blogId} go={go}/>}
            {page==="services"&&<ServicesPage go={go}/>}
            {page==="emi"&&<EMICalculator/>}
            {page==="contact"&&<ContactPage/>}
            {page==="login"&&<LoginPage go={go} googleResult={googleResult}/>}
            {page==="register"&&<RegisterPage go={go}/>}
            {page==="free-listing"&&<FreeListingPage/>}
            {page==="admin"&&<AdminPage go={go}/>}
            {page==="videos"&&<HomePage go={go} setId={setSelId} scrollTo="videos"/>}
          </motion.div>
        </AnimatePresence>
        <Footer go={go}/>
        <QuickEnquiryFloat/>
        <WhatsAppFloat/>
      </motion.div>
    </div>
    </AuthProvider>
  );
}
