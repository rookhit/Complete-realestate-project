# Auth API reference

Base URL (dev): `http://localhost:3000/api/v1`

All endpoints are under `/api/v1/auth/` (plus one admin endpoint under `/api/v1/admin/`). All
accept and return **JSON**. All state-changing endpoints require the request header:

```
Content-Type: application/json
```

If you send a request without it, you get a `400` error before anything else runs (see the
error envelope below).

## How auth actually works (read this first)

The **access token is returned in the JSON response body** on register/login/refresh and must
be kept in memory (not `localStorage`) and sent back as:

```
Authorization: Bearer <accessToken>
```

on every subsequent request. It expires in 15 minutes. The **refresh token is never exposed to
JavaScript** — it lives only in an `httpOnly` cookie:

| Cookie | Sent to | Path | Lifetime | Contents |
|---|---|---|---|---|
| `refresh_token` | only requests to `/api/v1/auth/*` | `/api/v1/auth` | 7 days | random token (hashed in DB) |

When a request comes back `401`, call `POST /api/v1/auth/refresh` once (it reads the cookie
automatically — send it with `credentials: "include"`), swap in the new `accessToken`, and retry
the original request exactly once. If the refresh also fails, treat the user as logged out.

Since frontend and backend are separate apps (different origins/ports in dev), requests need
`credentials: "include"` (fetch) / `withCredentials: true` (axios) so the refresh cookie is sent,
and CORS must allow it — that's what `FRONTEND_ORIGIN` is for (see below). Every endpoint also
answers `OPTIONS` preflight requests.

To know if a visitor is logged in on app load (no access token in memory yet, e.g. after a
reload), call `POST /api/v1/auth/refresh` first to mint a new access token from the refresh
cookie, then `GET /api/v1/auth/me`.

## Error envelope

Every error response, from any endpoint, has this shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Human readable, safe to display", "fields": { "email": "Enter a valid email address" }, "requestId": "..." } }
```

`fields` is only present for validation errors. Stable `code` values the frontend can branch on:
`VALIDATION_FAILED` · `UNAUTHENTICATED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `INTERNAL`.
(`RATE_LIMITED` is reserved for when rate limiting is added later.)

## Data model these endpoints read/write

Defined in `prisma/schema.prisma`. Only the fields listed below are ever exposed to the client
(never `passwordHash`); `RefreshToken` and `PasswordResetToken` rows are never exposed at all —
they exist purely server-side.

**User** — the object returned as `user` in responses:

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | primary key |
| `email` | `String` | unique, stored lowercase |
| `name` | `String` | required at registration |
| `phone` | `String` | Nepal format, e.g. `9812345678` or `+9779812345678` |
| `role` | `"USER" \| "ADMIN"` | authorization role. Always `USER` from public registration; there is exactly one `ADMIN`, seeded separately |
| `accountType` | `"MEMBER" \| "AGENCY" \| "AGENT"` | what kind of account this is — separate from `role` |
| `agencyName` | `String \| null` | set when `accountType` is `AGENCY` |
| `licenseNumber` | `String \| null` | set when `accountType` is `AGENCY` or `AGENT` |
| `verificationStatus` | `"NONE" \| "PENDING" \| "APPROVED" \| "REJECTED"` | `NONE` for members; `AGENCY`/`AGENT` start `PENDING` until an admin approves them (see the admin endpoint below) |

---

## `POST /auth/register`

Creates a new user. `role` is always `USER` — the API never accepts a `role` field. The account
type (`member`/`agency`/`agent`) is a separate, non-authorization field.

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | yes | must look like an email; trimmed + lowercased before saving |
| `password` | string | yes | 8–72 bytes (UTF-8 byte length, not character count) |
| `confirmPassword` | string | yes | must equal `password` |
| `name` | string | yes | 1–255 chars after trimming |
| `phone` | string | yes | Nepal mobile format |
| `type` | `"member" \| "agency" \| "agent"` | no | defaults to `"member"` |
| `agencyName` | string | only if `type` is `"agency"` | |
| `licenseNumber` | string | only if `type` is `"agency"` or `"agent"` | |

```json
{
  "email": "agent@example.com",
  "password": "correcthorsebatterystaple",
  "confirmPassword": "correcthorsebatterystaple",
  "name": "Ram Thapa",
  "phone": "9812345678",
  "type": "agent",
  "licenseNumber": "NB-LIC-1234"
}
```

**Success — `200`**, sets the `refresh_token` cookie:
```json
{
  "user": { "id": "cmub...", "email": "agent@example.com", "name": "Ram Thapa", "phone": "9812345678", "role": "USER", "accountType": "AGENT", "agencyName": null, "licenseNumber": "NB-LIC-1234", "verificationStatus": "PENDING" },
  "accessToken": "eyJhbGciOi..."
}
```

**Errors:** `400 VALIDATION_FAILED` (bad JSON, failed validation, missing agency/license fields
for the chosen type), `409 CONFLICT` (email already registered).

---

## `POST /auth/login`

Works for the seeded admin too — there is no separate admin login endpoint.

**Request body:** `{ "email": string, "password": string }`

**Success — `200`**, sets the `refresh_token` cookie:
```json
{ "user": { "...": "same shape as register" }, "accessToken": "eyJhbGciOi..." }
```

**Errors:** `400 VALIDATION_FAILED`, `401 UNAUTHENTICATED` (`"Invalid email or password"` —
deliberately identical for wrong password vs. unknown email, both message and response time).

---

## `POST /auth/refresh`

No body needed — reads the `refresh_token` cookie. Rotates it (old one revoked, new one issued)
and returns a fresh access token.

**Success — `200`**, sets a new `refresh_token` cookie:
```json
{ "accessToken": "eyJhbGciOi..." }
```

**Errors:** `401 UNAUTHENTICATED` — no cookie present, or it's expired/revoked/unknown (treat as
fully logged out and redirect to login).

---

## `POST /auth/logout`

No body needed. Revokes the refresh token (if present) and clears the cookie.

**Success — `204`**, no body.

---

## `GET /auth/me`

Requires `Authorization: Bearer <accessToken>`. This is how the frontend checks "am I logged in."

**Success — `200`:** `{ "user": { "...": "same shape as register" } }`

**Errors:** `401 UNAUTHENTICATED` — missing/expired/invalid access token. Call `/auth/refresh`
and retry once, or send the user to login.

---

## `POST /auth/forgot-password`

**Request body:** `{ "email": string }`

**Success — `204`, always** — regardless of whether the email exists, so the response can't be
used to enumerate accounts. If the email matches a user, a reset link is generated (currently
logged to the server console; no email provider is wired up yet).

**Errors:** `400 VALIDATION_FAILED` (malformed email).

---

## `POST /auth/reset-password`

**Request body:** `{ "token": string, "password": string }`

**Success — `204`.** The reset token is single-use and expires after 1 hour. All of the user's
existing refresh tokens are revoked, so any other logged-in sessions are signed out.

**Errors:** `400 VALIDATION_FAILED` (bad/expired/already-used token, or password fails the
8–72-byte rule).

---

## `PATCH /admin/users/:id/verification`

Admin-only. Approves or rejects a pending `AGENCY`/`AGENT` registration. Requires
`Authorization: Bearer <accessToken>` for an `ADMIN` user.

**Request body:** `{ "status": "APPROVED" | "REJECTED" }`

**Success — `200`:** `{ "user": { "...": "same shape as register, with the new verificationStatus" } }`

**Errors:** `401 UNAUTHENTICATED` (not logged in), `403 FORBIDDEN` (logged in but not admin),
`404 NOT_FOUND` (no such user).

---

## Suggested frontend flow

1. On app load, call `POST /auth/refresh` (the refresh cookie survives reloads even though the
   in-memory access token doesn't) to get a fresh `accessToken`, then `GET /auth/me`.
2. If `/auth/refresh` 401s, treat the user as logged out.
3. On any API call that comes back `401` mid-session, try one `/auth/refresh` + retry before
   giving up.
4. Always send `credentials: "include"` / `withCredentials: true` (for the refresh cookie) and
   `Authorization: Bearer <accessToken>` (for everything else).

## Environment variables relevant to the frontend

- `FRONTEND_ORIGIN` — must exactly match your frontend's origin (scheme + host + port, e.g.
  `http://localhost:5173`) for CORS and cross-origin cookies to work. Ask the backend dev to set
  this in their `.env`.
