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

## 0. Backend handoff: quick reference (updated 2026-09-28)

Start here. Everything the backend needs from the frontend is on this page; the numbered
sections below go into detail. **Older sections say `apps/web` and `apps/api`: in this repo those
are `frontend-realstate/` and `backend-realstate/`.** Where an older section disagrees with this
one, this one is current.

### 0.1 Run it

```bash
cd backend-realstate && npm install && npx prisma generate && npm run dev     # http://localhost:3000
cd frontend-realstate && npm install && npm run dev -- --port 5175 --strictPort
npm run typecheck      # frontend: strict TypeScript, unused code is an error
npm run build          # frontend production build
```

`FRONTEND_ORIGIN` in the backend `.env` must equal the frontend's address exactly (here
`http://localhost:5175`), or the browser's requests are refused.

### 0.2 Environment variables

| Where | Name | What |
|---|---|---|
| Frontend | `VITE_API_URL` | Backend origin. Default `http://localhost:3000`. The only frontend variable (read in `src/app/auth.tsx`). Anything `VITE_` is public: never a secret |
| Backend | `DATABASE_URL`, `DIRECT_URL` | Supabase pooler / direct connection (`DIRECT_URL` is only used by Prisma migrations) |
| Backend | `JWT_ACCESS_SECRET`, `TOTP_ENCRYPTION_KEY` | Token signing, 2FA secret encryption |
| Backend | `FRONTEND_ORIGIN` | CORS, CSRF origin check, Google redirect, reset-link host |
| Backend | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google sign-in |
| Backend | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM_NAME` | Verification codes and reset links |
| Backend | `CRON_SECRET`, `NODE_ENV`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Cleanup cron auth, mode, seeded admin |

### 0.3 Endpoints already built (frontend call sites)

All under `/api/v1`, error envelope as in §7.1.

| Method | Path | Called from |
|---|---|---|
| POST | `/auth/login` | `auth.tsx` `login()` → may return `{ mfaRequired, mfaToken }` or `{ verificationRequired, email }` |
| POST | `/auth/login/2fa` | `auth.tsx` `verifyMfa()` |
| POST | `/auth/register` | `auth.tsx` `register()` → always `{ verificationRequired, email }` |
| POST | `/auth/verify-email`, `/auth/resend-verification` | `auth.tsx` `verifyEmail()`, `resendVerification()` |
| POST | `/auth/refresh`, `/auth/logout` | `auth.tsx` (on load, on 401, Logout) |
| GET | `/auth/me` | `auth.tsx` on load |
| POST | `/auth/forgot-password`, `/auth/verify-reset-token`, `/auth/reset-password` | `auth.tsx`, used by LoginPage and ResetPasswordPage |
| GET | `/auth/google` → `/auth/google/callback` | LoginPage redirects to it; callback returns to `?auth=google` / `?auth=google_mfa` / `?auth_error=google` |
| GET | `/admin/users` | `admin/AdminUsers.tsx`. Please add `lastLoginAt` to its select |
| POST | `/auth/2fa/setup`, `/enable`, `/disable` | **No frontend screen yet** (built on the backend only) |

### 0.4 Endpoints the frontend is waiting for

The frontend already sends or expects these shapes; mock data stands in until they exist. Each
row names the exact function to replace.

| Method | Path | Auth | Replaces (file → function / variable) |
|---|---|---|---|
| GET | `/properties?listing&type&district&minPrice&maxPrice&preset&q&sort&page&limit` | public | `data/properties.ts` → `ALL_PROPS` (filtering is in `BuyRentPage`) |
| GET | `/properties/:id` | public | `ALL_PROPS.find(...)` in `PropertyDetailPage` |
| POST / PATCH / DELETE | `/admin/properties[/:id]` | ADMIN | `saveProperty()`, `deleteProperty()`, `restoreProperty()` (Undo) |
| PATCH | `/admin/properties/:id` `{ reactionCount }` | ADMIN | `data/reviews.ts` → `setReactionCount()` |
| POST | `/admin/uploads` (multipart, image ≤ 8 MB) → `{ url }` | ADMIN | every `blob:` URL from `components/ui/photo-picker.tsx` |
| GET / POST | `/properties/:id/reviews` | public | `reviewsFor()`; `ReviewForm` submit in `components/ui/property-reviews.tsx` |
| GET / DELETE | `/admin/reviews[/:id]` | ADMIN | `admin/AdminReviews.tsx` → `deleteReview()`, `restoreReview()` |
| POST / DELETE | `/properties/:id/reaction` | public | `components/ui/reaction-button.tsx` → `FAVS` |
| GET | `/articles`, `/articles/:slug` | public | `data/content.ts` → `BLOGS` |
| POST / PATCH / DELETE | `/admin/articles[/:id]`, `PUT /admin/articles/order` | ADMIN | `upsert(BLOGS…)`, `removeById`, `moveById` |
| GET | `/team` | public | `TEAM` |
| POST / PATCH / DELETE | `/admin/team[/:id]`, `PUT /admin/team/order` | ADMIN | `upsert(TEAM…)` etc. |
| GET | `/testimonials` | public | `TESTIMONIALS` |
| POST / PATCH / DELETE | `/admin/testimonials[/:id]`, `PUT …/order` | ADMIN | `upsert(TESTIMONIALS…)` etc. |
| GET | `/videos` | public | `VIDEO_LIST` / `companyVideos()` |
| POST / PATCH / DELETE | `/admin/videos[/:id]`, `PUT /admin/videos/order` | ADMIN | `upsert(VIDEO_LIST…)` etc. |
| GET | `/site` → `{ stats, featuredDistricts }` | public | `STATS`, `FEATURED_DISTRICTS` |
| PUT | `/admin/site/stats`, `/admin/site/featured-districts` | ADMIN | `HomePageSection` save buttons in `admin/ContentEditors.tsx` |
| POST | `/enquiries`, `/callbacks`, `/contact`, `/listings` | public | the four lead forms (§7.5). Nothing is sent today |
| GET/PUT/DELETE | `/me/favourites[/:propertyId]` | signed in | `FAVS` (hearts, lost on reload today) |

Every `upsert` / `removeById` / `moveById` call is in `data/content.ts`; order matters for
articles (first = featured on home), team (first 6 on About), testimonials and videos (first = centre).

**Undo after delete.** Deleting a property or review shows an "Undo" button for a few seconds.
Undo puts back the same record (same `id`, same ref, same position). Either soft-delete
(`deletedAt`, cleared on undo, e.g. `POST /admin/properties/:id/restore`) or delay the real
DELETE until the Undo notice closes. Don't hand out a new id on restore.

### 0.5 Shapes and exact vocabularies

Types: `Prop`, `FloorPlan`, `FloorPlanRoom` in `data/properties.ts`; `BlogPost`, `Testimonial`,
`TeamMember`, `Stat`, `FeaturedDistrict`, `CompanyVideoInput` in `data/content.ts`; `Review` in
`data/reviews.ts`; `AuthUser` in `auth.tsx`. Suggested Prisma models: §7.8.

Store these **exact strings** (they are filter keys and dropdown values):

| Constant | File | Values |
|---|---|---|
| `DISTRICTS` | `data/districts.ts` | the 77 districts |
| `AMENITIES` | `icons/amenities.tsx` | 69 amenity names in 3 groups (store names, never icons) |
| `PROPERTY_TYPES` | `data/properties.ts` | House/Bungalow, Land, Apartment, Commercial, Flat |
| `BADGES` | ″ | Hot, Featured, New, Prime, Rare, Verified, Exclusive |
| `FACINGS`, `ROAD_SURFACES` | ″ | 8 directions; Black-topped, Concrete, Graveled, Earthen |
| `LAND_UNITS`, `BUILT_UNITS` | ″ | Ropani, Aana, Bigha, Kattha, Dhur, sq.ft; sq.ft, sq.m |
| `FLOOR_LABELS`, `ROOM_NAMES` | ″ | Basement … Rooftop; 21 room names |
| `BLOG_CATEGORIES`, `TEAM_ROLES` | `data/content.ts` | suggestions; the admin may type others |
| `DEPARTMENTS`, `LANGUAGES`, `SPECIALITIES` | ″ | team profile fields |

Prices: `priceNum` is whole rupees (per month for rent); the display string comes from
`formatPrice()` in `data/properties.ts`.

### 0.6 Pages and browser storage

`Page` values (`App.tsx`): home, buy, rent, hot, new-listings, map, area, property, about, team,
blog, blog-post, services, emi, contact, login, register, reset-password, free-listing, videos,
admin, admin-users, admin-reviews. There are still no URLs per page (§5); only `/reset-password`
is read from the address bar.

The only thing the frontend stores in the browser: admin drafts in `localStorage` under
`nb-admin-draft:property:<id|new>`, removed when saved or discarded. Tokens are never stored
(access token in memory, refresh token in an httpOnly cookie).

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
| Backend | **Exists** — `backend-realstate`, Next.js App Router, `/api/v1`. Auth, email verification, 2FA and `GET /admin/users` so far |
| Database | **Exists** — Postgres on Supabase via Prisma. Auth models only (User, tokens, audit, rate limits). **No property/content tables yet** |
| Network calls | Auth only: `src/app/auth.tsx` (login, register, verify email, 2FA, Google, forgot/reset password) and the admin Users page |
| Admin panel | **Built, frontend only (2026-09-28).** Dashboard, Users, Reviews under `src/app/admin/`. Edits change in-memory data until reload; §7.8 lists every endpoint it needs |
| Data | Mock arrays in `src/app/data/` (properties, content, reviews). Each save/delete function there is the exact spot for its API call |
| Images | Hotlinked from Unsplash + one local PNG logo. Admin uploads are temporary `blob:` URLs until `POST /admin/uploads` exists |
| TypeScript in `backend-realstate` | **Checked.** `next build` runs tsc |
| Routing | Hand-rolled. A `page` string in React state. **The URL never changes.** An in-app Back button exists on property and article pages |
| Tests | None committed |
| TypeScript in `frontend-realstate` | **Checked in the editor** via `tsconfig.json` (added 2026-09-28). Run `npx tsc -p tsconfig.json` to check from the terminal |
| Linting / formatting | Configured in the backend only |

`src/app/App.tsx` is still the public site (~2,800 lines), but data, the admin area and shared
components now live in their own files (§4.2). Two people editing `App.tsx` at once is still the
biggest merge risk. See §10.

---

## 3. Commands

> **In this repo use §0.1.** The commands below are for the other repo's `apps/` layout.

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
   └─────────────────────┤  src/app/data/   (the mock "database")   │
                         │  properties.ts  ALL_PROPS + vocabularies │
                         │  content.ts     BLOGS TESTIMONIALS TEAM  │
                         │                 STATS FEATURED_DISTRICTS │
                         │                 VIDEO_LIST               │
                         │  reviews.ts     reviews + REACTIONS      │
                         │  store.ts       change signal for admin  │
                         └────────────────────▲─────────────────────┘
                                              │ saves / deletes
                         ┌────────────────────┴─────────────────────┐
                         │  src/app/admin/  Dashboard, Users,       │
                         │  Reviews, PropertyEditor, ContentEditors │
                         └──────────────────────────────────────────┘
```

Other folders:

| Path | What |
|---|---|
| `src/app/auth.tsx` | Auth client and `useAuth()` — the only real network code besides the Users page |
| `src/app/admin/` | The admin area (§5, §7.8). `suggestions.ts` = template-based writing help, no AI or network |
| `src/app/components/ui/` | Shared components in the site's style: `brand.ts` (colours, fonts), `property-cards.tsx` (the two card designs, also used by the admin live preview), `form-controls.tsx`, `photo-picker.tsx`, `district-combobox.tsx`, `floor-plan.tsx`, `back-button.tsx`, `list-pagination.tsx`, `confirm-dialog.tsx`, `team-profile.tsx` |
| `src/app/icons/amenities.tsx` | The 69 canonical amenities and their icons (§6) |
| `src/app/data/districts.ts` | The 77 districts |

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
| `reset-password` | `ResetPasswordPage` | Opened from the emailed link `/reset-password?token=…` |
| `team` | `TeamPage` | Everyone on the team, department chips + search; cards open a profile pop-up. About shows the first 6 (`ABOUT_TEAM_LIMIT`) |
| `admin` | `admin/AdminDashboard` | ADMIN only. Overview + editors for properties, journal, team, testimonials, videos, home page |
| `admin-users` | `admin/AdminUsers` | ADMIN only. Live `GET /admin/users`, search/filter/pagination |
| `admin-reviews` | `admin/AdminReviews` | ADMIN only. Reviews grouped by property; delete |

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
  floorPlans?: FloorPlan[];  // added 2026-09-28, set in the admin; optional
}

interface FloorPlan     { id: string; label: string; image?: string; rooms: FloorPlanRoom[] }
                          // label: "Basement" | "Ground Floor" | "First Floor" | … | "Rooftop"
interface FloorPlanRoom { name: string; dims: string }   // dims "5.2 × 4.8 m", or "" if unknown
```

Source of truth: `src/app/data/properties.ts`. It also holds every dropdown vocabulary the admin
offers (`BADGES`, `FACINGS`, `ROAD_SURFACES`, `LAND_UNITS`, `BUILT_UNITS`, `FLOOR_LABELS`,
`ROOM_NAMES`, `PROPERTY_TYPES`) and `formatPrice(priceNum, listing)`, which produces the display
price ("NPR 8.5 Cr", "NPR 1.2 L/mo", "NPR 85,000/mo").

How the admin form maps onto these fields (so the API can store the parts, not just the strings):

| Form | Stored today as | Suggested API field |
|---|---|---|
| Amount + Crore/Lakh/Rupees | `priceNum` (rupees) + `price` via `formatPrice` | `priceNum` int; format on the client or send both |
| Built area number + unit | `builtArea` "4,850 sq.ft" or "—" | `builtAreaValue` decimal? + `builtAreaUnit` enum, null when absent |
| Land area number + unit | `landArea` "12 Ropani" or "—" | `landAreaValue` + `landAreaUnit` (Ropani, Aana, Bigha, Kattha, Dhur, sq.ft) |
| Road surface + width | `roadAccess` "Black-topped 20ft" | `roadSurface` enum + `roadWidthFt` int |
| Amenity tiles | canonical names inside `features` | **`amenities: string[]`** (canonical only, filterable) |
| Highlights (free text) | the other entries of `features` | **`highlights: string[]`** |
| Photos (first = cover) | `hero` = `gallery[0]` | `gallery: string[]` ordered; drop `hero` or derive it |
| Map pin | `mapX`, `mapY` 0–100 | keep until real `lat`/`lng` |
| Reactions | `REACTIONS[id]` in data/reviews.ts | `reactionCount` int on the property (§7.7) |

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

All in `src/app/data/content.ts`:

```ts
// BLOGS  (BlogPost)
{ id:number; cat:string; date:string;   // "May 2025" — NOT a parseable date. Send ISO 8601
  read:string;                          // "6 min" — the admin computes it from the text (200 wpm)
  title:string; excerpt:string; image:string;
  author:string;                        // a team member's name (or free text)
  body?:string }                        // full article, paragraphs split by a blank line. NEW 2026-09-28

// TESTIMONIALS  (Testimonial)
{ id:number; name:string; role:string; rating:number /*1-5*/; text:string; img:string }

// TEAM  (TeamMember) — About page (first 6) and the Team page, in display order. NEW 2026-09-28
{ id:number; name:string; role:string; img:string;          // the card
  department?:string;        // one of DEPARTMENTS; the Team page filters on it
  bio?:string; experienceYears?:number;
  specialities?:string[];    // SPECIALITIES or free text
  languages?:string[];       // LANGUAGES
  phone?:string; whatsapp?:string /* digits incl. 977 */; email?:string }   // the profile pop-up

// STATS  (Stat) — home page statistics band, exactly 4 today. NEW
{ id:number; value:string /* "180+" */; label:string /* "Properties Sold" */ }

// FEATURED_DISTRICTS  (FeaturedDistrict) — home page district tiles, 1–5. NEW
{ id:number; name:string /* one of the 77 */; count:number; img:string }

// VIDEO_LIST  (CompanyVideoInput) — see "Company videos" in §7.3
{ id:number; title:string; duration:string /* "1:19" */; youtubeUrl?:string; poster?:string; sources?:…; captions?:… }

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

`src/app/icons/amenities.tsx` defines **69 canonical amenities** in three groups (Main Features,
Rooms, Furnished), each with an icon: 44 custom drawings in lucide's style plus 24 lucide icons
(added 2026-09-28: Air Conditioning, CCTV, Fire Safety, Boring Water, Solar Water Heater, Gated
Community, Kids Play Area, Pet Friendly, Wheelchair Access, EV Charging, Corner Plot, Puja Room,
Study Room, Store Room, Laundry Room, Guest Room, Attached Bathroom, Refrigerator, Washing
Machine, Microwave, Television, Water Purifier, Curtains & Blinds, Ceiling Fans). An alias table
maps marketing phrases ("Infinity Pool", "Deep boring") onto them for display.

**For the API:** store only the amenity **name**, never an icon; the frontend picks the icon. The
exact list is `AMENITIES` in that file (`contract/amenities.json` in the other repo is older, 45).
The admin keeps amenities (tile picks) and highlights (free text) apart — store them as two
fields (table above). Icons appear on the property page only; listing cards no longer show them.

---

## 7. Proposed API contract

**Nothing here is built yet. This is the proposal — amend it in this file, then implement.**

- Base URL: `${VITE_API_URL}/api/v1` (see §0.2, §9.3)
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

**How entries are written now (2026-09-24).** The list in `App.tsx` is `VIDEO_LIST:
CompanyVideoInput[]`; each YouTube entry is just `{ id, title, duration, youtubeUrl }` with the
normal share link (`youtu.be/…`, `watch?v=…`, `/shorts/…`, `/embed/…`, `?si=` is fine).
`youtubeIdFrom()` extracts the id; when `poster` is omitted the card uses YouTube's own thumbnail
(`i.ytimg.com/vi/<id>/maxresdefault.jpg`, falling back to `hqdefault.jpg` on error). The popup
embed uses `youtube-nocookie.com` with `autoplay=1`, so one click plays. Order in the list =
order on the site; the first entry is centred on load. The placeholder test clips were removed.

Current videos (all from the Nepal Bhoomi YouTube channel, embedding checked as allowed):

| # | Card title | Link | Length |
|---|---|---|---|
| 1 | Sitapaila Elite Colony — 2 Minutes from Ring Road | https://youtu.be/gHsBz7OJDHk | 1:19 |
| 2 | Commercial Space for Rent — Kamaladi, Kathmandu | https://youtu.be/7wxOvLCa1BA | 1:01 |
| 3 | Buying Land Across Kathmandu? Talk to Nepal Bhoomi (YouTube title is Nepali) | https://youtu.be/qP_ZmzMgBlE | 0:52 |
| 4 | Stay Aware, Stay Alert — Property Awareness (YouTube title is Nepali) | https://youtu.be/_rU-4grC0k0 | 0:34 |

Card titles are English because the heading font (Gloock) has no Devanagari glyphs.
The production Content-Security-Policy (`vite.config.ts`) allows `i.ytimg.com` for thumbnails and
`www.youtube-nocookie.com` for the player; self-hosted MP4s would need their host added to
`media-src`. A future step is managing this list from the admin dashboard instead of code.

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

### 7.7 Reviews and reactions — UI built, API not

Mock data and the call sites: `src/app/data/reviews.ts`. Shown on the property page ("Resident
Reviews", rating link in the info bar, heart with a count on rows and the page).

```ts
interface Review { id:number; author:string; avatar:string; rating:number /*1-5*/;
                   date:string /* send ISO 8601 */; text:string; verified:boolean }
```

| Method | Path | Notes |
|---|---|---|
| `GET` | `/properties/:id/reviews` | Published reviews, newest first, paginated |
| `POST` | `/properties/:id/reviews` | `{ rating, name, text }`. Rate-limit; goes to **moderation**, not straight live |
| `POST` / `DELETE` | `/properties/:id/reaction` | The visitor's heart. Anonymous visitors: decide how to de-duplicate |
| `GET` | `/admin/reviews` | ADMIN. All reviews with `propertyId`, filterable by property / rating |
| `DELETE` | `/admin/reviews/:reviewId` | ADMIN. The Reviews page's delete button |

- `verified` ("Verified Visit") must be decided by the server, never accepted from the client.
- The property carries `reactionCount` and `reviewCount`. `reactionCount` should **exclude the
  caller's own reaction**; the frontend adds one locally so the heart updates instantly.
- The admin can set `reactionCount` directly (editor stepper and the −/+ on each list row), so it
  is an editable field, not only a derived count. Store it on the property.

### 7.8 Admin panel — every endpoint and field it needs

The admin area is complete on the frontend (`src/app/admin/`). Today each save edits the mock
arrays in memory; every one of those functions (in `src/app/data/*.ts`) names the endpoint that
replaces it. All routes below are **ADMIN only** (same guard as `GET /admin/users`: ADMIN role + 2FA)
and use the §7.1 envelope.

**Properties** — `admin/PropertyEditor.tsx`, `data/properties.ts`

| Method | Path | Body / notes |
|---|---|---|
| `GET` | `/admin/properties` | Paginated, `q`, `listing`, `type`, `sort` (`price_desc` \| `price_asc` \| `reactions`) |
| `POST` | `/admin/properties` | Full property (§6 + table there). Server assigns `id` and `propId` ("NB-013") |
| `PATCH` | `/admin/properties/:id` | Any subset, including `reactionCount` |
| `DELETE` | `/admin/properties/:id` | The UI refuses to delete the last property; the API may enforce the same |

**Uploads** — `components/ui/photo-picker.tsx`

| Method | Path | Notes |
|---|---|---|
| `POST` | `/admin/uploads` | Multipart, images only, ≤ 8 MB each (the UI checks the same). Returns `{ url }` |

On save the frontend must upload every `blob:` URL (property gallery, floor-plan drawings, article
covers, team portraits, testimonial photos, district tiles) and replace it with the returned URL.
Keep property media and people photos in separate folders/validation paths (a portrait was once
used as a listing hero). Add the storage host to the CSP in `vite.config.ts`.

**Content** — `admin/ContentEditors.tsx`, `data/content.ts`

| Collection | Endpoints | Order matters? |
|---|---|---|
| Articles | `POST/PATCH/DELETE /admin/articles[/:id]`, public `GET /articles[/:slug]` | Yes: first = featured story on the home page |
| Team | `POST/PATCH/DELETE /admin/team[/:id]`, `PUT /admin/team/order` | Yes |
| Testimonials | `POST/PATCH/DELETE /admin/testimonials[/:id]`, `PUT …/order` | Yes |
| Videos | `POST/PATCH/DELETE /admin/videos[/:id]`, `PUT /admin/videos/order` | Yes: first = centre card |
| Statistics | `PUT /admin/site/stats` (array of 4 `{ value, label }`) | Yes |
| Featured districts | `PUT /admin/site/featured-districts` (1–5 `{ name, count, img }`) | Yes |

**Users** — `admin/AdminUsers.tsx`: already live on `GET /admin/users`. Please add **`lastLoginAt`**
to `USER_SELECT`; the "Last Sign-in" column is ready and shows "—" until then.

**Suggested Prisma models** (names are suggestions; field names match what the UI sends):

```prisma
model Property {
  id            Int      @id @default(autoincrement())
  ref           String   @unique              // "NB-013" (UI calls it propId)
  title         String
  tagline       String   @default("")
  description   String
  listing       Listing                        // FOR_SALE | FOR_RENT
  type          String                         // one of PROPERTY_TYPES
  badge         String                         // one of BADGES
  featured      Boolean  @default(false)
  verified      Boolean  @default(false)
  district      String                         // one of the 77, exact spelling
  location      String                         // "Jawlakhel, Lalitpur"
  facing        String
  roadSurface   String
  roadWidthFt   Int?
  priceNum      BigInt                         // rupees; per month when FOR_RENT
  builtAreaValue Decimal? @db.Decimal(10,2)
  builtAreaUnit String?                        // sq.ft | sq.m
  landAreaValue Decimal? @db.Decimal(10,2)
  landAreaUnit  String?                        // Ropani | Aana | Bigha | Kattha | Dhur | sq.ft
  beds          Int      @default(0)           // 0 hides it; land is always 0
  baths         Int      @default(0)
  floors        Int      @default(0)
  buildYear     Int?
  gallery       String[]                       // ordered; [0] is the cover
  amenities     String[]                       // canonical names only
  highlights    String[]                       // free text
  mapX          Int      @default(50)
  mapY          Int      @default(50)
  reactionCount Int      @default(0)
  floorPlans    FloorPlan[]
  reviews       Review[]
  createdAt     DateTime @default(now())       // "newest" sort needs this
  updatedAt     DateTime @updatedAt
}
model FloorPlan { id String @id @default(cuid()) propertyId Int property Property @relation(fields:[propertyId], references:[id], onDelete: Cascade)
                  label String  image String?  rooms Json  /* [{ name, dims }] */  position Int }
model Review    { id Int @id @default(autoincrement()) propertyId Int property Property @relation(fields:[propertyId], references:[id], onDelete: Cascade)
                  author String  avatar String?  rating Int  text String  verified Boolean @default(false)
                  status ReviewStatus @default(PENDING)  createdAt DateTime @default(now()) }
model Article   { id Int @id @default(autoincrement())  slug String @unique  title String  category String
                  excerpt String  body String  coverUrl String  author String  readingMinutes Int
                  position Int  publishedAt DateTime @default(now()) }
model TeamMember  { id Int @id @default(autoincrement()) name String role String photoUrl String position Int
                    department String? bio String? experienceYears Int? specialities String[] languages String[]
                    phone String? whatsapp String? email String? }
model Testimonial { id Int @id @default(autoincrement()) name String role String rating Int text String photoUrl String position Int }
model Video       { id Int @id @default(autoincrement()) title String duration String youtubeUrl String? posterUrl String? position Int }
model SiteSetting { key String @id  value Json }   // "stats", "featuredDistricts", later "contact"
enum Listing { FOR_SALE FOR_RENT }
enum ReviewStatus { PENDING PUBLISHED REJECTED }
```

**Not in the admin yet, because they need the backend first** (flagged in §12):
enquiries inbox (the four §7.5 forms and Free Listing submissions have nowhere to go), editable
contact details (phone, email, WhatsApp, address, hours are hard-coded in several places), and
the Services list (its icons are code, so it needs an icon-name field first).

**Admin UX facts the backend may rely on:** drafts autosave to `localStorage` per property
(`nb-admin-draft:property:<id|new>`) and are removed on save; photos picked before a reload are
not kept in drafts. "Duplicate" creates a new property from a copy (new ref, reactions 0). The
"Write it for me" / idea chips are local templates (`admin/suggestions.ts`), not an AI service.

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

These module-scope arrays **are** the current data layer (moved out of `App.tsx` on 2026-09-28).
Each one is the insertion point for an API call, and the save/delete functions beside them are
the insertion points for the admin's writes.

| Variable | File | Read by | Replace with |
|---|---|---|---|
| `ALL_PROPS: Prop[]` | `data/properties.ts` | Nearly every section, admin | `GET /properties`, `GET /properties/:id` |
| `PROP_TYPES`, `PRICE_RANGES` | `data/properties.ts` | Filters, Free Listing, admin | `GET /reference` |
| `BLOGS` | `data/content.ts` | `BlogSection`, `BlogPage`, `BlogPostPage`, admin | `GET /articles` |
| `TESTIMONIALS` | `data/content.ts` | `TestimonialsSection`, admin | `GET /testimonials` |
| `TEAM` | `data/content.ts` | `AboutPage`, admin | `GET /team` |
| `STATS`, `FEATURED_DISTRICTS` | `data/content.ts` | `StatisticsSection`, `LocationStripsSection`, admin | `GET /site` (settings) |
| `VIDEO_LIST` / `companyVideos()` | `data/content.ts` | `VideoSection`, admin | `GET /videos` |
| `REACTIONS`, reviews | `data/reviews.ts` | Hearts, `ReviewsSection`, admin Reviews | §7.7 |
| `AREAS` | `App.tsx` (= `DISTRICTS`) | District filters | `GET /reference` |
| `SERVICES_LIST` | `App.tsx` | `ServicesSectionHome`, `ServicesPage`, `AboutPage` | `GET /services` (icon by name) |
| `FAVS: Set<number>` | `components/ui/reaction-button.tsx` | `FavButton`, `ReactionButton` | `GET/PUT/DELETE /me/favourites` |

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
  api/client.ts  GET {VITE_API_URL}/api/v1/properties
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

**Frontend** (`frontend-realstate/.env.local`, git-ignored, optional): `VITE_API_URL`, the backend
origin without a path (default `http://localhost:3000`). `auth.tsx` appends `/api/v1`.

```
VITE_API_URL=http://localhost:3000
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

- Colours are **constants in `src/app/components/ui/brand.ts`**: `MAROON #8a2030`, `GOLD #b08848`,
  `BG_DARK #0e0d0b`, `BG_LIGHT / CREAM #f7f3ed`, `FG_DARK #f0ebe0`, `FG_LIGHT #1a1611`.
- Two fonts: `serif` = Gloock (display), `sans` = Jost (everything else), both from Google Fonts.
- Most styling is **inline `style={{}}`**, not Tailwind classes. Tailwind is used for layout only
  (flex, grid, spacing). Match the surrounding style; do not convert one to the other piecemeal.
- The navbar is 80px (`h-20`). Every page starts with `pt-20`. Sticky elements use `top-20`.
  **Change the nav height and you must change all of them.**
- `src/app/components/ui/` holds only the site's own shared components (§4.2). The unused
  shadcn/ui files and their 51 packages were removed on 2026-09-28.

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
3. **`App.tsx` is still ~2,800 lines** (public pages). Data, admin and shared components are split out; the pages are not yet.
4. ~~Frontend types are never checked~~ **Fixed 2026-09-28:** `npm run typecheck` (strict). Previously every
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
11. ~~Unused shadcn/ui components~~ **Removed 2026-09-28**, with 51 unused packages.
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
| 2026-09-28 | Frontend | **Admin panel is built, frontend only.** Please build §7.8 (properties, uploads, articles, team, testimonials, videos, site settings) and §7.7 (reviews, reactions). Suggested Prisma models are in §7.8. | **Needs saksham** |
| 2026-09-28 | Frontend | Add **`lastLoginAt`** to `USER_SELECT` in `GET /admin/users`; the Users page column is ready. | **Needs saksham** |
| 2026-09-28 | Frontend | Split property `features` into **`amenities`** (canonical, 69 names) and **`highlights`** (free text); the admin already keeps them apart. | Open |
| 2026-09-28 | Frontend | **Enquiries inbox**: the four §7.5 forms and Free Listing submissions need endpoints and storage before the admin can show them. | Open |
| 2026-09-28 | Frontend | Editable **contact details** (phone, email, WhatsApp, address, hours) as a `SiteSetting`; today they are hard-coded in several places. | Open |
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

- **2026-09-28 · frontend · Clean-up, admin tools, handoff page.** Removed 48 unused shadcn files,
  51 unused packages and Figma Make leftovers (CSS 103 → 45 kB; `npm audit` clean after Vite 6.4.3).
  The admin now loads separately from the public site. Added a "Needs attention" checklist, Ctrl K
  search, one-click Featured/Verified switches and Undo for deletes. `npm run typecheck` added.
  **New §0 is the backend quick reference**: env vars, built vs needed endpoints with call sites,
  exact vocabularies. Frontend env var is `VITE_API_URL` (older text said `VITE_API_BASE_URL`).

- **2026-09-28 · frontend · Team profiles and a Team page.** Clicking a team card opens a profile pop-up
  (bio, specialities, languages, Call / WhatsApp / Email, prev/next, Back). About shows the first 6;
  the new `team` page lists everyone with department filters and search, so the team can grow past
  20 without a carousel. `TeamMember` gained optional profile fields (§6, §7.8). The floating Quick
  Enquiry button now scrolls to the home page enquiry form (`#enquiry`) instead of opening a pop-up.

- **2026-09-28 · frontend · Admin panel (frontend only) and a data layer.** Mock data moved out of
  `App.tsx` into `src/app/data/` (properties, content, reviews); the admin (`src/app/admin/`) edits
  it in memory. Three pages: Dashboard (properties with an 8-step editor, live card preview,
  draft autosave, duplicate, floor plans, map pin, reaction count; journal; team; testimonials;
  videos; home-page stats and districts), Users (live API), Reviews (delete). 24 new amenities
  (69 total). Amenity icons removed from listing cards (property page only). In-app Back button
  on property and article pages. `tsconfig.json` added. **Backend-facing:** every endpoint and a
  suggested schema are in §7.7–7.8; requests in §12.

- **2026-09-24 · frontend · Real YouTube videos, pushed as branch `feat/auth-2fa-admin-videos`.** "Explore in
  Video" now shows the 4 Nepal Bhoomi YouTube videos listed in §7 "Company videos"; the
  test-video placeholders are gone and their hosts were removed from the CSP. Entries take a
  pasted `youtubeUrl`; thumbnails come from YouTube; the popup autoplays. Everything in this
  change log dated 2026-09-24 (real login/register/logout, session restore, 2FA code step, admin
  page, refresh-race retry, CSP, removed react-router) is on that branch, which builds on
  `feat/be-google-auth`. **Known frontend gaps (not fixed yet):** the callback, property-enquiry,
  contact, free-listing and forgot-password forms only show a success message and send nothing;
  every page lives at `/` (Back leaves the site, links can't be shared); `index.html` still has
  the Figma title/description and `robots: noindex, nofollow`; favourites are lost on reload;
  Vite 6.3.5 has dev-server advisories (upgrade to 6.4.3); there is no type-check/lint script.

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
