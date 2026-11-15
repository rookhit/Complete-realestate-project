import type { ReactNode } from "react";
import { GOLD, sans } from "./brand";

/** The small spaced-out capitals used above headings ("LIST YOUR PROPERTY"). */
export const Tag = ({ c, children }: { c?: string; children: ReactNode }) => (
  <span className="text-[10px] tracking-[0.34em] uppercase" style={{ color: c ?? GOLD, ...sans }}>{children}</span>
);

/** The short gold rule that sits before a Tag. */
export const GoldLine = () => <div style={{ width: "2rem", height: "0.5px", background: GOLD }} />;
