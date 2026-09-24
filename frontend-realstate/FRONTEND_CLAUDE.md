# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Read this before touching anything.** This is the single source of truth shared between the
> frontend owner and the backend owner. It is a *contract*, not a description. If you change how
> the two halves talk to each other, you change this file in the same commit.
>
> **Doing backend work? Start with [BACKEND.md](BACKEND.md) instead.** This file is the spec —
> what the shapes and rules should be. That one is the status — what is built, what changed in
> apps/api and why, and what the frontend is blocked on. Read that first, come back here for detail.

---

## 1. What this project is, in one paragraph

**Nepal Bhoomi** is a luxury real-estate marketing site for the Nepalese market: property
listings for sale and rent, a property detail page, an EMI (home-loan) calculator, an editorial
blog, and a set of lead-capture forms. It was exported from **Figma Make** as a static React
prototype and then hardened by hand. The frontend still holds every property, article and
testimonial as a JavaScript constant and makes **no network call of any kind**. A real API now
exists alongside it under `apps/api` — Next.js, Prisma and Postgres, currently covering
authentication only. The remaining work is to replace those frontend constants with calls to it.

---

## 2. Current state — read this twice

| Thing | Status |
|---|---|
| Backend | **Exists** — `apps/api`, Next.js 15 App Router. Auth endpoints only so far |
| Database | **Exists** — Postgres on Supabase via Prisma. Models: User, RefreshToken, RateLimit |
| Network calls | Still zero **from the frontend**. No `fetch`, no API client in `apps/web` yet |
| Auth | Real on the backend (bcrypt, rotating refresh tokens). Still fake in the frontend UI |
| Data | Hardcoded arrays in `apps/web/src/app/App.tsx` |
| Images | Hotlinked from Unsplash + one local PNG logo |
| TypeScript in `apps/api` | **Checked.** `next build` runs tsc. Only `apps/web` is unchecked |
| Routing | Hand-rolled. A `page` string in React state. **The URL never changes** |
| Tests | None |
| TypeScript in `apps/web` | **Types are written but never checked.** No `tsconfig.json` there, TypeScript is not installed. Vite strips types with esbuild and never validates them |
| Linting / formatting | Configured in `apps/api` only |

The whole **frontend** is still one 1,927-line file: `apps/web/src/app/App.tsx`. That single
fact is the biggest practical risk to two people working at once. See §10.

---

## 3. Commands

Run everything from the repository root. The two apps are independent; the root scripts delegate.

```bash
npm run install:all   # installs apps/web and apps/api

npm run dev:web       # Vite      -> http://localhost:5173
npm run dev:api       # Next.js   -> http://localhost:3000

npm run build:web
npm run build:api     # also runs tsc over apps/api
npm run lint:api
```

`apps/api` additionally needs a `.env` (copy `apps/api/.env.example`) and a database:

```bash
cd apps/api
npx prisma migrate deploy   # apply migrations
npx prisma generate         # regenerate the client after a schema change
npm run db:seed
```

**They are deliberately not npm workspaces.** Vite/React 18 and Next.js 15 each pin their own
React tree; hoisting them into one `node_modules` invites version skew. Each app keeps its own
`package.json`, lockfile and `node_modules`.

`apps/web` still has no `test`, `lint`, `typecheck` or `format` script, and its types are never
checked. `apps/api` is typechecked by `next build` and linted by ESLint.

**Recommended next improvement for `apps/web`** (not yet done, agree before adding):

```bash
npm --prefix apps/web i -D typescript
# then add to apps/web/package.json:  "typecheck": "tsc --noEmit"
```

### Install gotchas

- Vite dev server logs a 404 for `/favicon.ico`. That is the browser asking on its own. Harmless.
- `apps/api` refuses to start without `JWT_ACCESS_SECRET` (32+ chars) and `FRONTEND_ORIGIN`.
  Both failures are deliberate: see §9.3.

*(Two earlier traps are fixed: `react`/`react-dom` were optional peer dependencies and are now
real dependencies, and the `pnpm-workspace.yaml` that pinned `os: linux` and broke pnpm on
Windows and macOS has been deleted.)*

---

## 4. Architecture

### 4.1 Repository shape

Two independent applications, deliberately **not** npm workspaces (see §3).

```
  nepal-bhoomi/
  ├── CLAUDE.md            ← this contract. Root, shared, both owners
  ├── package.json         ← delegating scripts only, no dependencies
  ├── apps/
  │   ├── web/             ← Vite + React 18 frontend        FRONTEND owns
  │   │   ├── src/app/App.tsx      the entire UI, one file
  │   │   └── src/styles/
  │   └── api/             ← Next.js 15 + Prisma + Postgres   BACKEND owns
  │       ├── app/api/auth/*       route handlers
  │       ├── lib/auth/*           jwt, cookies, password, refresh, guards
  │       ├── lib/origins.ts       CORS + forgery allowlist
  │       ├── lib/rate-limit.ts    Postgres-backed limiter
  │       ├── middleware.ts        CORS + preflight
  │       └── prisma/              schema, migrations, seed
  └── .claude/settings.json
```

### 4.2 The frontend, today

```
                         ┌──────────────────────────────────────────┐
  browser                │  apps/web/index.html                     │
                         │    └── src/main.tsx   createRoot(#root)  │
                         └────────────────────┬─────────────────────┘
                                              │
                         ┌────────────────────▼─────────────────────┐
                         │  src/app/App.tsx   ← THE ENTIRE UI       │
   ┌── state ────────────┤  page   : Page     (which screen)        │
   │                     │  selId  : number   (property id)         │
   │                     │  blogId : number   (article id)          │
   │                     │  nav    : NavOpts  (filters/anchor)      │
   │   go(page, opts) ───┤  sets all four, scrolls to top           │
   │                     │  <Navbar/> <AnimatePresence> <Footer/>   │
   │                     └────────────────────┬─────────────────────┘
   │                                          │ reads
   │                     ┌────────────────────▼─────────────────────┐
   └─────────────────────┤  MODULE-SCOPE CONSTANTS  (the "database")│
                         │  ALL_PROPS  BLOGS  TESTIMONIALS  FAVS    │
                         │  SERVICES_LIST  AREAS  PROP_TYPES        │
                         └──────────────────────────────────────────┘
            No fetch anywhere yet. Replacing these is the open work.
```

### 4.3 The backend, today

```
   Browser ──── credentialed fetch ────►  apps/api
      │         credentials:"include"        │
      │         (no Authorization header)    ▼
      │                            ┌──────────────────────┐
      │                            │ middleware.ts        │  CORS + preflight
      │                            └──────────┬───────────┘
      │                                       ▼
      │                            ┌──────────────────────┐
      │                            │ app/api/auth/*       │
      │                            │  guards: json type,  │
      │                            │  origin allowlist,   │
      │                            │  rate limit          │
      │                            └──────────┬───────────┘
      │                                       ▼
      │                            ┌──────────────────────┐
      │◄── Set-Cookie: httpOnly ───┤ lib/auth/*  bcrypt12 │
      │    access_token   15 min   │  jose HS256, rotate  │
      │    refresh_token   7 days  └──────────┬───────────┘
      │    path=/api/auth                     ▼
      │                            ┌──────────────────────┐
      │                            │ Prisma → Postgres    │
      │                            │ User RefreshToken    │
      │                            │ RateLimit            │
      │                            └──────────────────────┘
```

**The seam.** The frontend will only ever touch `apps/web/src/api/*` (to be written). The backend
only ever satisfies §7. Neither reaches across. That seam is what lets two people work at once.

**Deploy same-site.** Put the API under the same site as the frontend, ideally one origin with
`/api` proxied to `apps/api`, otherwise `api.domain.com` beside `domain.com`. Then `SameSite`
cookies work, no CORS runs, and no `SameSite=None` downgrade is needed. Splitting them across
unrelated domains forces `SameSite=None`, which switches off the browser's own forgery
protection and leaves `FRONTEND_ORIGIN` as the only defence.

---

## 5. Page list and routing

Routing is `apps/web/src/app/App.tsx` → `App()`. A `Page` string selects one component. **There is no
router, so there is no URL, no deep link, no shareable link, no browser back button, and nothing
for search engines to crawl.** Fixing this means adopting `react-router` (already a dependency,
currently unused) and is the single highest-value frontend change.

| `Page` value | Component | Notes for backend |
|---|---|---|
| `home` | `HomePage` | Composes 11 sections. Accepts `scrollTo` for anchor links |
| `buy` | `BuyRentPage listing="For Sale"` | Filter + list/grid/map |
| `rent` | `BuyRentPage listing="For Rent"` | Rent uses a different price scale |
| `hot` | `BuyRentPage` `preset:"hot"` | `badge==="Hot" \|\| featured` |
| `new-listings` | `BuyRentPage` `preset:"new"` | `badge==="New" \|\| badge==="Prime"` |
| `map` | `BuyRentPage` `view:"map"` | |
| `area` | `BuyRentPage` | Alias of `buy`. Nothing links to it |
| `property` | `PropertyDetailPage` | Driven by `selId` |
| `blog` | `BlogPage` | Index of 4 articles |
| `blog-post` | `BlogPostPage` | Driven by `blogId` |
| `about` | `AboutPage` | Static copy + team. No API |
| `services` | `ServicesPage` | Static. Could be CMS-driven |
| `emi` | `EMICalculator` | **Pure client-side maths. Needs no API** |
| `contact` | `ContactPage` | Lead form |
| `login` | `LoginPage` | See §8 |
| `register` | `RegisterPage` | See §8 |
| `free-listing` | `FreeListingPage` | Seller submits a property |
| `videos` | `HomePage scrollTo="videos"` | Anchor, not a real page |

The home page no longer has a search strip under the hero. It was removed as visual noise; the
filter bar on the results page does the same job. `SearchStrip` no longer exists.

### Navigation API

```ts
type Page = "home"|"buy"|"rent"|"property"|"hot"|"new-listings"|"about"|"blog"
          | "blog-post"|"services"|"emi"|"contact"|"login"|"register"
          | "free-listing"|"area"|"videos"|"map";

type NavOpts = {
  type?:     string;                      // property type filter
  district?: string;                      // district filter
  view?:     "list" | "grid" | "map";
  preset?:   "hot" | "new";
  scrollTo?: string;                      // element id on the home page
  blog?:     number;                      // article id
};

type Go = (p: Page, o?: NavOpts) => void;
```

`go()` is threaded down as a prop to nearly every component. When routing moves to react-router,
`go()` becomes a thin wrapper over `navigate()` and `NavOpts` becomes the query string. Keep the
signature — it is the frontend's internal navigation contract.

---

## 6. Data model — the shapes the API must produce

These are the literal TypeScript shapes the UI reads today. Treat them as the response contract
unless we agree otherwise in this file.

### `Prop` — a property (`apps/web/src/app/App.tsx`, `interface Prop`)

```ts
interface Prop {
  id:         number;        // 1..12 today. Use a stable id or uuid
  propId:     string;        // human reference, "NB-001". Shown on the listing row
  badge:      string;        // "Hot" | "Featured" | "New" | "Prime" | "Rare" | "Verified"
  title:      string;        // "The Patan Residence"
  tagline:    string;        // short subtitle. Currently rendered nowhere — dead field
  location:   string;        // "Jawlakhel, Lalitpur" — free text, shown under the title
  district:   string;        // MUST match one of AREAS exactly. This is the filter key
  price:      string;        // DISPLAY string: "NPR 8.5 Cr", "NPR 85,000/mo"
  priceNum:   number;        // SORT/FILTER value in rupees: 85000000, 85000
  listing:    "For Sale" | "For Rent";
  type:       string;        // MUST match PROP_TYPES exactly
  beds:       number;        // 0 means "not applicable" (land, commercial) and hides the row
  baths:      number;        // 0 means hidden
  builtArea:  string;        // "4,850 sq.ft" — or the literal em dash "—" to hide
  landArea:   string;        // "12 Ropani" — or "—" to hide
  roadAccess: string;        // "Black-topped 20ft"
  facing:     string;        // "North-East"
  buildYear:  number;        // 0 renders as "—"
  floors:     number;        // 0 renders as "—"
  verified:   boolean;
  featured:   boolean;
  hero:       string;        // absolute image URL
  gallery:    string[];      // absolute image URLs, >= 1. Index 0 is shown first
  description:string;
  features:   string[];      // amenity chips
  mapX:       number;        // 0-100, % position on a FAKE decorative grid
  mapY:       number;        // 0-100. NOT latitude/longitude
}
```

**Backend notes on this shape — please read.**

- `price` vs `priceNum` is duplicated on purpose today. **Send both.** Nepali price formatting
  (Crore / Lakh, and `/mo` for rent) is locale logic the frontend should not reinvent per call
  site. Better still, send `priceNum` + `currency` + `period` and let us format once — but that
  is a frontend change, so raise it here before assuming it.
- `"—"` (U+2014 EM DASH) as a magic "not applicable" value is fragile. Prefer `null` and we will
  adapt the renderers. **Agree this in §12 before changing it.**
- `mapX` / `mapY` are decorative percentages on an SVG grid, **not** real coordinates. When you
  add real geo, send `lat` / `lng` as separate fields and we will swap in a real map.
- `district` and `type` are **exact-match filter keys**. If the API sends "Kathmandu " with a
  trailing space, the filter silently returns nothing. Normalise server-side.
- `badge` drives a coloured chip. Unknown values render fine but will not be filterable.

### Other collections

```ts
// BLOGS
{ id:number; cat:string; date:string;   // "May 2025" — NOT a parseable date. Send ISO 8601
  read:string;                          // "6 min" — precomputed. Better: reading_minutes:number
  title:string; excerpt:string; image:string; author:string }

// TESTIMONIALS
{ name:string; role:string; rating:number /*1-5*/; text:string; img:string }

// SERVICES_LIST
{ icon:ReactNode;   // a lucide-react element, NOT serialisable. Send an icon NAME string
  title:string; desc:string }

// Reference data
AREAS       = all 77 districts, from apps/web/src/app/data/districts.ts
PROP_TYPES  = ["All Types","House/Bungalow","Land","Apartment","Commercial","Flat"]
PRICE_RANGES: Record<"For Sale"|"For Rent", {label,min,max}[]>
              // For Sale: Any / Under 5 Cr / 5-10 Cr / Above 10 Cr
              // For Rent: Any / Under 1 Lakh / 1-2 Lakh / Above 2 Lakh
```

`SERVICES_LIST.icon` holds a live React element. **It cannot come from JSON.** If services become
CMS-driven, the API sends `icon: "home" | "layers" | ...` and the frontend maps the name to a
lucide component.

### Districts — 77, and the spellings are the contract

`apps/web/src/app/data/districts.ts` is now the source of truth. It exports the districts grouped
by province, a flat alphabetical list, a province lookup, an alias table, and `searchDistricts()`
which backs the typeahead.

`district` is an **exact-match filter key**, so the API must send exactly these strings. The two
that trip people up: Nawalparasi is split into **Nawalpur** (east) and **Parasi** (west), and
Rukum into **Rukum East** and **Rukum West**. The alias table maps what users actually type
("pokhara", "kavre", "nawalparasi") onto the canonical name, but that is a frontend convenience —
it does not loosen what the API must return.

### Amenities — a canonical vocabulary now exists

`apps/web/src/app/icons/amenities.tsx` defines 22 canonical amenities in three groups (Main
Features, Rooms, Furnished), each with an icon. `features: string[]` on a property is unchanged,
but a string that matches a canonical name renders with its icon; anything else falls back to the
old gold dot. The seeded properties now carry a mix of both.

**For the API:** send canonical names where they apply. A dedicated `amenities: string[]` field
separate from free-text `features` would be cleaner — raise it in §12 if you want to split them.

---

## 7. Proposed API contract

**Nothing here is built yet. This is the proposal — amend it in this file, then implement.**

- Base URL: `/api/v1`, injected as `VITE_API_BASE_URL` (see §9.3)
- Content type: `application/json; charset=utf-8`
- Dates: ISO 8601 UTC (`2025-05-14T09:00:00Z`)
- Money: **integer rupees**, never floats
- All list endpoints are paginated, even when small today

### 7.1 Envelope

```jsonc
// success
{ "data": <payload>, "meta": { "page":1, "limit":20, "total":12, "totalPages":1 } }

// error — always this shape, any status >= 400
{ "error": { "code": "VALIDATION_FAILED",
             "message": "Human readable, safe to display",
             "fields": { "email": "Enter a valid email address" },
             "requestId": "req_01H..." } }
```

Stable `error.code` values the frontend will branch on:
`VALIDATION_FAILED` · `UNAUTHENTICATED` · `FORBIDDEN` · `NOT_FOUND` · `RATE_LIMITED` ·
`CONFLICT` · `INTERNAL`.

### 7.2 Properties

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/properties` | Filtered, paginated list |
| `GET` | `/properties/:id` | One property, full detail + gallery |
| `GET` | `/properties/:id/related` | 3 similar, same `listing` |

`GET /properties` query parameters — these map 1:1 onto the filter UI in `BuyRentPage`:

| Param | Type | Source in UI |
|---|---|---|
| `listing` | `for-sale` \| `for-rent` | Page (`buy` / `rent`) |
| `type` | one of `PROP_TYPES` minus "All Types" | Type pill / nav submenu |
| `district` | one of `AREAS` | District pill / home search / district tile |
| `minPrice` / `maxPrice` | integer rupees | Price range panel |
| `preset` | `hot` \| `new` | Footer links |
| `q` | string | Home search strip (free text location) |
| `sort` | `newest` \| `price_asc` \| `price_desc` | **Not in the UI yet** |
| `page` / `limit` | integer, default 1 / 20 | Pagination is **not in the UI yet** |

> The UI currently filters the full array client-side and renders every match with no paging.
> Once the API paginates, the frontend needs a pagination control. That is frontend work — file
> it in §12 rather than silently returning everything.

### 7.3 Content

| Method | Path | Notes |
|---|---|---|
| `GET` | `/articles` | Blog index. Support `?limit=` for the home page's 4 |
| `GET` | `/articles/:slug` | **Prefer a slug over the numeric id** — needed for SEO later |
| `GET` | `/testimonials` | |
| `GET` | `/services` | Only if these become editable |
| `GET` | `/reference` | `{ districts, propertyTypes, priceRanges }` in one call |
| `GET` | `/districts/featured` | The home page district strip: `{ name, propertyCount, imageUrl }[]` |
| `GET` | `/videos` | Company films for the home carousel. **Not built** — see below |

**How many featured districts to return.** The home strip sizes itself: each tile
is `100 / n` percent wide and its height follows that same share, clamped
between 340px and 520px. Measured at a 1440px viewport:

| Districts | Tile | Row |
|---|---|---|
| 3 | 480 × 480 | fits |
| 4 | 360 × 360 | fits |
| 5 | 288 × 340 | fits exactly |
| 6 | 280 × 340 | overflows to horizontal scroll |

So **three to five is the safe range**. At six the row overflows and only a 40px
sliver of the last tile is visible, and the scrollbar is hidden by design, so
mouse users cannot easily reach the rest. If the admin needs more than five,
the strip needs scroll arrows first — the Hot Properties and Video sections
already have that control to copy. Raise it in §12 before shipping more than
five.

`propertyCount` is shown on the tile and must match what
`GET /properties?district=<name>` actually returns, or the tile advertises 24
and the results page shows 2. The current hardcoded counts do exactly that.

### Company videos — shape the player already expects

```ts
type CompanyVideo = {
  id: number;
  title: string;            // the only text on the card; there is no location line
  poster: string;           // image URL
  duration: string;         // "2:34", display only
  sources?: { label: string; src: string; type?: string }[];  // highest first
  youtubeId?: string;       // alternative to sources; YouTube handles its own controls
  captions?: { start: string; end: string; text: string }[];  // becomes a WebVTT track
};
```

**`sources` is what makes the quality menu real.** One entry and the menu says so; several and it
switches renditions, preserving playback position. Order them highest quality first.

Serve video with CORS **or** from the same origin. The player deliberately does not set
`crossOrigin`, because a host that sends no `Access-Control-Allow-Origin` fails the load
outright when it is set. Captions are built client-side into a `blob:` URL, so they are always
same-origin and never need CORS.

Current entries point at test-videos.co.uk placeholders until the real films exist.

### 7.4 Auth — BUILT, and the scheme changed

Base path is `/api/auth`, **not** `/api/v1/auth`. Nothing is versioned yet.

> **The token scheme in §8 was superseded.** We documented an access token returned in the JSON
> body and held in frontend memory. What shipped returns **no token in any response body, ever**:
> both tokens are `httpOnly` cookies the browser stores and replays by itself.
>
> **The shipped scheme wins.** An in-memory token is readable by any cross-site-scripting bug on
> the page; an `httpOnly` cookie is not. The tradeoff is cross-site request forgery, which is
> answered by `SameSite` plus the origin allowlist in `lib/origins.ts`.
>
> Consequence for the frontend: **no `Authorization` header**. Every call needs
> `credentials: "include"`, and "am I logged in?" is answered by calling `/api/auth/me` and
> checking for 200 versus 401, never by reading a cookie from JavaScript.

| Method | Path | Body | Returns | Status |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | `{ email, password, name? }` | `{ user }` + 2 cookies | Built |
| `POST` | `/api/auth/login` | `{ email, password }` | `{ user }` + 2 cookies | Built |
| `POST` | `/api/auth/refresh` | — (cookie) | `{ ok: true }` + rotated cookies | Built |
| `POST` | `/api/auth/logout` | — | `{ ok: true }`, cookies cleared | Built |
| `GET` | `/api/auth/me` | — | `{ id, email, name, role }` | Built |
| `POST` | `/api/auth/forgot-password` | `{ email }` | `204` always | **Not built** |
| `POST` | `/api/auth/reset-password` | `{ token, password }` | `204` | **Not built** |

Cookies set on register, login and refresh:

| Cookie | Sent to | Lifetime | Contents |
|---|---|---|---|
| `access_token` | every path | 15 minutes | signed JWT (HS256, issuer and audience checked) |
| `refresh_token` | `/api/auth` only | 7 days | 32 random bytes; only its SHA-256 hash is stored |

**Rate limits.** `429` with a `Retry-After` header. Login 10 per IP and 5 per account per 15
minutes; register 5 per IP per hour; refresh 60 per IP per 15 minutes. Counters live in the
`RateLimit` table, not process memory, because serverless instances share nothing.

**Refresh rotation.** Every refresh revokes the old token and issues a new one. Presenting an
already-revoked token is treated as evidence of theft and revokes **every** session for that
user, forcing a fresh login the thief cannot complete.

**Not yet aligned with the frontend.** `apps/web` collects Full Name, Phone, Confirm Password and
an account type of member, agency or agent with Agency Name and Licence Number. The backend
stores only `email`, `password`, `name` and a `USER`/`ADMIN` role. The agent-approval path §8.3
called a fraud vector does not exist. See §12.

### 7.4b Google sign-in — BUILT on `feat/be-google-auth` (backend section)

> **Different backend from the §7.4 description above.** §7.4 describes `apps/api` on
> `feat/monorepo-and-auth-hardening`. The branch `feat/be-google-auth` carries saksham's current
> backend in `backend-realstate/` (and a copy of this frontend in `frontend-realstate/`). That
> backend uses base path **`/api/v1/auth`**, returns the access token in the JSON body (held in
> memory, sent as `Authorization: Bearer`), keeps the refresh token in an httpOnly cookie on path
> `/api/v1/auth`, and already has forgot/reset-password. The two backends must be reconciled —
> see §12.

| Method | Path | Called by | Result |
|---|---|---|---|
| `GET` | `/api/v1/auth/google` | Browser navigation (not `fetch`) | `303` to Google with `state` + PKCE (S256) |
| `GET` | `/api/v1/auth/google/callback` | Google | Sets the refresh cookie, `303` to `FRONTEND_ORIGIN/?auth=google`; on any failure `303` to `FRONTEND_ORIGIN/?auth_error=google` |

Flow: the "Continue with Google" button on `LoginPage` navigates to `/api/v1/auth/google`. After
Google, the backend verifies `state`, exchanges the code, verifies Google's ID token (RS256,
Google issuer, `aud` = client id), requires `email_verified`, then finds the user by Google id,
else links by the same email, else creates a `USER` / `MEMBER` with no password. The frontend,
seeing `?auth=google`, calls `POST /api/v1/auth/refresh` (`credentials: "include"`) for an access
token and then `GET /api/v1/auth/me`. **No token ever appears in a URL.** The single admin cannot
sign in with Google. Each login is recorded in a new `OAuthAccount` table (provider, Google id,
email, email-verified, name, picture URL, first/last login); Google's own tokens are not stored.
`User.passwordHash` is now nullable; password login against a Google-only account returns the
normal generic 401.

### 7.5 Leads — four forms exist today, all currently fake

| Method | Path | Fired by |
|---|---|---|
| `POST` | `/enquiries` | Property detail sidebar. Include `propertyId` |
| `POST` | `/callbacks` | Home "Let Us Call You" |
| `POST` | `/contact` | Contact page |
| `POST` | `/listings` | Free Listing page (seller submission) |

All four are **public, unauthenticated and spam-exposed.** They need rate limiting, a honeypot or
captcha, and server-side validation that does not trust the client.

### 7.6 Authenticated user

| Method | Path | Notes |
|---|---|---|
| `GET` | `/me/favourites` | Saved properties |
| `PUT` | `/me/favourites/:propertyId` | Idempotent save |
| `DELETE` | `/me/favourites/:propertyId` | |
| `POST` | `/uploads` | Multipart. **Free Listing has no image upload yet** — a real gap |
| `POST` | `/concierge/messages` | The floating chat. Canned reply today |

---

## 8. Login and authentication — full detail

### 8.1 What exists

> **This section describes the FRONTEND only.** A real backend now exists — see §7.4 for what
> actually ships, including the cookie-only token scheme that supersedes §8.2. The UI below has
> not been wired to it yet.

`LoginPage` in `apps/web/src/app/App.tsx`. It is a **visual prototype with no security
whatsoever.**

```ts
const [email, setEmail] = useState("");
const [pw,    setPw]    = useState("");
const [err,   setErr]   = useState("");     // string, "" = no error
const [done,  setDone]  = useState(false);  // true = show success panel

const submit = () => {
  if (!email.trim() || !pw.trim())            { setErr("Please enter your email and password."); return; }
  if (!/^\S+@\S+\.\S+$/.test(email.trim()))   { setErr("Please enter a valid email address."); return; }
  setErr(""); setDone(true);                  // <-- that is the whole "login"
};
```

Behaviour:

- Fields: **Email Address** (`type=email`) and **Password** (`type=password`). Enter submits.
- Validation is client-side only: non-empty, then a loose email regex.
- On success it swaps the card for a "Welcome back / You are signed in as {email}" panel with a
  "Continue Browsing" button back to `home`.
- **No password is ever checked. Any email plus any non-empty password succeeds.**
- Nothing is persisted. Refresh the page and you are logged out.
- There is no logged-in state anywhere else. The navbar still shows Login / Register. Nothing is
  gated. There is no logout.

### 8.2 What is missing — the backend + frontend job

| Gap | Owner |
|---|---|
| Real credential check, password hashing (argon2id or bcrypt ≥12) | Backend |
| Token issuing: short-lived access token + httpOnly `SameSite=Lax` refresh cookie | Backend |
| Rate limiting and lockout on repeated failures | Backend |
| Generic "Invalid email or password" — never reveal which was wrong | Backend |
| Forgot password / reset — **UI now exists; the endpoints do not** | Backend |
| Email verification | Both |
| Auth context + protected routes + logout in the navbar | Frontend |
| Persisting the session across reloads | Frontend |
| 401 handling: refresh once, then bounce to login | Frontend |

**Token storage.** Do not put the refresh token in `localStorage`. Access token in memory,
refresh token in an httpOnly cookie, silent refresh on 401. Agree the exact scheme in §12 before
either side builds it.

### 8.2b Target auth flow

```
  LoginPage        api/auth.ts        api/client.ts             API
     │                  │                   │                    │
     │ submit(email,pw) │                   │                    │
     ├─────────────────►│ POST /auth/login  │                    │
     │                  ├──────────────────►├───────────────────►│ verify hash
     │                  │                   │                    │ issue tokens
     │                  │                   │◄───────────────────┤ 200 {user, accessToken}
     │                  │                   │   Set-Cookie: refresh (httpOnly)
     │                  │◄──────────────────┤
     │  {user}          │  accessToken -> in-memory store
     │◄─────────────────┤
     │ AuthContext.setUser(user) -> navbar swaps to "My Account / Logout"
     │
     ─── later: any authenticated call ───────────────────────────────
     │                  │                   │  Authorization: Bearer <access>
     │                  │                   ├───────────────────►│
     │                  │                   │◄───────────────────┤ 401 UNAUTHENTICATED
     │                  │                   │ POST /auth/refresh │   (cookie sent)
     │                  │                   ├───────────────────►│
     │                  │                   │◄───────────────────┤ 200 {accessToken}
     │                  │                   │ retry original request ONCE
     │                  │                   │ still 401 -> clear user, go("login")
```

Rules that fall out of this and must hold on both sides:

- Retry the refresh **once**. A refresh loop on a dead session is the classic way to DDoS your
  own login endpoint.
- The refresh cookie is the only long-lived credential, and JavaScript must never read it.
- `POST /auth/logout` must invalidate the refresh token server-side, not just clear the cookie.

### 8.3 Register

`RegisterPage`. **Members only.** Agency and agent sign-up were removed on 2026-09-23: they
implied a licence-verification and approval flow neither side had built, and an unverified
"agent" listing property is a fraud vector.

Fields: **Full Name, Email, Phone, Password, Confirm Password**. Both password fields have a
show/hide eye. Client validation: all non-empty, loose email regex, at least 8 characters,
passwords must match.

**This resolves the mismatch in §12.** The frontend form and the backend's
`{ email, password, name }` now agree, apart from `phone`, which the frontend collects and the
backend does not yet store.

Backend must still enforce: password strength, unique email, and Nepal `+977` phone format.

### 8.4 Other form payloads

```
POST /enquiries   { propertyId, name*, email, phone, message }
                  // client requires name AND (email OR phone)

POST /callbacks   { name*, phone*, preferredTime }
                  // preferredTime ∈ "Morning (9am-12pm)" | "Afternoon (12pm-4pm)" | "Evening (4pm-6pm)"

POST /contact     { name*, email*, phone, interest, message }
                  // interest ∈ "General Enquiry" | "Buy Property" | "Rent Property"
                  //            | "Investment Advisory" | "Free Listing"

POST /listings    { propertyTitle*, contactName*, contactPhone*, contactEmail,
                    price, builtArea, landArea, buildYear,
                    propertyType, listingType, district, description }
                  // * = enforced client-side today. Re-validate everything server-side.
                  // NOTE: no image upload field exists yet.
```

---

## 9. Frontend internals a backend dev needs

### 9.1 Data-calling variables — the exact swap list

These module-scope constants in `apps/web/src/app/App.tsx` **are** the current data layer. Each one is the
insertion point for an API call.

| Variable | Line | Read by | Replace with |
|---|---|---|---|
| `ALL_PROPS: Prop[]` | 57 | Nearly every section | `GET /properties`, `GET /properties/:id` |
| `BLOGS` | 168 | `BlogSection`, `BlogPage`, `BlogPostPage` | `GET /articles` |
| `TESTIMONIALS` | 183 | `TestimonialsSection` | `GET /testimonials` |
| `AREAS` | 189 | District filters, Free Listing dropdown | `GET /reference` |
| `PROP_TYPES` | 190 | Type filters, Free Listing dropdown | `GET /reference` |
| `PRICE_RANGES` | 191 | Price panel | `GET /reference` |
| `SERVICES_LIST` | 205 | `ServicesSectionHome`, `ServicesPage`, `AboutPage` | `GET /services` (icon by name) |
| `FAVS: Set<number>` | 474 | `FavButton` | `GET/PUT/DELETE /me/favourites` |

Line numbers drift with every edit. The **variable names** are the reliable anchor — grep for
them rather than trusting the numbers.

`FAVS` deserves a warning: it is a **module-level mutable `Set`**, not React state. It survives
navigation but not reload, and it is shared by every `FavButton` instance. It exists so hearts
look alive. Replace it with real persistence, not more of the same.

Also note `img(id, w, h)` at line 42 — a helper that builds Unsplash URLs. Every property photo
in the app is a hotlinked Unsplash image. Real listings need real media storage plus responsive
sizes.

### 9.2 Where to put the API layer

```
apps/web/src/
  api/
    client.ts        # fetch wrapper: base URL, auth header, refresh-on-401, error envelope
    properties.ts    # listProperties(filters), getProperty(id), getRelated(id)
    articles.ts
    auth.ts
    leads.ts
  hooks/
    useProperties.ts # loading / error / data, debounced filters
    useAuth.ts
```

Every call goes through `client.ts`. No component calls `fetch` directly.

Worked example — what a filtered search looks like end to end once wired:

```
  user clicks "Land" pill in BuyRentPage
        │
        ▼
  setTypeF("Land")                          ← local filter state
        │
        ▼
  useProperties({ listing:"For Sale", type:"Land", district, minPrice, maxPrice, preset })
        │  debounce 250ms, abort the in-flight request on change
        ▼
  api/properties.ts  listProperties(filters)
        │
        ▼
  api/client.ts  GET {VITE_API_BASE_URL}/properties
                     ?listing=for-sale&type=Land&page=1&limit=20
        │  Authorization: Bearer <access>   (omitted when signed out)
        ▼
  API ──► { data: Property[], meta: { total, page, limit, totalPages } }
        │
        ▼
  hook returns { data, isLoading, error }
        │
        ├─ isLoading ──► skeleton rows            ← DOES NOT EXIST YET
        ├─ error     ──► retry panel              ← DOES NOT EXIST YET
        └─ data      ──► <PropertyCard/> list / grid / MapView
```

**There are no loading or error states anywhere in the UI today** because data is synchronous.
Every screen will need a skeleton and an error path. That is frontend work; do not let it block
the API.

### 9.3 Environment variables

**`apps/web`** has none yet. Vite only exposes variables prefixed `VITE_`. When the API client is
written, create `apps/web/.env.local` (git-ignored):

```
VITE_API_BASE_URL=http://localhost:3000/api
```

> **Anything prefixed `VITE_` is compiled into the public bundle.** Never put a secret, private
> key or database URL behind that prefix.

**`apps/api`** — full contract in `apps/api/.env.example`. Two of these are fail-closed on
purpose: the app refuses to start rather than run without them.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Pooled connection (Supabase port 6543) used by the app |
| `DIRECT_URL` | yes | Direct connection (port 5432) used only by migrations |
| `JWT_ACCESS_SECRET` | yes | 32+ chars. **Throws at startup if missing or short** |
| `FRONTEND_ORIGIN` | yes | Comma-separated allowed origins. **Throws at startup if missing** |
| `ALLOW_ANY_ORIGIN` | no | `true` disables the allowlist. Local tooling only, never deployed |
| `COOKIE_INSECURE` | no | `true` drops the Secure flag. Local http:// only |
| `COOKIE_SAMESITE` | no | `lax` (default), `strict`, or `none`. See §4.3 before using `none` |

**Added on `feat/be-google-auth` (§7.4b).** Frontend (`frontend-realstate/.env.local`):
`VITE_API_URL` — backend origin, defaults to `http://localhost:3000`. Backend
(`backend-realstate/.env`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
(must exactly match the redirect URI registered in Google Cloud Console, e.g.
`http://localhost:3000/api/v1/auth/google/callback`), and `FRONTEND_ORIGIN`, which Google login
requires for the redirect back. The Google variables are read lazily, so the rest of the API
starts without them.

### 9.4 CORS

Implemented in `apps/api/middleware.ts`, matching `/api/:path*`. It echoes the caller's origin
when the origin is on the allowlist, sets `Access-Control-Allow-Credentials: true`, adds
`Vary: Origin`, and answers the `OPTIONS` preflight. The wildcard `*` is never used, because
browsers reject it whenever credentials are involved.

Do not confuse the two mechanisms. `FRONTEND_ORIGIN` **rejects** bad origins, which is the
forgery defence. CORS headers **permit** the browser to read a response. Both are needed for a
split-origin deployment; neither is needed if you deploy same-site, which is the recommendation
in §4.3.

### 9.5 Component props reference

`go: Go` and `setId: (id:number)=>void` are threaded down from `App`. `setId` only sets the
selected property id; the child is responsible for calling `go("property")` afterwards.

| Component | Props |
|---|---|
| `Navbar` | `{ page: Page; go: Go }` |
| `Footer` | `{ go: Go }` |
| `HomePage` | `{ go, setId, scrollTo?: string }` |
| `HeroSection` | `{ go, setId }` |
| `HotPropertiesSection` | `{ go, setId }` |
| `NewListingsSection` | `{ go, setId }` |
| `LocationStripsSection` | `{ go }` |
| `VideoSection` | none — company films, self-contained. Renders `id="videos"` anchor |
| `VideoPlayer` | `{ video: CompanyVideo; onClose }` — in-page player, not a route |
| `CallbackForm` | `{ onClose? }` — shared by the home section and the Quick Enquiry popup |
| `QuickEnquiryFloat` | none — replaced `AIChatFloat` |
| `PasswordInput` | `{ value, onChange, placeholder?, onEnter?, autoComplete? }` |
| `DistrictCombobox` | `{ value, onChange, placeholder?, dark? }` — typeahead over all 77 |
| `ImageUpload` | `{ images: PickedImage[]; onChange; max? }` — multi-file, drag and drop |
| `TestimonialsSection` | none |
| `BlogSection` | `{ go }` |
| `ServicesSectionHome` | `{ go }` |
| `StatisticsSection` | none — hardcoded counters |
| `CallbackSection` | none |
| `BuyRentPage` | `{ listing: "For Sale"\|"For Rent"; go; setId; nav?: NavOpts }` |
| `MapView` | `{ props: Prop[]; go; setId }` |
| `PropertyCard` | `{ p: Prop; go; setId; light?: boolean }` — `light` = light background variant |
| `FavButton` | `{ id: number; light?: boolean }` |
| `PropertyDetailPage` | `{ propId: number; go; setId }` |
| `BlogPage` | `{ go }` |
| `BlogPostPage` | `{ id: number; go }` |
| `AboutPage` | `{ go }` |
| `ServicesPage` | `{ go }` |
| `LoginPage` / `RegisterPage` | `{ go }` |
| `ContactPage` / `FreeListingPage` / `EMICalculator` | none |
| `LoadingScreen` | `{ onDone: () => void }` — 2.6s splash |
| `WhatsAppFloat` | none |

### 9.6 Styling conventions — do not fight these

- Colours are **constants at the top of `App.tsx`**: `MAROON #8a2030`, `GOLD #b08848`,
  `BG_DARK #0e0d0b`, `BG_LIGHT / CREAM #f7f3ed`, `FG_DARK #f0ebe0`, `FG_LIGHT #1a1611`.
- Two fonts: `serif` = Gloock (display), `sans` = Jost (everything else), both from Google Fonts.
- Most styling is **inline `style={{}}`**, not Tailwind classes. Tailwind is used for layout only
  (flex, grid, spacing). Match the surrounding style; do not convert one to the other piecemeal.
- The navbar is 80px (`h-20`). Every page starts with `pt-20`. Sticky elements use `top-20`.
  **Change the nav height and you must change all of them.**
- `src/app/components/ui/` holds ~50 shadcn/ui components. **`App.tsx` imports none of them.**
  They are dead code. Do not assume they are in use.

---

## 10. Working agreement — how we avoid conflicts

### 10.1 Version control

The repository is live at
`https://github.com/Prajjwalgautam/Nepal-Bhoomi-Real-Estate-website-` and is **private**, so
you must be invited as a collaborator before you can clone it.

```bash
git clone https://github.com/Prajjwalgautam/Nepal-Bhoomi-Real-Estate-website-.git
cd Nepal-Bhoomi-Real-Estate-website-
npm install
npm run dev
```

`.gitignore` covers `node_modules/`, `dist/`, `.env*`, `.claude/settings.local.json` and editor
files. `main` has no branch protection yet, so §10.3 is an honour-system agreement rather than
something the server enforces.

### 10.2 Ownership — who may edit what

The whole app is one file, so **file-level ownership is the only thing that reliably prevents
merge conflicts.**

| Path | Owner | Rule |
|---|---|---|
| `apps/web/**` | **Frontend** | Backend must not edit. Needed changes go in §12 |
| `apps/web/src/api/`, `apps/web/src/hooks/` | **Shared** | Frontend writes; backend reviews the contract |
| `apps/api/**` | **Backend** | Frontend must not edit. Needed changes go in §12 |
| `apps/api/API.md` | **Backend** | Frontend may append a dated note, not rewrite |
| `CLAUDE.md` | **Both** | The contract. Append only, in your own section. See §10.4 |
| `BACKEND.md` | **Backend** | Backend status and task list. Frontend may append to its change log |
| `package.json` | **Both** | Announce dependency changes in §12 first |
| `.claude/settings.json` | **Both** | Committed, shared. Personal tweaks go in `.claude/settings.local.json`, which is git-ignored |

**Splitting `App.tsx` is the real fix.** Until it is split into `apps/web/src/app/pages/*` and
`apps/web/src/app/sections/*`, every frontend change touches the same file and merges will hurt.
Agree a time to do it when no branch is open.

**One exception has already happened.** The frontend owner edited `apps/api` once, on
`feat/monorepo-and-auth-hardening`, to close security gaps found in review. That was agreed
out-of-band and is flagged in §12 for the backend owner to review rather than merged silently.
It is not a precedent.

### 10.3 Branches

```
main                    always builds, always runnable
  feat/fe-<thing>       frontend work
  feat/be-<thing>       backend work
```

Never commit to `main` directly. Rebase on `main` before opening a PR.

### 10.4 Keeping this file current — the actual rule

> **Any change to a shared contract must update this file in the same commit.**

A "shared contract" means: an API endpoint, a request or response shape, a field name or type, an
env var, an error code, an auth rule, a new page, or a `NavOpts` / props change.

Concretely, at the end of a session where you changed any of those:

1. Edit the affected section (§5, §6, §7, §8, §9) so it describes reality, not intent.
2. Add one line to §13 with the date, who, and what changed.
3. If you need something from the other person, add it to §12 rather than editing their files.
4. Backend work also ticks the item in `BACKEND.md` and appends to its §7 change log. Keep the
   split straight: **this file is the spec, `BACKEND.md` is the status.** A new endpoint means a
   spec entry here and a status line there, in the same commit.

**Conflict rule for this file.** §13 is append-only and newest-first, so two people appending on
the same day produce a trivial merge. Everywhere else, edit only the rows and sections you own.
If you must change something the other person owns, propose it in §12 instead.

A `Stop` hook in `.claude/settings.json` reminds Claude at the end of any session that touched
`src/`. The hook only prints a reminder — it cannot edit the file for you, and Claude is the one
that has to act on it. **Treat the reminder as the prompt, not the guarantee.**

---

## 11. Known gaps and risks

Ranked by how much they will cost if ignored.

1. **No router in `apps/web`.** No URLs, no deep links, no back button, nothing crawlable. A
   property site that cannot link to a property is not shippable. `react-router` is installed.
2. **The frontend still talks to nobody.** Auth works on the server and is theatre in the UI.
   Nothing is gated, nothing persists, and any password still "works" in `apps/web`.
3. **The whole frontend is one 1,927-line file.** Guarantees merge conflicts. Split it.
4. **`apps/web` types are never checked.** No `tsconfig.json`, TypeScript not installed. Every
   frontend type in this document is a comment, not a guarantee. `apps/api` is checked.
5. **No email verification.** Anyone can register with anyone's address. Matters more once
   agents can list property.
6. **Access tokens cannot be revoked.** Logout clears the cookies and kills the refresh token,
   but a captured access JWT stays valid for up to 15 minutes. Accepted tradeoff; revisit if
   that window is too wide.
7. **Only auth exists.** No properties, articles, leads, favourites or uploads endpoints.
8. **Public lead forms have no spam protection** and no server-side validation, because they
   have no backend at all yet.
9. **No loading or error states in the UI.** Every screen assumes data is already there.
10. **All images hotlinked from Unsplash.** No media pipeline, no upload, no resizing.
11. **~50 unused shadcn/ui components** in `apps/web/src/app/components/ui/` — dead weight.
12. **No tests and no CI** anywhere. Nothing stops a broken commit reaching `main`.
13. **Dates are display strings** (`"May 2025"`) and reading time is hardcoded (`"6 min"`).
14. **`mapX`/`mapY` are fake.** No real geography anywhere.
15. **No i18n.** English only, in a market where Nepali matters.
16. **Accessibility is partial** in `apps/web`: focus order, hero contrast, and keyboard traps
    in the lightbox and mobile menu are unaudited.
17. **Rate limiting fails open** if Postgres is unreachable, by design — a database blip must not
    lock everyone out. It is a brute-force brake, not an authorisation control.
18. **`x-forwarded-for` is trusted** for the per-IP limit. Safe on Vercel, which sets it. Behind
    your own proxy you must overwrite it or an attacker spoofs a new IP per request. The
    per-account limit is the backstop that does not depend on it.

---

## 12. Open questions / cross-team requests

Add a row instead of editing the other person's files. Delete the row when resolved.

| Date | From | Question / request | Status |
|---|---|---|---|
| 2026-09-23 | Backend | **Review the `LoginPage` edit on `feat/be-google-auth`.** It touches `App.tsx` (frontend-owned, §10.2): adds the "Continue with Google" button and the `?auth=google` / `?auth_error=google` handling. Done on the product owner's request; flagged here rather than merged silently. | **Needs Prajjwal** |
| 2026-09-23 | Backend | **Reconcile the two backends.** `feat/monorepo-and-auth-hardening` (`apps/api`, cookie-only, `/api/auth`) and `feat/be-google-auth` (`backend-realstate`, Bearer + refresh cookie, `/api/v1/auth`, forgot/reset-password, agency/agent verification, Google login) diverged from the same commit. Pick one scheme and port the other branch's fixes (rate limiting, reuse detection, password denylist) or features across. | Open |
| 2026-09-22 | Frontend | **Review `feat/monorepo-and-auth-hardening`.** It edits `apps/api`, which is yours. Seven security fixes plus the repo restructure. Details in the two commits on that branch. | **Needs saksham** |
| ~~2026-09-22~~ | ~~Frontend~~ | ~~Register fields do not match~~ — **resolved 2026-09-23**: agency/agent sign-up removed, the frontend now matches your schema. Only `phone` is still collected and unstored. | Resolved |
| 2026-09-23 | Frontend | **`POST /uploads` is now blocking.** Free Listing accepts multiple photos with previews and a cover image. It has nowhere to send them. | **Needs saksham** |
| 2026-09-23 | Frontend | **forgot/reset-password endpoints are now blocking.** The UI ships; the two endpoints in §7.4 are still unbuilt. | **Needs saksham** |
| 2026-09-23 | Frontend | `GET /videos` for the home carousel. Shape is in §7.3 — `sources[]` is what makes the quality menu work. | Open |
| 2026-09-23 | Frontend | Split `amenities: string[]` (canonical, 22 values) from free-text `features: string[]` on a property? | Open |
| 2026-09-23 | Frontend | `district` must be one of the 77 canonical spellings. Note Nawalpur/Parasi and Rukum East/West. | Open |
| 2026-09-22 | Frontend | `forgot-password` and `reset-password` are documented in §7.4 but not built, and no UI exists either. Who builds which half first? | Open |
| 2026-09-22 | Frontend | Agree the deployment target. Same-site (one origin with `/api`, or `api.domain.com`) is materially more secure than split-origin — see §4.3. | Open |
| 2026-09-22 | Frontend | Email verification is unbuilt on both sides. Needs an email provider decision (Resend, Postmark, SES). | Open |
| 2026-09-20 | Frontend | Confirm `price` display string stays server-side, or move formatting to the client? | Open |
| 2026-09-20 | Frontend | Replace the `"—"` sentinel with `null` in API responses? | Open |
| 2026-09-20 | Frontend | Articles keyed by `slug` rather than numeric `id`? | Open |
| ~~2026-09-20~~ | ~~Frontend~~ | ~~Agree token scheme~~ — **resolved 2026-09-22**: adopted the shipped cookie-only scheme. See §7.4. | Resolved |

---

## 13. Change log (append newest first, one line each)

<!-- Format: YYYY-MM-DD · who · what changed · why it matters to the other side -->

- **2026-09-24 · both · Refresh race + CSP.** `POST /auth/refresh` now answers `409` (not 401)
  when another tab refreshed the same cookie at the same moment; `auth.tsx` waits ~0.5 s and
  retries once, so opening/restoring several tabs no longer logs the user out. Production builds
  get a Content-Security-Policy `<meta>` from `vite.config.ts`: **any new external host (images,
  video, fonts, embeds, APIs) must be added there or the browser will block it.** Login limits
  now count only failed attempts (30 per 15 min per IP).

- **2026-09-24 · frontend · First admin page.** New `admin` page (`AdminPage` in App.tsx), linked
  from the navbar only when `user.role === "ADMIN"`: user-count tiles and a read-only table from
  `GET /api/v1/admin/users`. Placeholder to grow into the admin dashboard; the backend enforces
  access (ADMIN + 2FA).

- **2026-09-24 · both · Two-factor authentication.** `POST /auth/login` may now answer
  `{ mfaRequired, mfaToken }` instead of a session; `LoginPage` shows a code step and calls
  `POST /auth/login/2fa` (`useAuth().verifyMfa`). Google sign-in for a 2FA account lands on
  `?auth=google_mfa` and shows the same step (token in a cookie, none in the URL).
  `/auth/me` returns `twoFactorEnabled`. Login lockout is now per email + IP (5 tries, 15 min).

- **2026-09-24 · frontend · Login/register now call the real API.** New `src/app/auth.tsx`
  (`AuthProvider`, `useAuth`, `authFetch`): access token kept in memory, one shared
  `/auth/refresh` on load (restores the session after a reload and finishes Google sign-in),
  refresh-and-retry once on a 401. Navbar shows the user's name and Logout when signed in.
  Register checks the Nepal phone format client-side. Forgot password is still UI-only
  (email OTP planned). Also fixed the "videos" page mounting `HomePage` twice.
- **2026-09-24 · backend · Hardening.** Per-IP rate limits (429 + `Retry-After`), refresh
  cookie now `SameSite=Strict` and bound to the browser, refresh-token reuse revokes all
  sessions, reset links expire in 15 min, new `POST /auth/verify-reset-token`. See API.md.

- **2026-09-23 · backend · Google sign-in, on `feat/be-google-auth`.** New
  `GET /api/v1/auth/google` and `/google/callback`, a new `OAuthAccount` table, nullable
  `User.passwordHash`, and a "Continue with Google" button on `LoginPage` that finishes via
  `/refresh` + `/me` (§7.4b). The branch lays the repo out as `backend-realstate/` +
  `frontend-realstate/` and carries saksham's `/api/v1` backend, which differs from `apps/api` on
  `feat/monorepo-and-auth-hardening` — reconciliation and a review of the `App.tsx` edit are in §12.

- **2026-09-23 · frontend · Split the docs in two.** `CLAUDE.md` stays the contract; the new
  `BACKEND.md` is the backend status and task list — what is built, the seven security fixes made
  to `apps/api` and why, and the ranked list of what the frontend is blocked on.

- **2026-09-23 · frontend · Large UX pass.** Removed the hero search strip and the AI concierge.
  Added a Quick Enquiry float that opens the shared callback form, a navbar hover rule, forgot
  password, password eye toggles, member-only registration, multi-image upload, a typeahead over
  all 77 districts, a rotating video carousel with a full in-page player, and 22 amenity icons.
  **Backend-facing:** districts are now 77 canonical spellings, register matches your schema,
  and `POST /uploads` plus the password-reset endpoints are now blocking (§12).

- **2026-09-22 · frontend · Merged the backend in as `apps/api` and hardened its auth.**
  saksham's Next.js API arrived as an unrelated root commit, so it was subtree-merged under
  `apps/api` and the Vite app moved to `apps/web`. Seven security fixes followed: Postgres-backed
  rate limiting, fail-closed origin allowlist, refresh-token reuse detection, real CORS,
  Secure-by-default cookies, a common-password denylist, and the §7.1 error envelope. The
  documented token scheme was superseded by the shipped cookie-only one — see §7.4. **All of it
  is on `feat/monorepo-and-auth-hardening`, not `main`, pending saksham's review (§12).**

- **2026-09-20 · frontend · Doc maintenance and a real fix to the staleness hook.**
  The Stop hook only inspected uncommitted changes, so committing inside the same
  session made it silent — it missed three commits in a row. It now also checks
  whether the HEAD commit touched `src/` without `CLAUDE.md`. Refreshed §10.1
  (the repo now exists and is private), the file's line count, and one stale line
  number in §9.1.

- **2026-09-20 · frontend · District strip cut to three panels and made count-adaptive.**
  Tile height now derives from tile width, so the strip holds its proportion at
  any district count. Added `GET /districts/featured` to §7.3 with the safe
  range (three to five) and the `propertyCount` accuracy requirement.

- **2026-09-20 · frontend · Created CLAUDE.md, `.gitignore` and the session hook.** Documents the
  full data model, proposed API contract and auth gaps ahead of backend work.
- **2026-09-20 · frontend · Fixed ~20 dead controls and did a typography/spacing pass.** Nav
  Buy/Rent, the price and "All Filters" controls, all four form submits, login/register
  validation, blog article pages, map zoom, and the hot/new/videos routes now work. Added
  `NavOpts`/`Go` so navigation can carry filters. No API surface changed.
