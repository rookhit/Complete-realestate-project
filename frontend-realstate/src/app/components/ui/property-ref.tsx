import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { displayRef } from "@/app/data/properties";
import { BORDER_L, FG_DARK, FG_LIGHT, GOLD, MUTED_L, sans } from "./brand";

/**
 * The property reference as a small hairline tag: "#NBS345". Used on every card and
 * list row so a visitor can quote it on the phone. `dark` for dark section backgrounds,
 * `copy` adds a copy button (the property page).
 */
export function RefTag({ propId, dark = false, copy = false }: { propId: string; dark?: boolean; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  const text = displayRef(propId);
  const tag = (
    <span className="inline-flex items-center border px-2 py-[3px] text-[10.5px] font-medium tracking-[0.14em] tabular-nums whitespace-nowrap leading-none"
      style={{ borderColor: dark ? "rgba(240,235,224,0.18)" : BORDER_L, color: dark ? FG_DARK : FG_LIGHT, ...sans }}
      title="Property reference: quote it when you call or message us">
      <span style={{ color: GOLD }}>#</span>{propId}
    </span>
  );
  if (!copy) return tag;

  const doCopy = () => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }, () => {});
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      {tag}
      <button type="button" onClick={doCopy} aria-label={copied ? "Reference copied" : `Copy reference ${text}`}
        className="inline-flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase transition-colors hover:text-[#8a2030]"
        style={{ color: copied ? GOLD : MUTED_L, ...sans }}>
        {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
