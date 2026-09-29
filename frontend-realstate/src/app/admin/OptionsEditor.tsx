import { useState } from "react";
import { GripVertical, Plus, RotateCcw, X } from "lucide-react";
import { OPTION_LISTS, addOption, setOptions, type OptionList } from "@/app/data/options";
import { useDataVersion } from "@/app/data/store";
import { BORDER_L, FG_LIGHT, GOLD, MUTED_L, WHITE, sans, serif } from "@/app/components/ui/brand";
import { SectionHeading, type Notify } from "./parts";

/** "1 property", "3 properties", "2 people". */
const counted = (n: number, unit = "item") =>
  `${n} ${n === 1 ? unit : unit === "property" ? "properties" : unit === "person" ? "people" : `${unit}s`}`;

const GROUPS = ["Properties", "Team", "Testimonials", "Website Forms"] as const;

/**
 * Admin → Dropdown Options: every list of choices used in the admin and on the website's
 * forms. Type and press Enter to add, × to remove, drag to reorder. Changes apply at once.
 */
export function OptionsSection({ notify }: { notify: Notify }) {
  useDataVersion();
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("Properties");
  return (
    <div>
      <SectionHeading title="Dropdown Options" subtitle="Every list of choices in the editors and on the website’s forms. Add, remove or reorder options; the dropdowns update straight away." />
      <div className="flex flex-wrap gap-2 mb-8">
        {GROUPS.map(g => {
          const on = g === group;
          return (
            <button key={g} type="button" onClick={() => setGroup(g)} aria-pressed={on}
              className="px-4 py-2 border text-[12px] tracking-[0.08em] transition-colors hover:border-[#8a2030]"
              style={{ borderColor: on ? FG_LIGHT : BORDER_L, background: on ? FG_LIGHT : WHITE, color: on ? WHITE : FG_LIGHT, ...sans }}>
              {g} <span className="ml-1 opacity-60">{OPTION_LISTS.filter(l => l.group === g).length}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {OPTION_LISTS.filter(l => l.group === group).map(l => <ListCard key={l.key} list={l} notify={notify} />)}
      </div>
    </div>
  );
}

function ListCard({ list, notify }: { list: OptionList; notify: Notify }) {
  const [text, setText] = useState("");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const changed = JSON.stringify(list.items) !== JSON.stringify(list.defaults);

  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (addOption(list.key, v)) { setText(""); notify(`“${v}” added to ${list.label.toLowerCase()}`); }
    else notify(`“${v}” is already in the list`);
  };
  const remove = (item: string) => {
    if (list.min && list.items.length <= list.min) { notify(`Keep at least ${list.min} option${list.min === 1 ? "" : "s"} here`); return; }
    const before = [...list.items];
    setOptions(list.key, list.items.filter(x => x !== item));
    const used = list.usedBy?.(item) ?? 0;
    const short = item.length > 40 ? `${item.slice(0, 40)}…` : item;
    notify(used ? `“${short}” removed. ${counted(used, list.unit)} still use it and keep it until edited.` : `“${short}” removed`,
      { label: "Undo", run: () => setOptions(list.key, before) });
  };
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...list.items];
    const [x] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, x);
    setOptions(list.key, next);
  };
  const dragProps = (i: number) => ({
    draggable: true,
    onDragStart: () => setDragFrom(i),
    onDragOver: (e: React.DragEvent) => { if (dragFrom !== null) { e.preventDefault(); setDropAt(i); } },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); setDropAt(null); },
    onDragEnd: () => { setDragFrom(null); setDropAt(null); },
  });

  return (
    <div className="border p-6 flex flex-col gap-4" style={{ borderColor: BORDER_L, background: WHITE }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[18px] leading-tight" style={{ color: FG_LIGHT, ...serif }}>{list.label}</p>
          <p className="text-[12px] mt-1" style={{ color: MUTED_L, ...sans }}>{list.where}</p>
        </div>
        <span className="text-[11px] tracking-[0.14em] uppercase shrink-0 pt-1" style={{ color: MUTED_L, ...sans }}>{list.items.length} options</span>
        {changed && (
          <button type="button" onClick={() => { const before = [...list.items]; setOptions(list.key, [...list.defaults]); notify(`${list.label} reset`, { label: "Undo", run: () => setOptions(list.key, before) }); }}
            title="Back to the original options" className="shrink-0 inline-flex items-center gap-1.5 text-[11px] tracking-[0.14em] uppercase pt-1 hover:text-[#8a2030]" style={{ color: MUTED_L, ...sans }}>
            <RotateCcw size={12} />Reset
          </button>
        )}
      </div>

      {list.long ? (
        <div className="flex flex-col gap-2">
          {list.items.map((item, i) => (
            <div key={item} {...dragProps(i)} className="flex items-start gap-2 border px-3 py-2.5 cursor-grab active:cursor-grabbing"
              style={{ borderColor: dropAt === i ? GOLD : BORDER_L, background: dragFrom === i ? "rgba(176,136,72,0.08)" : WHITE }}>
              <GripVertical size={14} className="mt-0.5 shrink-0" style={{ color: MUTED_L }} />
              <p className="flex-1 text-[13px] leading-relaxed" style={{ color: FG_LIGHT, ...sans }}>{item}</p>
              <button type="button" onClick={() => remove(item)} aria-label="Remove" className="shrink-0 p-1 hover:text-[#8a2030]" style={{ color: MUTED_L }}><X size={14} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.items.map((item, i) => {
            const used = list.usedBy?.(item) ?? 0;
            return (
              <span key={item} {...dragProps(i)} title={used ? `Used by ${counted(used, list.unit)}` : "Drag to reorder"}
                className="group inline-flex items-center gap-1.5 pl-2 pr-1 py-1.5 border text-[13px] cursor-grab active:cursor-grabbing transition-colors"
                style={{ borderColor: dropAt === i ? GOLD : BORDER_L, background: dragFrom === i ? "rgba(176,136,72,0.1)" : "#faf7f2", color: FG_LIGHT, ...sans }}>
                <GripVertical size={12} style={{ color: "rgba(26,22,17,0.25)" }} />
                {item}
                {used > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-[10px] tabular-nums" style={{ background: "rgba(176,136,72,0.18)", color: "#7a5a24" }}>{used}</span>}
                <button type="button" onClick={() => remove(item)} aria-label={`Remove ${item}`} className="p-0.5 rounded-full transition-colors hover:bg-[rgba(138,32,48,0.1)] hover:text-[#8a2030]" style={{ color: MUTED_L }}><X size={13} /></button>
              </span>
            );
          })}
        </div>
      )}

      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
        {list.long
          ? <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Add a new quote…" className="flex-1 border px-3 py-2.5 text-[14px] outline-none resize-none focus:border-[#8a2030]" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }} />
          : <input value={text} onChange={e => setText(e.target.value)} placeholder={`Add to ${list.label.toLowerCase()}…`} maxLength={60} className="flex-1 border px-3 py-2.5 text-[14px] outline-none focus:border-[#8a2030]" style={{ borderColor: BORDER_L, color: FG_LIGHT, ...sans }} />}
        <button type="submit" className="inline-flex items-center gap-1.5 px-4 border text-[11px] tracking-[0.18em] uppercase transition-colors hover:border-[#8a2030]" style={{ borderColor: BORDER_L, background: WHITE, color: FG_LIGHT, ...sans }}>
          <Plus size={13} />Add
        </button>
      </form>
    </div>
  );
}
