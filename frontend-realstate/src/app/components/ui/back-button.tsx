import { ArrowLeft } from "lucide-react";
import { FG_LIGHT, GOLD, MUTED_L, sans } from "./brand";

/**
 * "← Back to …". The caller decides where it goes: the previous page on the public
 * site, or a fixed page in the admin. `compact` hides the words on phones and keeps
 * only the round arrow, for tight bars such as the breadcrumb.
 */
export function BackButton({ label, onClick, compact = false }: { label: string; onClick: () => void; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="group inline-flex items-center gap-3 min-w-0 max-w-full text-[11px] tracking-[0.24em] uppercase transition-colors hover:text-[#8a2030]"
      style={{ color: MUTED_L, ...sans }}>
      <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-colors group-hover:border-[#8a2030]"
        style={{ border: "1px solid rgba(176,136,72,0.5)", color: FG_LIGHT }}>
        <ArrowLeft size={14} strokeWidth={1.8} className="transition-transform duration-300 group-hover:-translate-x-0.5" style={{ color: GOLD }} />
      </span>
      <span className={`truncate ${compact ? "hidden sm:inline" : ""}`}>{label}</span>
    </button>
  );
}
