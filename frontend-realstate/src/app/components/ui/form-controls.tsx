import { useId, type ReactNode } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { BORDER_L, FG_LIGHT, GOLD, MAROON, MUTED_L, WHITE, sans } from "./brand";

/**
 * Form controls for the admin, in the site's own style: hairline borders, uppercase
 * tracked labels, maroon focus. Built so a non-technical editor mostly clicks and picks
 * rather than types: dropdowns, steppers, toggles and segmented choices.
 */

const inputCls = "w-full border px-4 py-3 text-[15px] outline-none transition-colors focus:border-[#8a2030]";
const inputStyle = { borderColor: BORDER_L, color: FG_LIGHT, background: WHITE, ...sans };

/** Label + control + optional hint underneath. */
export function Field({ label, hint, children, className = "" }: {
  label: string; hint?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[10px] tracking-[0.28em] uppercase" style={{ color: MUTED_L, ...sans }}>{label}</span>
      {children}
      {hint && <span className="text-[12px] leading-snug" style={{ color: MUTED_L, ...sans }}>{hint}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = "text", maxLength }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; maxLength?: number;
}) {
  return (
    <input type={type} value={value} maxLength={maxLength} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} className={inputCls} style={inputStyle} />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea rows={rows} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
      className={`${inputCls} resize-y leading-relaxed`} style={inputStyle} />
  );
}

/** A dropdown. `options` can be plain strings or { value, label } pairs. */
export function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: (string | { value: string; label: string })[]; placeholder?: string;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`${inputCls} appearance-none cursor-pointer pr-10`} style={inputStyle}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(o => typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: MUTED_L }} />
    </div>
  );
}

/** A number with − and + buttons, clamped to [min, max]. Typing is allowed too. */
export function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
  const btn = "w-11 flex items-center justify-center transition-colors hover:bg-[#f7f3ed] disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex items-stretch border h-[50px]" style={{ borderColor: BORDER_L, background: WHITE }}>
      <button type="button" aria-label="Decrease" className={btn} style={{ color: FG_LIGHT }}
        disabled={value <= min} onClick={() => onChange(clamp(value - step))}><Minus size={15} /></button>
      <div className="flex-1 flex items-center justify-center gap-1.5 border-x" style={{ borderColor: BORDER_L }}>
        <input inputMode="numeric" value={String(value)} aria-label="Value"
          onChange={e => onChange(clamp(Number(e.target.value.replace(/\D/g, "")) || 0))}
          className="w-full min-w-0 bg-transparent text-center text-[16px] tabular-nums outline-none" style={{ color: FG_LIGHT, ...sans }} />
        {suffix && <span className="text-[12px] pr-3 shrink-0" style={{ color: MUTED_L, ...sans }}>{suffix}</span>}
      </div>
      <button type="button" aria-label="Increase" className={btn} style={{ color: FG_LIGHT }}
        disabled={value >= max} onClick={() => onChange(clamp(value + step))}><Plus size={15} /></button>
    </div>
  );
}

/** Two to four side-by-side choices, one selected (e.g. For Sale / For Rent). */
export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="grid border" style={{ borderColor: BORDER_L, gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))`, background: WHITE }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={on}
            className={`flex items-center justify-center gap-2 py-3 text-[12px] tracking-[0.16em] uppercase transition-colors ${i > 0 ? "border-l" : ""}`}
            style={{ borderColor: BORDER_L, background: on ? FG_LIGHT : "transparent", color: on ? WHITE : MUTED_L, ...sans }}>
            {o.icon}{o.label}
          </button>
        );
      })}
    </div>
  );
}

/** An on/off switch with a label and an optional one-line explanation. */
export function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  const id = useId();
  return (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-5 border px-5 py-4 text-left transition-colors"
      style={{ borderColor: checked ? "rgba(176,136,72,0.55)" : BORDER_L, background: checked ? "rgba(176,136,72,0.07)" : WHITE }}>
      <span className="min-w-0">
        <span id={id} className="block text-[14px]" style={{ color: FG_LIGHT, ...sans }}>{label}</span>
        {description && <span className="block mt-0.5 text-[12px] leading-snug" style={{ color: MUTED_L, ...sans }}>{description}</span>}
      </span>
      <span className="relative w-11 h-6 shrink-0 rounded-full transition-colors" style={{ background: checked ? GOLD : "rgba(26,22,17,0.16)" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-all" style={{ left: checked ? 22 : 2, background: WHITE }} />
      </span>
    </button>
  );
}

/** A small numbered card that groups related fields inside an editor. */
export function FormSection({ n, title, subtitle, children, id }: {
  n: number; title: string; subtitle?: string; children: ReactNode; id?: string;
}) {
  return (
    <section id={id} className="border scroll-mt-6" style={{ borderColor: BORDER_L, background: WHITE }}>
      <header className="flex items-start gap-4 px-6 md:px-8 pt-6 md:pt-7 pb-5 border-b" style={{ borderColor: BORDER_L }}>
        <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[12px] tabular-nums"
          style={{ border: `1px solid ${GOLD}`, color: GOLD, ...sans }}>{String(n).padStart(2, "0")}</span>
        <div className="min-w-0">
          <h3 className="text-[19px] leading-tight" style={{ color: FG_LIGHT, fontFamily: "'Gloock', Georgia, serif" }}>{title}</h3>
          {subtitle && <p className="mt-1 text-[13px] leading-snug" style={{ color: MUTED_L, ...sans }}>{subtitle}</p>}
        </div>
      </header>
      <div className="px-6 md:px-8 py-6 md:py-7">{children}</div>
    </section>
  );
}

/** Primary (maroon) and quiet (outlined) buttons used across the admin. */
export function Button({ children, onClick, variant = "primary", disabled, type = "button", title }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "quiet" | "danger";
  disabled?: boolean; type?: "button" | "submit"; title?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[11px] tracking-[0.24em] uppercase whitespace-nowrap transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const style = variant === "primary"
    ? { background: MAROON, color: WHITE, ...sans }
    : variant === "danger"
      ? { background: "transparent", color: MAROON, border: `1px solid ${MAROON}`, ...sans }
      : { background: WHITE, color: FG_LIGHT, border: `1px solid ${BORDER_L}`, ...sans };
  const hover = variant === "primary" ? "hover:brightness-110" : "hover:border-[#8a2030]";
  return <button type={type} title={title} onClick={onClick} disabled={disabled} className={`${base} ${hover}`} style={style}>{children}</button>;
}
