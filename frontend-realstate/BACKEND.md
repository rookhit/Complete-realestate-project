# BACKEND.md

**Written for saksham.** This is the backend work log and task list: what exists, what changed
in your code and why, and what the frontend is currently blocked on.

### Which file is which

| File | Owner | What it is |
|---|---|---|
| `CLAUDE.md` (root) | Both | The **contract**. Data shapes, endpoint specs, auth rules. The spec. |
| **`BACKEND.md`** (this) | **Backend** | The **status**. What is built, what is next, what is blocking. |
| `apps/api/API.md` | Backend | Your reference docs for the endpoints you shipped |
| `apps/api/CLAUDE.md` | Backend | Your own project instructions for `apps/api` |

Rule of thumb: **`CLAUDE.md` says what it should be. This file says where we are.** When you
finish something, tick it here and update the matching section of `CLAUDE.md` in the same commit.

---

## 1. Where we are

| | Status |
|---|---|
| **Auth API** | Built and hardened. Register, login, refresh, logout, me |
| **Database** | Postgres on Supabase. `User`, `RefreshToken`, `RateLimit`. Two migrations |
| **Everything else** | Not started. No properties, articles, leads, uploads, favourites, videos |
| **Frontend** | Feature-complete as a prototype, wired to **nothing**. Still reads hardcoded arrays |

The frontend makes **zero network calls today**. Nothing breaks when the API is down, and nothing
improves when it is up, until we write the client layer. That is frontend work and is not
blocking you.

---

## 2. Running it

```bash
npm run install:all     # from the repo root
npm run dev:api         # http://localhost:3000
npm run dev:web         # http://localhost:5173
```

`apps/api` needs a `.env`. Copy `apps/api/.env.example` and fill it in.

> **The `.env` currently in the repo folder is throwaway.** It holds dummy values that only exist
> so `next build` could run during review. Replace `DATABASE_URL`, `DIRECT_URL` and
> `JWT_ACCESS_SECRET` with real ones. It is git-ignored, so it never left this machine.

Two variables are **fail-closed on purpose** — the app refuses to start without them:

- `JWT_ACCESS_SECRET` — 32+ characters. Generate with `openssl rand -base64 48`.
- `FRONTEND_ORIGIN` — the browser origin allowed to call the API. This is the cross-site request
  forgery defence, so it must never be optional.

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
npm run db:seed
```

---

## 3. Changes made to your code — please review

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

## 4. What the frontend is blocked on

Ranked. The top two have shipped UI with nowhere to send data.

### 4.1 `POST /uploads` — blocking

Free Listing now accepts multiple photos with previews, a cover image, removal, and 8 MB and
count limits. It has nowhere to send them.

```
POST /uploads          multipart/form-data, field "files" (repeatable)
  -> { data: { files: [{ id, url, width, height, bytes }] } }
```

Needs: object storage (Supabase Storage is already there), a size and MIME allowlist, and a
limit on how many an unauthenticated caller can push.

### 4.2 `POST /auth/forgot-password` and `/auth/reset-password` — blocking

The UI ships. Enter an email, get "check your inbox", link expires in one hour.

```
POST /auth/forgot-password   { email }            -> 204 ALWAYS, even if unknown
POST /auth/reset-password    { token, password }  -> 204
```

Always return 204 on forgot-password. Anything else tells an attacker which emails have accounts.
Needs an email provider — Resend, Postmark or SES. That is a product decision, not just a
technical one.

### 4.3 Properties — the big one

Everything on the site is a property. Shape is in `CLAUDE.md` §6, query parameters in §7.2.

```
GET /properties            filtered + paginated
GET /properties/:id        full detail + gallery
GET /properties/:id/related
```

Three things that will bite:

- **`district` is an exact-match filter key** and there are now **77 canonical spellings** in
  `apps/web/src/app/data/districts.ts`. Send "Kathmandu ", with a trailing space, and the filter
  silently returns nothing. Normalise server-side. Note Nawalparasi splits into **Nawalpur** and
  **Parasi**, and Rukum into **Rukum East** and **Rukum West**.
- **`price` and `priceNum` are both needed.** One is the display string ("NPR 8.5 Cr"), one is the
  integer rupees we sort and filter on.
- **`"—"` as a "not applicable" value** is what the UI expects today. `null` would be cleaner;
  say so in `CLAUDE.md` §12 and we will adapt the renderers.

### 4.4 Lead capture — four forms, all currently fake

```
POST /enquiries   { propertyId, name, email, phone, message }
POST /callbacks   { name, phone, preferredTime }
POST /contact     { name, email, phone, interest, message }
POST /listings    { propertyTitle, contactName, contactPhone, ..., imageIds[] }
```

All four are **public and unauthenticated**. They need rate limiting (the limiter already exists,
reuse it), a honeypot or captcha, and server-side validation that does not trust the client.

### 4.5 Content and the rest

```
GET /districts/featured   { name, propertyCount, imageUrl }[]   — 3 to 5 only, see §7.3
GET /videos               company films — sources[] is what makes quality switching work
GET /articles, /articles/:slug, /testimonials, /reference
GET/PUT/DELETE /me/favourites/:propertyId
```

`propertyCount` on a district tile must match what `GET /properties?district=X` actually returns.
The hardcoded values currently claim 24 where the data holds 5 — one click exposes it.

---

## 5. Decisions already made

- **Cookie-only auth wins.** Your scheme, not the one originally written in `CLAUDE.md` §8. No
  token in any response body; both live in `httpOnly` cookies. It is safer, because an in-memory
  token is readable by any cross-site-scripting bug. The frontend will use
  `credentials: "include"` and no `Authorization` header.
- **Register is members-only.** Agency and agent sign-up was removed from the frontend, so your
  `{ email, password, name }` schema now matches. Only `phone` is collected and unstored.
- **Deploy same-site.** One origin with `/api` proxied, or `api.domain.com` beside `domain.com`.
  Then `SameSite` cookies work, no CORS runs, and no `SameSite=None` downgrade is needed.
  Splitting across unrelated domains forces `SameSite=None`, which switches off the browser's own
  forgery protection and leaves `FRONTEND_ORIGIN` as the only defence.

---

## 6. Not your job

Listed so nobody builds it twice. All frontend: the API client layer under `apps/web/src/api/`,
loading and error states (no screen has them yet), adopting `react-router` so URLs exist, and
splitting the 2,700-line `App.tsx`.

---

## 7. Backend change log

Newest first, one line each. Append only.

- **2026-09-22 · frontend · Hardened the auth API.** Seven operational fixes on
  `feat/monorepo-and-auth-hardening`, listed in §3. Needs saksham's review.
- **2026-09-22 · saksham · Auth API.** Register, login, refresh, logout, me. Prisma schema,
  init migration, seed. Bcrypt 12, rotating refresh tokens, jose JWT.
