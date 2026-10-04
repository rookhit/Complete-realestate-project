import { useEffect, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Calendar, Check, Clock, Lightbulb, Pencil, Plus, Sparkles, Star, Trash2, Upload, Youtube } from "lucide-react";
import {
  ARTICLE_AUTHOR, BLOGS, DEPARTMENTS, FEATURED_DISTRICTS, LANGUAGES, MAX_FEATURED_DISTRICTS, SPECIALITIES, STATS, TEAM, TEAM_ROLES, TESTIMONIALS, VIDEO_LIST,
  monthYear, moveById, nextId, readingTime, removeById, saveFeaturedDistricts, saveStats, upsert, youtubeIdFrom, youtubeThumb,
  type BlogPost, type CompanyVideoInput, type FeaturedDistrict, type Stat, type TeamMember, type Testimonial,
} from "@/app/data/content";
import { emitChange, useDataVersion } from "@/app/data/store";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { DistrictCombobox } from "@/app/components/ui/district-combobox";
import { ImageField } from "@/app/components/ui/photo-picker";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { Button, Field, Select, Stepper, TextArea, TextInput } from "@/app/components/ui/form-controls";
import { Chip, Drawer, EmptyState, SectionHeading, type Notify } from "./parts";
import { ArticlePreview, TeamPreview, TestimonialPreview, VideoPreview } from "./previews";
import { summaryFrom, teamBio } from "./suggestions";
import { TESTIMONIAL_IDEAS, addOption, optionList } from "@/app/data/options";
import { VideoUploadEditor } from "./VideoUpload";
import { createArticle, deleteArticleOnServer, reorderArticles, toBlog, updateArticle, type ArticleInput } from "@/api/articles";
import { createMember, deleteMemberOnServer, reorderTeam, toMember, updateMember, type MemberInput } from "@/api/team";
import { createTestimonial, deleteTestimonialOnServer, reorderTestimonials, toTestimonial, updateTestimonial, type TestimonialInput } from "@/api/testimonials";
import { uploadMedia } from "@/api/uploads";
import { ApiError } from "@/app/auth";


// ─── Shared bits ──────────────────────────────────────────────────────────────

const OTHER = "__other__";

/**
 * A dropdown of suggestions plus "Other…", which reveals a text box for anything else.
 * With `listKey`, a typed value can be saved to that option list (data/options.ts).
 */
function SelectOrCustom({ value, onChange, options, otherLabel = "Other…", listKey }: {
  value: string; onChange: (v: string) => void; options: string[]; otherLabel?: string; listKey?: string;
}) {
  const known = options.includes(value);
  const [custom, setCustom] = useState(!known && value !== "");
  return (
    <div className="flex flex-col gap-2">
      <Select value={custom ? OTHER : value} placeholder="Choose…"
        onChange={v => { if (v === OTHER) { setCustom(true); onChange(""); } else { setCustom(false); onChange(v); } }}
        options={[...options.map(o => ({ value: o, label: o })), { value: OTHER, label: otherLabel }]} />
      {custom && <TextInput value={value} onChange={onChange} placeholder="Type it here" maxLength={60} />}
      {custom && listKey && value.trim() && !options.some(o => o.toLowerCase() === value.trim().toLowerCase()) && (
        <button type="button" onClick={() => { addOption(listKey, value); onChange(value.trim()); setCustom(false); }}
          className="self-start inline-flex items-center gap-1.5 text-[11px] tracking-[0.14em] uppercase underline underline-offset-4 hover:text-[#8a2030]" style={{ color: GOLD, ...sans }}>
          <Plus size={12} />Save “{value.trim()}” to the {optionList(listKey).label.toLowerCase()} list
        </button>
      )}
    </div>
  );
}

/** Up / down / edit / delete buttons for a card. Edit is left out for cards edited in place. */
export function CardTools({ onUp, onDown, onEdit, onDelete, first, last }: {
  onUp?: () => void; onDown?: () => void; onEdit?: () => void; onDelete: () => void; first?: boolean; last?: boolean;
}) {
  const b = "w-9 h-9 flex items-center justify-center border transition-colors hover:border-[#8a2030] hover:text-[#8a2030] disabled:opacity-30 disabled:hover:border-[rgba(26,22,17,0.1)]";
  const st = { borderColor: BORDER_L, color: FG_LIGHT, background: WHITE };
  return (
    <div className="flex gap-1.5">
      {onUp && <button type="button" className={b} style={st} aria-label="Move up" disabled={first} onClick={onUp}><ArrowUp size={14} /></button>}
      {onDown && <button type="button" className={b} style={st} aria-label="Move down" disabled={last} onClick={onDown}><ArrowDown size={14} /></button>}
      {onEdit && <button type="button" className={b} style={st} aria-label="Edit" onClick={onEdit}><Pencil size={14} /></button>}
      <button type="button" className={b} style={st} aria-label="Delete" onClick={onDelete}><Trash2 size={14} /></button>
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(v => (
        <button key={v} type="button" aria-label={`${v} star${v > 1 ? "s" : ""}`} onClick={() => onChange(v)} onMouseEnter={() => setHover(v)} className="p-0.5 transition-transform hover:scale-110">
          <Star size={26} fill={v <= (hover || value) ? GOLD : "none"} style={{ color: v <= (hover || value) ? GOLD : "rgba(176,136,72,0.4)" }} />
        </button>
      ))}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "May 2025" ⇄ "2025-05" for the month picker. */
const toMonthInput = (s: string) => {
  const m = s.match(/^([A-Za-z]{3})\w*\s+(\d{4})$/);
  const i = m ? MONTHS.findIndex(x => x.toLowerCase() === m[1].toLowerCase()) : -1;
  return m && i >= 0 ? `${m[2]}-${String(i + 1).padStart(2, "0")}` : "";
};
const fromMonthInput = (v: string) => {
  const m = v.match(/^(\d{4})-(\d{2})$/);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : monthYear();
};

/** Holds the item being deleted and renders the confirmation. */
function useDeleteConfirm<T>(onConfirm: (item: T) => void, describe: (item: T) => { title: string; message: string }) {
  const [item, setItem] = useState<T | null>(null);
  const text = item ? describe(item) : { title: "", message: "" };
  const node = (
    <ConfirmDialog open={item !== null} title={text.title} message={text.message}
      onCancel={() => setItem(null)} onConfirm={() => { if (item !== null) onConfirm(item); setItem(null); }} />
  );
  return [node, setItem] as const;
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export function JournalSection({ notify, openId, onOpened }: { notify: Notify; openId?: number | null; onOpened?: () => void }) {
  useDataVersion();
  const [editing, setEditing] = useState<BlogPost | "new" | null>(null);
  // The overview checklist and Ctrl K can ask for one article to open straight away.
  useEffect(() => {
    if (openId == null) return;
    const b = BLOGS.find(x => x.id === openId);
    if (b) setEditing(b);
    onOpened?.();
  }, [openId, onOpened]);
  // Every change goes to the API first; the local list is then updated from what it stored.
  const failed = (err: unknown) => notify(err instanceof ApiError ? err.message : "Could not save. Please try again.");
  const [confirm, askDelete] = useDeleteConfirm<BlogPost>(
    b => { deleteArticleOnServer(b.id).then(() => { removeById(BLOGS, b.id); notify("Article deleted"); }, failed); },
    b => ({ title: "Delete this article?", message: `“${b.title}” will be removed from the Property Journal. This cannot be undone.` }),
  );

  /** Move one place up or down: the whole new order is sent, and the list comes back in it. */
  const move = (id: number, dir: -1 | 1) => {
    const ids = BLOGS.map(b => b.id), i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderArticles(ids).then(res => { BLOGS.splice(0, BLOGS.length, ...res.data.map(toBlog)); emitChange(); }, failed);
  };

  return (
    <div>
      <SectionHeading title="Property Journal" subtitle="Articles in the order the site shows them. The first one is the large featured story on the home page."
        actions={<Button onClick={() => setEditing("new")}><Plus size={14} />Write an Article</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {BLOGS.map((b, i) => (
          <article key={b.id} className="border flex flex-col" style={{ borderColor: BORDER_L, background: WHITE }}>
            <div className="relative overflow-hidden" style={{ aspectRatio: "16/10" }}>
              <img src={b.image} alt="" className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 flex gap-1.5"><Chip tone="maroon">{b.cat}</Chip>{i === 0 && <Chip tone="dark">Featured</Chip>}</div>
            </div>
            <div className="p-5 flex flex-col gap-2 flex-1">
              <p className="flex items-center gap-4 text-[11px] tracking-[0.18em] uppercase" style={{ color: MUTED_L, ...sans }}>
                <span className="flex items-center gap-1.5"><Calendar size={12} style={{ color: GOLD }} />{b.date}</span>
                <span className="flex items-center gap-1.5"><Clock size={12} style={{ color: GOLD }} />{b.read}</span>
              </p>
              <h3 className="text-[17px] leading-snug" style={{ color: FG_LIGHT, ...serif }}>{b.title}</h3>
              <p className="text-[13px]" style={{ color: MUTED_L, ...sans }}>By {b.author}</p>
              <div className="mt-auto pt-4 flex justify-end">
                <CardTools first={i === 0} last={i === BLOGS.length - 1}
                  onUp={() => move(b.id, -1)} onDown={() => move(b.id, 1)}
                  onEdit={() => setEditing(b)}
                  onDelete={() => (BLOGS.length <= 1 ? notify("The journal needs at least one article") : askDelete(b))} />
              </div>
            </div>
          </article>
        ))}
      </div>
      <ArticleEditor post={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} notify={notify} />
      {confirm}
    </div>
  );
}

function ArticleEditor({ post, open, onClose, notify }: { post: BlogPost | null; open: boolean; onClose: () => void; notify: Notify }) {
  const blank = (): BlogPost => ({ id: 0, cat: "", date: monthYear(), read: "1 min", title: "", excerpt: "", image: "", author: ARTICLE_AUTHOR, body: "" });
  const [d, setD] = useState<BlogPost>(post ?? blank());
  const [tried, setTried] = useState(false);
  const [base, setBase] = useState("");
  useEffect(() => { if (open) { const start = post ? { ...post, body: post.body ?? "" } : blank(); setD(start); setBase(JSON.stringify(start)); setTried(false); } }, [open, post]);
  const dirty = base !== "" && JSON.stringify(d) !== base;

  const set = <K extends keyof BlogPost>(k: K, v: BlogPost[K]) => setD(o => ({ ...o, [k]: v }));
  const read = readingTime(`${d.excerpt} ${d.body ?? ""}`);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const issues = [
    uploading && "Wait for the cover photo to finish uploading.",
    d.title.trim().length < 5 && "Give the article a title.",
    !d.image && "Add a cover photo.",
    !!d.image && !/^https?:\/\//i.test(d.image) && "The cover photo wasn't uploaded. Choose it again.",
    !d.cat.trim() && "Enter a category.",
    d.excerpt.trim().length < 20 && "Write a short summary (a sentence or two).",
  ].filter(Boolean) as string[];

  /** Saves to the API; the local list is updated from what the server stored. */
  const save = async () => {
    setTried(true);
    if (issues.length || saving) return;
    setSaving(true);
    setServerError("");
    const month = toMonthInput(d.date);
    const input: ArticleInput = {
      title: d.title.trim(), category: d.cat.trim(), excerpt: d.excerpt.trim(), body: (d.body ?? "").trim(), coverUrl: d.image,
    };
    // The month picker sets the publication month; unchanged on an edit = keep the saved date.
    if (month && (!post || month !== toMonthInput(post.date))) input.publishedAt = `${month}-01T00:00:00.000Z`;
    try {
      const res = post ? await updateArticle(post.id, input) : await createArticle(input);
      upsert(BLOGS, toBlog(res.data), true);
      notify(post ? "Article updated" : "Article published");
      onClose();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} backLabel="Back to Journal" dirty={dirty} onSave={() => void save()}
      preview={<ArticlePreview a={{ ...d, read }} />} width={820}
      title={post ? "Edit Article" : "Write an Article"} subtitle="Published articles appear in the Property Journal and on the home page."
      footer={<>
        {tried && issues[0] && <p className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{issues[0]}</p>}
        {!issues.length && serverError && <p role="alert" className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{serverError}</p>}
        <Button onClick={() => void save()} disabled={saving}><Check size={14} />{saving ? "Saving…" : post ? "Save Changes" : "Publish Article"}</Button>
      </>}>
      <div className="flex flex-col gap-6 border p-6 md:p-8" style={{ borderColor: BORDER_L, background: WHITE }}>
        <Field label="Cover Photo"><ImageField value={d.image} onChange={v => set("image", v)} label="Upload the cover"
          upload={(file, progress) => uploadMedia("image", file, progress, "articles")} onBusy={setUploading} /></Field>
        <Field label="Title"><TextInput value={d.title} onChange={v => set("title", v)} placeholder="e.g. How to Buy Property in Nepal" maxLength={120} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Category" hint="Shown above the title, e.g. Market Report."><TextInput value={d.cat} onChange={v => set("cat", v)} placeholder="e.g. Market Report" maxLength={30} /></Field>
          <Field label="Author" hint="Every article is published by the firm.">
            <div className="h-[50px] flex items-center px-4 border text-[15px]" style={{ borderColor: BORDER_L, background: "rgba(176,136,72,0.07)", color: FG_LIGHT, ...sans }}>{ARTICLE_AUTHOR}</div>
          </Field>
          <Field label="Month" hint={`Reading time: ${read} (automatic)`}>
            <TextInput type="month" value={toMonthInput(d.date)} onChange={v => set("date", fromMonthInput(v))} />
          </Field>
        </div>
        <Field label="Summary" hint="Shown on the article cards and at the top of the article.">
          <TextArea rows={3} value={d.excerpt} onChange={v => set("excerpt", v)} placeholder="One or two sentences that make people want to read on." />
          {(d.body ?? "").trim().length > 40 && (
            <button type="button" onClick={() => set("excerpt", summaryFrom(d.body ?? ""))}
              className="self-start inline-flex items-center gap-2 px-4 py-2.5 border text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-[#8a2030]"
              style={{ borderColor: "rgba(176,136,72,0.55)", background: "rgba(176,136,72,0.08)", color: FG_LIGHT, ...sans }}>
              <Sparkles size={14} style={{ color: GOLD }} />Use the start of the article
            </button>
          )}
        </Field>
        <Field label="Full Article" hint="Leave an empty line between paragraphs.">
          <TextArea rows={14} value={d.body ?? ""} onChange={v => set("body", v)} placeholder="Write the article here…" />
        </Field>
      </div>
    </Drawer>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export function TeamSection({ notify, openId, onOpened }: { notify: Notify; openId?: number | null; onOpened?: () => void }) {
  useDataVersion();
  const [editing, setEditing] = useState<TeamMember | "new" | null>(null);
  useEffect(() => {
    if (openId == null) return;
    const m = TEAM.find(x => x.id === openId);
    if (m) setEditing(m);
    onOpened?.();
  }, [openId, onOpened]);
  // Every change goes to the API first; the local list is then updated from what it stored.
  const failed = (err: unknown) => notify(err instanceof ApiError ? err.message : "Could not save. Please try again.");
  const [confirm, askDelete] = useDeleteConfirm<TeamMember>(
    m => { deleteMemberOnServer(m.id).then(() => { removeById(TEAM, m.id); notify(`${m.name} removed from the team`); }, failed); },
    m => ({ title: `Remove ${m.name}?`, message: "They will no longer appear in “Our Team” on the About page." }),
  );
  /** Move one place up or down: the whole new order is sent, and the list comes back in it. */
  const move = (id: number, dir: -1 | 1) => {
    const ids = TEAM.map(m => m.id), i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderTeam(ids).then(res => { TEAM.splice(0, TEAM.length, ...res.data.map(toMember)); emitChange(); }, failed);
  };
  return (
    <div>
      <SectionHeading title="Our Team" subtitle="In display order. The About page shows the first six; everyone appears on the Our Team page. Clicking a card on the site opens the profile."
        actions={<Button onClick={() => setEditing("new")}><Plus size={14} />Add a Team Member</Button>} />
      {TEAM.length === 0 ? (
        <EmptyState title="No team members yet" text="Add the people clients will meet." action={<Button onClick={() => setEditing("new")}><Plus size={14} />Add a Team Member</Button>} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {TEAM.map((m, i) => (
            <div key={m.id} className="border" style={{ borderColor: BORDER_L, background: WHITE }}>
              <div className="overflow-hidden" style={{ aspectRatio: "4/5" }}>
                {m.img
                  ? <img src={m.img} alt={m.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-[2.5rem]" style={{ background: "#e9e3d8", color: GOLD, ...serif }}>{m.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}</div>}
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div><p className="text-[16px]" style={{ color: FG_LIGHT, ...serif }}>{m.name}</p><p className="text-[12px] mt-0.5" style={{ color: MUTED_L, ...sans }}>{m.role}</p></div>
                <CardTools first={i === 0} last={i === TEAM.length - 1}
                  onUp={() => move(m.id, -1)} onDown={() => move(m.id, 1)}
                  onEdit={() => setEditing(m)} onDelete={() => askDelete(m)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <TeamEditor member={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} notify={notify} />
      {confirm}
    </div>
  );
}

/** Tap-to-toggle chips for picking several values from a list (specialities, languages). */
/** Tick any number of options. With `listKey`, "+ New" adds an option to that list and ticks it. */
function ChipPicker({ options, value, onChange, listKey }: { options: string[]; value: string[]; onChange: (v: string[]) => void; listKey?: string }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const commit = () => {
    const v = text.trim();
    if (v && listKey) { addOption(listKey, v); if (!value.includes(v)) onChange([...value, v]); }
    setText(""); setAdding(false);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter(x => x !== o) : [...value, o])}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border text-[13px] transition-colors"
            style={{ borderColor: on ? GOLD : BORDER_L, background: on ? "rgba(176,136,72,0.1)" : WHITE, color: on ? FG_LIGHT : MUTED_L, ...sans }}>
            {on && <Check size={12} style={{ color: GOLD }} />}{o}
          </button>
        );
      })}
      {listKey && (adding ? (
        <input autoFocus value={text} onChange={e => setText(e.target.value)} maxLength={40} placeholder="New option, then Enter"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { e.stopPropagation(); setAdding(false); } }}
          onBlur={commit} className="px-3 py-2 border text-[13px] outline-none w-52 focus:border-[#8a2030]" style={{ borderColor: GOLD, color: FG_LIGHT, ...sans }} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-dashed text-[13px] transition-colors hover:border-[#8a2030] hover:text-[#8a2030]"
          style={{ borderColor: "rgba(176,136,72,0.6)", color: MUTED_L, ...sans }}><Plus size={12} />New</button>
      ))}
    </div>
  );
}

function TeamEditor({ member, open, onClose, notify }: { member: TeamMember | null; open: boolean; onClose: () => void; notify: Notify }) {
  const blank = (): TeamMember => ({ id: 0, name: "", role: TEAM_ROLES[3], department: DEPARTMENTS[1], specialities: [], languages: ["Nepali", "English"] });
  const [d, setD] = useState<TeamMember>(member ?? blank());
  const [tried, setTried] = useState(false);
  const [base, setBase] = useState("");
  const [bioStyle, setBioStyle] = useState(0);
  useEffect(() => { if (open) { const start = member ?? blank(); setD(start); setBase(JSON.stringify(start)); setTried(false); setBioStyle(0); } }, [open, member]);
  const dirty = base !== "" && JSON.stringify(d) !== base;
  const set = <K extends keyof TeamMember>(k: K, v: TeamMember[K]) => setD(o => ({ ...o, [k]: v }));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const issues = [
    uploading && "Wait for the portrait to finish uploading.",
    d.name.trim().length < 2 && "Enter their name.",
    !d.role.trim() && "Choose their role.",
    !!d.img && !/^https?:\/\//i.test(d.img) && "The portrait wasn't uploaded. Choose it again or remove it.",
    d.email && !/^\S+@\S+\.\S+$/.test(d.email.trim()) && "Check the email address.",
  ].filter(Boolean) as string[];
  /** Saves to the API (the portrait is optional); the local list is updated from what the server stored. */
  const save = async () => {
    setTried(true);
    if (issues.length || saving) return;
    setSaving(true);
    setServerError("");
    // Empty optional fields are sent as null / [] ("not given").
    const input: MemberInput = {
      name: d.name.trim(), role: d.role.trim(), photoUrl: d.img || null,
      department: d.department || null, bio: d.bio?.trim() || null, experienceYears: d.experienceYears || null,
      specialities: d.specialities ?? [], languages: d.languages ?? [],
      phone: d.phone?.trim() || null, whatsapp: d.whatsapp?.replace(/\D/g, "") || null, email: d.email?.trim() || null,
    };
    try {
      const res = member ? await updateMember(member.id, input) : await createMember(input);
      const saved = toMember(res.data);
      upsert(TEAM, saved);
      notify(member ? "Team member updated" : `${saved.name} added to the team`);
      onClose();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const card = "flex flex-col gap-5 border p-6 md:p-8";
  const cardStyle = { borderColor: BORDER_L, background: WHITE };
  const heading = (t: string, s: string) => (
    <div><p className="text-[18px]" style={{ color: FG_LIGHT, ...serif }}>{t}</p><p className="text-[13px] mt-0.5" style={{ color: MUTED_L, ...sans }}>{s}</p></div>
  );
  return (
    <Drawer open={open} onClose={onClose} backLabel="Back to Team" dirty={dirty} onSave={() => void save()}
      preview={<TeamPreview m={d} />} width={760}
      title={member ? `Edit ${member.name}` : "Add a Team Member"} subtitle="Shown on the About page and the Our Team page. Clicking their card opens this profile."
      footer={<>
        {tried && issues[0] && <p className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{issues[0]}</p>}
        {!issues.length && serverError && <p role="alert" className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{serverError}</p>}
        <Button onClick={() => void save()} disabled={saving}><Check size={14} />{saving ? "Saving…" : "Save"}</Button>
      </>}>
      <div className="flex flex-col gap-6">
        <div className={`${card} sm:grid sm:grid-cols-[13rem_1fr] sm:items-start`} style={cardStyle}>
          <Field label="Portrait" hint="Optional. Without one, the site shows their initials.">
            <ImageField value={d.img ?? ""} onChange={v => set("img", v)} aspect="4/5" label="Upload portrait"
              upload={(file, progress) => uploadMedia("image", file, progress, "team")} onBusy={setUploading} />
            {d.img && !uploading && (
              <button type="button" onClick={() => set("img", undefined)} className="self-start inline-flex items-center gap-1.5 text-[12px] underline underline-offset-4 transition-colors hover:text-[#8a2030]"
                style={{ color: MUTED_L, ...sans }}><Trash2 size={12} />Remove photo</button>
            )}
          </Field>
          <div className="flex flex-col gap-5">
            {heading("The Card", "What everyone sees first.")}
            <Field label="Full Name"><TextInput value={d.name} onChange={v => set("name", v)} placeholder="e.g. Priya Shrestha" maxLength={60} /></Field>
            <Field label="Role"><SelectOrCustom value={d.role} onChange={v => set("role", v)} options={[...new Set([...TEAM_ROLES, ...TEAM.map(t => t.role)])]} listKey="teamRoles" /></Field>
          </div>
        </div>

        <div className={card} style={cardStyle}>
          {heading("The Profile", "Shown in the pop-up when someone clicks their card. All optional.")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Department" hint="Used for the filters on the Our Team page."><Select value={d.department ?? ""} onChange={v => set("department", v)} placeholder="Choose…" options={DEPARTMENTS} /></Field>
            <Field label="Years of Experience"><Stepper value={d.experienceYears ?? 0} onChange={v => set("experienceYears", v)} max={60} suffix="years" /></Field>
          </div>
          <Field label="Specialities"><ChipPicker options={[...new Set([...SPECIALITIES, ...(d.specialities ?? [])])]} value={d.specialities ?? []} onChange={v => set("specialities", v)} listKey="specialities" /></Field>
          <Field label="Languages"><ChipPicker options={[...new Set([...LANGUAGES, ...(d.languages ?? [])])]} value={d.languages ?? []} onChange={v => set("languages", v)} listKey="languages" /></Field>
          <Field label="Short Bio" hint="Two or three sentences. “Write it for me” uses the role, experience, specialities and languages above.">
            <TextArea rows={4} value={d.bio ?? ""} onChange={v => set("bio", v)} placeholder="What clients should know about them" />
            <button type="button" onClick={() => { set("bio", teamBio(d, bioStyle)); setBioStyle(n => n + 1); }}
              className="self-start inline-flex items-center gap-2 px-4 py-2.5 border text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-[#8a2030]"
              style={{ borderColor: "rgba(176,136,72,0.55)", background: "rgba(176,136,72,0.08)", color: FG_LIGHT, ...sans }}>
              <Sparkles size={14} style={{ color: GOLD }} />{bioStyle === 0 ? "Write it for me" : "Try another style"}
            </button>
          </Field>
        </div>

        <div className={card} style={cardStyle}>
          {heading("Contact", "Buttons in the profile. Leave any blank to hide it.")}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="Phone"><TextInput type="tel" value={d.phone ?? ""} onChange={v => set("phone", v)} placeholder="+977 98…" /></Field>
            <Field label="WhatsApp" hint="With country code."><TextInput type="tel" value={d.whatsapp ?? ""} onChange={v => set("whatsapp", v)} placeholder="977 98…" /></Field>
            <Field label="Email"><TextInput type="email" value={d.email ?? ""} onChange={v => set("email", v)} placeholder="name@nepalbhoomi.com" /></Field>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

export function TestimonialsSection({ notify }: { notify: Notify }) {
  useDataVersion();
  const [editing, setEditing] = useState<Testimonial | "new" | null>(null);
  // Every change goes to the API first; the local list is then updated from what it stored.
  const failed = (err: unknown) => notify(err instanceof ApiError ? err.message : "Could not save. Please try again.");
  const [confirm, askDelete] = useDeleteConfirm<Testimonial>(
    t => { deleteTestimonialOnServer(t.id).then(() => { removeById(TESTIMONIALS, t.id); notify("Testimonial deleted"); }, failed); },
    t => ({ title: "Delete this testimonial?", message: `${t.name}’s words will be removed from “What Our Clients Say”.` }),
  );
  /** Move one place up or down: the whole new order is sent, and the list comes back in it. */
  const move = (id: number, dir: -1 | 1) => {
    const ids = TESTIMONIALS.map(t => t.id), i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderTestimonials(ids).then(res => { TESTIMONIALS.splice(0, TESTIMONIALS.length, ...res.data.map(toTestimonial)); emitChange(); }, failed);
  };
  return (
    <div>
      <SectionHeading title="Client Testimonials" subtitle="Shown on the home page under “What Our Clients Say”."
        actions={<Button onClick={() => setEditing("new")}><Plus size={14} />Add a Testimonial</Button>} />
      {TESTIMONIALS.length === 0 ? (
        <EmptyState title="No testimonials" text="The section is hidden on the home page until you add one." action={<Button onClick={() => setEditing("new")}><Plus size={14} />Add a Testimonial</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.id} className="border p-6 flex flex-col gap-4" style={{ borderColor: BORDER_L, background: WHITE }}>
              <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, j) => <Star key={j} size={14} fill={j < t.rating ? GOLD : "none"} style={{ color: GOLD }} />)}</div>
              <p className="text-[14px] leading-relaxed line-clamp-4" style={{ color: MUTED_L, ...sans }}>“{t.text}”</p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t" style={{ borderColor: BORDER_L }}>
                <div className="flex items-center gap-3 min-w-0">
                  {t.img
                    ? <img src={t.img} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    : <span aria-hidden className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[14px]" style={{ background: "#e9e3d8", color: GOLD, ...serif }}>{t.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}</span>}
                  <div className="min-w-0"><p className="text-[14px] truncate" style={{ color: FG_LIGHT, ...sans }}>{t.name}</p><p className="text-[12px] truncate" style={{ color: MUTED_L, ...sans }}>{t.role}</p></div>
                </div>
                <CardTools first={i === 0} last={i === TESTIMONIALS.length - 1}
                  onUp={() => move(t.id, -1)} onDown={() => move(t.id, 1)}
                  onEdit={() => setEditing(t)} onDelete={() => askDelete(t)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <TestimonialEditor item={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} notify={notify} />
      {confirm}
    </div>
  );
}

function TestimonialEditor({ item, open, onClose, notify }: { item: Testimonial | null; open: boolean; onClose: () => void; notify: Notify }) {
  const blank = (): Testimonial => ({ id: 0, name: "", role: "", rating: 5, text: "" });
  const [d, setD] = useState<Testimonial>(item ?? blank());
  const [tried, setTried] = useState(false);
  const [base, setBase] = useState("");
  useEffect(() => { if (open) { const start = item ?? blank(); setD(start); setBase(JSON.stringify(start)); setTried(false); } }, [open, item]);
  const dirty = base !== "" && JSON.stringify(d) !== base;
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const issues = [
    uploading && "Wait for the photo to finish uploading.",
    d.name.trim().length < 2 && "Enter the client’s name.",
    d.text.trim().length < 20 && "Write what they said (a sentence or two).",
    !!d.img && !/^https?:\/\//i.test(d.img) && "The photo wasn't uploaded. Choose it again or remove it.",
  ].filter(Boolean) as string[];
  /** Saves to the API (the photo is optional); the local list is updated from what the server stored. */
  const save = async () => {
    setTried(true);
    if (issues.length || saving) return;
    setSaving(true);
    setServerError("");
    const input: TestimonialInput = { name: d.name.trim(), role: d.role.trim(), rating: d.rating, text: d.text.trim(), photoUrl: d.img || null };
    try {
      const res = item ? await updateTestimonial(item.id, input) : await createTestimonial(input);
      upsert(TESTIMONIALS, toTestimonial(res.data));
      notify(item ? "Testimonial updated" : "Testimonial added");
      onClose();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Drawer open={open} onClose={onClose} backLabel="Back to Testimonials" dirty={dirty} onSave={() => void save()}
      preview={<TestimonialPreview t={d} />} width={680}
      title={item ? "Edit Testimonial" : "Add a Testimonial"} subtitle="A few words from a happy client."
      footer={<>
        {tried && issues[0] && <p className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{issues[0]}</p>}
        {!issues.length && serverError && <p role="alert" className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{serverError}</p>}
        <Button onClick={() => void save()} disabled={saving}><Check size={14} />{saving ? "Saving…" : "Save"}</Button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-6 border p-6 md:p-8" style={{ borderColor: BORDER_L, background: WHITE }}>
        <Field label="Photo" hint="Optional. Without one, their initials are shown.">
          <ImageField value={d.img ?? ""} onChange={v => setD(o => ({ ...o, img: v }))} aspect="1/1" label="Upload photo"
            upload={(file, progress) => uploadMedia("image", file, progress, "testimonials")} onBusy={setUploading} />
          {d.img && !uploading && (
            <button type="button" onClick={() => setD(o => ({ ...o, img: undefined }))} className="self-start inline-flex items-center gap-1.5 text-[12px] underline underline-offset-4 transition-colors hover:text-[#8a2030]"
              style={{ color: MUTED_L, ...sans }}><Trash2 size={12} />Remove photo</button>
          )}
        </Field>
        <div className="flex flex-col gap-5">
          <Field label="Client Name"><TextInput value={d.name} onChange={v => setD(o => ({ ...o, name: v }))} placeholder="e.g. Bijay Shrestha" maxLength={60} /></Field>
          <Field label="Who They Are" hint="e.g. “Property Buyer, Kathmandu”."><TextInput value={d.role} onChange={v => setD(o => ({ ...o, role: v }))} maxLength={60} /></Field>
          <Field label="Rating"><StarPicker value={d.rating} onChange={v => setD(o => ({ ...o, rating: v }))} /></Field>
        </div>
        <Field label="What They Said" className="sm:col-span-2" hint="Use the client’s own words where you can. The suggestions below are a starting point to edit.">
          <TextArea rows={5} value={d.text} onChange={v => setD(o => ({ ...o, text: v }))} />
          <div className="flex flex-col gap-2 mt-2">
            <span className="flex items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase" style={{ color: GOLD, ...sans }}><Lightbulb size={13} />Start from a suggestion</span>
            {TESTIMONIAL_IDEAS.map(q => (
              <button key={q} type="button" onClick={() => setD(o => ({ ...o, text: q }))}
                className="text-left px-4 py-3 border text-[13px] leading-snug transition-colors hover:border-[#8a2030]"
                style={{ borderColor: d.text === q ? GOLD : BORDER_L, background: d.text === q ? "rgba(176,136,72,0.07)" : WHITE, color: MUTED_L, ...sans }}>“{q}”</button>
            ))}
          </div>
        </Field>
      </div>
    </Drawer>
  );
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export function VideosSection({ notify }: { notify: Notify }) {
  useDataVersion();
  // "youtube" / "upload" add a new video; an existing one opens the editor that fits it.
  const [editing, setEditing] = useState<CompanyVideoInput | "youtube" | "upload" | null>(null);
  const uploaded = (v: CompanyVideoInput | "youtube" | "upload" | null) => v === "upload" || (typeof v === "object" && !!v?.sources?.length);
  const adders = <>
    <Button variant="quiet" onClick={() => setEditing("upload")}><Upload size={14} />Upload a Video</Button>
    <Button onClick={() => setEditing("youtube")}><Youtube size={14} />Add from YouTube</Button>
  </>;
  const [confirm, askDelete] = useDeleteConfirm<CompanyVideoInput>(
    v => { removeById(VIDEO_LIST, v.id); notify("Video removed"); },
    v => ({ title: "Remove this video?", message: `“${v.title}” will no longer appear in “Explore in Video”.` }),
  );
  return (
    <div>
      <SectionHeading title="Company Videos" subtitle="The “Explore in Video” carousel on the home page. The first video is shown in the centre."
        actions={adders} />
      {VIDEO_LIST.length === 0 ? (
        <EmptyState title="No videos" text="The video section is hidden on the home page until you add one." action={<div className="flex flex-wrap justify-center gap-3">{adders}</div>} />
      ) : (
        <div className="flex flex-col border" style={{ borderColor: BORDER_L, background: WHITE }}>
          {VIDEO_LIST.map((v, i) => {
            const id = youtubeIdFrom(v.youtubeUrl ?? v.youtubeId);
            const thumb = v.poster ?? (id ? youtubeThumb(id, "hqdefault") : "");
            return (
              <div key={v.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border-b last:border-b-0" style={{ borderColor: BORDER_L }}>
                <div className="w-full sm:w-44 shrink-0 overflow-hidden" style={{ aspectRatio: "16/9", background: "#1a1611" }}>{thumb && <img src={thumb} alt="" className="w-full h-full object-cover" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1.5 mb-1.5">{i === 0 && <Chip tone="dark">Centre</Chip>}<Chip tone="muted">{v.duration}</Chip>{id ? <Chip>YouTube</Chip> : v.sources?.length ? <Chip>Uploaded</Chip> : null}</div>
                  <p className="text-[16px] leading-snug" style={{ color: FG_LIGHT, ...serif }}>{v.title}</p>
                </div>
                <CardTools first={i === 0} last={i === VIDEO_LIST.length - 1}
                  onUp={() => moveById(VIDEO_LIST, v.id, -1)} onDown={() => moveById(VIDEO_LIST, v.id, 1)}
                  onEdit={() => setEditing(v)} onDelete={() => askDelete(v)} />
              </div>
            );
          })}
        </div>
      )}
      <VideoEditor video={typeof editing === "object" && !uploaded(editing) ? editing : null} open={editing !== null && !uploaded(editing)} onClose={() => setEditing(null)} notify={notify} />
      <VideoUploadEditor video={typeof editing === "object" && uploaded(editing) ? editing : null} open={uploaded(editing)} onClose={() => setEditing(null)} notify={notify} />
      {confirm}
    </div>
  );
}

function VideoEditor({ video, open, onClose, notify }: { video: CompanyVideoInput | null; open: boolean; onClose: () => void; notify: Notify }) {
  const blank = (): CompanyVideoInput => ({ id: nextId(VIDEO_LIST), title: "", duration: "", youtubeUrl: "" });
  const [d, setD] = useState<CompanyVideoInput>(video ?? blank());
  const [tried, setTried] = useState(false);
  const [base, setBase] = useState("");
  useEffect(() => { if (open) { const start = video ?? blank(); setD(start); setBase(JSON.stringify(start)); setTried(false); } }, [open, video]);
  const dirty = base !== "" && JSON.stringify(d) !== base;
  const ytId = youtubeIdFrom(d.youtubeUrl);
  const hasFile = !!d.sources?.length;
  const issues = [
    !hasFile && !ytId && "Paste a YouTube link (youtu.be/… or youtube.com/watch?v=…).",
    d.title.trim().length < 3 && "Give the video a title.",
    !/^\d{1,2}:\d{2}$/.test(d.duration.trim()) && "Enter the length as minutes:seconds, e.g. 1:19.",
  ].filter(Boolean) as string[];
  const save = () => {
    setTried(true);
    if (issues.length) return;
    upsert(VIDEO_LIST, { ...d, title: d.title.trim(), duration: d.duration.trim() });
    notify(video ? "Video updated" : "Video added");
    onClose();
  };
  return (
    <Drawer open={open} onClose={onClose} backLabel="Back to Videos" dirty={dirty} onSave={save}
      preview={<VideoPreview title={d.title} duration={d.duration} poster={ytId ? youtubeThumb(ytId, "hqdefault") : d.poster ?? ""} isYouTube={!!ytId} />} width={680}
      title={video ? "Edit YouTube Video" : "Add from YouTube"} subtitle="Paste the video's YouTube link. The cover and player come from YouTube."
      footer={<>
        {tried && issues[0] && <p className="sm:mr-auto text-[13px]" style={{ color: MAROON, ...sans }}>{issues[0]}</p>}
        <Button onClick={save}><Check size={14} />Save</Button>
      </>}>
      <div className="flex flex-col gap-6 border p-6 md:p-8" style={{ borderColor: BORDER_L, background: WHITE }}>
        {!hasFile && (
          <Field label="YouTube Link">
            <TextInput value={d.youtubeUrl ?? ""} onChange={v => setD(o => ({ ...o, youtubeUrl: v.trim() }))} placeholder="https://youtu.be/…" />
          </Field>
        )}
        <div className="overflow-hidden flex items-center justify-center" style={{ aspectRatio: "16/9", background: "#1a1611" }}>
          {ytId ? <img src={youtubeThumb(ytId, "hqdefault")} alt="Video preview" className="w-full h-full object-cover" />
            : <span className="flex flex-col items-center gap-2 text-[13px]" style={{ color: "rgba(240,235,224,0.6)", ...sans }}>
                {d.youtubeUrl ? <><AlertCircle size={22} style={{ color: GOLD }} />That doesn’t look like a YouTube link</> : <><Youtube size={26} style={{ color: GOLD }} />The preview appears here</>}
              </span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-5">
          <Field label="Title"><TextInput value={d.title} onChange={v => setD(o => ({ ...o, title: v }))} placeholder="e.g. Sitapaila Elite Colony" maxLength={90} /></Field>
          <Field label="Length" hint="e.g. 1:19"><TextInput value={d.duration} onChange={v => setD(o => ({ ...o, duration: v.replace(/[^\d:]/g, "") }))} placeholder="0:00" maxLength={5} /></Field>
        </div>
      </div>
    </Drawer>
  );
}

// ─── Home page: statistics and featured districts ─────────────────────────────

export function HomePageSection({ notify }: { notify: Notify }) {
  useDataVersion();
  const [stats, setStats] = useState<Stat[]>(() => STATS.map(s => ({ ...s })));
  const [districts, setDistricts] = useState<FeaturedDistrict[]>(() => FEATURED_DISTRICTS.map(d => ({ ...d })));

  const [saving, setSaving] = useState<"stats" | "districts" | null>(null);
  const [uploading, setUploading] = useState(0);
  const failed = (err: unknown) => notify(err instanceof ApiError ? err.message : "Could not save. Please try again.");
  const saveStatList = () => {
    if (stats.some(s => !s.value.trim() || !s.label.trim())) { notify("Fill in every figure and label first"); return; }
    setSaving("stats");
    saveStats(stats.map(s => ({ ...s, value: s.value.trim(), label: s.label.trim() })))
      .then(() => { setStats(STATS.map(s => ({ ...s }))); notify("Statistics updated"); }, failed)
      .finally(() => setSaving(null));
  };
  const saveDistricts = () => {
    if (uploading) { notify("Wait for the photo to finish uploading"); return; }
    if (districts.length === 0) { notify("Keep at least one district"); return; }
    if (districts.some(d => !d.name || !d.img)) { notify("Every district needs a name and a photo"); return; }
    if (districts.some(d => !/^https?:\/\//i.test(d.img))) { notify("A district photo wasn't uploaded. Choose it again."); return; }
    setSaving("districts");
    saveFeaturedDistricts(districts)
      .then(() => { setDistricts(FEATURED_DISTRICTS.map(d => ({ ...d }))); notify("Featured districts updated"); }, failed)
      .finally(() => setSaving(null));
  };
  const setDistrict = (id: number, patch: Partial<FeaturedDistrict>) => setDistricts(list => list.map(d => (d.id === id ? { ...d, ...patch } : d)));
  const moveDistrict = (i: number, dir: -1 | 1) => setDistricts(list => {
    const j = i + dir; if (j < 0 || j >= list.length) return list;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });

  return (
    <div className="flex flex-col gap-14">
      <div>
        <SectionHeading title="Statistics" subtitle="The four figures in the dark band on the home page."
          actions={<Button onClick={saveStatList} disabled={saving === "stats"}><Check size={14} />{saving === "stats" ? "Saving…" : "Save Statistics"}</Button>} />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.id} className="border p-5 flex flex-col gap-4" style={{ borderColor: BORDER_L, background: WHITE }}>
              <Field label="Figure"><TextInput value={s.value} onChange={v => setStats(l => l.map(x => (x.id === s.id ? { ...x, value: v } : x)))} placeholder="180+" maxLength={12} /></Field>
              <Field label="Label"><TextInput value={s.label} onChange={v => setStats(l => l.map(x => (x.id === s.id ? { ...x, label: v } : x)))} placeholder="Properties Sold" maxLength={30} /></Field>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeading title="Featured Districts" subtitle={`The large photo tiles under “Prestige Properties Across Nepal”. Between 1 and ${MAX_FEATURED_DISTRICTS} fit the design.`}
          actions={<>
            <Button variant="quiet" disabled={districts.length >= MAX_FEATURED_DISTRICTS}
              onClick={() => setDistricts(l => [...l, { id: Math.max(0, ...l.map(x => x.id), ...FEATURED_DISTRICTS.map(x => x.id)) + 1, name: "", img: "" }])}>
              <Plus size={14} />Add District
            </Button>
            <Button onClick={saveDistricts} disabled={saving === "districts"}><Check size={14} />{saving === "districts" ? "Saving…" : "Save Districts"}</Button>
          </>} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {districts.map((d, i) => (
            <div key={d.id} className="border p-5 flex flex-col gap-4" style={{ borderColor: BORDER_L, background: WHITE }}>
              <ImageField value={d.img} onChange={v => setDistrict(d.id, { img: v })} aspect="4/3" label="Upload a photo"
                upload={(file, progress) => uploadMedia("image", file, progress, "site")} onBusy={b => setUploading(n => n + (b ? 1 : -1))} />
              <Field label="District"><DistrictCombobox value={d.name} onChange={v => setDistrict(d.id, { name: v })} /></Field>
              <div className="flex justify-end">
                <CardTools first={i === 0} last={i === districts.length - 1}
                  onUp={() => moveDistrict(i, -1)} onDown={() => moveDistrict(i, 1)}
                  onDelete={() => setDistricts(l => l.filter(x => x.id !== d.id))} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
