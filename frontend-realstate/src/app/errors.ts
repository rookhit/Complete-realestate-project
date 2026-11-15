/**
 * An error whose message is written for the person using the site ("Upload failed. Check the
 * connection and try again."), so forms may show it as it is. Any other Error is a bug, and forms
 * show a general message instead of its text.
 */
export class UserFacingError extends Error {
  override name = "UserFacingError";
}
