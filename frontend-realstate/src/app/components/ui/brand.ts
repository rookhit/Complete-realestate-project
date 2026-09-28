// Brand colours and fonts, shared by App.tsx and everything in components/ and admin/.

export const BG_LIGHT  = "#f7f3ed";
export const FG_DARK   = "#f0ebe0";
export const FG_LIGHT  = "#1a1611";
export const CREAM     = "#f7f3ed";
export const WHITE     = "#ffffff";
export const MAROON    = "#8a2030";
export const GOLD      = "#b08848";
export const GOLD_DIM  = "rgba(176,136,72,0.45)";
export const MUTED_D   = "#7a7060";
export const MUTED_L   = "#6b6154";
export const BORDER_L  = "rgba(26,22,17,0.1)";
export const BORDER_D  = "rgba(240,235,224,0.08)";

export const serif = { fontFamily: "'Gloock', Georgia, serif" } as const;
export const sans  = { fontFamily: "'Jost', system-ui, sans-serif" } as const;

/** Unsplash URL at a given crop size. Used by the mock data until real uploads exist. */
export const img = (id: string, w = 1200, h = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format`;
