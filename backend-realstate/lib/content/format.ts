// Display strings the frontend already renders, built the same way as its
// frontend-realstate/src/app/data/properties.ts (formatPrice, R-A-P-D helpers).

export type ListingLabel = "For Sale" | "For Rent";

/** 85000000 → "NPR 8.5 Cr"; 120000 for rent → "NPR 1.2 L/mo"; 85000 for rent → "NPR 85,000/mo". No price → "Negotiable". */
export function formatPrice(price: number | null, listing: ListingLabel): string {
  if (price === null) return "Negotiable";
  const CR = 10_000_000, LAKH = 100_000;
  const short = (n: number): string => String(Math.round(n * 100) / 100);
  const rent = listing === "For Rent";
  let body: string;
  if (price >= CR) body = `${short(price / CR)} Cr`;
  else if (price >= LAKH) body = `${short(price / LAKH)} ${rent ? "L" : "Lakh"}`;
  else body = price.toLocaleString("en-IN");
  return `NPR ${body}${rent ? "/mo" : ""}`;
}

/** "4,850 sq.ft", or "—" (the frontend's "not applicable"). */
export function formatArea(value: number | null, unit: string | null): string {
  return value !== null && value > 0 && unit ? `${value.toLocaleString("en-US")} ${unit}` : "—";
}

/** Ropani-Aana-Paisa-Dam. "4-4" → [4, 4, 0, 0]. */
function rapdParts(v: string): number[] {
  const p = v.trim().split("-").map(Number);
  while (p.length < 4) p.push(0);
  return p;
}
export const isRapd = (v: string): boolean => /^\d+(-\d+){1,3}$/.test(v.trim());
/** Always four parts: "4-4" → "4-4-0-0". */
export const normalizeRapd = (v: string): string => rapdParts(v).join("-");
/** What is wrong with an R-A-P-D value, or null. */
export function rapdProblem(v: string): string | null {
  if (!isRapd(v)) return "Write the land area as Ropani-Aana-Paisa-Dam, e.g. 4-4-0-1";
  const [, a, p, d] = rapdParts(v);
  if (a > 15) return "Aana goes up to 15 (16 aana make a ropani)";
  if (p > 3) return "Paisa goes up to 3 (4 paisa make an aana)";
  if (d > 3) return "Dam goes up to 3 (4 dam make a paisa)";
  return null;
}

/** Square feet per land unit (1 ropani = 16 aana = 5,476 sq.ft; 1 bigha = 20 kattha = 400 dhur). */
const SQFT_PER_UNIT: Record<string, number> = {
  Ropani: 5476, Aana: 342.25, Bigha: 72900, Kattha: 3645, Dhur: 182.25, "sq.ft": 1, "sq.m": 10.7639,
};

/** Land area in square feet, for sorting and filtering; null for a unit the admin invented. */
export function landSqft(value: number | null, unit: string | null, rapd: string | null): number | null {
  if (rapd) {
    const [r, a, p, d] = rapdParts(rapd);
    return Math.round(r * 5476 + a * 342.25 + p * 85.5625 + d * 21.390625);
  }
  if (value === null || !unit) return null;
  const per = SQFT_PER_UNIT[unit];
  return per ? Math.round(value * per) : null;
}

/** "12 Ropani", "4-4-0-1 R-A-P-D" or "—". */
export function formatLand(value: number | null, unit: string | null, rapd: string | null): string {
  return rapd ? `${rapd} R-A-P-D` : formatArea(value, unit);
}

/** "Black-topped 20ft", "Black-topped", or "". */
export function formatRoad(surface: string | null, widthFt: number | null): string {
  if (!surface) return widthFt ? `${widthFt}ft` : "";
  return widthFt ? `${surface} ${widthFt}ft` : surface;
}
