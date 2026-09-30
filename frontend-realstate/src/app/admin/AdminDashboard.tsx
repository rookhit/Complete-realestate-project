import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck, Building2, ClipboardList, CheckCircle2, Clapperboard, Copy, Eye, Heart, Home, LayoutGrid,
  ListChecks, Mail, MapPin, MessageSquare, Minus, Newspaper, Pencil, Phone, Plus, Quote, Search, Star, Trash2, Users,
} from "lucide-react";
import { useAuth } from "@/app/auth";
import { ALL_PROPS, PROPERTY_TYPES, deleteProperty, displayRef, matchesRef, restoreProperty, saveProperty, type Prop } from "@/app/data/properties";
import { BLOGS, TEAM, TESTIMONIALS, VIDEO_LIST } from "@/app/data/content";
import { REACTIONS, reviewedPropertyIds, reviewsFor, setReactionCount } from "@/app/data/reviews";
import { useDataVersion } from "@/app/data/store";
import { AMENITIES } from "@/app/icons/amenities";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { Button, Select } from "@/app/components/ui/form-controls";
import { ListPagination, paginate } from "@/app/components/ui/list-pagination";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { AdminLayout, type AdminNav } from "./AdminLayout";
import { PropertyEditor } from "./PropertyEditor";
import { HomePageSection, JournalSection, TeamSection, TestimonialsSection, VideosSection } from "./ContentEditors";
import { CompanySection } from "./CompanyEditor";
import { OptionsSection } from "./OptionsEditor";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { Chip, EmptyState, SearchBox, SectionHeading, useToast, type Notify } from "./parts";

type Section = "overview" | "properties" | "journal" | "team" | "testimonials" | "videos" | "homepage" | "company" | "options";

const SECTIONS: { key: Section; label: string; Icon: typeof Home }[] = [
  { key: "overview", label: "Overview", Icon: LayoutGrid },
  { key: "properties", label: "Properties", Icon: Building2 },
  { key: "journal", label: "Journal", Icon: Newspaper },
  { key: "team", label: "Team", Icon: Users },
  { key: "testimonials", label: "Testimonials", Icon: Quote },
  { key: "videos", label: "Videos", Icon: Clapperboard },
  { key: "homepage", label: "Home Page", Icon: Home },
  { key: "company", label: "Contact & Services", Icon: Phone },
  { key: "options", label: "Dropdown Options", Icon: ListChecks },
];

const CANONICAL = new Set(AMENITIES.map(a => a.name));

export function AdminDashboard({ nav }: { nav: AdminNav }) {
  const version = useDataVersion();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [toast, notify] = useToast();
  const [editing, setEditing] = useState<Prop | "new" | null>(null);
  const [copyOf, setCopyOf] = useState<Prop | null>(null);
  // An article or team member to open as soon as its section shows (from the checklist or Ctrl K).
  const [openArticle, setOpenArticle] = useState<number | null>(null);
  const [openMember, setOpenMember] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const goTo = useCallback((s: Section) => { setSection(s); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const clearArticle = useCallback(() => setOpenArticle(null), []);
  const clearMember = useCallback(() => setOpenMember(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(o => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const act = (id: string, label: string, icon: ReactNode, run: () => void, keywords = ""): PaletteItem => ({ id, group: "Actions", label, icon, run, keywords });
    return [
      act("a-prop", "Add a property", <Plus size={15} />, () => setEditing("new"), "new listing house land"),
      act("a-article", "Write an article", <Newspaper size={15} />, () => goTo("journal"), "blog journal post"),
      act("a-team", "Add a team member", <Users size={15} />, () => goTo("team"), "employee staff advisor"),
      act("a-testimonial", "Add a testimonial", <Quote size={15} />, () => goTo("testimonials"), "client quote"),
      act("a-video", "Add a video", <Clapperboard size={15} />, () => goTo("videos"), "youtube film"),
      act("a-home", "Update home page statistics and districts", <Home size={15} />, () => goTo("homepage"), "stats numbers"),
      act("a-options", "Edit dropdown options", <ListChecks size={15} />, () => goTo("options"), "positions roles badges types languages departments specialities list choices"),
      act("a-listings", "Review free listings from sellers", <ClipboardList size={15} />, () => nav.go("admin-listings"), "free listing seller submission publish"),
      act("a-messages", "Open messages and enquiries", <Mail size={15} />, () => nav.go("admin-messages"), "inbox email enquiry callback reply unread"),
      act("a-contact", "Edit contact details and services", <Phone size={15} />, () => goTo("company"), "phone whatsapp email address hours social instagram facebook services"),
      act("a-overview", "Overview and checklist", <LayoutGrid size={15} />, () => goTo("overview"), "dashboard attention"),
      act("a-users", "Users", <Users size={15} />, () => nav.go("admin-users"), "accounts members people"),
      act("a-reviews", "Reviews", <MessageSquare size={15} />, () => nav.go("admin-reviews"), "comments moderate"),
      act("a-site", "View the website", <Eye size={15} />, () => nav.go("home"), "public site"),
      ...ALL_PROPS.map<PaletteItem>(p => ({
        id: `p-${p.id}`, group: "Properties", label: p.title, hint: displayRef(p.nbId), keywords: `${p.location} ${p.district} ${p.type} ${p.listing}`,
        icon: <Building2 size={15} />, run: () => setEditing(p),
      })),
      ...BLOGS.map<PaletteItem>(b => ({
        id: `b-${b.id}`, group: "Articles", label: b.title, hint: b.cat, keywords: b.author,
        icon: <Newspaper size={15} />, run: () => { goTo("journal"); setOpenArticle(b.id); },
      })),
      ...TEAM.map<PaletteItem>(m => ({
        id: `t-${m.id}`, group: "Team", label: m.name, hint: m.role, keywords: `${m.department ?? ""} ${(m.languages ?? []).join(" ")}`,
        icon: <Users size={15} />, run: () => { goTo("team"); setOpenMember(m.id); },
      })),
    ];
  }, [version, goTo, nav]);

  const content: Record<Section, ReactNode> = {
    overview: <Overview go={goTo} nav={nav} onAddProperty={() => setEditing("new")} onEditProperty={setEditing}
      onOpenArticle={id => { goTo("journal"); setOpenArticle(id); }} onOpenMember={id => { goTo("team"); setOpenMember(id); }} />,
    properties: <PropertiesSection notify={notify} onAdd={() => setEditing("new")} onEdit={setEditing} onDuplicate={setCopyOf} nav={nav} />,
    journal: <JournalSection notify={notify} openId={openArticle} onOpened={clearArticle} />,
    team: <TeamSection notify={notify} openId={openMember} onOpened={clearMember} />,
    testimonials: <TestimonialsSection notify={notify} />,
    videos: <VideosSection notify={notify} />,
    homepage: <HomePageSection notify={notify} />,
    company: <CompanySection notify={notify} />,
    options: <OptionsSection notify={notify} />,
  };

  return (
    <AdminLayout nav={nav} current="admin" tag="Administration" title="Admin Dashboard"
      intro={<>Welcome back{user?.name ? `, ${user.name}` : ""}. <span className="hidden lg:inline">Pick a section on the left, or press <b style={{ color: FG_LIGHT }}>Ctrl K</b> to find anything.</span><span className="lg:hidden">Pick a section below, or use Find anything.</span></>}>
      <div className="grid grid-cols-1 lg:grid-cols-[15rem_1fr] gap-8 lg:gap-12 items-start">
        <div className="lg:sticky lg:top-[9.5rem] flex flex-col gap-3 min-w-0">
          <button type="button" onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-3 px-4 py-3 border text-left text-[13px] transition-colors hover:border-[#b08848]"
            style={{ borderColor: BORDER_L, background: WHITE, color: MUTED_L, ...sans }}>
            <Search size={15} style={{ color: GOLD }} /><span className="flex-1">Find anything</span>
            <kbd className="text-[10px] tracking-[0.12em] px-1.5 py-0.5 border" style={{ borderColor: BORDER_L }}>Ctrl K</kbd>
          </button>
          <nav aria-label="Dashboard sections" className="flex lg:flex-col gap-1 overflow-x-auto border lg:border-0 p-1 lg:p-0" style={{ borderColor: BORDER_L, background: WHITE, scrollbarWidth: "none" }}>
            {SECTIONS.map(({ key, label, Icon }) => {
              const on = key === section;
              return (
                <button key={key} onClick={() => goTo(key)} aria-current={on ? "page" : undefined}
                  className="relative flex items-center gap-3 px-4 py-3 text-left text-[13px] whitespace-nowrap transition-colors hover:text-[#8a2030]"
                  style={{ background: on ? "rgba(176,136,72,0.1)" : "transparent", color: on ? FG_LIGHT : MUTED_L, ...sans }}>
                  <span className="hidden lg:block absolute left-0 top-2 bottom-2 w-[2px]" style={{ background: on ? GOLD : "transparent" }} />
                  <Icon size={16} style={{ color: on ? GOLD : undefined }} />{label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="min-w-0">{content[section]}</div>
      </div>

      <PropertyEditor property={editing === "new" || editing === null ? null : editing} template={copyOf}
        open={editing !== null || copyOf !== null} onClose={() => { setEditing(null); setCopyOf(null); }}
        onSaved={notify} onViewOnSite={id => { setEditing(null); setCopyOf(null); nav.openProperty(id); }} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
      {toast}
    </AdminLayout>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

type Issue = { key: string; what: string; problem: string; fix: () => void; fixLabel: string; kind: "property" | "article" | "team" | "review" };

/** Things worth fixing, found by looking at the data rather than asking the admin to remember. */
function findIssues(on: { property: (p: Prop) => void; article: (id: number) => void; member: (id: number) => void; reviews: () => void }): Issue[] {
  const out: Issue[] = [];
  for (const p of ALL_PROPS) {
    const fix = () => on.property(p);
    const amenities = p.features.filter(f => CANONICAL.has(f)).length;
    if (p.gallery.length < 3) out.push({ key: `p${p.id}-photos`, kind: "property", what: p.title, problem: `Only ${p.gallery.length} photo${p.gallery.length === 1 ? "" : "s"}. Aim for five or more.`, fix, fixLabel: "Add photos" });
    if (p.description.trim().length < 80) out.push({ key: `p${p.id}-desc`, kind: "property", what: p.title, problem: "The description is very short.", fix, fixLabel: "Write it" });
    if (amenities < 3) out.push({ key: `p${p.id}-amen`, kind: "property", what: p.title, problem: `${amenities} amenit${amenities === 1 ? "y" : "ies"} ticked. Buyers filter on these.`, fix, fixLabel: "Add amenities" });
    if (p.beds > 0 && !p.floorPlan?.length) out.push({ key: `p${p.id}-plan`, kind: "property", what: p.title, problem: "No floor plan yet.", fix, fixLabel: "Add a plan" });
    if (!p.verified) out.push({ key: `p${p.id}-ver`, kind: "property", what: p.title, problem: "Not marked as verified.", fix, fixLabel: "Review" });
  }
  for (const b of BLOGS) if (!b.body?.trim()) out.push({ key: `b${b.id}`, kind: "article", what: b.title, problem: "Only a summary, no full article text.", fix: () => on.article(b.id), fixLabel: "Write it" });
  for (const m of TEAM) {
    if (!m.bio?.trim()) out.push({ key: `t${m.id}-bio`, kind: "team", what: m.name, problem: "No profile bio.", fix: () => on.member(m.id), fixLabel: "Add bio" });
    if (!m.phone && !m.whatsapp && !m.email) out.push({ key: `t${m.id}-contact`, kind: "team", what: m.name, problem: "No contact details in the profile.", fix: () => on.member(m.id), fixLabel: "Add contact" });
  }
  const low = reviewedPropertyIds().flatMap(id => reviewsFor(id)).filter(r => r.rating <= 3).length;
  if (low) out.push({ key: "reviews-low", kind: "review", what: `${low} review${low === 1 ? "" : "s"} of 3 stars or fewer`, problem: "Worth reading in case something needs a reply or removal.", fix: on.reviews, fixLabel: "Open reviews" });

  // Take one of each kind in turn, so a long run of property reminders
  // can't push the team, article or review items off the first screen.
  const byKind = (["review", "team", "article", "property"] as const).map(k => out.filter(i => i.kind === k));
  const mixed: Issue[] = [];
  while (byKind.some(q => q.length)) for (const q of byKind) { const next = q.shift(); if (next) mixed.push(next); }
  return mixed;
}

const KIND_ICON: Record<Issue["kind"], ReactNode> = {
  property: <Building2 size={15} />, article: <Newspaper size={15} />, team: <Users size={15} />, review: <Star size={15} />,
};

function Overview({ go, nav, onAddProperty, onEditProperty, onOpenArticle, onOpenMember }: {
  go: (s: Section) => void; nav: AdminNav; onAddProperty: () => void; onEditProperty: (p: Prop) => void;
  onOpenArticle: (id: number) => void; onOpenMember: (id: number) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const issues = findIssues({ property: onEditProperty, article: onOpenArticle, member: onOpenMember, reviews: () => nav.go("admin-reviews") });
  const reviewCount = reviewedPropertyIds().reduce((n, id) => n + reviewsFor(id).length, 0);
  const reactions = ALL_PROPS.reduce((n, p) => n + (REACTIONS[p.id] ?? 0), 0);
  const tiles = [
    { label: "Properties", value: ALL_PROPS.length, note: `${ALL_PROPS.filter(p => p.listing === "For Sale").length} for sale · ${ALL_PROPS.filter(p => p.listing === "For Rent").length} for rent`, to: "properties" as Section },
    { label: "Featured", value: ALL_PROPS.filter(p => p.featured).length, note: "In the hero and Hot Properties", to: "properties" as Section },
    { label: "Reactions", value: reactions.toLocaleString("en-US"), note: "Hearts across all listings", to: "properties" as Section },
    { label: "Reviews", value: reviewCount, note: "Open the Reviews tab to manage", to: null },
    { label: "Articles", value: BLOGS.length, note: "In the Property Journal", to: "journal" as Section },
    { label: "Team", value: TEAM.length, note: "About and Our Team pages", to: "team" as Section },
    { label: "Testimonials", value: TESTIMONIALS.length, note: "On the home page", to: "testimonials" as Section },
    { label: "Videos", value: VIDEO_LIST.length, note: "In “Explore in Video”", to: "videos" as Section },
  ];
  const shown = showAll ? issues : issues.slice(0, 6);

  return (
    <div className="flex flex-col gap-12">
      <div>
        <SectionHeading title="Needs Attention"
          subtitle={issues.length ? "Small things that make listings and pages better. Each one opens exactly where to fix it." : undefined} />
        {issues.length === 0 ? (
          <div className="flex items-center gap-4 border px-6 py-6" style={{ borderColor: "rgba(176,136,72,0.45)", background: "rgba(176,136,72,0.07)" }}>
            <CheckCircle2 size={22} style={{ color: GOLD }} />
            <p className="text-[15px]" style={{ color: FG_LIGHT, ...sans }}>Everything looks complete. Nice work.</p>
          </div>
        ) : (
          <div className="border" style={{ borderColor: BORDER_L, background: WHITE }}>
            {shown.map(i => (
              <div key={i.key} className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0" style={{ borderColor: BORDER_L }}>
                <span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center" style={{ background: "rgba(176,136,72,0.1)", color: GOLD }}>{KIND_ICON[i.kind]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] truncate" style={{ color: FG_LIGHT, ...serif }}>{i.what}</p>
                  <p className="text-[13px] mt-0.5" style={{ color: MUTED_L, ...sans }}>{i.problem}</p>
                </div>
                <button type="button" onClick={i.fix}
                  className="shrink-0 px-4 py-2.5 border text-[11px] tracking-[0.18em] uppercase transition-colors hover:border-[#8a2030] hover:text-[#8a2030]"
                  style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }}>{i.fixLabel}</button>
              </div>
            ))}
            {issues.length > 6 && (
              <button type="button" onClick={() => setShowAll(s => !s)}
                className="w-full py-3.5 text-[11px] tracking-[0.22em] uppercase transition-colors hover:text-[#8a2030]"
                style={{ color: MUTED_L, ...sans }}>
                {showAll ? "Show fewer" : `Show all ${issues.length}`}
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <SectionHeading title="At a Glance" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {tiles.map(t => {
            const body = (
              <>
                <p className="text-[10px] tracking-[0.28em] uppercase" style={{ color: MUTED_L, ...sans }}>{t.label}</p>
                <p className="mt-3 leading-none" style={{ color: FG_LIGHT, ...serif, fontSize: "clamp(2rem,3.4vw,2.8rem)" }}>{t.value}</p>
                <p className="mt-3 text-[12px] leading-snug" style={{ color: MUTED_L, ...sans }}>{t.note}</p>
              </>
            );
            return t.to
              ? <button key={t.label} onClick={() => go(t.to!)} className="text-left border px-6 py-6 transition-all hover:-translate-y-0.5 hover:border-[#b08848]" style={{ borderColor: BORDER_L, background: WHITE }}>{body}</button>
              : <div key={t.label} className="border px-6 py-6" style={{ borderColor: BORDER_L, background: WHITE }}>{body}</div>;
          })}
        </div>
      </div>

      <div>
        <SectionHeading title="Quick Actions" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Add a property", text: "Photos, price, amenities and floor plans.", Icon: Building2, run: onAddProperty },
            { label: "Write an article", text: "Publish to the Property Journal.", Icon: Newspaper, run: () => go("journal") },
            { label: "Add a team member", text: "With a profile visitors can open.", Icon: Users, run: () => go("team") },
            { label: "Update the home page", text: "Statistics and featured districts.", Icon: Home, run: () => go("homepage") },
          ].map(a => (
            <button key={a.label} onClick={a.run} className="group text-left border p-6 flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:border-[#b08848]" style={{ borderColor: BORDER_L, background: WHITE }}>
              <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ border: `1px solid ${GOLD}`, color: GOLD }}><a.Icon size={18} /></span>
              <span className="text-[17px]" style={{ color: FG_LIGHT, ...serif }}>{a.label}</span>
              <span className="text-[13px]" style={{ color: MUTED_L, ...sans }}>{a.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Properties ───────────────────────────────────────────────────────────────

const PER_PAGE = 6;
type SortKey = "list" | "price_desc" | "price_asc" | "reactions";

function PropertiesSection({ notify, onAdd, onEdit, onDuplicate, nav }: {
  notify: Notify; onAdd: () => void; onEdit: (p: Prop) => void; onDuplicate: (p: Prop) => void; nav: AdminNav;
}) {
  const version = useDataVersion();
  const [q, setQ] = useState("");
  const [listing, setListing] = useState("All");
  const [type, setType] = useState("All");
  const [sort, setSort] = useState<SortKey>("list");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Prop | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = ALL_PROPS.filter(p =>
      (listing === "All" || p.listing === listing) && (type === "All" || p.type === type) &&
      (!s || ([p.title, p.location, p.district].some(v => v.toLowerCase().includes(s)) || matchesRef(p.nbId, s))));
    if (sort === "price_desc") list.sort((a, b) => b.priceNum - a.priceNum);
    if (sort === "price_asc") list.sort((a, b) => a.priceNum - b.priceNum);
    if (sort === "reactions") list.sort((a, b) => (REACTIONS[b.id] ?? 0) - (REACTIONS[a.id] ?? 0));
    return list;
  }, [q, listing, type, sort, version]);

  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / PER_PAGE)));
  const nudge = (p: Prop, d: number) => setReactionCount(p.id, (REACTIONS[p.id] ?? 0) + d);
  const flip = (p: Prop, field: "featured" | "verified") => {
    saveProperty({ ...p, [field]: !p[field] });
    notify(`${p.title} ${!p[field] ? "is now" : "is no longer"} ${field}`);
  };
  const remove = (p: Prop) => {
    const at = ALL_PROPS.findIndex(x => x.id === p.id);
    if (deleteProperty(p.id)) notify(`“${p.title}” deleted`, { label: "Undo", run: () => restoreProperty(p, at) });
    else notify("The site needs at least one property");
  };

  const iconBtn = "w-[46px] flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030]";

  return (
    <div>
      <SectionHeading title="Properties" subtitle="Every listing on the site. Changes show immediately."
        actions={<Button onClick={onAdd}><Plus size={14} />Add a Property</Button>} />

      <div className="flex flex-col xl:flex-row gap-3 mb-6">
        <SearchBox value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by name, area or ref (#NBS004)" />
        <div className="grid grid-cols-3 gap-3 xl:w-[34rem]">
          <Select value={listing} onChange={v => { setListing(v); setPage(1); }} options={[{ value: "All", label: "Sale & Rent" }, "For Sale", "For Rent"]} />
          <Select value={type} onChange={v => { setType(v); setPage(1); }} options={[{ value: "All", label: "All types" }, ...PROPERTY_TYPES]} />
          <Select value={sort} onChange={v => setSort(v as SortKey)} options={[
            { value: "list", label: "Site order" }, { value: "price_desc", label: "Price: high–low" },
            { value: "price_asc", label: "Price: low–high" }, { value: "reactions", label: "Most reactions" },
          ]} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No properties match" text="Try a different search or filter." />
      ) : (
        <div className="border" style={{ borderColor: BORDER_L, background: WHITE }}>
          {paginate(rows, current, PER_PAGE).map(p => (
            <div key={p.id} className="flex flex-col md:flex-row md:flex-wrap xl:flex-nowrap md:items-center gap-5 p-5 border-b last:border-b-0" style={{ borderColor: BORDER_L }}>
              <button onClick={() => onEdit(p)} className="w-full md:w-40 shrink-0 overflow-hidden" style={{ aspectRatio: "4/3" }} aria-label={`Edit ${p.title}`}>
                <img src={p.hero} alt="" className="w-full h-full object-cover" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Chip tone="maroon">{p.badge}</Chip><Chip tone="muted">{p.listing}</Chip><Chip tone="muted">{p.type}</Chip>
                </div>
                <p className="text-[18px] leading-snug truncate" style={{ color: FG_LIGHT, ...serif }}>{p.title}</p>
                <p className="flex items-center gap-1.5 mt-1 text-[13px]" style={{ color: MUTED_L, ...sans }}>
                  <MapPin size={12} style={{ color: GOLD }} />{p.location}<span className="mx-1.5">·</span>{displayRef(p.nbId)}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <p className="mr-2 text-[16px] font-medium" style={{ color: MAROON, ...sans }}>{p.price}</p>
                  {/* One-click switches, no need to open the editor. */}
                  {([["featured", "Featured", Star], ["verified", "Verified", BadgeCheck]] as const).map(([field, label, Icon]) => (
                    <button key={field} type="button" aria-pressed={p[field]} onClick={() => flip(p, field)}
                      title={p[field] ? `Click to remove “${label}”` : `Click to mark as ${label.toLowerCase()}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 border text-[11px] tracking-[0.12em] uppercase transition-colors"
                      style={{ borderColor: p[field] ? "rgba(176,136,72,0.6)" : BORDER_L, background: p[field] ? "rgba(176,136,72,0.1)" : WHITE, color: p[field] ? FG_LIGHT : MUTED_L, ...sans }}>
                      <Icon size={12} style={{ color: p[field] ? GOLD : MUTED_L }} fill={p[field] && field === "featured" ? GOLD : "none"} />{label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Controls: on their own line under the details until there is room beside them. */}
              <div className="flex flex-wrap items-center gap-3 md:w-full xl:w-auto md:justify-end">
              <div className="flex items-center gap-1 shrink-0" title="Reactions shown on the site">
                <button type="button" aria-label="One fewer reaction" onClick={() => nudge(p, -1)} className="w-8 h-8 flex items-center justify-center border transition-colors hover:border-[#8a2030]" style={{ borderColor: BORDER_L, color: MUTED_L }}><Minus size={13} /></button>
                <span className="min-w-[4.5rem] h-8 px-2 flex items-center justify-center gap-1.5 border text-[13px] tabular-nums" style={{ borderColor: BORDER_L, color: MAROON, ...sans }}>
                  <Heart size={13} fill={MAROON} />{(REACTIONS[p.id] ?? 0).toLocaleString("en-US")}
                </span>
                <button type="button" aria-label="One more reaction" onClick={() => nudge(p, 1)} className="w-8 h-8 flex items-center justify-center border transition-colors hover:border-[#8a2030]" style={{ borderColor: BORDER_L, color: MUTED_L }}><Plus size={13} /></button>
              </div>
              <div className="flex flex-wrap gap-2 [&>button]:px-4 sm:[&>button]:px-6">
                <Button variant="quiet" onClick={() => nav.openProperty(p.id)} title="Open on the website"><Eye size={13} />View</Button>
                <Button variant="quiet" onClick={() => onEdit(p)}><Pencil size={13} />Edit</Button>
                <button type="button" aria-label={`Duplicate ${p.title}`} title="Start a new listing from this one" onClick={() => onDuplicate(p)}
                  className={iconBtn} style={{ borderColor: BORDER_L, color: MUTED_L }}><Copy size={15} /></button>
                <button type="button" aria-label={`Delete ${p.title}`} onClick={() => setToDelete(p)}
                  className={iconBtn} style={{ borderColor: BORDER_L, color: MUTED_L }}><Trash2 size={15} /></button>
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ListPagination page={current} total={rows.length} perPage={PER_PAGE} onPage={setPage} noun="properties" />

      <ConfirmDialog open={toDelete !== null} title="Delete this property?"
        message={toDelete ? `“${toDelete.title}” (${displayRef(toDelete.nbId)}) will be removed from the website. You can undo this for a few seconds afterwards.` : ""}
        onCancel={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) remove(toDelete); setToDelete(null); }} />
    </div>
  );
}
