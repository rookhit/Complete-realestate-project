/**
 * True when index.html's still loading screen (#nb-boot) was on screen as the app started. Read once,
 * when this module loads (before React replaces the page's first HTML), so the app's own loading
 * screen can carry on from it instead of replaying its entrance from a blank screen.
 */
export const BOOT_SPLASH_SHOWN: boolean =
  typeof document !== "undefined" && document.getElementById("nb-boot") !== null;
