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
| `refresh_token` | only requests to `/api/v1/auth/*` | `/api/v1/auth` | 7 days | random token (hashed in DB), `SameSite=Strict` |

The refresh token is bound to the browser it was issued to: a refresh from a different browser
or OS (by `User-Agent`, version numbers ignored) is rejected with `401`. If an already-rotated
refresh token is presented again more than 30 seconds later, it is treated as stolen and **every**
session of that user is revoked. Two tabs refreshing at the same moment are fine: the second
just gets a `401`. Avoid calling `/refresh` twice in parallel anyway; share one in-flight refresh
promise instead.

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
`VALIDATION_FAILED` · `UNAUTHENTICATED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `RATE_LIMITED` · `INTERNAL`.

`RATE_LIMITED` (`429`) always carries a `Retry-After` header (seconds, readable cross-origin).
Per-IP limits (sized for shared IPs such as mobile carrier NAT): 30 **failed** logins per 15 min
(successful logins never count), 20 failed 2FA codes per 15 min, register 20 per hour,
forgot-password 10 per hour. On top of
that, 5 wrong passwords in a row for one email from one IP lock that pair (see login).

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

---

## `POST /auth/register`

Creates a new user. `role` is always `USER` — the API never accepts a `role` field.

**Request body:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | yes | must look like an email; trimmed + lowercased before saving |
| `password` | string | yes | 8–72 bytes (UTF-8 byte length, not character count) |
| `confirmPassword` | string | yes | must equal `password` |
| `name` | string | yes | 1–255 chars after trimming |
| `phone` | string | yes | Nepal mobile format |

```json
{
  "email": "ram@example.com",
  "password": "correcthorsebatterystaple",
  "confirmPassword": "correcthorsebatterystaple",
  "name": "Ram Thapa",
  "phone": "9812345678"
}
```

**Success — `200`**, sets the `refresh_token` cookie:
```json
{
  "user": { "id": "cmub...", "email": "ram@example.com", "name": "Ram Thapa", "phone": "9812345678", "role": "USER" },
  "accessToken": "eyJhbGciOi..."
}
```

**Errors:** `400 VALIDATION_FAILED` (bad JSON, failed validation), `409 CONFLICT` (email already registered).

---

## `POST /auth/login`

Works for the seeded admin too — there is no separate admin login endpoint.

**Request body:** `{ "email": string, "password": string }`

**Success — `200`**, sets the `refresh_token` cookie:
```json
{ "user": { "...": "same shape as register" }, "accessToken": "eyJhbGciOi..." }
```

**Success with 2FA on — `200`**, no cookie, no token yet:
```json
{ "mfaRequired": true, "mfaToken": "eyJhbGciOi..." }
```
Show a code screen and call `POST /auth/login/2fa` within 5 minutes.

**Errors:** `400 VALIDATION_FAILED`, `401 UNAUTHENTICATED` (`"Invalid email or password"` —
deliberately identical for wrong password vs. unknown email, both message and response time),
`429 RATE_LIMITED` (locked — see below, or the per-IP limit).

**Lockout:** counted per **email + client IP**, not per account, so someone guessing from their
own IP can't lock the real user out, and unknown emails are treated exactly like real ones (a
`429` reveals nothing). 5 wrong passwords in a row lock that pair for 15 minutes; each further
wrong password after a lock ends doubles it (15 → 30 → 60 min …, max 24 h). While locked, every
login for that email from that IP is rejected with `429` — even with the correct password. The
response has a `Retry-After` header (seconds) and a message like
`"Too many failed login attempts. Try again in 15 minutes."`. A successful login clears it; a
password reset clears it for every IP.

---

## `POST /auth/login/2fa`

Second step for accounts with two-factor authentication.

**Request body:** `{ "mfaToken": string, "code": string }`. `code` is the 6-digit code from the
authenticator app, or one of the one-time recovery codes (`XXXX-XXXX`). After a Google sign-in
that needs 2FA (the backend redirects to `FRONTEND_ORIGIN/?auth=google_mfa`), omit `mfaToken`:
the backend keeps it in an httpOnly cookie.

**Success — `200`**, sets the `refresh_token` cookie: `{ "user": {...}, "accessToken": "..." }`.

**Errors:** `401 UNAUTHENTICATED` (`"Invalid code"`, or `"Your sign-in expired..."` → go back to
the password step), `429 RATE_LIMITED` (10 tries per 15 min per IP, 5 wrong codes per 15 min per
account). Each code works once.

---

## Two-factor authentication (authenticator app)

All three need `Authorization: Bearer <accessToken>`.

- `POST /auth/2fa/setup` — body `{ "password": string }` (omit for Google-only accounts).
  Returns `{ "secret": "BASE32...", "otpauthUrl": "otpauth://totp/..." }`. Add it to an
  authenticator app (scan `otpauthUrl` as a QR code, or type `secret` as a setup key).
- `POST /auth/2fa/enable` — body `{ "code": "123456" }`. Turns 2FA on and returns
  `{ "recoveryCodes": ["ABCD-EFGH", ...8], "accessToken": "..." }`. **Recovery codes are shown only
  this once.** Every other session is signed out; use the new `accessToken` from now on.
- `POST /auth/2fa/disable` — body `{ "password": string, "code": string }` (code = authenticator
  or recovery code). `204`.

`GET /auth/me` now includes `"twoFactorEnabled": boolean` in `user`. **The admin must have 2FA on:**
admin endpoints answer `403` until it is enabled.

---

## `POST /auth/refresh`

No body needed — reads the `refresh_token` cookie. Rotates it (old one revoked, new one issued)
and returns a fresh access token.

**Success — `200`**, sets a new `refresh_token` cookie:
```json
{ "accessToken": "eyJhbGciOi..." }
```

**Errors:** `401 UNAUTHENTICATED` — no cookie present, or it's expired/revoked/unknown, or it was
issued to a different browser (treat as fully logged out and redirect to login). The response
also clears the dead cookie.

`409 CONFLICT` (with `Retry-After: 1`) — another tab refreshed the same cookie at the same moment
and won. The cookie is **not** cleared; the browser already holds the winner's new one. Wait a
few hundred ms and call `/auth/refresh` once more (the frontend's `auth.tsx` does this).

---

## `POST /auth/logout`

No body needed. Revokes the refresh token (if present) and clears the cookie.

**Success — `204`**, no body.

---

## `GET /auth/me`

Requires `Authorization: Bearer <accessToken>`. This is how the frontend checks "am I logged in."

**Success — `200`:** `{ "user": { "...": "same shape as register", "twoFactorEnabled": false } }`

Unlike most endpoints, `/me` also rejects access tokens issued before a password reset, stolen
refresh-token detection or enabling 2FA (it checks the database), so use it to confirm a session.

**Errors:** `401 UNAUTHENTICATED` — missing/expired/invalid access token. Call `/auth/refresh`
and retry once, or send the user to login.

---

## `POST /auth/forgot-password`

**Request body:** `{ "email": string }`

**Success — `204`, always** — regardless of whether the email exists, so the response can't be
used to enumerate accounts. If the email matches a user, a reset link is generated (currently
logged to the server console; no email provider is wired up yet). The link is
`FRONTEND_ORIGIN/reset-password?token=...` and is valid for **15 minutes**.

**Errors:** `400 VALIDATION_FAILED` (malformed email), `429 RATE_LIMITED`.

---

## `POST /auth/verify-reset-token`

**Request body:** `{ "token": string }`

Lets the reset page check the link before showing the "new password" form. Does **not** use up
the token.

**Success — `204`** (usable). **Errors:** `400 VALIDATION_FAILED` (unknown, used or expired).

---

## `POST /auth/reset-password`

**Request body:** `{ "token": string, "password": string }`

**Success — `204`.** The reset token is single-use and expires after 15 minutes. All of the
user's existing refresh tokens are revoked (every device is signed out, including this browser,
whose refresh cookie is cleared) and the login lockout is reset. The user logs in again with the
new password.

**Errors:** `400 VALIDATION_FAILED` (bad/expired/already-used token, or password fails the
8–72-byte rule).

---

## Google sign-in and existing accounts

If someone signs in with Google using an email that already has an email+password account,
the Google identity is linked to it, **the old password is removed and all its sessions are
signed out** (registration doesn't verify email ownership yet, so that password may not
belong to the email's owner). The user can set a password again with forgot-password.

---

## `GET /admin/users`

Admin-only. Lists every user, newest first. Requires `Authorization: Bearer <accessToken>` for
the `ADMIN` user. There is exactly one admin: it is seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in
`.env` (`npm run db:seed`) and logs in through the normal `POST /auth/login`.

**Success — `200`:**
```json
{ "users": [ { "id": "cmub...", "email": "ram@example.com", "name": "Ram Thapa", "phone": "9812345678", "role": "USER", "createdAt": "2026-09-24T10:00:00.000Z" } ] }
```

**Errors:** `401 UNAUTHENTICATED` (not logged in, or a token from before a password reset),
`403 FORBIDDEN` (not admin, or the admin hasn't turned on 2FA yet).

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
