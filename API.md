# Auth API reference

Base URL (dev): `http://localhost:3000`

All endpoints are under `/api/auth/`. All accept and return **JSON**. All state-changing
endpoints (register, login, refresh, logout) require the request header:

```
Content-Type: application/json
```

If you send a request without it, you get `400 { "error": "Content-Type must be application/json" }`
before anything else runs.

## How auth actually works (read this first)

There are **no tokens in any JSON response, ever**. Login/register/refresh set two
`httpOnly` cookies on the response instead:

| Cookie | Sent to | Path | Lifetime | Contents |
|---|---|---|---|---|
| `access_token` | every request to the site | `/` | 15 minutes | signed JWT |
| `refresh_token` | only requests to `/api/auth/*` | `/api/auth` | 7 days | random token (hashed in DB) |

Because they're `httpOnly`, JavaScript in the frontend **cannot read them** — that's
intentional. The frontend never touches the tokens directly; it just needs to make sure
the browser sends cookies along with API calls:

- **fetch**: `fetch(url, { credentials: "include", ... })`
- **axios**: `axios.create({ baseURL, withCredentials: true })`

Since frontend and backend are separate apps (different origins/ports in dev), you also
need CORS to allow credentialed cross-origin requests. That's what `FRONTEND_ORIGIN` is
for (see below) — ask the backend dev to set it to your frontend's exact origin
(e.g. `http://localhost:5173`), or requests will get `403 { "error": "Forbidden" }`.

To know if a visitor is logged in, don't try to read the cookie — just call
`GET /api/auth/me` and check whether it returns `200` or `401`.

## Data model these endpoints read/write

Defined in `prisma/schema.prisma`. Only `User` fields are ever exposed to the client
(never `passwordHash`); `RefreshToken` rows are never exposed at all — they exist purely
server-side to back the refresh cookie.

**User** (`model User`) — the `role` field below is the two-value enum `Role`:

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | primary key, returned to client |
| `email` | `String` | unique, stored lowercase, returned to client |
| `name` | `String?` | optional, returned to client |
| `passwordHash` | `String` | bcrypt hash, **never** returned to client |
| `role` | `Role` (`"USER" \| "ADMIN"`) | defaults to `USER`, returned to client |
| `createdAt` / `updatedAt` | `DateTime` | not currently returned to client |

**RefreshToken** (`model RefreshToken`) — internal only, drives `/refresh` and `/logout`:

| Field | Type | Notes |
|---|---|---|
| `tokenHash` | `String` | SHA-256 hash of the cookie value, never the raw token |
| `userId` | `String` | FK to `User`, cascade-deletes with the user |
| `expiresAt` | `DateTime` | 7 days from creation |
| `revokedAt` | `DateTime?` | set when rotated (refresh) or logged out |

---

## `POST /api/auth/register`

Creates a new user. Always creates role `USER` — any `role` or `isAdmin` field you send
is silently ignored (verified: sending `"role":"ADMIN"` still creates a `USER`).

**Request body** (validated against `lib/validation/auth.ts` → `registerSchema`):

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | yes | must look like an email; trimmed + lowercased before saving |
| `password` | string | yes | **8–72 bytes** (UTF-8 byte length, not character count) |
| `name` | string | no | 1–255 chars after trimming, if provided |

```json
{ "email": "user@example.com", "password": "correcthorsebatterystaple", "name": "Ada" }
```

**Success — `200`**, sets `access_token` + `refresh_token` cookies:
```json
{ "user": { "id": "cmub...", "email": "user@example.com", "name": "Ada", "role": "USER" } }
```

**Errors:**
| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "<message>" }` | bad/missing JSON, or a field fails validation |
| `409` | `{ "error": "Email already registered" }` | email already exists |

---

## `POST /api/auth/login`

Verifies credentials for an existing user (works for the seeded admin too — there is no
separate admin login endpoint).

**Request body:**

| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `password` | string | yes |

```json
{ "email": "user@example.com", "password": "correcthorsebatterystaple" }
```

**Success — `200`**, sets `access_token` + `refresh_token` cookies:
```json
{ "user": { "id": "cmub...", "email": "user@example.com", "name": "Ada", "role": "USER" } }
```

**Errors:**
| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "<message>" }` | bad/missing JSON, or a field fails validation |
| `401` | `{ "error": "Invalid email or password" }` | wrong password **or** unknown email — deliberately identical, both message and response time, so the frontend can't distinguish "no such account" from "wrong password" |

---

## `POST /api/auth/refresh`

No body needed — reads the `refresh_token` cookie. Rotates it (old one is revoked, a new
one issued) and issues a fresh `access_token`. Call this when a request comes back `401`
because the 15-minute access token expired, then retry the original request.

**Success — `200`**, sets new `access_token` + `refresh_token` cookies:
```json
{ "ok": true }
```

**Errors:**
| Status | Body | When |
|---|---|---|
| `401` | `{ "error": "Login required" }` | no `refresh_token` cookie present |
| `401` | `{ "error": "Invalid refresh token" }` | cookie present but expired, already revoked, or unknown to the DB — treat this as "fully logged out", redirect to login |

---

## `POST /api/auth/logout`

No body needed. Revokes the refresh token (if present) and clears both cookies. Always
succeeds, even if you were already logged out.

**Success — `200`:**
```json
{ "ok": true }
```

---

## `GET /api/auth/me`

Returns the current user. This is how the frontend checks "am I logged in" — no request
body, no `Content-Type` requirement (it's a `GET`).

**Success — `200`:**
```json
{ "id": "cmub...", "email": "user@example.com", "name": "Ada", "role": "USER" }
```

**Errors:**
| Status | Body | When |
|---|---|---|
| `401` | `{ "error": "Login required" }` | not logged in, or access token expired/invalid — call `/refresh` and retry, or send the user to login |

---

## Suggested frontend flow

1. On app load, call `GET /api/auth/me` to check session state.
2. If it 401s, try `POST /api/auth/refresh` once; if that also 401s, treat the user as logged out.
3. On any API call that comes back `401` mid-session, try one `/refresh` + retry before giving up (the access token is only good for 15 minutes).
4. Always send `credentials: "include"` / `withCredentials: true` — there is nothing else to attach.

## Environment variables relevant to the frontend

Only one of these matters to whoever's building the frontend — the rest are
backend-only (DB, JWT secret, admin seed credentials):

- `FRONTEND_ORIGIN` — must exactly match your frontend's origin (scheme + host + port,
  e.g. `http://localhost:5173`) for cross-origin cookies to work. Ask the backend dev to
  set this in their `.env`.
