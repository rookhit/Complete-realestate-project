# Production checklist

Things that must be changed or set up before (and when) the site goes live. Add to this list
whenever something comes up during development; tick items off at deployment.

Last updated: 2026-10-06

## Secrets and accounts

- [ ] **Rotate every secret that appeared in a chat transcript**: database password (`DATABASE_URL` /
      `DIRECT_URL`), `GOOGLE_CLIENT_SECRET`, `JWT_ACCESS_SECRET`, `TOTP_ENCRYPTION_KEY`. Changing
      `TOTP_ENCRYPTION_KEY` breaks existing 2FA secrets, so re-enrol the admin's 2FA afterwards.
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
      and re-upload or rewrite any stored r2.dev URLs.
- [ ] Photos keep their EXIF metadata (phone photos often hold the exact GPS point), which undoes the
      "Approximate area" map for anyone who downloads a listing photo. Strip it before upload (e.g. re-encode in the
      browser) or with an R2-side process.
- [ ] Free-listing uploads are limited per IP only (120/h × 8 MB). Consider a per-account limit too, plus the
      lifecycle rule above, so one account can't fill the bucket.

## Maps

- [ ] Open a property page and Buy → Map view on the **production build** and check the map tiles
      load (a blank map means the CSP blocked them: check the browser console).
- [ ] OpenStreetMap's free tile server has a usage policy (fine for a small site, not heavy traffic):
      re-read it at operations.osmfoundation.org/policies/tiles before launch. If the site outgrows it,
      switch `TILES` in `frontend-realstate/src/app/components/ui/leaflet-maps.tsx` to a tile provider.
- [ ] Privacy: public property API responses must never contain `mapUrl`, and for properties set to
      "Approximate area" must not contain the real lat / lng (only `approx`, the shifted centre).
      Check one response of each kind in the browser's Network tab.

## URLs, domain and HTTPS

- [ ] Serve everything over **HTTPS**.
- [ ] **Deploy same-site**: frontend and API on one site (`domain.com` + `/api`, or `api.domain.com`),
      so the `SameSite=Strict` refresh cookie works.
- [ ] Backend: `FRONTEND_ORIGIN` = the real frontend URL (e.g. `https://domain.com`).
- [ ] Backend: `GOOGLE_REDIRECT_URI` = `https://<api-host>/api/v1/auth/google/callback`, and add the
      same URI (plus the production origin) in Google Cloud Console → OAuth client.
- [ ] Frontend build: set `VITE_API_URL` to the production API origin.
- [ ] Run the backend with `NODE_ENV=production` (turns on the `Secure` cookie flag and makes missing
      email settings an error instead of printing codes to the console).
- [ ] Deploy behind a proxy that sets `X-Forwarded-For`, so rate limits and lockouts see real client IPs.
- [ ] Once the frontend has real page URLs (QA finding F1, `FRONTEND_CLAUDE.md` §0.0): the frontend host must
      serve `index.html` for every path (SPA fallback / rewrite), or a reload or shared link on
      `/property/NBS005` answers 404.

## Database (Supabase)

- [ ] Apply migrations on the production database: `npx prisma migrate deploy` (in `backend-realstate`).
- [ ] Then run `npm run db:seed` once: it creates the admin **and** the 69 amenities the property
      editor links to (the `Amenity` table is empty until then). Safe to re-run.
      The seeded admin is email-verified (2026-10-06), so it can sign in without an emailed code.
- [ ] For serverless hosting, consider the Supabase transaction pooler (port 6543) for `DATABASE_URL`,
      and host the backend near the database region (ap-northeast-2).
- [ ] Supabase free tier pauses when idle and has limited backups: upgrade or set up backups before launch.

## From the QA audit (2026-10-05)

- [ ] **Admin email in the public repo (B6, deferred)**: `backend-realstate/CLAUDE.md` and 3 commits show the real
      admin login email. Replace it with `<ADMIN_EMAIL from .env>`, then make the repo private or change the
      admin's login email (git history keeps the old one).
- [ ] **Free listings saved before 2026-10-06** may hold outside photo URLs (the upload-only check is new):
      look over Admin → Free Listings and reject any whose photos are not from the site's own uploads.
- [ ] Frontend findings F1-F4 (page URLs, Videos not saved, dead footer links, out-of-date admin banner):
      fix before launch, see `FRONTEND_CLAUDE.md` §0.0. A **privacy policy** page is expected, since the
      site collects names, phone numbers and emails.
- [ ] Company videos backend (`/videos`, `/admin/videos`) not built: until it is, Admin → Videos must be hidden.
