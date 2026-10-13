// Dashain 2083 (2026): the greeting pop-up and the flying kite. Everything for the festival lives in
// this folder; see README.md for how to take it down. Edit the wording here, not in the components.
//
// Dates (Nepal Panchanga Nirnayak Samiti): Ghatasthapana Sun 11 Oct, Vijaya Dashami (Tika)
// Wed 21 Oct, Kojagrat Purnima Sun 25 Oct 2026.

export const DASHAIN = {
  /** Shown from `starts` until `ends` (Nepal time). After `ends` nothing renders, even if this folder stays. */
  starts: "2026-10-11T00:00:00+05:45",
  ends: "2026-10-26T00:00:00+05:45",

  /** The pages (App's page names) that show the pop-up and the kite. */
  popupPages: ["home"],
  kitePages: ["home"],

  /** The pop-up opens once per visit (browser tab session). */
  seenKey: "nb-dashain-2083-seen",

  copy: {
    eyebrow: "विजया दशमी २०८३",
    title: "Happy Dashain",
    offers: "Bijayadashami Offers",
    message:
      "Wishing you and your family a joyful Dashain, blessed with tika, jamara and the warmth of home. " +
      "This festive season, enjoy our Bijayadashami offers on selected homes, land and apartments.",
    blessing: "विजया दशमीको हार्दिक मङ्गलमय शुभकामना",
    primary: { label: "Explore Offers", page: "hot" },
    secondary: { label: "Talk to an Advisor", page: "contact" },
    close: "Close the Dashain greeting",
  },
} as const;

/** The App pages the pop-up's buttons can open. */
export type DashainPage = typeof DASHAIN.copy.primary.page | typeof DASHAIN.copy.secondary.page;

/**
 * Whether the festival is on. `?dashain=on` / `?dashain=off` in the address overrides the dates,
 * for checking the design before or after the festival.
 */
export function dashainActive(now = Date.now()): boolean {
  try {
    const force = new URLSearchParams(window.location.search).get("dashain");
    if (force === "on") return true;
    if (force === "off") return false;
  } catch { /* no window: fall through to the dates */ }
  return now >= Date.parse(DASHAIN.starts) && now < Date.parse(DASHAIN.ends);
}

/** The festival palette: sindoor red, marigold, gold, jamara green, on the brand's maroon. */
export const PALETTE = {
  maroonDeep: "#4a0d19",
  maroon: "#7a1828",
  crimson: "#a3263a",
  sindoor: "#c8232c",
  marigold: "#ee8a1c",
  saffron: "#f6b31b",
  gold: "#d4a94f",
  goldSoft: "#e9cf93",
  jamara: "#9dc04a",
  jamaraDeep: "#5f8a2a",
  cream: "#f7efe1",
} as const;
