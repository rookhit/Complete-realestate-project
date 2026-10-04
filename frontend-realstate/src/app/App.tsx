import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Menu, X, MapPin, ArrowRight, Search, ChevronDown, ChevronLeft, ChevronRight,
  Phone, Mail, MessageCircle, Send, Bed, Bath, Square, Share2,
  Play, Grid3X3, List as ListIcon, Map, Calculator, Star,
  Home, Landmark, Layers, CheckCircle2,
  Instagram, Facebook, Youtube, Linkedin, ZoomIn,
  SlidersHorizontal, RotateCcw, User, FileText, PlusCircle,
  Eye, EyeOff, Upload, Trash2, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  Settings, Subtitles, Check, Clock, Calendar, Compass, Route,
  Tag as TagIcon,
  ExternalLink, LogOut, Lock,
} from "lucide-react";
import logoImg from "@/imports/image.png";
import { DISTRICTS } from "@/app/data/districts";
import { clearAdminReviews, clearMyHearts, loadAdminReviews, loadMyHearts, pendingReviewCount } from "@/app/data/reviews";
import { ALL_PROPS, PROP_TYPES, PROPERTY_TYPES, PRICE_RANGES, displayRef, landSqftNote, loadProperties, matchesRef, propertiesError, propertiesStatus, type Prop } from "@/app/data/properties";
import { approxFor, exactFor, googleMapsAt, placeLabel } from "@/app/data/maps";
import { AreaMap, PropertiesMap } from "@/app/components/ui/maps";
import { clearMessages, loadMessages, unreadCount } from "@/app/data/messages";
import { sendCallback, sendContact, sendEnquiry } from "@/api/messages";
import { clearListings, loadListings, newListingsCount } from "@/app/data/listings";
import { submitListing } from "@/api/listings";
import { uploadListingPhoto } from "@/api/uploads";
import { CALLBACK_TIMES, CONTACT_TOPICS, loadSiteOptions } from "@/app/data/options";
import { useDataVersion } from "@/app/data/store";
import {
  BLOGS, articlesStatus, loadArticles, siteStatus, loadSiteSettings, TESTIMONIALS, testimonialsStatus, loadTestimonials, TEAM, teamStatus, loadTeam, STATS, FEATURED_DISTRICTS, ABOUT_TEAM_LIMIT, DEPARTMENTS, CONTACT, SERVICES,
  companyVideos, whatsappLink, youtubeThumb, type CompanyVideo,
} from "@/app/data/content";
import { ServiceIcon } from "@/app/components/ui/service-icon";
import { AMENITIES, AMENITY_GROUPS, amenityIcon } from "@/app/icons/amenities";
import { API_URL, ApiError, AuthProvider, UNVERIFIED_ACCOUNT_DAYS, forgotPassword, onSignInRequest, requestSignIn, resendVerification, resetPassword, useAuth, verifyResetToken } from "@/app/auth";
import {
  BG_LIGHT, FG_DARK, FG_LIGHT, CREAM, WHITE, MAROON, GOLD, GOLD_DIM,
  MUTED_D, MUTED_L, BORDER_L, BORDER_D, serif, sans, img,
} from "@/app/components/ui/brand";
import { StatusBadge, VerifiedChip } from "@/app/components/ui/status-badge";
import { RefTag } from "@/app/components/ui/property-ref";
import { FavButton, ReactionButton } from "@/app/components/ui/reaction-button";
import { FloatingDock } from "@/app/components/ui/floating-dock";
import { RatingLink, ReviewsSection } from "@/app/components/ui/property-reviews";
import { ResultsToolbar, type SortKey } from "@/app/components/ui/results-toolbar";
import { DistrictCombobox } from "@/app/components/ui/district-combobox";
// The admin is only downloaded when an admin opens it, so visitors never load it.
const AdminDashboard = lazy(() => import("@/app/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import("@/app/admin/AdminUsers").then(m => ({ default: m.AdminUsers })));
const AdminReviews = lazy(() => import("@/app/admin/AdminReviews").then(m => ({ default: m.AdminReviews })));
const AdminMessages = lazy(() => import("@/app/admin/AdminMessages").then(m => ({ default: m.AdminMessages })));
const AdminListings = lazy(() => import("@/app/admin/AdminListings").then(m => ({ default: m.AdminListings })));
import type { AdminNav } from "@/app/admin/AdminLayout";
import { FloorPlanViewer } from "@/app/components/ui/floor-plan";
import { BackButton } from "@/app/components/ui/back-button";
import { HotCard, ListingCard } from "@/app/components/ui/property-cards";
import { TeamCard, TeamProfile } from "@/app/components/ui/team-profile";

// ─── Types ────────────────────────────────────────────────────────────────────
type Page =
  | "home" | "buy" | "rent" | "property" | "hot" | "new-listings"
  | "about" | "blog" | "blog-post" | "services" | "emi" | "contact"
  | "login" | "register" | "free-listing" | "area" | "videos" | "map" | "reset-password" | "team"
  | "admin" | "admin-users" | "admin-reviews" | "admin-listings" | "admin-messages";                  // the admin area, src/app/admin/

type NavOpts = {
  type?: string; district?: string; view?: "list"|"grid"|"map";
  preset?: "hot"|"new"; scrollTo?: string; blog?: number;
  q?: string;                             // free-text search on the Buy/Rent page
};
type Go = (p: Page, o?: NavOpts) => void;

// Brand colours and fonts live in components/ui/brand.ts.

// ─── Mock Data ────────────────────────────────────────────────────────────────
// Properties live in data/properties.ts; journal, testimonials, team, statistics, featured
// districts and videos in data/content.ts. The admin edits those arrays.

// Every district in Nepal. Was a 9-item hand-picked list.
const AREAS = DISTRICTS;

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

// DistrictCombobox (typeahead over all 77 districts) lives in components/ui/district-combobox.tsx.

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
  const [openSub, setOpenSub] = useState<string|null>(null);
  useDataVersion();
  // Unread messages plus free listings waiting for review.
  const unread = user?.role==="ADMIN" ? unreadCount()+newListingsCount()+pendingReviewCount() : 0;
  const badge = unread>0 ? <span className="min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-[10px] font-semibold tabular-nums leading-none" style={{background:"#d93636",color:WHITE,letterSpacing:0,...sans}} aria-label={`${unread} new messages and listings`}>{unread>99?"99+":unread}</span> : null;
  useEffect(()=>{
    document.body.style.overflow = menu ? "hidden" : "";
    if(!menu){ setOpenSub(null); return ()=>{ document.body.style.overflow=""; }; }
    const onKey=(e:KeyboardEvent)=>{ if(e.key==="Escape") setMenu(false); };
    window.addEventListener("keydown",onKey);
    return ()=>{ window.removeEventListener("keydown",onKey); document.body.style.overflow=""; };
  },[menu]);
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
  const mobileLinks: { label:string; page:Page; items?:{label:string;action:()=>void}[] }[] = [
    ...navLinks, { label:"EMI Calculator", page:"emi" },
    ...(user?.role==="ADMIN" ? [{ label:"Admin", page:"admin" as Page }] : []),
  ];
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-400"
        style={{ background: scrolled||page!=="home"?"#0a0908":"transparent", borderBottom:scrolled||page!=="home"?`1px solid ${BORDER_D}`:"1px solid transparent", backdropFilter:scrolled?"blur(20px)":"none" }}>
        <div className="flex items-center gap-5 2xl:gap-7 px-6 md:px-12 xl:px-10 2xl:px-20 h-20">
          {/* Logo */}
          <button onClick={()=>go("home")} className="flex items-center gap-2.5 shrink-0">
            <img src={logoImg} alt="NB" className="h-8 w-8 object-contain" />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-[14px] tracking-[0.2em] uppercase" style={{color:FG_DARK,...sans,fontWeight:500}}>Nepal Bhoomi</span>
              <span className="text-[9px] tracking-[0.28em] uppercase" style={{color:MUTED_D,...sans}}>Estate Agents</span>
            </div>
          </button>
          {/* Desktop nav */}
          <div className="hidden xl:flex items-center gap-0.5 2xl:gap-1 ml-2 2xl:ml-4">
            {navLinks.map(n => (
              <div key={n.label} className="relative" onMouseEnter={()=>n.items&&setDropdown(n.label)} onMouseLeave={()=>setDropdown(null)}>
                <button onClick={()=>n.page&&go(n.page)}
                  className="group/nav relative flex items-center gap-1 px-2.5 2xl:px-3 py-2 text-[12px] tracking-[0.16em] 2xl:tracking-[0.2em] uppercase transition-colors"
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
            <button onClick={()=>go("emi")} className="group/nav relative flex items-center gap-1.5 px-2.5 2xl:px-3 py-2 text-[12px] tracking-[0.16em] 2xl:tracking-[0.2em] uppercase transition-colors" style={{color:page==="emi"?GOLD:"rgba(240,235,224,0.72)",...sans}}>
              <Calculator size={14}/>EMI
              <span
                className={`pointer-events-none absolute left-1/2 bottom-0.5 h-px -translate-x-1/2 transition-all duration-400 ease-out group-hover/nav:w-[calc(100%-1.5rem)] ${page==="emi"?"w-[calc(100%-1.5rem)]":"w-0"}`}
                style={{ background: GOLD }}
              />
            </button>
          </div>
          {/* Right side */}
          <div className="hidden xl:flex items-center gap-2.5 2xl:gap-3 ml-auto">
            <button onClick={()=>go("free-listing")} className="flex items-center gap-1.5 px-4 py-2 whitespace-nowrap text-[11px] tracking-[0.2em] uppercase border transition-all hover:border-accent"
              style={{color:FG_DARK,borderColor:GOLD_DIM,...sans}}><PlusCircle size={14}/>Free Listing</button>
            {user ? (<>
              {user.role==="ADMIN"&&<button onClick={()=>go("admin")} className="flex items-center gap-1.5 px-4 py-2 text-[11px] tracking-[0.2em] uppercase border transition-all hover:border-accent" style={{color:page.startsWith("admin")?GOLD:FG_DARK,borderColor:GOLD_DIM,...sans}}><Settings size={14}/>Admin{badge}</button>}
              <span className="flex items-center gap-1.5 px-1.5 text-[12px] max-w-[180px] truncate" title={`${user.name||""} · ${user.email}`} style={{color:"rgba(240,235,224,0.72)",...sans}}><User size={14}/><span className="hidden 2xl:inline">{user.name||user.email}</span></span>
              <button onClick={signOut} aria-label="Logout" title="Logout" className="flex items-center gap-1.5 px-2 2xl:px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition-colors hover:text-accent" style={{color:"rgba(240,235,224,0.72)",...sans}}><LogOut size={15} className="2xl:hidden"/><span className="hidden 2xl:inline">Logout</span></button>
            </>) : (<>
              <button onClick={()=>go("login")} className="px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition-colors hover:text-accent" style={{color:"rgba(240,235,224,0.72)",...sans}}>Login</button>
              <button onClick={()=>go("register")} className="px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Register</button>
            </>)}
          </div>
          <button onClick={()=>setMenu(true)} aria-label="Open menu" className="xl:hidden ml-auto w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:border-[#b08848]" style={{color:FG_DARK,borderColor:"rgba(240,235,224,0.16)"}}>
            <Menu size={18} strokeWidth={1.5}/>
          </button>
        </div>
      </nav>
      {/* Mobile menu: a frosted panel from the left. The page stays visible behind it;
          tapping outside or pressing Escape closes it. */}
      <AnimatePresence>
        {menu&&(<>
          <motion.div className="xl:hidden fixed inset-0 z-[60]" style={{background:"rgba(10,9,8,0.32)",backdropFilter:"blur(3px)",WebkitBackdropFilter:"blur(3px)"}}
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.35}} onClick={()=>setMenu(false)}/>
          <motion.aside role="dialog" aria-modal="true" aria-label="Menu"
            className="xl:hidden fixed top-0 left-0 bottom-0 z-[61] w-[min(80vw,360px)] flex flex-col overflow-y-auto overscroll-contain antialiased"
            style={{background:"linear-gradient(165deg, rgba(30,26,20,0.72) 0%, rgba(10,9,8,0.84) 100%)",backdropFilter:"blur(24px) saturate(150%)",WebkitBackdropFilter:"blur(24px) saturate(150%)",borderRight:"1px solid rgba(176,136,72,0.22)",boxShadow:"30px 0 80px rgba(0,0,0,0.35)"}}
            initial={{x:"-100%"}} animate={{x:0}} exit={{x:"-100%"}} transition={{type:"spring",stiffness:300,damping:34}}>
            <div className="shrink-0 flex items-center justify-between h-20 px-7">
              <span className="flex items-center gap-3 text-[10px] tracking-[0.36em] uppercase" style={{color:GOLD,...sans}}>
                <span style={{width:"1.5rem",height:"0.5px",background:GOLD}}/>Menu
              </span>
              <button onClick={()=>setMenu(false)} aria-label="Close menu" className="w-10 h-10 rounded-full flex items-center justify-center border transition-colors hover:border-[#b08848]" style={{borderColor:"rgba(240,235,224,0.14)",color:FG_DARK}}>
                <X size={17} strokeWidth={1.5}/>
              </button>
            </div>

            <ul className="px-7">
              {mobileLinks.map((n,i)=>{
                const active=n.page==="admin"?page.startsWith("admin"):page===n.page;
                const expanded=openSub===n.label;
                return (
                  <motion.li key={n.label} className="border-b" style={{borderColor:"rgba(240,235,224,0.07)"}}
                    initial={{opacity:0,x:-28}} animate={{opacity:1,x:0}} transition={{delay:0.1+i*0.045,duration:0.5,ease:[0.16,1,0.3,1]}}>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>{go(n.page);setMenu(false);}} className="flex-1 flex items-baseline gap-4 py-[15px] text-left">
                        <span className="w-5 text-[10px] tracking-[0.12em] tabular-nums" style={{color:active?GOLD:"rgba(240,235,224,0.32)",...sans}}>{String(i+1).padStart(2,"0")}</span>
                        <span className="text-[18px] font-light tracking-[0.03em] transition-colors" style={{color:active?GOLD:FG_DARK,...sans}}>{n.label}</span>{n.page==="admin"&&badge}
                      </button>
                      {n.items&&(
                        <button onClick={()=>setOpenSub(expanded?null:n.label)} aria-label={`${expanded?"Hide":"Show"} ${n.label} property types`} aria-expanded={expanded}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{color:expanded?GOLD:"rgba(240,235,224,0.5)",background:expanded?"rgba(176,136,72,0.12)":"transparent"}}>
                          <ChevronDown size={15} strokeWidth={1.5} className={`transition-transform duration-300 ${expanded?"rotate-180":""}`}/>
                        </button>
                      )}
                    </div>
                    <AnimatePresence initial={false}>
                      {n.items&&expanded&&(
                        <motion.div className="overflow-hidden" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.3,ease:[0.16,1,0.3,1]}}>
                          <div className="pl-9 pb-4 flex flex-col">
                            {n.items.map(it=>(
                              <button key={it.label} onClick={it.action} className="group flex items-center gap-3 py-2 text-left text-[14px] font-light tracking-[0.02em] transition-colors hover:text-[#b08848]" style={{color:"rgba(240,235,224,0.62)",...sans}}>
                                <span className="h-px w-3 transition-all group-hover:w-5" style={{background:"rgba(176,136,72,0.6)"}}/>{it.label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>

            <motion.div className="mt-auto px-7 pt-8 pb-8 flex flex-col gap-3" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.35,duration:0.5}}>
              <button onClick={()=>{go("free-listing");setMenu(false);}} className="flex items-center justify-center gap-2 py-3.5 text-[11px] tracking-[0.24em] uppercase border transition-colors hover:border-[#b08848]"
                style={{color:FG_DARK,borderColor:GOLD_DIM,background:"rgba(176,136,72,0.06)",...sans}}><PlusCircle size={14} strokeWidth={1.5} style={{color:GOLD}}/>Free Listing</button>
              {user ? (
                <div className="flex items-center gap-3 pt-3">
                  <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[13px]" style={{background:"rgba(176,136,72,0.16)",color:GOLD,...sans}}>{(user.name||user.email).charAt(0).toUpperCase()}</span>
                  <span className="flex-1 min-w-0 text-[13px] font-light truncate" style={{color:FG_DARK,...sans}}>{user.name||user.email}</span>
                  <button onClick={signOut} className="text-[10px] tracking-[0.24em] uppercase transition-colors hover:text-[#b08848]" style={{color:"rgba(240,235,224,0.6)",...sans}}>Logout</button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={()=>{go("login");setMenu(false);}} className="flex-1 py-3.5 text-[11px] tracking-[0.24em] uppercase border transition-colors hover:border-[#b08848]" style={{color:FG_DARK,borderColor:"rgba(240,235,224,0.16)",...sans}}>Login</button>
                  <button onClick={()=>{go("register");setMenu(false);}} className="flex-1 py-3.5 text-[11px] tracking-[0.24em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Register</button>
                </div>
              )}
              <p className="pt-4 text-[9px] tracking-[0.34em] uppercase text-center" style={{color:"rgba(240,235,224,0.28)",...sans}}>Nepal Bhoomi · Estate Agents</p>
            </motion.div>
          </motion.aside>
        </>)}
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
          <div className="flex gap-3">{([[Instagram,"Instagram",CONTACT.instagram],[Facebook,"Facebook",CONTACT.facebook],[Youtube,"YouTube",CONTACT.youtube],[Linkedin,"LinkedIn",CONTACT.linkedin]] as const).filter(([,,url])=>url.trim()).map(([I,name,url])=><a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={name} className="transition-opacity hover:opacity-70" style={{color:MUTED_D}}><I size={15}/></a>)}</div>
        </div>
        {[
          {title:"Properties",links:[{l:"Buy Property",p:"buy"},{l:"Rent Property",p:"rent"},{l:"Hot Properties",p:"hot"},{l:"New Listings",p:"new-listings"},{l:"View All",p:"buy"}]},
          {title:"Company",links:[{l:"About Us",p:"about"},{l:"Our Team",p:"team"},{l:"Services",p:"services"},{l:"Blog & News",p:"blog"},{l:"Videos",p:"home",o:{scrollTo:"videos"}},{l:"Contact",p:"contact"}]},
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
      {/* Extra room at the bottom so the floating Enquiry / WhatsApp buttons never cover these links. */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 md:px-12 lg:px-20 pt-8 pb-32 sm:pb-8 sm:pr-32 lg:pr-40">
        <p className="text-[12px]" style={{color:MUTED_D,...sans}}>© 2025 Nepal Bhoomi Estate Agents. All rights reserved.</p>
        <div className="flex gap-5">{["Privacy Policy","Terms of Use","Sitemap"].map(t=><a key={t} href="#" onClick={e=>e.preventDefault()} className="text-[12px] hover:opacity-70" style={{color:MUTED_D,...sans}}>{t}</a>)}</div>
      </div>
    </footer>
  );
}

// ─── Website forms: signed-in members only ────────────────────────────────────
// The callback, contact and property enquiry forms post to the API (src/api/messages.ts) and land
// in Admin → Messages with the member's account. Signed out, the send button becomes "Sign In".

/** Takes the place of a form's send button for visitors who are not signed in. */
function SignInToSend({ action, light=true }: { action:string; light?:boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={requestSignIn} className="flex items-center justify-center gap-2 py-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>
        <Lock size={14}/>Sign In to {action}
      </button>
      <p className="text-[12px] leading-relaxed" style={{color:light?MUTED_L:MUTED_D,...sans}}>Only signed-in members can send messages, so we always know how to reach you. Creating an account takes a minute.</p>
    </div>
  );
}

/** The message to show when a form could not be sent. A lapsed sign-in opens the login page. */
function sendError(err:unknown): string {
  if(err instanceof ApiError && err.status===401) { requestSignIn(); return "Please sign in again to send."; }
  return err instanceof ApiError ? err.message : "Could not send. Please check your connection and try again.";
}

// ─── Callback form ────────────────────────────────────────────────────────────
// The "Let Us Call You" form at the bottom of the home page. The floating Quick Enquiry
// button scrolls here.
function CallbackForm() {
  const { user } = useAuth();
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [time,setTime]=useState(CALLBACK_TIMES[0]??"");
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState(false);
  const [busy,setBusy]=useState(false);
  const [serverErr,setServerErr]=useState("");
  // Signed in: start from the account's name and phone (still editable).
  useEffect(()=>{ if(user){ setName(n=>n||user.name||""); setPhone(p=>p||user.phone||""); } },[user]);
  const send=async()=>{
    if(!name.trim()||!phone.trim()){ setErr(true); return; }
    setErr(false); setServerErr(""); setBusy(true);
    try { await sendCallback({name:name.trim(),phone:phone.trim(),time}); setSent(true); }
    catch(e) { setServerErr(sendError(e)); }
    finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 size={32} style={{color:GOLD}}/>
        <p className="text-base" style={{color:FG_LIGHT,...serif}}>Thank you. We will call you shortly.</p>
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
          {CALLBACK_TIMES.map(t=><option key={t}>{t}</option>)}
        </select>
        <ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:MUTED_L}}/>
      </div>
      {user?(
        <button onClick={()=>void send()} disabled={busy} className="py-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}>
          {busy?"Sending…":"Request a Callback"}
        </button>
      ):<SignInToSend action="Request a Callback"/>}
      {err&&<p className="text-[14px]" style={{color:MAROON,...sans}}>Please enter your name and phone number.</p>}
      {serverErr&&<p role="alert" className="text-[14px]" style={{color:MAROON,...sans}}>{serverErr}</p>}
    </div>
  );
}

// ─── Float Elements ───────────────────────────────────────────────────────────
// The floating Quick Enquiry and WhatsApp buttons (FloatingDock, components/ui/floating-dock.tsx).
// Quick Enquiry takes the visitor to the "Let Us Call You" section on the home page
// (CallbackSection, id="enquiry") instead of opening a pop-up with the same form.
function QuickEnquiryFloat({ overHero=false, onEnquire }: { overHero?:boolean; onEnquire:()=>void }) {
  return <FloatingDock onEnquire={onEnquire} overHero={overHero}/>;
}

// ─── PropertyCard ─────────────────────────────────────────────────────────────
// The card design lives in components/ui/property-cards.tsx (shared with the admin's live preview).
function PropertyCard({ p, go, setId, light=false }: { p:Prop; go:Go; setId:(id:number)=>void; light?:boolean }) {
  return <ListingCard p={p} light={light} onOpen={()=>{ setId(p.id); go("property"); window.scrollTo(0,0); }}/>;
}

// Favourites and reactions (FavButton, ReactionButton) live in components/ui/reaction-button.tsx.

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection({ go, setId }: { go:Go; setId:(id:number)=>void }) {
  const [active,setActive]=useState(0);
  const featured=ALL_PROPS.filter(p=>p.featured).slice(0,3);
  // The slide on screen. The counter only grows, so it can never divide by an empty list.
  const slide=active%Math.max(featured.length,1);
  const prop=featured[slide]||ALL_PROPS[0];
  useEffect(()=>{ const t=setInterval(()=>setActive(a=>a+1),6500); return ()=>clearInterval(t); },[]);
  // No properties yet (none added, or the server is down): a plain hero instead of a crash.
  if(!prop) return (
    <section className="relative h-[70vh] min-h-[480px] flex items-end px-6 md:px-12 lg:px-20 pb-20" style={{background:"#0a0908"}}>
      <h1 className="leading-[0.92]" style={{color:FG_DARK,...serif,fontSize:"clamp(2.4rem,5vw,4.5rem)"}}>Nepal Bhoomi Estate Agents</h1>
    </section>
  );
  return (
    <section className="relative h-screen min-h-[600px] overflow-hidden flex flex-col justify-end">
      <AnimatePresence mode="wait">
        <motion.div key={slide} className="absolute inset-0" initial={{opacity:0,scale:1.06}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:1.4,ease:[0.16,1,0.3,1]}}>
          <img src={prop.hero} alt={prop.title} className="w-full h-full object-cover"/>
          <div className="absolute inset-0" style={{background:"linear-gradient(to top, rgba(10,9,8,0.95) 0%, rgba(10,9,8,0.4) 45%, rgba(10,9,8,0.08) 100%)"}}/>
          <div className="absolute inset-0" style={{background:"linear-gradient(to right, rgba(10,9,8,0.55) 0%, transparent 65%)"}}/>
        </motion.div>
      </AnimatePresence>
      <div className="relative z-10 px-6 md:px-12 lg:px-20 pb-20 w-full">
        <div className="flex items-center gap-4 mb-6"><div style={{width:"3rem",height:"0.5px",background:GOLD}}/><Tag>{prop.badge} · {prop.type}</Tag></div>
        <AnimatePresence mode="wait">
          <motion.h1 key={slide} className={`${prop.tagline?"mb-3":"mb-6"} leading-[0.9]`} style={{color:FG_DARK,...serif,fontSize:"clamp(2.8rem,7.5vw,6.5rem)"}} initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.85,ease:[0.16,1,0.3,1]}}>{prop.title}</motion.h1>
        </AnimatePresence>
        {/* The tagline the admin writes, e.g. "Heritage Reimagined". */}
        <AnimatePresence mode="wait">
          {prop.tagline&&<motion.p key={`t${slide}`} className="mb-6 text-[15px] md:text-[17px] tracking-[0.04em] italic" style={{color:"rgba(240,235,224,0.78)",...serif}} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{delay:0.1}}>{prop.tagline}</motion.p>}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div key={`m${slide}`} className="flex flex-wrap items-center gap-x-7 gap-y-3 mb-9" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{delay:0.06}}>
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
                <motion.div animate={{width:i===slide?28:14,background:i===slide?GOLD:"rgba(240,235,224,0.22)"}} transition={{duration:0.4}} style={{height:"1px"}}/>
                <span className="text-[10px] tracking-[0.25em]" style={{color:i===slide?GOLD:"rgba(240,235,224,0.3)",...sans}}>{String(i+1).padStart(2,"0")}</span>
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
          {hot.map(p=><HotCard key={p.id} p={p} onOpen={()=>{setId(p.id);go("property");window.scrollTo(0,0);}}/>)}
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
  // Edited in the admin (Home Page section): 1 to 5 districts.
  const locs = FEATURED_DISTRICTS;
  if(locs.length===0) return null;
  // Each tile takes an equal share of the row, so the strip fills the width
  // however many districts are published. Height follows that same share so
  // the proportion holds as the list grows, instead of the tiles turning into
  // tall slivers. Clamped at both ends: it cannot balloon at two districts or
  // collapse at eight. Past roughly five the row overflows into a horizontal
  // scroll, and the partly visible last tile is what signals there is more.
  const share = 100 / locs.length;
  const tileH = `clamp(340px, ${share.toFixed(2)}vw, 520px)`;
  // Top padding matches the other home sections (py-36). No bottom padding:
  // the full-bleed image strip ends the section.
  return (
    <section className="pt-28 md:pt-36 border-t" style={{background:WHITE,borderColor:BORDER_L}}>
      <div className="px-6 md:px-12 lg:px-20 mb-14">
        <div className="flex items-center gap-3 mb-3"><GoldLine/><Tag c={GOLD}>By Location</Tag></div>
        <h2 className="leading-[0.93]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.2rem,4.2vw,3.4rem)"}}>Prestige Properties Across Nepal</h2>
        <p className="mt-3 text-[15px] max-w-xl leading-relaxed" style={{color:MUTED_L,...sans}}>Major cities or exclusive destinations. Choose the location that suits you.</p>
      </div>
      {/* Full-bleed horizontal image strip (Image 3 style) */}
      <div className="flex overflow-x-auto" style={{scrollbarWidth:"none"}}>
        {locs.map(l=>(
          <button key={l.name} onClick={()=>go("buy",{district:l.name})} className="relative shrink-0 overflow-hidden group"
            style={{width:`${share}%`,minWidth:"280px",height:tileH}}>
            <img src={l.img} alt={l.name} className="w-full h-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.05]"/>
            <div className="absolute inset-0" style={{background:"linear-gradient(to top, rgba(10,9,8,0.94) 0%, rgba(10,9,8,0.58) 36%, rgba(10,9,8,0.06) 76%)"}}/>
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10 text-left">
              <p className="text-[10px] tracking-[0.28em] uppercase mb-2.5" style={{color:GOLD,...sans}}>{(n=>`${n} ${n===1?"Property":"Properties"}`)(ALL_PROPS.filter(p=>p.district===l.name).length)}</p>
              <p className="leading-[1.04]" style={{color:WHITE,...serif,fontSize:"clamp(1.8rem,2.6vw,2.6rem)"}}>{l.name}</p>
              <div className="mt-5 h-px w-10 transition-all duration-500 ease-out group-hover:w-24" style={{background:GOLD}}/>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// Company videos (types, the list and companyVideos()) live in data/content.ts.

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
  // Read at render, so videos the admin adds or reorders appear the next time the page opens.
  const COMPANY_VIDEOS=companyVideos();
  const count=COMPANY_VIDEOS.length;

  const go=(d:number)=>setIndex(i=>(i+d+count)%count);

  // Gentle auto-rotation; stops while hovered or while a film is open.
  useEffect(()=>{
    if(paused||open||count<2) return;
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

  // The admin can remove every video; the section then simply isn't shown.
  if(count===0) return null;

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
      <div className="flex items-center justify-center gap-3 mt-12 -mb-6">
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
  // The admin can remove every testimonial; the section then simply isn't shown.
  if(TESTIMONIALS.length===0) return null;
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
              <div key={t.id} className={`p-9 border transition-all duration-300 ${i===idx?"":"opacity-60"}`} style={{background:i===idx?CREAM:WHITE,borderColor:BORDER_L}}>
                <div className="flex gap-0.5 mb-5">{Array.from({length:t.rating}).map((_,j)=><Star key={j} size={15} fill={GOLD} style={{color:GOLD}}/>)}</div>
                <p className="text-[15px] leading-[1.75] mb-6" style={{color:MUTED_L,...sans}}>"{t.text}"</p>
                <div className="flex items-center gap-3 pt-5 border-t" style={{borderColor:BORDER_L}}>
                  {t.img
                    ?<img src={t.img} alt={t.name} className="w-10 h-10 object-cover rounded-full"/>
                    :<span aria-hidden className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[14px]" style={{background:"#e9e3d8",color:GOLD,...serif}}>{t.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}</span>}
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
  // No articles (none published yet, or the journal couldn't load): leave the section out.
  if(!feat) return null;
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
            <p className="flex items-center gap-4 text-[11px] tracking-[0.28em] uppercase mb-2" style={{color:MUTED_L,...sans}}>
              <span className="flex items-center gap-1.5"><Calendar size={12} style={{color:GOLD}}/>{feat.date}</span>
              <span className="flex items-center gap-1.5"><Clock size={12} style={{color:GOLD}}/>{feat.read}</span>
            </p>
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
          {SERVICES.map(s=>(
            <div key={s.id} className="border-b border-r p-10 flex flex-col gap-5 group cursor-pointer hover:bg-white/[0.02] transition-all" style={{borderColor:BORDER_D}}>
              <div style={{color:GOLD}}><ServiceIcon name={s.icon}/></div>
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
  // Edited in the admin (Home Page section).
  const stats=STATS;
  return (
    <section className="py-28 md:py-36 border-t border-b" style={{background:"#080706",borderColor:BORDER_D}}>
      <div className="px-6 md:px-12 lg:px-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-t" style={{borderColor:BORDER_D}}>
          {stats.map(s=>(
            <div key={s.id} className="border-r last:border-0 py-14 pr-10" style={{borderColor:BORDER_D}}>
              <p className="leading-none mb-2" style={{color:FG_DARK,...serif,fontSize:"clamp(2rem,4.5vw,3.8rem)"}}>{s.value}</p>
              <p className="text-[11px] tracking-[0.22em] uppercase" style={{color:MUTED_D,...sans}}>{s.label}</p>
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
    // id="enquiry" is where the floating Quick Enquiry button brings visitors.
    <section id="enquiry" className="py-28 md:py-36 border-t scroll-mt-20" style={{background:WHITE,borderColor:BORDER_L}}>
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
  // Free-text search and sort (see components/ui/results-toolbar.tsx).
  const [query,setQuery]=useState(nav.q??"");
  const [sortBy,setSortBy]=useState<SortKey>("newest");
  const resultsRef=useRef<HTMLDivElement>(null);
  const preset=nav.preset;
  const ranges=PRICE_RANGES[listing];
  const range=ranges.find(r=>r.label===priceF);
  // Match the fields someone would actually type: title, location, district,
  // type and the reference ("#NBS004", "nbs004" or just "004"). Not the description: a match buried in
  // a paragraph gives results the user cannot see the reason for.
  const q=query.trim().toLowerCase();
  const matchesQuery=(p:Prop)=>
    !q ||
    p.title.toLowerCase().includes(q) ||
    p.location.toLowerCase().includes(q) ||
    p.district.toLowerCase().includes(q) ||
    matchesRef(p.nbId,q) ||
    p.type.toLowerCase().includes(q);
  const props=ALL_PROPS.filter(p=>{
    if(p.listing!==listing) return false;
    if(preset==="hot"&&!(p.badge==="Hot"||p.featured)) return false;
    if(preset==="new"&&!(p.badge==="New"||p.badge==="Prime")) return false;
    if(typeF!=="All Types"&&p.type!==typeF) return false;
    if(distF!=="All"&&p.district!==distF) return false;
    if(range&&(p.priceNum<range.min||p.priceNum>range.max)) return false;
    if(!matchesQuery(p)) return false;
    return true;
  }).sort((a,b)=>{
    if(sortBy==="price_asc")  return a.priceNum-b.priceNum;
    if(sortBy==="price_desc") return b.priceNum-a.priceNum;
    // "Newest" has no date to sort on yet, so it uses the badge and then the id.
    // Replace with the listing's createdAt once the API sends it.
    const rank=(p:Prop)=>p.badge==="New"?0:p.badge==="Prime"?1:p.featured?2:3;
    return rank(a)-rank(b) || b.id-a.id;
  });
  const types=PROP_TYPES;
  const dists=["All",...AREAS.filter(a=>ALL_PROPS.some(x=>x.district===a&&x.listing===listing))];
  const dirty=typeF!=="All Types"||distF!=="All"||priceF!=="Any Price"||q!=="";
  const reset=()=>{ setTypeF("All Types"); setDistF("All"); setPriceF("Any Price"); setQuery(""); };
  const heading=preset==="hot"?"Hot Properties":preset==="new"?"New Listings":(listing==="For Sale"?"Properties for Sale":"Properties for Rent");
  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      {/* Sticky filter bar */}
      <div className="sticky top-20 z-30 border-b" style={{background:"rgba(247,243,237,0.97)",backdropFilter:"blur(20px)",borderColor:BORDER_L}}>
        {/* Phones: one swipeable row (this bar is sticky, so three wrapped rows would eat the screen). */}
        <div className="px-4 sm:px-6 md:px-12 lg:px-20 py-3 sm:py-4 flex items-center gap-2 sm:gap-2.5 overflow-x-auto sm:overflow-visible sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
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
        <ResultsToolbar count={props.length} query={query} onQuery={setQuery} sort={sortBy} onSort={setSortBy}/>
        {props.length===0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-2xl" style={{color:FG_LIGHT,...serif}}>No properties match these filters</p>
            <p className="text-[15px]" style={{color:MUTED_L,...sans}}>
              {q
                ? <>Nothing matches &ldquo;{query.trim()}&rdquo;. Try a district, a property name, or a reference like #NBS004.</>
                : <>Try widening your price range or choosing a different district.</>}
            </p>
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
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-start gap-0 border-b group cursor-pointer transition-colors hover:bg-[#f0ebe0]/50"
                style={{borderColor:BORDER_L}} onClick={()=>{setId(p.id);go("property");}}>
                <div className="w-full sm:w-64 md:w-80 shrink-0 relative overflow-hidden" style={{aspectRatio:"4/3"}}>
                  <img src={p.hero} alt={p.title} className="w-full h-full object-cover transition-transform duration-600 group-hover:scale-[1.03]"/>
                  <div className="absolute bottom-3 left-3 flex gap-1.5">
                    <span className="px-2 py-0.5 text-[10px] tracking-[0.25em] uppercase" style={{background:MAROON,color:WHITE,...sans}}>{p.badge}</span>
                    {/* Opaque plate: the old 15% gold tint was unreadable over the photo. */}
                    {p.verified&&<VerifiedChip onImage/>}
                  </div>
                </div>
                <div className="flex-1 min-w-0 p-5 sm:p-6 md:p-8 flex flex-col justify-between">
                  <div>
                    {/* Phones: price under the title. Wider: price on the right. */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-4 mb-1.5">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5"><span className="text-[11px] tracking-[0.25em] uppercase" style={{color:MUTED_L,...sans}}>{p.type}</span><RefTag nbId={p.nbId}/></div>
                        <h3 className="text-lg leading-tight" style={{color:FG_LIGHT,...serif}}>{p.title}</h3></div>
                      <div className="sm:text-right shrink-0">
                        <p className="text-lg sm:text-xl font-medium whitespace-nowrap" style={{color:MAROON,...sans}}>{p.price}</p>
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
                      <ReactionButton id={p.id} size="sm"/>
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
/** The pin's hover card on both maps: photo, price, title, place and a few facts. */
function mapCardOf(p:Prop) {
  const facts=[p.beds>0?`${p.beds} bed${p.beds===1?"":"s"}`:"", p.baths>0?`${p.baths} bath${p.baths===1?"":"s"}`:"",
    p.builtArea!=="—"?p.builtArea:"", p.landArea!=="—"?p.landArea:""].filter(Boolean);
  return { title:p.title, price:p.price, image:p.hero, location:p.location, listing:p.listing, facts };
}

function MapView({ props, go, setId }: { props:Prop[]; go:Go; setId:(id:number)=>void }) {
  const [hovPin,setHovPin]=useState<number|null>(null);
  const [activeCard,setActiveCard]=useState<number|null>(null);
  const mapItems=useMemo(()=>props.flatMap(p=>{ const area=approxFor(p); return area?[{ id:p.id, area, ...mapCardOf(p), exact:import.meta.env.DEV ? exactFor(p) : null }]:[]; }),[props]);
  const unmapped=props.length-mapItems.length;
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
      {/* Map: price markers when zoomed out, the approximate areas from street level.
          Never the exact points (data/maps.ts). Hovering a card highlights it on the map. */}
      <div className="flex-1 relative overflow-hidden" style={{background:"#e8e4df"}}>
        <PropertiesMap items={mapItems} hoveredId={hovPin} onHover={setHovPin} onOpen={id=>{setId(id);go("property");}}
          fallback={<div className="absolute inset-0 flex items-center justify-center text-[14px]" style={{color:MUTED_L,...sans}}>The map could not be loaded.</div>}/>
        {unmapped>0&&(
          <div className="absolute bottom-3 left-3 z-10 px-3 py-2 text-[12px] border bg-white/95" style={{borderColor:BORDER_L,color:MUTED_L,...sans}}>
            {unmapped} listing{unmapped===1?" has":"s have"} no map location yet
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function PropertyDetailPage({ propertyId, go, setId, onBack, backLabel }: { propertyId:number; go:Go; setId:(id:number)=>void; onBack:()=>void; backLabel:string }) {
  const p=ALL_PROPS.find(x=>x.id===propertyId)||ALL_PROPS[0];
  // Visitors get only what the admin chose to show; "Open in Google Maps" goes to that point, never the admin's link.
  const area=approxFor(p);
  const mapOpen=area ? googleMapsAt(area.centre) : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${placeLabel(p.location,p.district)}, Nepal`)}`;
  const mapFallback=(
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
      <MapPin size={22} style={{color:GOLD}}/>
      <p className="text-[15px]" style={{color:FG_LIGHT,...sans}}>{placeLabel(p.location,p.district)}</p>
      <p className="text-[13px]" style={{color:MUTED_L,...sans}}>Map not available for this listing yet.</p>
    </div>
  );
  // WhatsApp opens with the reference already typed, so the advisor knows which property it is.
  const waLink=whatsappLink(`Hello, I'm interested in ${displayRef(p.nbId)} (${p.title}).`);
  const [galIdx,setGalIdx]=useState(0);
  const [lightbox,setLightbox]=useState(false);
  const { user } = useAuth();
  const [form,setForm]=useState({name:"",email:"",phone:"",msg:""});
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState(false);
  const [busy,setBusy]=useState(false);
  const [serverErr,setServerErr]=useState("");
  const [shared,setShared]=useState(false);
  useEffect(()=>{ setGalIdx(0); setSent(false); setErr(false); setServerErr(""); setShared(false); },[propertyId]);
  // Signed in: start from the account's details (still editable).
  useEffect(()=>{ if(user) setForm(v=>({...v,name:v.name||user.name||"",email:v.email||user.email,phone:v.phone||user.phone||""})); },[user]);
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
  // Same facts as the results list, so the same icons.
  const details=[
    {l:"NB ID",v:displayRef(p.nbId),i:<FileText size={14}/>},
    {l:"Property Type",v:p.type,i:<Home size={14}/>},
    {l:"Listing",v:p.listing,i:<TagIcon size={14}/>},
    {l:"Built Area",v:p.builtArea,i:<Square size={14}/>},
    {l:"Land Area",v:landSqftNote(p.landArea)?<>{p.landArea}<span className="block text-[12px] font-normal mt-0.5" style={{color:MUTED_L}}>{landSqftNote(p.landArea)}</span></>:p.landArea,i:<Landmark size={14}/>},
    {l:"Floors",v:p.floors>0?String(p.floors):"—",i:<Layers size={14}/>},
    {l:"Bedrooms",v:p.beds>0?String(p.beds):"—",i:<Bed size={14}/>},
    {l:"Bathrooms",v:p.baths>0?String(p.baths):"—",i:<Bath size={14}/>},
    {l:"Road Access",v:p.roadAccess,i:<Route size={14}/>},
    {l:"Facing",v:p.facing,i:<Compass size={14}/>},
    {l:"Build Year",v:p.buildYear>0?String(p.buildYear):"—",i:<Calendar size={14}/>},
    {l:"Verified",v:p.verified?"Yes":"No",i:<CheckCircle2 size={14}/>},
  ];
  return (
    <div className="pt-20 min-h-screen" style={{background:BG_LIGHT}}>
      {/* Breadcrumb */}
      <div className="px-6 md:px-12 lg:px-20 py-4 border-b flex items-center gap-2 text-[12px]" style={{borderColor:BORDER_L,background:WHITE}}>
        <button onClick={()=>go("home")} className="shrink-0 text-[12px] transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>Home</button>
        <span style={{color:MUTED_L}}>/</span>
        <button onClick={()=>go(p.listing==="For Sale"?"buy":"rent")} className="shrink-0 text-[12px] transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>{p.listing==="For Sale"?"Buy":"Rent"}</button>
        <span style={{color:MUTED_L}}>/</span>
        <span className="truncate min-w-0" style={{color:FG_LIGHT,...sans}}>{p.title}</span>
        <div className="ml-auto pl-4 shrink-0 max-w-[45%]"><BackButton label={backLabel} onClick={onBack} compact/></div>
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
        <RatingLink propertyId={p.id}/>
        <div className="ml-auto flex gap-2.5">
          <ReactionButton id={p.id}/>
          <button aria-label="Share property" onClick={share} className="relative p-2.5 border transition-all hover:border-[#8a2030]" style={{borderColor:BORDER_L,color:MUTED_L}}>
            <Share2 size={14}/>
            {shared&&<span className="absolute -top-8 right-0 whitespace-nowrap px-2 py-1 text-[11px]" style={{background:"#1a1611",color:WHITE,...sans}}>Link copied</span>}
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="px-6 md:px-12 lg:px-20 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-20">
        {/* Left */}
        <div className="lg:col-span-2 flex flex-col gap-14">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3"><GoldLine/><Tag c={GOLD}>{p.badge}</Tag><span className="ml-auto"><RefTag nbId={p.nbId} copy/></span></div>
            <h1 className="leading-[0.92] mb-2" style={{color:FG_LIGHT,...serif,fontSize:"clamp(1.8rem,4vw,3.5rem)"}}>{p.title}</h1>
            {p.tagline&&<p className="mb-3 text-[16px] italic" style={{color:MUTED_L,...serif}}>{p.tagline}</p>}
            <div className="flex items-center gap-1.5 mb-3"><MapPin size={14} style={{color:GOLD}}/><span className="text-[14px]" style={{color:MUTED_L,...sans}}>{p.location}</span></div>
            <div className="flex items-baseline gap-3"><span className="text-2xl font-medium" style={{color:MAROON,...sans}}>{p.price}</span>{p.listing==="For Rent"&&<span className="text-sm" style={{color:MUTED_L,...sans}}>per month</span>}</div>
          </div>
          <div className="h-px" style={{background:BORDER_L}}/>
          {/* Property Details table */}
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-5" style={{color:GOLD,...sans}}>Property Details</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 border-t border-l" style={{borderColor:BORDER_L}}>
              {details.map(d=>(
                <div key={d.l} className="border-b border-r px-5 py-5" style={{borderColor:BORDER_L}}>
                  <p className="flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase mb-1.5" style={{color:MUTED_L,...sans}}>
                    <span style={{color:GOLD}}>{d.i}</span>{d.l}
                  </p>
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
          {/* Floor plan drawn by the admin (boxes with a floor name and area). */}
          {!!p.floorPlan?.length&&<>
            <div className="h-px" style={{background:BORDER_L}}/>
            <div>
              <p className="text-[11px] tracking-[0.3em] uppercase mb-5" style={{color:GOLD,...sans}}>Floor Plan</p>
              <FloorPlanViewer boxes={p.floorPlan}/>
            </div>
          </>}
          <div className="h-px" style={{background:BORDER_L}}/>
          {/* Location: the admin chooses per property: an approximate area about 500 m across (the
              default), or the exact point with a pin (data/maps.ts → approxFor).
              The map only loads when the visitor scrolls near it. No coordinates yet (e.g. a short
              share link the backend hasn't resolved): the area by name. */}
          <div>
            <p className="text-[11px] tracking-[0.3em] uppercase mb-5" style={{color:GOLD,...sans}}>Location</p>
            <div className="relative border overflow-hidden" style={{borderColor:BORDER_L,background:"#e9e3d8",aspectRatio:"16/8",minHeight:260}}>
              {area
                ? <AreaMap area={area} card={mapCardOf(p)} exact={import.meta.env.DEV ? exactFor(p) : null} fallback={mapFallback}/>
                : mapFallback}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[14px]" style={{color:MUTED_L,...sans}}><MapPin size={14} style={{color:GOLD}}/>{placeLabel(p.location,p.district)}{area&&!area.precise&&<span style={{color:MUTED_L}}> · approximate area</span>}</span>
              <a href={mapOpen} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 border text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-[#8a2030] hover:text-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}>
                <ExternalLink size={13}/>Open in Google Maps
              </a>
            </div>
          </div>
          <div className="h-px" style={{background:BORDER_L}}/>
          {/* Reviews: social proof after the facts, before "You May Also Like". Always shown, so
              a visitor can write the first one. */}
          <ReviewsSection propertyId={p.id}/>
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
                <button onClick={()=>{setSent(false);setForm(v=>({...v,msg:""}));}} className="mt-1 text-[11px] tracking-[0.25em] uppercase transition-colors hover:brightness-110" style={{color:MAROON,...sans}}>Send another</button>
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
                <textarea rows={3} value={form.msg} onChange={e=>setForm(v=>({...v,msg:e.target.value}))} className="border px-3 py-2.5 text-[14px] outline-none resize-none transition-all focus:border-[#8a2030]" placeholder={`I'm interested in ${displayRef(p.nbId)}...`} style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
              </div>
              {user?(
                <button disabled={busy} onClick={async()=>{
                  if(!form.name.trim()||!(form.email.trim()||form.phone.trim())){ setErr(true); return; }
                  setErr(false); setServerErr(""); setBusy(true);
                  try { await sendEnquiry({propertyId:p.id,name:form.name.trim(),email:form.email.trim(),phone:form.phone.trim(),message:form.msg.trim()}); setSent(true); }
                  catch(e) { setServerErr(sendError(e)); }
                  finally { setBusy(false); }
                }} className="flex items-center justify-center gap-2 py-3.5 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}><Send size={14}/>{busy?"Sending…":"Send Enquiry"}</button>
              ):<SignInToSend action="Send an Enquiry"/>}
              {err&&<p className="text-[12px]" style={{color:MAROON,...sans}}>Please add your name and either an email or a phone number.</p>}
              {serverErr&&<p role="alert" className="text-[12px]" style={{color:MAROON,...sans}}>{serverErr}</p>}
            </>)}
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3.5 border text-[11px] tracking-[0.22em] uppercase transition-colors hover:bg-[rgba(37,211,102,0.12)]" style={{borderColor:"#25D366",color:"#1f9e4d",background:"rgba(37,211,102,0.07)",...sans}}><MessageCircle size={15}/>Chat on WhatsApp</a>
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
  // Which team member's profile is open (index into the cards shown), or null.
  const [profile,setProfile]=useState<number|null>(null);
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
          {SERVICES.map(s=>(
            <div key={s.id} className="border-b border-r px-8 py-10" style={{borderColor:BORDER_L}}>
              <div className="mb-3" style={{color:MAROON}}><ServiceIcon name={s.icon}/></div>
              <p className="text-[15px] mb-2" style={{color:FG_LIGHT,...serif}}>{s.title}</p>
              <p className="text-[14px] leading-relaxed" style={{color:MUTED_L,...sans}}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Team: the first ABOUT_TEAM_LIMIT in the admin's order; everyone is on the Team page.
          Clicking a card opens that person's profile. */}
      <div className="px-6 md:px-12 lg:px-20 py-20 border-b" style={{background:WHITE,borderColor:BORDER_L}}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <h2 className="text-3xl" style={{color:FG_LIGHT,...serif}}>Our Team</h2>
          {TEAM.length>ABOUT_TEAM_LIMIT&&(
            <button onClick={()=>go("team")} className="self-start sm:self-auto flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase border px-6 py-3.5 transition-all hover:border-[#1a1611]" style={{color:MUTED_L,borderColor:BORDER_L,...sans}}>
              Meet the Full Team ({TEAM.length})<ArrowRight size={14}/>
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {TEAM.slice(0,ABOUT_TEAM_LIMIT).map((m,i)=><TeamCard key={m.id} m={m} onOpen={()=>setProfile(i)}/>)}
        </div>
      </div>
      <TeamProfile members={TEAM.slice(0,ABOUT_TEAM_LIMIT)} index={profile} onIndex={setProfile} onClose={()=>setProfile(null)}/>
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
// TEAM PAGE
// ═══════════════════════════════════════════════════════════════════════════════
// Everyone, however many there are: department chips and a search instead of a carousel, so
// a visitor can find the advisor they need (a language, an area, lettings…) rather than
// waiting for faces to rotate past. Cards open the same profile pop-up as the About page.
function TeamPage({ onBack, backLabel }: { onBack:()=>void; backLabel:string }) {
  const [dept,setDept]=useState("All");
  const [q,setQ]=useState("");
  const [profile,setProfile]=useState<number|null>(null);
  const depts=["All",...DEPARTMENTS.filter(d=>TEAM.some(m=>m.department===d))];
  const s=q.trim().toLowerCase();
  const shown=TEAM.filter(m=>
    (dept==="All"||m.department===dept) &&
    (!s||[m.name,m.role,m.department??"",...(m.languages??[]),...(m.specialities??[])].some(v=>v.toLowerCase().includes(s))));
  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      <div className="px-6 md:px-12 lg:px-20 pt-10 pb-14 md:pb-16 border-b" style={{borderColor:BORDER_L,background:WHITE}}>
        <div className="mb-10"><BackButton label={backLabel} onClick={onBack}/></div>
        <div className="flex items-center gap-3 mb-4"><GoldLine/><Tag c={GOLD}>The People Behind Nepal Bhoomi</Tag></div>
        <h1 className="leading-[0.92]" style={{color:FG_LIGHT,...serif,fontSize:"clamp(2.6rem,5.4vw,4.6rem)"}}>Our Team</h1>
        <p className="mt-4 text-[15px] max-w-xl leading-relaxed" style={{color:MUTED_L,...sans}}>{TEAM.length} advisors across the valley. Choose a department or search by name, language or speciality, then open a profile to get in touch directly.</p>
      </div>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-12">
          <div className="flex flex-wrap gap-2 flex-1">
            {depts.map(d=>{
              const on=d===dept;
              const n=d==="All"?TEAM.length:TEAM.filter(m=>m.department===d).length;
              return (
                <button key={d} onClick={()=>setDept(d)} aria-pressed={on}
                  className="px-5 py-2.5 text-[12px] tracking-[0.12em] border transition-all whitespace-nowrap"
                  style={{borderRadius:"9999px",borderColor:on?"transparent":BORDER_L,background:on?FG_LIGHT:WHITE,color:on?WHITE:FG_LIGHT,...sans}}>
                  {d} <span style={{opacity:0.55}}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className="relative lg:w-80 shrink-0">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:MUTED_L}}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Name, language or speciality" aria-label="Search the team"
              className="w-full border pl-11 pr-4 py-3 text-[14px] outline-none transition-colors focus:border-[#8a2030]" style={{borderColor:BORDER_L,background:WHITE,color:FG_LIGHT,...sans}}/>
          </div>
        </div>
        {shown.length===0 ? (
          <div className="py-20 text-center">
            <p className="text-2xl mb-2" style={{color:FG_LIGHT,...serif}}>No one matches that</p>
            <p className="text-[15px]" style={{color:MUTED_L,...sans}}>Try another department or a different word.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
            {shown.map((m,i)=><TeamCard key={m.id} m={m} onOpen={()=>setProfile(i)}/>)}
          </div>
        )}
      </div>
      <TeamProfile members={shown} index={profile} onIndex={setProfile} onClose={()=>setProfile(null)}/>
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
        {BLOGS.length===0&&<p className="text-[15px]" style={{color:MUTED_L,...sans}}>No articles yet. Please check back soon.</p>}
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
function BlogPostPage({ id, go, onBack, backLabel }: { id:number; go:Go; onBack:()=>void; backLabel:string }) {
  const a=BLOGS.find(b=>b.id===id)||BLOGS[0];
  if(!a) return (
    <div className="min-h-screen pt-32 px-6 md:px-12 lg:px-20" style={{background:BG_LIGHT}}>
      <p className="text-[15px] mb-6" style={{color:MUTED_L,...sans}}>This article isn't available.</p>
      <BackButton label={backLabel} onClick={onBack}/>
    </div>
  );
  const more=BLOGS.filter(b=>b.id!==a.id);
  return (
    <div className="min-h-screen pt-20" style={{background:BG_LIGHT}}>
      <div className="px-6 md:px-12 lg:px-20 py-4 border-b flex items-center gap-2 text-[12px]" style={{borderColor:BORDER_L,background:WHITE}}>
        <button onClick={()=>go("home")} className="shrink-0 text-[12px] transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>Home</button>
        <span style={{color:MUTED_L}}>/</span>
        <button onClick={()=>go("blog")} className="shrink-0 text-[12px] transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>Journal</button>
        <span style={{color:MUTED_L}}>/</span>
        <span className="truncate min-w-0" style={{color:FG_LIGHT,...sans}}>{a.cat}</span>
        <div className="ml-auto pl-4 shrink-0 max-w-[45%]"><BackButton label={backLabel} onClick={onBack} compact/></div>
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
          {/* The full article, written in the admin. Paragraphs are separated by a blank line. */}
          {a.body&&a.body.split(/\n\s*\n/).map(t=>t.trim()).filter(Boolean).map((para,i)=>(
            <p key={i} className="mt-6 leading-[1.85] whitespace-pre-line" style={{color:FG_LIGHT,...sans,fontSize:"1.05rem"}}>{para}</p>
          ))}
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
              <span className="flex items-center gap-4 text-[11px] mt-2" style={{color:MUTED_L,...sans}}>
                <span className="flex items-center gap-1.5"><Calendar size={12} style={{color:GOLD}}/>{b.date}</span>
                <span className="flex items-center gap-1.5"><Clock size={12} style={{color:GOLD}}/>{b.read}</span>
              </span>
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
        {SERVICES.map(s=>(
          <div key={s.id} className="border-b border-r px-10 py-12" style={{borderColor:BORDER_L}}>
            <div className="w-14 h-14 flex items-center justify-center border mb-6" style={{borderColor:BORDER_L,color:MAROON}}><ServiceIcon name={s.icon}/></div>
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
  const { user } = useAuth();
  const [form,setForm]=useState({name:"",email:"",phone:"",interest:CONTACT_TOPICS[0]??"",msg:""});
  const [sent,setSent]=useState(false);
  const [err,setErr]=useState(false);
  const [busy,setBusy]=useState(false);
  const [serverErr,setServerErr]=useState("");
  // Signed in: start from the account's details (still editable).
  useEffect(()=>{ if(user) setForm(v=>({...v,name:v.name||user.name||"",email:v.email||user.email,phone:v.phone||user.phone||""})); },[user]);
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
                  {CONTACT_TOPICS.map(o=><option key={o}>{o}</option>)}
                </select><ChevronDown size={15} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:MUTED_L}}/></div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Message</label>
                <textarea rows={4} value={form.msg} onChange={e=>setForm(v=>({...v,msg:e.target.value}))} className="border px-4 py-3 text-[15px] outline-none resize-none" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
              </div>
              {user?(
                <button disabled={busy} onClick={async()=>{
                  if(!form.name.trim()||!form.email.trim()){ setErr(true); return; }
                  setErr(false); setServerErr(""); setBusy(true);
                  try { await sendContact({name:form.name.trim(),email:form.email.trim(),phone:form.phone.trim(),topic:form.interest,message:form.msg.trim()}); setSent(true); }
                  catch(e) { setServerErr(sendError(e)); }
                  finally { setBusy(false); }
                }} className="py-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}>{busy?"Sending…":"Send Enquiry"}</button>
              ):<SignInToSend action="Send an Enquiry"/>}
              {err&&<p className="text-[14px]" style={{color:MAROON,...sans}}>Please enter your name and email address.</p>}
              {serverErr&&<p role="alert" className="text-[14px]" style={{color:MAROON,...sans}}>{serverErr}</p>}
            </div>
          )}
        </div>
        <div className="px-8 md:px-12 py-16 flex flex-col gap-8" style={{background:CREAM}}>
          {/* One list, so every row carries an icon and the same rule above it.
              Office and Office Hours used to be bare headings between iconned rows. */}
          {[
            {i:<MapPin size={15}/>,        l:"Our Office",   v:CONTACT.address},
            {i:<Phone size={15}/>,         l:"Telephone",    v:CONTACT.phone},
            {i:<Mail size={15}/>,          l:"Email",        v:CONTACT.email},
            {i:<MessageCircle size={15}/>, l:"WhatsApp",     v:CONTACT.whatsapp},
            {i:<Clock size={15}/>,         l:"Office Hours", v:CONTACT.hours},
          ].filter(c=>c.v.trim()).map((c,i)=>(
            <div key={c.l} className={`flex items-start gap-4 ${i>0?"border-t pt-8":""}`} style={{borderColor:BORDER_L}}>
              <span className="w-5 shrink-0 flex justify-center" style={{color:GOLD,marginTop:2}}>{c.i}</span>
              <div><p className="text-[10px] tracking-[0.28em] uppercase mb-1.5" style={{color:MUTED_L,...sans}}>{c.l}</p><p className="text-[15px] leading-relaxed whitespace-pre-line" style={{color:FG_LIGHT,...sans}}>{c.v}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Email verification ───────────────────────────────────────────────────────
// New accounts (and logins before verifying) get a 6-digit code by email. Entering it verifies
// the email and signs the user in; the parent re-renders its signed-in view once `user` is set.
const RESEND_COOLDOWN_S=60;
// UNVERIFIED_ACCOUNT_DAYS comes from auth.tsx (it must match the backend).

function VerifyEmailForm({ email, onBack, onMfa }: { email:string; onBack:()=>void; onMfa:(mfaToken:string)=>void }) {
  const { verifyEmail } = useAuth();
  const [code,setCode]=useState("");
  const [err,setErr]=useState("");
  const [info,setInfo]=useState("");
  const [busy,setBusy]=useState(false);
  // A code was just sent, so resending waits out the backend's one-minute cooldown.
  const [wait,setWait]=useState(RESEND_COOLDOWN_S);
  useEffect(()=>{
    if(wait<=0) return;
    const t=setTimeout(()=>setWait(w=>w-1),1000);
    return ()=>clearTimeout(t);
  },[wait]);

  const submit=async()=>{
    if(busy) return;
    if(!/^\d{6}$/.test(code.trim())){ setErr("Enter the 6-digit code from the email."); return; }
    setErr(""); setInfo(""); setBusy(true);
    try {
      const r=await verifyEmail(email, code.trim());
      if("mfaRequired" in r) onMfa(r.mfaToken);
    }
    catch(e){ setErr(e instanceof ApiError ? e.message : "Verification failed. Please try again."); setCode(""); }
    finally { setBusy(false); }
  };

  const resend=async()=>{
    if(busy||wait>0) return;
    setErr(""); setInfo(""); setBusy(true);
    try { await resendVerification(email); setInfo("A new code is on its way."); setWait(RESEND_COOLDOWN_S); }
    catch(e){ setErr(e instanceof ApiError ? e.message : "Couldn't send a new code. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="flex justify-center mb-4"><Mail size={30} style={{color:GOLD}}/></div>
      <h2 className="text-2xl text-center mb-2" style={{color:FG_LIGHT,...serif}}>Verify your email</h2>
      <p className="text-[14px] text-center mb-8" style={{color:MUTED_L,...sans}}>We sent a 6-digit code to <span style={{color:FG_LIGHT}}>{email}</span>. It expires in 15 minutes.</p>
      <div className="flex flex-col gap-1.5 mb-2">
        <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Verification Code</label>
        <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} onKeyDown={e=>e.key==="Enter"&&submit()} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" maxLength={6} className="border px-4 py-3 text-[18px] tracking-[0.3em] text-center outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
      </div>
      {err&&<p className="text-[14px] mt-2 mb-1" style={{color:MAROON,...sans}}>{err}</p>}
      {info&&<p className="text-[14px] mt-2 mb-1" style={{color:MUTED_L,...sans}}>{info}</p>}
      <button onClick={submit} disabled={busy} className="w-full py-4 mt-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}>{busy?"Verifying...":"Verify Email"}</button>
      <p className="text-center text-[14px] mt-5" style={{color:MUTED_L,...sans}}>
        Didn&apos;t get it? Check your spam folder, or{" "}
        {wait>0 ? <span>resend in {wait}s</span> : <button onClick={resend} disabled={busy} className="transition-colors hover:text-[#8a2030] disabled:opacity-60" style={{color:FG_LIGHT}}>send a new code</button>}
      </p>
      <p className="text-center text-[12px] mt-4" style={{color:MUTED_L,...sans}}>Accounts that aren&apos;t verified within {UNVERIFIED_ACCOUNT_DAYS} days are deleted.</p>
      <button onClick={onBack} className="w-full mt-5 flex items-center justify-center gap-2 text-[13px] transition-colors hover:text-[#8a2030]" style={{color:MUTED_L,...sans}}>
        <ChevronLeft size={14}/>Back
      </button>
    </>
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
  // Right password but the email isn't verified yet: the backend emailed a code.
  const [verifying,setVerifying]=useState<string|null>(null);
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
      else if("verificationRequired" in r) setVerifying(r.email);
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

  const sendReset=async()=>{
    if(busy) return;
    if(!email.trim()){ setErr("Please enter your email address."); return; }
    if(!emailLooksValid(email)){ setErr("Please enter a valid email address."); return; }
    setErr(""); setBusy(true);
    try { await forgotPassword(email.trim()); setResetSent(true); }
    catch(e){ setErr(e instanceof ApiError ? e.message : "Couldn't send the reset link. Please try again."); }
    finally { setBusy(false); }
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
        ) : !user && verifying ? (
          <VerifyEmailForm email={verifying} onBack={()=>{ setVerifying(null); setErr(""); }} onMfa={t=>{ setVerifying(null); setMfa({ token:t }); }}/>
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
                If an account exists for {email}, a password reset link is on its way. The link expires in 15 minutes. Check your spam folder if you don&apos;t see it.
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
              <button onClick={sendReset} disabled={busy} className="w-full py-4 mt-2 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}>{busy?"Sending...":"Send Reset Link"}</button>
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
  // Registered; waiting for the emailed code (no session until the email is verified).
  const [verifying,setVerifying]=useState<string|null>(null);
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
      const r=await register({
        name:vals["Full Name"].trim(), email:vals["Email"].trim(), phone:vals["Phone"].trim(),
        password:vals["Password"], confirmPassword:vals["Confirm Password"],
      });
      setVerifying(r.email);
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
        ):verifying?(
          <div className="border p-10" style={{background:WHITE,borderColor:BORDER_L}}>
            <VerifyEmailForm email={verifying} onBack={()=>setVerifying(null)} onMfa={()=>go("login")}/>
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

// ─── Reset Password Page ──────────────────────────────────────────────────────
// Opened from the emailed link (/reset-password?token=...). App reads the token and removes it
// from the address bar on load, so it doesn't stay in the browser history.
function ResetPasswordPage({ go, token }: { go:Go; token:string }) {
  const [state,setState]=useState<"checking"|"invalid"|"form"|"done">(token ? "checking" : "invalid");
  const [pw,setPw]=useState("");
  const [pw2,setPw2]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(!token) return;
    let cancelled=false;
    verifyResetToken(token)
      .then(()=>{ if(!cancelled) setState("form"); })
      .catch(()=>{ if(!cancelled) setState("invalid"); });
    return ()=>{ cancelled=true; };
  },[token]);

  const submit=async()=>{
    if(busy) return;
    if(pw.length<8){ setErr("Password must be at least 8 characters."); return; }
    if(pw!==pw2){ setErr("The two passwords do not match."); return; }
    setErr(""); setBusy(true);
    try { await resetPassword(token, pw); setState("done"); }
    catch(e){ setErr(e instanceof ApiError ? e.message : "Couldn't reset your password. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen pt-20 flex items-center justify-center py-16" style={{background:BG_LIGHT}}>
      <div className="w-full max-w-md border p-12" style={{background:WHITE,borderColor:BORDER_L}}>
        <div className="flex justify-center mb-8"><img src={logoImg} alt="NB" className="h-12 w-12 object-contain"/></div>
        {state==="checking" ? (
          <p className="text-center text-[15px] py-10" style={{color:MUTED_L,...sans}}>Checking your link...</p>
        ) : state==="invalid" ? (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <h2 className="text-2xl" style={{color:FG_LIGHT,...serif}}>Link expired</h2>
            <p className="text-[15px] leading-relaxed" style={{color:MUTED_L,...sans}}>This reset link is invalid, already used or older than 15 minutes. Request a new one from the sign-in page.</p>
            <button onClick={()=>go("login")} className="mt-2 px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Go to Sign In</button>
          </div>
        ) : state==="done" ? (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <CheckCircle2 size={34} style={{color:GOLD}}/>
            <h2 className="text-2xl" style={{color:FG_LIGHT,...serif}}>Password updated</h2>
            <p className="text-[15px] leading-relaxed" style={{color:MUTED_L,...sans}}>You have been signed out everywhere. Sign in with your new password.</p>
            <button onClick={()=>go("login")} className="mt-2 px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Sign In</button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl text-center mb-2" style={{color:FG_LIGHT,...serif}}>Choose a new password</h2>
            <p className="text-[14px] text-center mb-8" style={{color:MUTED_L,...sans}}>At least 8 characters.</p>
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>New Password</label>
              <PasswordInput value={pw} onChange={setPw} autoComplete="new-password"/>
            </div>
            <div className="flex flex-col gap-1.5 mb-2">
              <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>Confirm Password</label>
              <PasswordInput value={pw2} onChange={setPw2} onEnter={submit} autoComplete="new-password"/>
            </div>
            {err&&<p className="text-[14px] mt-2 mb-1" style={{color:MAROON,...sans}}>{err}</p>}
            <button onClick={submit} disabled={busy} className="w-full py-4 mt-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}>{busy?"Saving...":"Set New Password"}</button>
          </>
        )}
      </div>
    </div>
  );
}

// The admin area (Dashboard, Users, Reviews) lives in src/app/admin/.

// ─── Free Listing Page ─────────────────────────────────────────────────────────
// Signed-in users only: the listing is tied to the account that sent it (the API reads it from
// the token). The contact fields start from the account, and the seller can change them.
function FreeListingPage({ go }: { go:Go }) {
  const { user, status } = useAuth();
  const [vals,setVals]=useState<Record<string,string>>({});
  useEffect(()=>{
    if(user) setVals(o=>({ "Contact Name":user.name??"", "Contact Phone":user.phone, "Contact Email":user.email, ...o }));
  },[user]);
  const [district,setDistrict]=useState("");
  const [images,setImages]=useState<PickedImage[]>([]);
  const [amenities,setAmenities]=useState<string[]>([]);
  const [err,setErr]=useState("");
  const [done,setDone]=useState(false);
  // While sending: which photo is uploading ("Uploading photo 2 of 4…"), then the listing itself.
  const [sending,setSending]=useState("");

  const textFields=[
    {l:"Property Title",t:"text",ph:"e.g. Patan 5-Bedroom Villa"},
    {l:"Contact Name",t:"text",ph:"Your name"},
    {l:"Contact Phone",t:"tel",ph:"+977 ..."},
    {l:"Contact Email",t:"email",ph:"your@email.com"},
    {l:"Price (NPR)",t:"text",ph:"e.g. 5,00,00,000"},
    {l:"Built Area",t:"text",ph:"e.g. 3,500 sq.ft"},
    {l:"Land Area",t:"text",ph:"e.g. 8 Ropani or 4-4-0-1"},
    {l:"Build Year",t:"number",ph:"2020"},
  ];
  const set=(k:string,v:string)=>setVals(o=>({...o,[k]:v}));
  const toggleAmenity=(name:string)=>
    setAmenities(a=>a.includes(name)?a.filter(x=>x!==name):[...a,name]);

  const submit=async()=>{
    if(sending) return;
    const missing=["Property Title","Contact Name","Contact Phone"].find(k=>!(vals[k]||"").trim());
    if(missing){ setErr(`Please fill in "${missing}".`); return; }
    if(!district.trim()){ setErr("Please choose a district."); return; }
    if(images.length===0){ setErr("Please add at least one photo — listings with photos get far more enquiries."); return; }
    // Lands in Admin → Free Listings for review; the seller's details stay private.
    const v=(k:string)=>(vals[k]||"").trim();
    setErr("");
    try {
      // The photos go up first (one at a time, in order: the first is the cover), then the listing.
      const photos:string[]=[];
      for(const [i,img] of images.entries()){
        setSending(`Uploading photo ${i+1} of ${images.length}…`);
        photos.push(await uploadListingPhoto(img.file));
      }
      setSending("Sending your listing…");
      await submitListing({sellerName:v("Contact Name"),sellerPhone:v("Contact Phone"),sellerEmail:v("Contact Email"),
        title:v("Property Title"),listing:v("Listing Type")==="For Rent"?"For Rent":"For Sale",type:v("Property Type")&&v("Property Type")!=="All Types"?v("Property Type"):"House/Bungalow",
        district,price:v("Price (NPR)"),builtArea:v("Built Area"),landArea:v("Land Area"),buildYear:v("Build Year"),description:v("desc"),
        amenities,photos});
      setDone(true);
    } catch(e) {
      setErr(sendError(e));
    } finally {
      setSending("");
    }
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
          {!user?(
            <div className="flex flex-col items-center text-center gap-4 py-16">
              <Lock size={32} style={{color:GOLD}}/>
              <h2 className="text-2xl" style={{color:FG_LIGHT,...serif}}>{status==="loading"?"Checking your account…":"Log in to list your property"}</h2>
              {status!=="loading"&&<>
                <p className="text-[15px] leading-relaxed max-w-md" style={{color:MUTED_L,...sans}}>
                  Free listings are for members, so our team knows who sent each property. It takes a minute to create an account.
                </p>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  <button onClick={()=>go("login")} className="px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Log In</button>
                  <button onClick={()=>go("register")} className="px-8 py-4 border text-[11px] tracking-[0.25em] uppercase transition-all hover:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}>Create Account</button>
                </div>
              </>}
            </div>
          ):done?(
            <div className="flex flex-col items-center text-center gap-4 py-16">
              <CheckCircle2 size={36} style={{color:GOLD}}/>
              <h2 className="text-2xl" style={{color:FG_LIGHT,...serif}}>Listing submitted</h2>
              <p className="text-[15px] leading-relaxed max-w-md" style={{color:MUTED_L,...sans}}>
                Thank you. Our listings team will review {vals["Property Title"]} in {district} with {images.length} photo{images.length===1?"":"s"} and contact {vals["Contact Name"]} within one working day.
              </p>
              <button onClick={()=>{ setDone(false); setVals(user?{ "Contact Name":user.name??"", "Contact Phone":user.phone, "Contact Email":user.email }:{}); setDistrict(""); setImages([]); setAmenities([]); }} className="mt-2 px-8 py-4 text-[11px] tracking-[0.25em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Submit Another</button>
            </div>
          ):(<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {textFields.map(f=>(
                <div key={f.l} className="flex flex-col gap-1.5">
                  <label className="text-[10px] tracking-[0.28em] uppercase" style={{color:MUTED_L,...sans}}>{f.l}</label>
                  <input type={f.t} placeholder={f.ph} value={vals[f.l]||""} onChange={e=>set(f.l,e.target.value)} className="border px-3 py-3 text-[15px] outline-none transition-all focus:border-[#8a2030]" style={{borderColor:BORDER_L,color:FG_LIGHT,...sans}}/>
                </div>
              ))}

              {[{l:"Property Type",opts:PROPERTY_TYPES},{l:"Listing Type",opts:["For Sale","For Rent"]}].map(s=>(
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
            <button onClick={()=>void submit()} disabled={!!sending} className="mt-6 w-full py-4 text-[12px] tracking-[0.25em] uppercase transition-all hover:brightness-110 disabled:opacity-60" style={{background:MAROON,color:WHITE,...sans}}>{sending||"Submit Free Listing"}</button>
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

// ─── Back button helpers ──────────────────────────────────────────────────────
/** A page the visitor was on: everything go() changes, plus how far down they had scrolled. */
type Visit = { page:Page; nav:NavOpts; selId:number; blogId:number; scrollY:number };

/** "Back to …" text for a page, e.g. "Back to Properties for Sale" or a property's title. */
function visitLabel(v:Visit):string {
  const name=(():string=>{
    switch(v.page){
      case "home": case "videos": return "Home";
      case "buy":  return v.nav.district ? `Properties in ${v.nav.district}` : "Properties for Sale";
      case "rent": return v.nav.district ? `Rentals in ${v.nav.district}` : "Properties for Rent";
      case "hot": return "Hot Properties";
      case "new-listings": return "New Listings";
      case "map": return "Map";
      case "area": return v.nav.district ? `Properties in ${v.nav.district}` : "Properties";
      case "property": return ALL_PROPS.find(x=>x.id===v.selId)?.title ?? "Property";
      case "blog": return "Journal";
      case "blog-post": return BLOGS.find(b=>b.id===v.blogId)?.title ?? "Article";
      case "about": return "About";
      case "team": return "Our Team";
      case "services": return "Services";
      case "emi": return "EMI Calculator";
      case "contact": return "Contact";
      case "login": return "Sign In";
      case "register": return "Register";
      case "free-listing": return "Free Listing";
      case "reset-password": return "Reset Password";
      case "admin": case "admin-users": case "admin-reviews": case "admin-listings": case "admin-messages": return "Admin";
    }
  })();
  return `Back to ${name}`;
}

// ─── App ──────────────────────────────────────────────────────────────────────
/**
 * Loads the properties once the sign-in check is done: the admin list for the admin (it adds the
 * private location the editor needs), the public list for everyone else. Shows a retry bar when
 * the server can't be reached.
 */
function PropertySync() {
  const { user, status } = useAuth();
  const admin = user?.role==="ADMIN";
  // The journal loads alongside: the admin's list includes drafts.
  useEffect(()=>{ if(status!=="loading") { void loadProperties(admin); void loadArticles(admin); } },[status,admin]);
  // The team is the same for everyone.
  useEffect(()=>{ void loadTeam(); void loadTestimonials(); void loadSiteOptions(); void loadSiteSettings(); },[]);
  // The admin's inbox: loaded on sign-in and checked every 30 s, so new messages (and the red
  // badge) show up without a reload. Forgotten on sign-out.
  useEffect(()=>{
    if(!admin){ clearMessages(); clearAdminReviews(); clearListings(); return; }
    void loadMessages(); void loadAdminReviews(); void loadListings();
    const t=window.setInterval(()=>{ void loadMessages(); void loadAdminReviews(); void loadListings(); },30_000);
    return ()=>window.clearInterval(t);
  },[admin]);
  // Which properties this user has hearted (forgotten on sign-out).
  useEffect(()=>{ if(status==="loading") return; if(user) void loadMyHearts(); else clearMyHearts(); },[user?.id,status]);
  useDataVersion();
  if(propertiesStatus!=="error") return null;
  return (
    <div role="alert" className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[120] flex flex-wrap items-center gap-4 px-5 py-3.5 border shadow-lg max-w-[calc(100%-2rem)]" style={{background:WHITE,borderColor:"rgba(138,32,48,0.35)"}}>
      <span className="text-[14px]" style={{color:FG_LIGHT,...sans}}>Couldn't load the properties. {propertiesError}</span>
      <button onClick={()=>void loadProperties(admin)} className="px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition-all hover:brightness-110" style={{background:MAROON,color:WHITE,...sans}}>Try again</button>
    </div>
  );
}

export default function App() {
  const [loading, setLoading]=useState(true);
  // Re-render every page when the properties arrive (or the admin saves one).
  useDataVersion();
  // The loading screen stays until the first property load has finished, so no page shows empty.
  const showLoader=loading||propertiesStatus==="loading"||articlesStatus==="loading"||teamStatus==="loading"||testimonialsStatus==="loading"||siteStatus==="loading";
  // The backend's Google callback lands back here with ?auth=google or ?auth_error=google.
  const [googleResult]=useState<GoogleResult>(()=>{
    const q=new URLSearchParams(window.location.search);
    const auth=q.get("auth");
    return auth==="google" ? "success" : auth==="google_mfa" ? "mfa" : q.get("auth_error")==="google" ? "error" : null;
  });
  useEffect(()=>{
    if(googleResult) window.history.replaceState(null,"",window.location.pathname);
  },[googleResult]);
  // The password reset email links to /reset-password?token=... Take the token, then drop it
  // from the address bar (and history) right away.
  const [resetToken]=useState<string|null>(()=>
    window.location.pathname==="/reset-password" ? new URLSearchParams(window.location.search).get("token") ?? "" : null);
  useEffect(()=>{
    if(resetToken!==null) window.history.replaceState(null,"","/");
  },[resetToken]);
  const [page, setPage]=useState<Page>(resetToken!==null ? "reset-password" : googleResult ? "login" : "home");
  const [selId, setSelId]=useState(1);
  const [blogId, setBlogId]=useState(1);
  const [nav, setNav]=useState<NavOpts>({});
  const handleDone=useCallback(()=>setLoading(false),[]);

  // ── Back button ──
  // Pages visited so far (newest last). Browser history isn't touched.
  // `here` is the page on screen; go() reads it before the next render, so it's the page being left.
  const here=useRef<Visit>({ page, nav, selId, blogId, scrollY:0 });
  here.current={ page, nav, selId, blogId, scrollY:0 };
  const trail=useRef<Visit[]>([]);
  const restoreY=useRef<number|null>(null);
  const [trailLen,setTrailLen]=useState(0);
  // The property a link has just chosen (setId runs right before go), so opening another
  // property from "You May Also Like" counts as a new page rather than the same one.
  const nextSelId=useRef<number|null>(null);
  const setSelIdFromLink=useCallback((id:number)=>{ nextSelId.current=id; setSelId(id); },[]);

  const go=useCallback<Go>((p,o={})=>{
    const from=here.current;
    const toSel=nextSelId.current ?? from.selId;
    nextSelId.current=null;
    const same=from.page===p && JSON.stringify(from.nav)===JSON.stringify(o)
      && (o.blog===undefined || o.blog===from.blogId) && (p!=="property" || toSel===from.selId);
    if(!same){
      trail.current.push({ ...from, scrollY:window.scrollY });
      if(trail.current.length>50) trail.current.shift();
      setTrailLen(trail.current.length);
    }
    restoreY.current=null;
    setPage(p); setNav(o);
    if(o.blog!==undefined) setBlogId(o.blog);
    // Admin tabs switch in place: AdminLayout keeps the tab bar where it was instead of the page
    // jumping back to the top. Everything else opens at the top.
    if(!(from.page.startsWith("admin")&&p.startsWith("admin"))) window.scrollTo(0,0);
  },[]);
  // A signed-out visitor tapped the heart or "Write a Review" (auth.tsx → requestSignIn).
  useEffect(()=>onSignInRequest(()=>go("login")),[go]);

  /** Where the Back button leads: the previous page, or the natural parent if there is none. */
  const backTarget=():Visit=>{
    const prev=trail.current[trail.current.length-1];
    if(prev) return prev;
    const h=here.current;
    const listing=ALL_PROPS.find(x=>x.id===h.selId)?.listing;
    const parent:Page=h.page==="property" ? (listing==="For Rent" ? "rent" : "buy") : h.page==="blog-post" ? "blog" : h.page==="team" ? "about" : "home";
    return { page:parent, nav:{}, selId:h.selId, blogId:h.blogId, scrollY:0 };
  };
  const goBack=useCallback(()=>{
    const prev=trail.current.pop();
    setTrailLen(trail.current.length);
    if(!prev){ const t=backTarget(); go(t.page,t.nav); trail.current=[]; setTrailLen(0); return; }
    restoreY.current=prev.scrollY;
    setPage(prev.page); setNav(prev.nav); setSelId(prev.selId); setBlogId(prev.blogId);
    window.scrollTo(0,0);
  },[go]);
  // Recomputed whenever the page or the trail changes, so the button always names its target.
  const backLabel=useMemo(()=>visitLabel(backTarget()),[trailLen,page,selId,blogId,nav]);

  // After Back, scroll to where the visitor was. Retried briefly because the page is still
  // animating in and images are loading; stops as soon as they scroll themselves.
  useEffect(()=>{
    const y=restoreY.current;
    if(y===null||y<=0) return;
    restoreY.current=null;
    const until=performance.now()+1500;
    let raf=0;
    const stop=()=>{ cancelAnimationFrame(raf); window.removeEventListener("wheel",stop); window.removeEventListener("touchstart",stop); };
    const tick=()=>{
      const target=Math.min(y, Math.max(0, document.documentElement.scrollHeight-window.innerHeight));
      if(Math.abs(window.scrollY-target)>2) window.scrollTo(0,target);
      if(performance.now()<until) raf=requestAnimationFrame(tick); else stop();
    };
    window.addEventListener("wheel",stop,{ passive:true });
    window.addEventListener("touchstart",stop,{ passive:true });
    raf=requestAnimationFrame(tick);
    return stop;
  },[page,selId,blogId,nav]);

  const navKey=[nav.type,nav.district,nav.preset,nav.view,nav.scrollTo].join("|");
  // Floating Quick Enquiry: on the home page, glide down to the enquiry form; anywhere else,
  // open the home page at that form (HomePage scrolls to `scrollTo` once it has rendered).
  const goToEnquiry=useCallback(()=>{
    const onHome=page==="home"||page==="videos";
    const el=onHome ? document.getElementById("enquiry") : null;
    if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
    else go("home",{scrollTo:"enquiry"});
  },[page,go]);
  // What the admin pages need: page changes, and opening one listing on the public site.
  const adminNav=useMemo<AdminNav>(()=>({ go:p=>go(p), openProperty:id=>{ setSelIdFromLink(id); go("property"); } }),[go,setSelIdFromLink]);
  return (
    <AuthProvider>
    <div className="min-h-screen bg-background">
      <AnimatePresence>
        {showLoader&&<LoadingScreen key="loader" onDone={handleDone}/>}
      </AnimatePresence>
      <PropertySync/>
      <motion.div animate={{opacity:showLoader?0:1}} transition={{duration:0.6}} style={{pointerEvents:showLoader?"none":"auto"}}>
        <Navbar page={page} go={go}/>
        <AnimatePresence mode="wait">
          {/* The three admin pages share one key, so switching between their tabs is instant
              instead of fading out and in like a change of page. */}
          <motion.div key={page.startsWith("admin") ? "admin-area" : `${page}|${selId}|${blogId}|${navKey}`} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.38,ease:[0.16,1,0.3,1]}}>
            {page==="home"&&<HomePage go={go} setId={setSelIdFromLink} scrollTo={nav.scrollTo}/>}
            {page==="buy"&&<BuyRentPage listing="For Sale" go={go} setId={setSelIdFromLink} nav={nav}/>}
            {page==="rent"&&<BuyRentPage listing="For Rent" go={go} setId={setSelIdFromLink} nav={nav}/>}
            {page==="hot"&&<BuyRentPage listing="For Sale" go={go} setId={setSelIdFromLink} nav={{...nav,preset:"hot"}}/>}
            {page==="new-listings"&&<BuyRentPage listing="For Sale" go={go} setId={setSelIdFromLink} nav={{...nav,preset:"new"}}/>}
            {page==="map"&&<BuyRentPage listing="For Sale" go={go} setId={setSelIdFromLink} nav={{...nav,view:"map"}}/>}
            {page==="area"&&<BuyRentPage listing="For Sale" go={go} setId={setSelIdFromLink} nav={nav}/>}
            {page==="property"&&(ALL_PROPS.length
              ? <PropertyDetailPage propertyId={selId} go={go} setId={setSelIdFromLink} onBack={goBack} backLabel={backLabel}/>
              : <div className="min-h-screen pt-40 px-6 text-center" style={{background:BG_LIGHT}}>
                  <p className="text-2xl mb-4" style={{color:FG_LIGHT,...serif}}>No properties to show yet.</p>
                  <button onClick={()=>go("home")} className="text-[11px] tracking-[0.25em] uppercase underline underline-offset-4" style={{color:MAROON,...sans}}>Back to home</button>
                </div>)}
            {page==="about"&&<AboutPage go={go}/>}
            {page==="team"&&<TeamPage onBack={goBack} backLabel={backLabel}/>}
            {page==="blog"&&<BlogPage go={go}/>}
            {page==="blog-post"&&<BlogPostPage id={blogId} go={go} onBack={goBack} backLabel={backLabel}/>}
            {page==="services"&&<ServicesPage go={go}/>}
            {page==="emi"&&<EMICalculator/>}
            {page==="contact"&&<ContactPage/>}
            {page==="login"&&<LoginPage go={go} googleResult={googleResult}/>}
            {page==="register"&&<RegisterPage go={go}/>}
            {page==="free-listing"&&<FreeListingPage go={go}/>}
            {page.startsWith("admin")&&(
              <Suspense fallback={<div className="min-h-screen pt-20 flex items-center justify-center" style={{background:BG_LIGHT}}><p className="text-[15px]" style={{color:MUTED_L,...sans}}>Loading the admin…</p></div>}>
                {page==="admin"&&<AdminDashboard nav={adminNav}/>}
                {page==="admin-users"&&<AdminUsers nav={adminNav}/>}
                {page==="admin-reviews"&&<AdminReviews nav={adminNav}/>}
                {page==="admin-messages"&&<AdminMessages nav={adminNav}/>}
                {page==="admin-listings"&&<AdminListings nav={adminNav}/>}
              </Suspense>
            )}
            {page==="reset-password"&&<ResetPasswordPage go={go} token={resetToken??""}/>}
            {page==="videos"&&<HomePage go={go} setId={setSelIdFromLink} scrollTo="videos"/>}
          </motion.div>
        </AnimatePresence>
        <Footer go={go}/>
        {/* Visitor contact buttons; not shown in the admin, where they would cover the tools. */}
        {!page.startsWith("admin")&&<QuickEnquiryFloat overHero={page==="home"||page==="videos"} onEnquire={goToEnquiry}/>}
      </motion.div>
    </div>
    </AuthProvider>
  );
}
