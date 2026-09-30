# Production checklist

Things that must be changed or set up before (and when) the site goes live. Add to this list
whenever something comes up during development; tick items off at deployment.

Last updated: 2026-09-28

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

## Database (Supabase)

- [ ] Apply migrations on the production database: `npx prisma migrate deploy` (in `backend-realstate`).
- [ ] Then run `npm run db:seed` once: it creates the admin **and** the 69 amenities the property
      editor links to (the `Amenity` table is empty until then). Safe to re-run.
- [ ] For serverless hosting, consider the Supabase transaction pooler (port 6543) for `DATABASE_URL`,
      and host the backend near the database region (ap-northeast-2).
- [ ] Supabase free tier pauses when idle and has limited backups: upgrade or set up backups before launch.
