# Changes, November 2026

What changed on the website and admin panel in the November 2026 round, and how to deploy it.
Branch: `update/2026-11-site-and-admin-fixes`. Details per file are in `frontend-realstate/FRONTEND_CLAUDE.md` §13
and `backend-realstate/CLAUDE.md` (dated entries).

## Read first

- **`main` is 47 commits behind this branch.** Merging also brings in October's work that is live but was never
  merged into `main`: the Mumbai database move, the Vercel setup and the www domain, SEO pre-rendering, the
  cover-frame and admin speed work. `main` has nothing this branch lacks, so the merge is conflict-free
  (fast-forward).
- **Deploy the backend first, then the frontend.** The new frontend calls endpoints only the new backend has.
- **Database: nothing to run.** All four migrations of this round are already applied to the live database:
  `20261114120000_listing_details`, `20261116090000_property_closed_at`,
  `20261116150000_session_start_message_read_at`, `20261130090000_price_unit_video_links`. They only add columns, so the backend that is live now keeps
  working until the new one is deployed.
- **Environment variables:** no new ones. The live backend must have `GMAIL_USER` and `GMAIL_APP_PASSWORD` set
  (already used for sign-up codes), because new-message emails use them too. The new map needs no key.
- **After deploying, the admin signs in again** at least every 3 days (see Sessions below).

## What changed, by area

### Website (visitors)
- **No text flash on first load:** a branded loading screen shows until the page is ready.
- **Maps:** MapLibre + OpenFreeMap (free, no key). Scrolling over a map scrolls the page (Ctrl + scroll zooms);
  phones show a "use two fingers" hint; the map view fits the screen; the hover card sits above the bars; space
  between the map and the cards on phones.
- **For Sale / For Rent tags** on every property card, Hot Properties card, Buy/Rent list row and property heading,
  next to the badge (Hot, Rare…). Taken from the property's listing type, so always correct.
- **Price filters:** sale under 3 Cr / 3–7 Cr / above 7 Cr; rent under 3 lakh / 3 lakh and above.
- **Home:** Hot Properties shows exactly 3 whole cards (1 + a peek on phones); testimonials swipe on phones.
- **Pagination** everywhere; Buy/Rent keep the page in the address, so Back returns to the same page; a page turn
  starts at the top of the list.
- **Forms:** after sending (callback, contact, enquiry, review, forgot password, Free Listing) the thank-you
  message is on screen instead of the footer. The footer "Videos" link goes to `/videos`.
- **Free Listing:** fields and amenities depend on the property type; the member's details are filled in; the
  half-written form survives a reload (cleared on Log Out).
- **Privacy Policy, Terms of Use and FAQ** pages (in the footer, the sitemap and Google's FAQ format); consent line
  on Register and Free Listing.
- **Faster:** cards load an 800 px copy of each photo; pages and the map code load only when needed; public data is
  cached at Vercel's edge for 30 s. Phone on 4G: usable in ~2.4 s instead of ~3.5 s, 1,059 KB instead of 1,400 KB.
- **Reviewer photos** from Google sign-in load again (initials if not).
- Dashain decorations removed.

### Admin panel
- **Sold and Rented Out** (new menu entries): "Mark as Sold" / "Mark as Rented" on each property, or
  "Mark a Property as …" in those sections. The property leaves the website but is kept with its NB ID, photos and
  reviews; "Put Back on Website" restores it. Its NB ID is never given to a new listing.
- **Search properties by NB number:** `008`, `8`, `01`, `nbs8`, `NBL 7`, `#nbs012`.
- **Messages:**
  - tick boxes, "Select all", "Delete selected" and "Delete all" (what the current filter or search shows),
    confirmed, with Undo;
  - opened messages are deleted automatically 90 days after they were first opened (unread ones are kept);
  - **every new enquiry, callback request and contact message is emailed** to the address in
    Contact & Services → "New-Message Emails" (private, not shown on the website; empty = the business email).
    Reply goes straight to the visitor.
- **Free Listings:** no publishing from the list; each listing opens as a full page with the owner's details,
  the exact map pin, a one-page PDF in the site's colours and Back; "Copy to Add Property" fills the editor.
- **Watermark** (new section): a logo / text band stamped on newly uploaded photos, admin and seller; camera
  location data is removed from every upload.
- **Property video:** a warning before uploading a video too heavy to play smoothly on phones.
- Form fields are labelled for screen readers.

### Sessions and security
- **Admin:** signed out after 1 day without use, and 3 days after signing in at the latest. **Members:** 7 days
  without use, 30 days at most. Before, an active session never ended. (`SESSION_LIMITS` in
  `backend-realstate/lib/auth/refresh-token.ts`.)
- A brief network problem no longer signs a person out on their next visit.
- Backend dependencies upgraded (Next.js 16.4.6 fixes a critical advisory; Prisma 7.10.1, zod, nodemailer).

### 22 November follow-up
- **New and changed properties appear at once.** The live site was already running this round's code; the "shows
  5–6 hours later" came from open tabs (phones keep a page in memory for hours) never reloading the list. Now the
  site asks for a tiny "data version" first and loads the lists for that version: an admin's change (new, edited,
  sold, deleted property or article) shows on the next page load, and in already-open tabs within 30 s. Because
  every change gives a new version, Vercel's edge can keep each list for a day without ever serving an old one, so
  the database is barely touched however many visitors there are. Changes made in the browser (admin saves,
  hearts) are never undone by a refresh.
- **New properties are visible to Google and in shared links at once:** a property's or article's page (title,
  description, preview photo for WhatsApp / Facebook, Google's listing data) and `sitemap.xml` are now built by the
  backend when asked, instead of once per deploy. Added, changed or sold properties are right within about 2
  minutes; sold ones tell Google to drop them.
- **Ready for 300+ properties:** lists load a slim "card" version of each property (short description, cover
  photo); a property page loads its own full details (all photos, features, floor plan, video), with placeholders
  for a moment. About 28% less data for today's 19 properties, more with photo-rich listings.
- **Phones: "See more" instead of long pages.** Buy / Rent / Hot / New and Blog show 6 at a time, Team 8, with a
  "See more" button; Back returns to the same place; rotating keeps the same items. The home page's Journal and
  Services and the About page's "What We Offer" show a few items and a visible "All …" button on phones (before,
  that button was hidden on phones). About's team is two across on phones. Computers keep page numbers.
- **Footer tidied:** two columns of links on phones (about a screen shorter), phone number and email added, a
  duplicate link removed, smaller quote, links light up on hover.
- **Database under load:** list pages no longer open a database transaction; saves wait up to 10 s for a free
  connection instead of failing after 2 s. See **Capacity** in `PRODUCTION_CHECKLIST.md` for how much the site can
  take and the three changes recommended before traffic grows (Vercel Pro, Supabase transaction pooler, a custom
  domain for photos).

### 30 November
- **Price units:** the admin can choose what a price is for: per Ropani, Aana, Paisa, Dam, Bigha, Kattha, Dhur or
  sq.ft for a sale, per year for a rent (lists editable in Dropdown Options). The site shows it after the price,
  like rent's "per month": "NPR 45 Lakh *per Aana*". Filters and sorting are unchanged (owner's decision).
- **Videos on social media:** the admin can paste any number of links (up to 10) to the property's videos on
  Facebook, Instagram, YouTube, TikTok…; the property page shows a button with the platform's icon for each, opening
  the post in a new tab.
- **EMI calculator:** the number boxes now sit above the sliders.
- **Database:** migration `20261130090000_price_unit_video_links` (two optional columns) is already applied to the
  live database; the current live backend keeps working with it.

### Tried and reverted
- An automatic photo-fitting change (commits `da70ef3` / `bee5df3`) was reverted at the owner's request: photos
  look exactly as before.

## New endpoints (backend)

| Method | Path | What |
|---|---|---|
| GET | `/seo/property/:slug`, `/seo/blog/:slug`, `/seo/sitemap` | Property / article pages and sitemap.xml (the website forwards `/property/*`, `/blog/*`, `/sitemap.xml` here) |
| GET | `/api/v1/site/version` | The data version `{ properties, articles }` (public, edge-cached 2 s) |
| GET | `/api/v1/properties?view=card` | The slim list (existing endpoint, new option); `?v=` on lists / one property / articles = edge-cached a day |
| GET | `/api/v1/site/watermark` | The watermark settings (public; uploads use them) |
| PUT | `/api/v1/admin/site/watermark` | Save the watermark |
| GET / PUT | `/api/v1/admin/site/notifications` | Where new-message emails go (admin only) |
| POST | `/api/v1/admin/properties/:id/close`, `/reopen` | Mark sold / rented out; put back |
| POST | `/api/v1/admin/messages/bulk-delete`, `/bulk-restore` | Delete many messages; Undo |

Free listings also take `details`; photo uploads take `cardSize` (the 800 px copy).

## Owner's dashboard settings (outside the code)

- **Cloudflare R2** → bucket `nepal-bhoomi-media` → Settings → CORS: allow `https://www.nepalbhoomi.com` (exact
  JSON in `PRODUCTION_CHECKLIST.md`). Until then, photo uploads on the live site fail.
- **Google Cloud** → Credentials → OAuth client: add `https://www.nepalbhoomi.com` and its
  `/api/v1/auth/google/callback`. Until then, Google sign-in fails on the live site.
- **Daily cleanup job** (`CRON_SECRET` + a daily call to `/api/cron/cleanup-tokens`): needed for the deletions
  the Privacy Policy promises.

## How it was tested

In Brave, as a visitor, a member and the admin, at phone and desktop sizes, by clicking and typing like a person,
with real photos and real (test) messages: maps, uploads and watermark, Free Listing, admin listing page and PDF,
filters, pagination, legal pages, Sold / Rented Out, NB search, sessions (expiry times checked), bulk delete and the
90-day deletion, new-message emails (received), and a smoke test of every page. Typecheck, lint and production
build pass on both projects. All test data was deleted afterwards.

## Known follow-ups

Listed at the top of `PRODUCTION_CHECKLIST.md`: replace NBL007's 211 MB video tour with a 720p copy (stalls on 4G);
have the legal text read by someone qualified; update the R2 host in `index.html` if R2 moves to a custom domain.
