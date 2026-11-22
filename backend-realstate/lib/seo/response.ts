// Answers for the /seo/* routes (pages and sitemap forwarded from the website's host).
// Vercel's CDN keeps each for 60 s and serves it once more while refreshing for up to 60 s more, so a new
// or changed property is in its page and the sitemap within about 2 minutes, and a page shared many times
// costs one database read a minute. Browsers revalidate every time (the HTML points at the live build).

const EDGE = "max-age=60, stale-while-revalidate=60";

export function seoResponse(body: string, status: number, contentType: string): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Vercel-CDN-Cache-Control": EDGE,
    },
  });
}

/** The site's page couldn't be built (the database or the website itself unreachable): try again shortly. */
export function seoUnavailable(error: unknown): Response {
  console.error(error);
  return new Response(
    "<!doctype html><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\"><title>Nepal Bhoomi</title>" +
    "<p style=\"font:16px Arial,sans-serif;padding:24px\">This page couldn't load. Please refresh in a moment.</p>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "30" } },
  );
}
