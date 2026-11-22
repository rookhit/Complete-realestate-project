import { fetchDataVersion, type DataVersion } from "@/api/site";

// The latest data version the site has seen (GET /site/version). The property and article lists are
// fetched with it (?v=), so a change made in the admin shows on the next page load, and in an open tab
// at its next check (PropertySync: every 30 s while on screen, and on coming back to the tab).

let current: DataVersion = { properties: "", articles: "" };

/** The version to ask the lists for ("" before the first check: the lists then use the short cache). */
export const dataVersion = (): DataVersion => current;

/**
 * Ask for the current version. Returns which lists changed since the last check, or null if the server
 * couldn't be reached (the lists then load without a version, as before).
 */
export async function checkDataVersion(): Promise<{ properties: boolean; articles: boolean } | null> {
  try {
    const next = await fetchDataVersion();
    const changed = { properties: next.properties !== current.properties, articles: next.articles !== current.articles };
    current = next;
    return changed;
  } catch {
    return null;
  }
}
