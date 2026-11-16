# Production checklist

Things that must be changed or set up before (and when) the site goes live. Add to this list
whenever something comes up during development; tick items off at deployment.

Last updated: 2026-11-15

## Before deploying the 2026-11-14 fixes round (branch `fix/frontend-audit-issues`)

- [x] Database migrations `20261114120000_listing_details` (adds `ListingSubmission.details`) and
      `20261116090000_property_closed_at` (adds `Property.closedAt`, for Sold / Rented Out) are already applied to
      the live database (`prisma migrate deploy`, 2026-11-14 and 2026-11-16). Nothing to run. Both are nullable
      columns: the backend that is live now keeps working until the new one is deployed.
- [ ] **Deploy the backend first, then the frontend.** The new frontend calls `GET /api/v1/site/watermark`, sends
      `details` with free listings and `cardSize` with photo uploads; the old backend ignores or 404s those. No
      environment variable changes on either side (the maps need no key or token).
- [ ] **R2 CORS for the live site (fixes "Upload failed, check your connection" on Free Listing and Admin)**:
      Cloudflare → R2 → bucket `nepal-bhoomi-media` → Settings → CORS policy → Edit, and paste:
      `[{"AllowedOrigins":["https://www.nepalbhoomi.com","http://localhost:5173"],"AllowedMethods":["PUT"],"AllowedHeaders":["Content-Type"],"MaxAgeSeconds":3600}]`.
      Checked 2026-11-14: the bucket answers 403 to `https://www.nepalbhoomi.com` and allows `localhost:5173`.
- [ ] **Google sign-in on the live site**: Google Cloud Console → APIs & Services → Credentials → the OAuth 2.0
      client → add Authorised JavaScript origin `https://www.nepalbhoomi.com` and Authorised redirect URI
      `https://www.nepalbhoomi.com/api/v1/auth/google/callback`, then Save (takes a few minutes).
- [ ] **Schedule the daily cleanup (`CRON_SECRET`, section below) before launch**: the new Privacy Policy
      (`/privacy-policy`) promises that unverified accounts go after 7 days and security logs after 180 days;
      that is only true once `GET /api/cron/cleanup-tokens` runs daily.
- [ ] **Have someone qualified read the legal pages** (`frontend-realstate/src/seo/legal.ts`, `faq.ts`): written
      in plain English for Nepal's Privacy Act, 2075, but not reviewed by a lawyer. Update `LEGAL_UPDATED` whenever the
      wording changes.
- [ ] `frontend-realstate/index.html` preconnects to the R2 public host (`pub-7b09….r2.dev`) by name. When
      `R2_PUBLIC_URL` moves to a custom domain, change that line too (it only speeds up the first photo; nothing
      breaks if it's stale).
- [ ] Backend dev dependencies: `npm audit` shows one moderate advisory (`minimatch`, via `@typescript-eslint`,
      lint only, not in the deployed server; `npm audit --omit=dev` = 0). `npm audit fix` resolves it.
- [ ] **Video tours must be web-sized.** The only tour on the site (property 39, NBL007) is the phone's original:
      1080×1920 at 16 Mbit/s, 211 MB. On a ~6 Mbit/s 4G phone only 9 s of the first 30 s played (5 stops). A 720p
      copy at ~1.7 Mbit/s (22 MB, looks the same on a phone) played 29 of 30 s. Replace the tour with the small copy
      (Admin → the property → Property Video → Replace). New uploads above 4 Mbit/s now get a warning in the editor
      (`frontend-realstate/src/app/media/video-check.ts`). To make a copy: HandBrake "Fast 720p30", or
      `ffmpeg -i in.mp4 -vf scale=720:-2 -c:v libx264 -crf 25 -maxrate 2500k -bufsize 5000k -c:a aac -b:a 128k -movflags +faststart out.mp4`.
- [ ] Watermark: Admin → Watermark is on (the Nepal Bhoomi logo + "Nepal Bhoomi", strength 25 %, band height 8 %:
      thin and faint, by the owner's request 2026-11-15; already in the live database). "Strength" fades the whole
      mark (band, logo and text) together. Check you like it, change it there if not. It stamps only
      photos uploaded from now on; photos already on the site are unchanged.

## Secrets and accounts

- [ ] **Rotate every secret that appeared in a chat transcript**: database password (`DATABASE_URL` /
      `DIRECT_URL`; the new Mumbai project's password too, 2026-10-14), `GOOGLE_CLIENT_SECRET`, `JWT_ACCESS_SECRET`,
      `TOTP_ENCRYPTION_KEY`. Changing `TOTP_ENCRYPTION_KEY` breaks existing 2FA secrets, so re-enrol the admin's 2FA
      afterwards. After changing the database password, update every teammate's `.env` at the same time.
- [ ] **Strong admin password**: replace `ADMIN_PASSWORD` (currently short) with a long random one.
- [ ] **Never commit `.env`** (already git-ignored). Put production values in the hosting
      provider's environment variables, not in files.

## Email (Gmail SMTP, kept for production by decision)

- [ ] Use a **dedicated Gmail account** for the site, not a personal one, with its own App Password
      (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM_NAME`).
- [ ] Keep the sending limit in mind: ~500 emails/day (personal Gmail) or ~2,000 (Google Workspace).
      Past it, verification codes and reset links stop for up to 24 h. Switch to a transactional
      provider (Resend, Amazon SES, Postmark) if traffic grows; only `backend-realstate/lib/email/mailer.ts` changes.

## Scheduled cleanup (CRON_SECRET)

- [ ] Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
      and set `CRON_SECRET` (32+ chars) in the backend environment.
- [ ] Schedule a daily `GET /api/cron/cleanup-tokens` with header `Authorization: Bearer <CRON_SECRET>`
      (Vercel Cron, crontab on a VPS, cron-job.org or GitHub Actions). The endpoint answers 404 until
      the secret is set. What it deletes: `backend-realstate/lib/cron/cleanup-tokens.ts`.

## Media storage (Cloudflare R2)

- [ ] Create the R2 bucket for property images and videos (the database stores only their URLs:
      `Property.gallery`, `Property.videoUrl`) and give it a public/custom domain for serving.
- [ ] Add that media host to the frontend's Content-Security-Policy in `frontend-realstate/vite.config.ts`
      (`img-src` and `media-src`), or images and videos will be blocked in production.
- [ ] Set the backend env vars `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
      `R2_PUBLIC_URL` (an R2 API token with Object Read & Write on that bucket only). Without them
      the admin's photo / video uploads answer 503.
- [ ] R2 bucket → Settings → CORS policy: allow `PUT` from the frontend origin(s) with header
      `Content-Type` (e.g. `[{"AllowedOrigins":["https://<site>","http://localhost:5173"],"AllowedMethods":["PUT"],"AllowedHeaders":["Content-Type"],"MaxAgeSeconds":3600}]`),
      or the browser's upload is blocked.
- [ ] The CSP allows any `https:` image / video (`img-src`, `media-src`). Narrow it to
      `'self' data: blob:` + the R2 public domain + the hosts still in use (images.unsplash.com,
      i.ytimg.com, tile.openstreetmap.org).
- [ ] Until R2 is set, development uploads go to `backend-realstate/.uploads/` and are stored as
      `http://localhost:3000/api/v1/media/…` URLs. Before launch, delete or re-upload any property /
      article whose photos point there (they don't exist anywhere else). Production never uses it.
- [ ] Add an R2 lifecycle rule or a cleanup job for orphaned uploads: a photo or video uploaded in the
      editor and then removed (or the editor closed) before saving stays in the bucket. Files of
      saved properties are deleted by the backend when removed from a property or when the property
      is deleted for good.

- [ ] `R2_PUBLIC_URL` is an `r2.dev` address (set 2026-10-08 for development). Cloudflare rate-limits r2.dev and
      doesn't recommend it for production: connect a custom domain (e.g. `media.<site>`), point `R2_PUBLIC_URL` at it,
      and re-upload or rewrite any stored r2.dev URLs. Note: r2.dev keeps serving a deleted file for a short while
      (cache), seen 2026-10-14; the bucket itself no longer has it.
- [x] ~~Photos keep their EXIF metadata~~ Fixed 2026-11-14: every property and free-listing photo is re-drawn in the
      browser before upload (`frontend-realstate/src/app/media/watermark.ts`), which drops EXIF (GPS included),
      resizes to ≤ 2560 px, adds the watermark and makes an 800 px card copy (`<uuid>.w800.jpg`). Photos uploaded
      before that date keep their EXIF; re-upload any where it matters.
- [ ] Free-listing uploads are limited per IP only (120/h × 8 MB). Consider a per-account limit too, plus the
      lifecycle rule above, so one account can't fill the bucket.

## Maps

- [ ] Open a property page and Buy → Map view on the **production build** and check the map tiles
      load (a blank map means the CSP blocked them: check the browser console).
- [x] Maps moved from Leaflet + OpenStreetMap tiles to **MapLibre GL + OpenFreeMap** (2026-11-14): vector map,
      free, no key, no request limit (openfreemap.org). If OpenFreeMap is unreachable the map falls back to OSM's
      raster tiles by itself (`FALLBACK_STYLE` in `frontend-realstate/src/app/components/ui/maplibre-maps.tsx`; its
      usage policy, operations.osmfoundation.org/policies/tiles, is fine for a fallback). The CSP allows both tile
      hosts in `connect-src` and `blob:` workers (vite.config.ts).
- [ ] Privacy: public property API responses must never contain `mapUrl`, and for properties set to
      "Approximate area" must not contain the real lat / lng (only `approx`, the shifted centre).
      Check one response of each kind in the browser's Network tab.

## URLs, domain and HTTPS

- [x] **Live on https://www.nepalbhoomi.com (2026-10-14)**: GoDaddy name servers moved to Vercel
      (`ns1`/`ns2.vercel-dns.com`); Vercel DNS holds the Zoho mail records (MX `mx`/`mx2`/`mx3.zoho.com`, SPF
      `v=spf1 include:zoho.com ~all`, the Zoho and Google site-verification TXT). `nepalbhoomi.com` and
      `nepal-bhoomi-web.vercel.app` 308-redirect to `www` (`frontend-realstate/vercel.json` "redirects"; the homepage `/` needs its own rule, the
      catch-all `/:path*` alone left it served without redirect, fixed 2026-10-14), HTTPS
      certificate by Vercel. Vercel env: backend `FRONTEND_ORIGIN=https://www.nepalbhoomi.com`,
      `GOOGLE_REDIRECT_URI=https://www.nepalbhoomi.com/api/v1/auth/google/callback`; frontend `VITE_API_URL` =
      `VITE_SITE_URL` = `https://www.nepalbhoomi.com`. Verified: pages, sitemap (46 www addresses), canonicals,
      CSP, API, sign-in/refresh/logout/other-origin 403 with a dummy account (deleted), Google start sends the
      www callback. Still to do (owner): in Google Cloud → Credentials → the OAuth client add JS origin
      `https://www.nepalbhoomi.com` and redirect `https://www.nepalbhoomi.com/api/v1/auth/google/callback`; in
      R2 bucket `nepal-bhoomi-media` CORS add `https://www.nepalbhoomi.com` (uploads answer 403 until then).
- [ ] **DKIM for Zoho mail**: no DKIM record found. Copy it from Zoho Admin → Domains → Email Configuration →
      DKIM and add it as a TXT record in Vercel DNS (Domains → nepalbhoomi.com).
- [x] **Vercel test deploy is live (2026-10-14)**: https://nepal-bhoomi-web.vercel.app (frontend, project
      `nepal-bhoomi-web`) and https://nepal-bhoomi-api.vercel.app (backend, `nepal-bhoomi-api`, region bom1), Vercel
      account `sakxama72-1518` (Hobby), deployed with the Vercel CLI from the private repo
      `rookhit/-nepal-bhoomi-realestate` (main). Since the domain switch this address redirects to https://www.nepalbhoomi.com (see above).
      Redeploy after changes: `npx vercel deploy --prod` in each folder (or connect the Git repo in Vercel).
- [ ] **Vercel test deploy (set up 2026-10-14)**: two projects (root directories `backend-realstate` and
      `frontend-realstate`). `frontend-realstate/vercel.json` forwards `/api/*` to the backend project, so the
      browser sees one site and the SameSite=Strict login cookie works on `*.vercel.app`: replace
      `REPLACE-WITH-BACKEND` in it with the backend project's address. Frontend env: `VITE_API_URL` and
      `VITE_SITE_URL` = the frontend's own address. Backend env: the `.env` values (without `NEW_DATABASE_URL` /
      `POOLER_URL`), with `FRONTEND_ORIGIN` = the frontend address and `GOOGLE_REDIRECT_URI` =
      `<frontend>/api/v1/auth/google/callback`. Add the frontend address to the R2 bucket's CORS (and to the Google
      OAuth client to test Google sign-in). Redeploy the frontend once after the first deploy so pre-rendering can
      read the live API. It uses the real Mumbai database. For production, keep this proxy or move to a custom
      domain (`api.` subdomain) and remove the rewrite.

- [ ] Serve everything over **HTTPS**.
- [ ] **Deploy same-site**: frontend and API on one site (`domain.com` + `/api`, or `api.domain.com`),
      so the `SameSite=Strict` refresh cookie works.
- [ ] Backend: `FRONTEND_ORIGIN` = the real frontend URL (e.g. `https://domain.com`).
- [ ] Backend: `GOOGLE_REDIRECT_URI` = `https://<api-host>/api/v1/auth/google/callback`, and add the
      same URI (plus the production origin) in Google Cloud Console → OAuth client.
- [ ] Frontend build: set `VITE_API_URL` to the production API origin.
- [ ] Run the backend with `NODE_ENV=production` (turns on the `Secure` cookie flag and makes missing
      email settings an error instead of printing codes to the console).
- [ ] **Host the backend in the same region as the database** (Supabase is in `ap-south-1`, Mumbai, since
      2026-10-14): each query is a round trip (~50 ms from Nepal to Mumbai, ~155 ms to the old Seoul project, ~1-2 ms
      from the same region), and one admin save makes several. Pin the Vercel functions to `bom1` (Mumbai).
- [ ] Deploy behind a proxy that sets `X-Forwarded-For`, so rate limits and lockouts see real client IPs.
- [ ] **The frontend has real page URLs now (F1, merged 2026-10-13)**: the frontend host must serve
      `index.html` for every path (SPA fallback / rewrite), or a reload or shared link on
      `/property/13-…` answers 404.

- [x] **SEO (frontend update, merged 2026-10-13)**: `VITE_SITE_URL=https://www.nepalbhoomi.com` set on Vercel (2026-10-14).
      Original note: the site is now indexable (`noindex` removed from
      `index.html`). Set `VITE_SITE_URL` to the real domain at build time (it defaults to
      `https://www.nepalbhoomi.com` in `frontend-realstate/src/seo/meta.ts`), or canonicals and share
      links point to the wrong host.
- [ ] **Pre-rendering is part of `npm run build` now** (`vite build && node scripts/prerender.mjs`). It
      writes static HTML per page / property / article (as `buy/index.html` and `buy.html`, so any host
      serves one), `sitemap.xml` and `robots.txt`, reading the live API at `VITE_API_URL`: the API must
      be reachable at build time, or only the fixed pages are written (the build still succeeds).
      Rebuild (or `npm run prerender`) after adding properties or articles, so the sitemap lists them.
- [ ] After going live: verify the domain in Google Search Console and submit `/sitemap.xml`; set up
      the Google Business Profile (Lazimpat office, 9818783518, Sun–Fri 9:30–6); 301-redirect the old
      nepalbhoomi.com page addresses to their new pages.
- [x] **Dashain 2083 decorations removed** (2026-11-14): `src/app/festive/` and three.js are gone.
- [x] **Privacy Policy, Terms of Use and FAQ pages added** (2026-11-14): `/privacy-policy`, `/terms`, `/faq`,
      pre-rendered, in the sitemap and footer; the FAQ page carries FAQPage structured data.

## Database (Supabase)

- [ ] Apply migrations on the production database: `npx prisma migrate deploy` (in `backend-realstate`).
- [ ] Then run `npm run db:seed` once: it creates the admin **and** the 69 amenities the property
      editor links to (the `Amenity` table is empty until then). Safe to re-run.
      The seeded admin is email-verified (2026-10-06), so it can sign in without an emailed code.
- [ ] For serverless hosting, consider the Supabase transaction pooler (port 6543) for `DATABASE_URL`,
      and host the backend near the database region (ap-south-1, Mumbai).
- [ ] Keep using a **pooler** host (`aws-0-ap-south-1.pooler.supabase.com`), never the direct `db.<ref>.supabase.co`
      host: the direct host is IPv6-only, and a brief IPv6 / DNS blip gave 500s (`getaddrinfo ENOENT`) on 2026-10-14.
      `DIRECT_URL` (migrations) uses the session pooler (5432) too.
- [ ] Supabase free tier pauses when idle and has limited backups: upgrade or set up backups before launch.
- [ ] **Database moved Seoul → Mumbai (2026-10-14)**: the old Seoul project (`pmxq…`) is kept read-only as a fallback.
      After about a week without problems (~2026-10-21), pause it, later delete it. Check nobody's `.env` still points
      at it (an old backend wrote two sessions there after the switch until it was stopped).
- [ ] Delete the local `.env` backups from the move once happy (`.env.seoul-backup`, `.env.pre-mumbai-switch`,
      `.env.pre-pooler`; git-ignored but they hold every secret) and remove the `NEW_DATABASE_URL` / `POOLER_URL`
      lines from `backend-realstate/.env`.
- [ ] Migration files must stay LF (`.gitattributes`: `*.sql text eol=lf`, added 2026-10-14): Prisma stores a
      checksum of each file, and a CRLF checkout on Windows made 8 of them differ. Commit `.gitattributes`.

## From the QA audit (2026-10-05)

- [ ] **Admin email in the public repo (B6, deferred)**: `backend-realstate/CLAUDE.md` and 3 commits show the real
      admin login email. Replace it with `<ADMIN_EMAIL from .env>`, then make the repo private or change the
      admin's login email (git history keeps the old one).
- [ ] **Free listings saved before 2026-10-06** may hold outside photo URLs (the upload-only check is new):
      look over Admin → Free Listings and reject any whose photos are not from the site's own uploads.
- [x] Frontend findings F1, F2, F4, F5 fixed (merged 2026-10-13). The privacy policy page was added 2026-11-14.
- [ ] Company videos backend (`/videos`, `/admin/videos`) not built. Admin → Videos is view-only meanwhile
      (`VIDEOS_EDITABLE = false` in `ContentEditors.tsx`); set it to `true` once the endpoints are wired.

## From the full QA, security and speed pass (2026-10-14)

Checked as admin and as a member (register → verify → sign in → like, enquiry, review, callback, contact,
free listing with photo upload → admin approve / reject / delete → sign out), 17 pages at 375 / 768 / 1440 px
(no overflow, broken images, console errors or failed requests), and the security basics: admin endpoints
answer 401 without a valid token (forged and `alg=none` tokens too), cross-site requests are refused, public
endpoints expose no emails, tokens or exact locations (public map points are ≥ 178 m from the real spot),
no secrets in git history or the frontend bundle, no source maps, bcrypt, httpOnly cookies, lockouts. Frontend
`npm audit`: 0. All test data was removed afterwards (test accounts, likes, listings and their files; unused
R2 files).

- [x] **Upgraded 2026-11-14** to `next@16.4.6` (also Prisma 7.10.1, zod 4.6.7, nodemailer 10.5.0); production
      dependencies now audit clean. Original note: **Backend dependencies (`npm audit`)**: `next` 16.3.5 has a critical advisory (RCE in `next/og`
      ImageResponse) and pulls an old `sharp`. The backend uses neither `next/og`, `use cache` nor draft mode,
      so it isn't reachable today, but upgrade to `next@16.4.0` or later before launch. The `mysql2` /
      `deepmerge-ts` advisories come from the Prisma CLI only (the site uses Postgres); ignore `npm audit fix
      --force`, which would downgrade Prisma to 6.
- [ ] **API root page**: `GET /` on the backend still serves the "Create Next App" starter page
      (`backend-realstate/app/page.tsx` and `public/*.svg`). Replace it with a 404 or a one-line JSON status,
      so the API domain doesn't show a template page or advertise the framework.
- [ ] **Frontend host headers**: the CSP is a `<meta>` tag (vite.config.ts). On the host also send
      `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
      strict-origin-when-cross-origin` and `frame-ancestors 'self'` (a meta CSP can't set frame-ancestors).
- [x] **Done 2026-11-14**: cards, lists and map pop-ups load the 800 px card copy (made at upload; the 71 photos
      already on R2 got theirs from a one-off back-fill), heroes and galleries pick it on phones through `srcset`.
      Home page on a phone: images 1,425 KB → 799 KB. Original note: **Smaller photos for cards**: every card and thumbnail downloads the full 1600 px upload (~250–300 KB).
      Off-screen images now load lazily (home page 3.2 MB → 1.6 MB on desktop), but a thumbnail size (e.g. an
      800 px copy made at upload, or Cloudflare Image Resizing on a custom R2 domain) would cut it again by
      about two thirds, mostly on phones.
- [x] **Partly done 2026-11-14**: the 11 public GET endpoints send `Vercel-CDN-Cache-Control: max-age=30,
      stale-while-revalidate=300` (Vercel's edge keeps the answer, browsers don't; `lib/auth/guards.ts`
      `publicJsonResponse`), so an admin change shows on the site within ~30 s. Check after deploying: a second
      request shows `x-vercel-cache: HIT`. Original note: **API latency from Nepal**: public GETs take 0.2–1.4 s (`/properties` is the slowest, ~1.3 s) because each
      query is a round trip to the Supabase region. A `Cache-Control: public, max-age=60` on the public GETs
      behind a CDN, or a closer database region, would make first loads noticeably faster.
- [ ] **Accounts left in the database**: 8 member accounts that look like real people (friends and family who
      tried the site) were kept. Delete any that were only for testing in Admin → Users before launch.
