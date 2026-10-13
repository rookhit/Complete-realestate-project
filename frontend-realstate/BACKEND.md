# BACKEND.md

**Written for saksham.** This is the backend work log and task list: what exists, what changed
in your code and why, and what the frontend is currently blocked on.

### Which file is which

| File | Owner | What it is |
|---|---|---|
| `frontend-realstate/FRONTEND_CLAUDE.md` | Both | The **contract**. Data shapes, endpoint specs, auth rules. The spec. |
| **`frontend-realstate/BACKEND.md`** (this) | **Backend** | The **status**. What is built, what is next, what is blocking. |
| `backend-realstate/API.md` | Backend | Reference docs for the endpoints already shipped |
| `backend-realstate/CLAUDE.md` | Backend | The backend's own project instructions (auth design, data model, change history) |

(Older sections below say `apps/api` / `apps/web`: in this repo those are `backend-realstate/` and `frontend-realstate/`.)

Rule of thumb: **`CLAUDE.md` says what it should be. This file says where we are.** When you
finish something, tick it here and update the matching section of `CLAUDE.md` in the same commit.

---

## 1. Where we are (updated 2026-09-30)

| | Status |
|---|---|
| **Auth API** | Built and hardened: register with 6-digit email verification, login, TOTP 2FA (required for the admin), Google sign-in, refresh, logout, me, forgot / reset password (Gmail SMTP), `GET /admin/users` |
| **Database** | Postgres on Supabase, 12 migrations, RLS on every table. **The content schema for every admin screen is built and applied** (tables only): properties with NB ID, locations with exact / approximate mode, amenities, hearts, reviews, messages, free listings, articles, team, testimonials, videos, site settings. Summary: `backend-realstate/CLAUDE.md` → "Data model (content)" |
| **Content API** | **Properties built** (2026-09-30, §4.1). The rest (§4.2–4.5) not yet |
| **Frontend** | Auth and **properties** call the real API (properties since 2026-09-30). Everything else still reads the mock arrays in `src/app/data/`; each function there names the endpoint that replaces it |

---

## 2. Running it

```bash
cd backend-realstate && npm install && npx prisma generate && npm run dev          # http://localhost:3000
cd frontend-realstate && npm install && npm run dev -- --port 5173 --strictPort    # must match FRONTEND_ORIGIN
```

`backend-realstate/.env` (never committed) needs the variables listed in `backend-realstate/CLAUDE.md`.
New database: `npx prisma migrate deploy` then `npm run db:seed` (the admin + the 69 amenities).

---

## 3. History: review of the old `apps/api` (2026-09-22)

Kept for the record. The auth scheme has changed since (access token in memory + httpOnly refresh cookie, §5).

All on `feat/monorepo-and-auth-hardening`. `apps/api` is yours under the working agreement, so
this was an exception, not a precedent.

**Your cryptography was already sound and none of it changed.** Bcrypt at cost 12. Refresh tokens
stored only as SHA-256 hashes and rotated on use. The JWT algorithm pinned on verify, which blocks
algorithm-confusion attacks. A dummy-hash compare so login timing cannot enumerate accounts.
Registration that ignores a client-supplied role. The password length measured in bytes rather
than characters, because bcrypt truncates past 72 — most people miss that one.

The gaps were operational:

| # | Was | Now |
|---|---|---|
| 1 | No rate limiting anywhere | Postgres-backed limiter, per IP and per account |
| 2 | `requireAllowedOrigin` began `if (!allowedOrigin) return;` | Throws at startup instead |
| 3 | A revoked refresh token only failed that one request | Revokes every session for that user |
| 4 | No `Access-Control-*` headers at all | `middleware.ts` with credentialed CORS and preflight |
| 5 | `secure` cookie keyed to `NODE_ENV` | On by default, off only by explicit opt-out |
| 6 | Password policy was length only | Denylist of the most-guessed passwords |
| 7 | `{ error: "string" }` | `{ error: { code, message, requestId } }` per contract §7.1 |

Two worth understanding rather than just accepting:

**Why the limiter is in Postgres, not memory.** Serverless instances share nothing. An in-process
counter resets on every cold start, which is no limit at all. It fails *open* if the database is
unreachable — deliberately, because a database blip must not lock everyone out of logging in. It
is a brute-force brake, not an authorisation control.

**Why reuse detection matters.** Rotation alone was not enough. A thief who stole a token and used
it once got a fresh one and kept a working session forever, while the legitimate user was merely
logged out. A revoked token reappearing means two parties hold the same credential, so the only
safe response is to end every session for that user.

**One correction to `API.md`.** It said `FRONTEND_ORIGIN` was "what CORS is for". It is not —
that variable *rejects* bad origins, which is the forgery check. CORS headers *permit* the browser
to read a response. They are different jobs and nothing was doing the second one. `API.md` now
carries a dated banner explaining this and the changed error shape.

---

## 4. What the frontend is waiting for, in build order

Full list with shapes: `FRONTEND_CLAUDE.md` §0.4. Forgot / reset password (old §4.2) is done.

### 4.1 Properties — ✅ built and wired into the frontend 2026-09-30 (shapes in `FRONTEND_CLAUDE.md` §0.3)
Public `GET /properties` (filters, search incl. NB ID, sort, pages) and `GET /properties/:id`; admin
create / edit / delete / restore (Undo), `GET /admin/properties/next-ref`, 409 `REF_TAKEN`. Rules that bite:
- **NB ID**: `nbId` = "NBS" (sale) / "NBL" (rent) + `nbNumber` padded to 3 digits. **Separate sequences** (NBS005 and
  NBL005 may coexist), unique among live properties; lowest free number pre-filled; switching sale ↔ rent moves it to
  the other sequence; deleting frees it; search matches full NB IDs only (`FRONTEND_CLAUDE.md` §0.5).
- **Location privacy**: never send `googleMapsUrl`; send one point `approx` + `locationMode` (the real point
  only when the admin chose EXACT). Resolve `maps.app.goo.gl` short links on save; generate the shifted centre once.
- **Exact strings**: `district` is one of the 77 spellings; type / badge / facing / road surface / units come from
  the admin-editable option lists. Price: send `priceNum` (BigInt → number) and the display `price`.

### 4.2 Uploads — Cloudflare R2
`POST /admin/uploads` (images ≤ 8 MB) and `/admin/uploads/video` → `{ url }`. Needs the R2 bucket and keys.

### 4.3 Hearts and reviews — signed in only
`POST / DELETE /properties/:id/reaction`, `GET / POST /properties/:id/reviews` (name and photo from the account),
admin moderation. The heart is the only like: there is **no** `/me/favourites`.

### 4.4 Free listings and Messages
`POST /listings` (signed in), `/admin/listings…`; the public enquiry / callback / contact forms and
`/admin/messages…` with unread counts.

### 4.5 Site content
Articles, team, testimonials, videos, `GET /site` (stats, featured districts with live counts, contact,
services, dropdown options) and their admin `PUT`s.

---

## 5. Decisions already made

- **Auth tokens**: access token in the JSON body, kept in memory, sent as `Authorization: Bearer`; refresh
  token in an httpOnly, SameSite=Strict cookie. (This replaced the older "cookie-only" plan.)
- **Register is members-only**; exactly one ADMIN, created by the seed, with 2FA required.
- **Hearts, reviews and free listings need a signed-in user**; the three other forms stay public, rate-limited.
- **NB ID** is given by the admin (NBS for sale, NBL for rent, separate sequences); the database `id` is separate, automatic and never shown.
- **Maps**: Leaflet + OpenStreetMap tiles. Per property the admin picks an approximate ~500 m area (default) or
  the exact point; the exact point stays admin-only otherwise.
- **Deploy same-site** (`domain.com` + `/api`, or `api.domain.com`), so the SameSite cookie works.

---

## 6. Not your job

Listed so nobody builds it twice. All frontend: the API client layer under `apps/web/src/api/`,
loading and error states (no screen has them yet), adopting `react-router` so URLs exist, and
splitting the 2,700-line `App.tsx`.

---

## 7. Backend change log

Newest first, one line each. Append only.

- **2026-10-06 · saksham · QA audit fixes (B1-B5).** Long `q` cut to 100 (no more 500), stray validation errors → 400,
  free-listing photos must come from `/listings/uploads`, JSON 404 for unknown `/api/v1/*`, seeded admin email-verified,
  API.md refresh/logout body. Frontend to-do F1-F4 and endpoint changes: `FRONTEND_CLAUDE.md` §0.0. Still owed by the
  backend: the videos endpoints (F3).
- **2026-09-30 · saksham · Property endpoints.** Public list / detail / related, admin CRUD + restore + next-ref. Media stored as strings for now.

- **2026-09-30 · saksham · Content schema complete + map privacy.** Migrations `20260930120000`,
  `20260930140000`, `20260930160000`: NB ID, text dropdown values, R-A-P-D, floor plan JSON, Message,
  ListingSubmission, Testimonial, Video, SiteSetting, signed-in reviews / listings, location mode. Frontend:
  approximate-location maps, `propId` → `nbId`, login prompts. Details: `FRONTEND_CLAUDE.md` §13.
- **2026-09-24 → 26 · saksham · Auth completed.** 2FA, Google sign-in, email verification, Gmail reset links,
  rate limits, audit log, RLS (see `backend-realstate/CLAUDE.md`).

- **2026-09-22 · frontend · Hardened the auth API.** Seven operational fixes on
  `feat/monorepo-and-auth-hardening`, listed in §3. Needs saksham's review.
- **2026-09-22 · saksham · Auth API.** Register, login, refresh, logout, me. Prisma schema,
  init migration, seed. Bcrypt 12, rotating refresh tokens, jose JWT.
