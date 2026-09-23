# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Project

Backend for a real estate website, built with Next.js (App Router), TypeScript, Prisma and PostgreSQL hosted on Supabase (free tier). A friend builds the frontend; this repo provides the API.

The developer works on Windows with PowerShell. Give commands that work there.

Current phase: authentication and authorization foundation only.

Scope

This backend implements the API contract proposed by the frontend's own CLAUDE.md (Nepal Bhoomi
repo, §6-§8), by explicit request. That expanded scope beyond the original plan and overrode two
rules below (see "Authentication design" and "Implementation status").

In scope now:

Endpoints: register, login, refresh, logout, current user (me), forgot-password, reset-password, Google sign-in (start + callback).
One admin-only endpoint to approve/reject agency/agent verification (not a dashboard).
Password hashing with bcryptjs, JWT access tokens with jose, refresh tokens stored hashed in Postgres.
Password reset tokens stored hashed in Postgres (email delivery is stubbed — see below).
Two authorization roles, USER and ADMIN, with exactly one ADMIN.
A separate, non-authorization accountType (MEMBER/AGENCY/AGENT) with a verificationStatus workflow for AGENCY/AGENT.
Reusable server-side guards: getAuthUser(), requireAuth(), requireAdmin().
A seed script that creates the single admin.

Out of scope. Do NOT build these unless I ask:

Middleware / proxy route protection (I will add it later).
Reactions, comments, inquiries (the inquiry channel, WhatsApp or email, is not decided yet).
Email verification, OAuth / social login other than Google, 2FA, admin dashboard.
Real email delivery for password reset (currently logs the reset link to the console — no provider chosen yet).
Any business tables (properties, comments, inquiries).

Reactions, comments and inquiries will later call requireAuth() on the server. Keep the guards generic and easy to reuse.

Commands
npm run dev: start the dev server (http://localhost:3000)
npm run build: production build
npm run lint: ESLint
npx tsc --noEmit: type check (run after every change)
npx prisma migrate dev --name <name>: create and apply a migration
npx prisma studio: browse the database
npm run db:seed: run prisma/seed.ts with tsx (add this script when creating the seed)
Authentication design (do not deviate)
Passwords: bcryptjs, cost 12. Length 8 to 72 bytes (bcrypt only reads 72 bytes, so measure bytes, not characters).
Access token: JWT, HS256, library jose (not jsonwebtoken, so it also works in Next.js middleware / proxy later). Expires in 15 minutes. Claims: sub (user id), role, iss, aud, iat, exp. Signed with JWT_ACCESS_SECRET (at least 32 random characters; fail at startup if missing or short). On every verification check the algorithm, issuer and audience.
Refresh token: 32 random bytes, NOT a JWT. Store only its SHA-256 hash in the RefreshToken table. Expires in 7 days. Rotate on every refresh: revoke the old row, issue a new token. Reject expired, revoked or unknown tokens.
Access token delivery: returned in the JSON response body on register/login/refresh, kept in memory by the frontend, sent back as `Authorization: Bearer <token>`. This overrides the original "never return tokens in a JSON body" rule — done by explicit request to match the frontend's contract (its §8.2b in-memory-token flow). There is no access_token cookie anymore.
Refresh token cookie: httpOnly, secure in production, sameSite: "lax", path /api/v1/auth, max age 7 days. Never suggest localStorage for it.
Logout: revoke the refresh token row and clear the refresh cookie. Responds 204 (frontend contract), no body.
The role inside the access token is trusted until it expires (15 minutes). Accepted trade-off.
Password reset: 32 random bytes hashed with SHA-256 in a PasswordResetToken table (same pattern as refresh tokens), 1 hour expiry, single-use. forgot-password always responds 204 regardless of whether the email exists. Resetting the password revokes all of that user's refresh tokens. Email delivery is stubbed: the reset link is logged to the server console, not emailed — no provider is configured yet.
CORS: lib/http/cors.ts sets Access-Control-Allow-Origin (only when it matches FRONTEND_ORIGIN), -Credentials and -Headers; every route exports an OPTIONS handler. This is done per-route, not in middleware, since middleware stays out of scope.
Roles
Public register ALWAYS creates USER. Ignore any role, isAdmin or similar field in request bodies.
Exactly one ADMIN, created only by prisma/seed.ts from ADMIN_EMAIL and ADMIN_PASSWORD. No API creates or promotes an admin.
Postgres enforces it: add this line by hand at the end of the first migration SQL (Prisma cannot express partial indexes): CREATE UNIQUE INDEX "only_one_admin" ON "User" ("role") WHERE "role" = 'ADMIN';
The admin logs in through the same login endpoint as everyone else, and never through Google (Google login rejects ADMIN accounts).
accountType (MEMBER/AGENCY/AGENT) is a separate field from role and carries no extra authorization — it's what the frontend's register form calls "member/agency/agent". AGENCY/AGENT accounts register as role USER with verificationStatus PENDING; only the admin-only verification endpoint can move that to APPROVED/REJECTED.
Authorization
getAuthUser(request): reads Authorization: Bearer <token> from the request header (not a cookie), verifies it, returns { id, role } or null.
requireAuth(request): returns the user or throws a 401 { "error": { "code": "UNAUTHENTICATED", ... } }.
requireAdmin(request): calls requireAuth(request), then throws a 403 { "error": { "code": "FORBIDDEN", ... } } if the role is not ADMIN.
Checks always run on the server inside route handlers. Middleware / proxy will only be a convenience for redirects, never the security boundary.
API endpoints

Base path /api/v1. All accept and return JSON.

Method	Path	Who	Behavior
POST	/api/v1/auth/register	anyone	Validate, create a USER, issue tokens, return { user, accessToken }. 409 if the email exists.
POST	/api/v1/auth/login	anyone	Verify credentials, issue tokens, return { user, accessToken }. Same 401 for wrong password and unknown email.
POST	/api/v1/auth/refresh	has refresh cookie	Rotate the refresh token, return { accessToken }. 401 if invalid.
POST	/api/v1/auth/logout	anyone	Revoke the refresh token, clear the cookie. 204.
GET	/api/v1/auth/me	logged in (Bearer)	Return { user }.
POST	/api/v1/auth/forgot-password	anyone	Always 204. Logs a reset link to the console if the email matches a user.
POST	/api/v1/auth/reset-password	has valid reset token	Set the new password, revoke all refresh tokens for that user. 204.
PATCH	/api/v1/admin/users/:id/verification	admin only	Set verificationStatus to APPROVED or REJECTED. Return { user }.
GET	/api/v1/auth/google	anyone (browser navigation)	303 to Google with state + PKCE; the state/verifier live in a short-lived httpOnly cookie.
GET	/api/v1/auth/google/callback	Google	Verify state + ID token, find/link/create the user, record the login in OAuthAccount, set the refresh cookie, 303 to FRONTEND_ORIGIN/?auth=google (or ?auth_error=google).
Data model (auth only)
Role enum: USER, ADMIN. AuthProvider enum: GOOGLE. AccountType enum: MEMBER, AGENCY, AGENT. VerificationStatus enum: NONE, PENDING, APPROVED, REJECTED.
User: id (cuid), email (unique, stored lowercase), name, phone, passwordHash (optional — null for Google-only users), role (default USER), accountType (default MEMBER), agencyName (optional), licenseNumber (optional), verificationStatus (default NONE), createdAt, updatedAt.
RefreshToken: id, tokenHash (unique), userId, expiresAt, revokedAt (optional), createdAt. Relation to User with cascade delete. Index on userId.
PasswordResetToken: id, tokenHash (unique), userId, expiresAt, usedAt (optional), createdAt. Relation to User with cascade delete. Index on userId.
OAuthAccount: id, userId, provider (AuthProvider), providerAccountId (Google sub), email, emailVerified, name (optional), pictureUrl (optional), lastLoginAt, createdAt, updatedAt. Unique (provider, providerAccountId). Relation to User with cascade delete. Index on userId. Stores only the profile Google returns, never Google access/refresh tokens.
File layout
app/api/v1/auth/register/route.ts
app/api/v1/auth/login/route.ts
app/api/v1/auth/refresh/route.ts
app/api/v1/auth/logout/route.ts
app/api/v1/auth/me/route.ts
app/api/v1/auth/forgot-password/route.ts
app/api/v1/auth/reset-password/route.ts
app/api/v1/admin/users/[id]/verification/route.ts
lib/prisma.ts                  single shared Prisma client
lib/auth/password.ts           hashPassword, verifyPassword
lib/auth/jwt.ts                signAccessToken, verifyAccessToken
lib/auth/refresh-token.ts      create, rotate, revoke, revokeAllForUser (hash stored in DB)
lib/auth/password-reset.ts     create, consume (hash stored in DB, single-use)
lib/auth/cookies.ts            set and clear the refresh cookie
lib/auth/guards.ts             getAuthUser, requireAuth, requireAdmin, HttpError, jsonResponse, noContentResponse, errorResponse
lib/http/cors.ts               corsHeaders, preflightResponse
lib/validation/auth.ts         zod schemas
lib/auth/google.ts             Google authorize URL, PKCE/state, code exchange, ID-token verification (jose remote JWKS)
lib/auth/oauth-account.ts      findOrCreateGoogleUser (link by googleId, else by verified email, else create USER)
lib/http/frontend-redirect.ts  redirectToFrontend (always FRONTEND_ORIGIN, never a request-supplied URL)
app/api/v1/auth/google/route.ts
app/api/v1/auth/google/callback/route.ts
prisma/schema.prisma
prisma/seed.ts

The import alias @/* maps to the repo root (no src/ folder).

Environment variables

Names only. Never print, log or commit values. Only I edit .env.

DATABASE_URL: Supabase pooled connection string (used by the running app).
DIRECT_URL: Supabase direct or session-pooler string (used for migrations), if the installed Prisma version needs it.
JWT_ACCESS_SECRET: at least 32 random characters.
ADMIN_EMAIL, ADMIN_PASSWORD: used only by the seed script.
FRONTEND_ORIGIN: the frontend's origin, used for CORS, the Origin check, and the Google-login redirect back to the frontend (required for Google login).
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI: Google OAuth web client. Read lazily, so the rest of the API starts without them.
Security rules
Validate every request body with zod. Only pick known fields.
Normalize email with trim and lowercase.
Login returns the same generic error for a wrong password and an unknown email. When the user does not exist, still run a dummy bcrypt comparison so response time is similar.
NEVER return passwordHash, token hashes or tokens from any endpoint. Use an explicit Prisma select and never return a full User row.
Never log passwords, tokens or secrets.
Require Content-Type: application/json on POST routes. If FRONTEND_ORIGIN is set, reject state-changing requests whose Origin header does not match it.
Handle errors in one place. Return { "error": { "code", "message", "fields"?, "requestId" } } with the right status (400, 401, 403, 404, 409, 500), per the frontend's error envelope contract. No stack traces or database errors in responses.
Rate limiting for login and register comes later. Structure the code so it is easy to add.
Code conventions
TypeScript strict mode. No any. Explicit return types on exported functions.
Use the @/ import alias.
Small files with one job each. Keep route handlers thin: validate, call a helper, return JSON.
In this Next.js version cookies() is async. Follow AGENTS.md and read node_modules/next/dist/docs/ before using framework APIs.
Check the installed Prisma version and follow its current docs. Recent versions need a prisma.config.ts file and a driver adapter (for example @prisma/adapter-pg with pg).
Working rules
One step at a time. Explain what you changed in simple words.
Ask before installing any package that is not listed in this file.
Never open, print or edit .env. Tell me which variables to set.
After each change run npx tsc --noEmit and npm run lint and fix problems.
Do not run git commit. I commit myself.
Do not add features outside the scope above.

Implementation status

The authentication foundation described above is built and has been manually verified end to end against the real Supabase database (register, login, refresh, logout, me, duplicate-email 409, wrong/unknown-login 401, missing Content-Type 400, role/isAdmin body fields ignored). All files listed under "File layout" exist. Notes for picking this up again:

Dependencies actually installed (pinned, not "latest", because prisma's "latest" npm tag currently points to an 8.0.0 release candidate): prisma@7.10.0, @prisma/client@7.10.0, @prisma/adapter-pg@7.10.0, pg, @types/pg, bcryptjs@3.0.3, jose@6.2.12, zod@4.6.5, tsx.

Prisma 7 specifics (this is not the Prisma you know, same spirit as the Next.js warning in AGENTS.md):
- The generator in prisma/schema.prisma is `provider = "prisma-client"` (the new default, not the old "prisma-client-js") with `output = "../generated/prisma"`. It generates plain .ts source files (not precompiled js+d.ts), imported as `@/generated/prisma/client`. That folder is gitignored and regenerated with `npx prisma generate`.
- schema.prisma's `datasource db` block has no `url` line. The connection string is supplied by prisma.config.ts instead, only to CLI commands (migrate, studio, db execute).
- prisma.config.ts loads .env itself via Node's built-in `process.loadEnvFile()` (no dotenv package installed). It points the CLI's datasource url at DIRECT_URL, falling back to DATABASE_URL, because migrations need a direct (non-pooled) connection.
- lib/prisma.ts is unrelated to that: it builds its own PrismaPg driver adapter from the pooled DATABASE_URL for the running app. The two URLs are read independently in two different places by design.
- prisma/seed.ts must load .env and then dynamically `import()` lib/prisma.ts, not statically import it at the top of the file. Static ES module imports execute before any other top-level code in the importing file, so a static import would construct the PrismaPg adapter with DATABASE_URL still undefined.
- The `only_one_admin` partial unique index was appended by hand to prisma/migrations/20260921120440_init/migration.sql per the rule above, but that migration had already been applied before the edit was made, so the index was also applied directly to the live database with `npx prisma db execute --file <sql>` (a plain `migrate dev` would only pick up file edits on a fresh, unapplied migration). `prisma migrate status` shows no drift after doing it this way.

npm supply-chain notes from installing: npm 11's install-scripts gate blocked postinstall for prisma, @prisma/engines, esbuild and unrs-resolver (needed for Prisma's engine binary and native deps) — approved via `npm install-scripts approve <pkg>`, recorded in package.json's `allowScripts`. `npm audit` still reports 4 high-severity findings in mysql2/deepmerge-ts, transitive dev-only dependencies of the prisma CLI itself (unused, since this project is Postgres-only); fixing them would force-downgrade prisma to 6.19.3, so they were left as-is with the user's sign-off.

lib/auth/guards.ts holds more than the three functions named in "Authorization" above: it also exports `HttpError`, `requireJsonContentType`, `requireAllowedOrigin`, and `errorResponse` (the single place that turns a thrown HttpError, or any other error, into the `{ "error": "message" }` JSON response with the right status, per the "Handle errors in one place" rule). Every route calls these instead of duplicating the checks.

The admin was seeded as admin@gmail.com via `npm run db:seed`.

2026-09-22 — aligned with the frontend's proposed API contract, by explicit request (see "Scope" above for what this changed and "Authentication design" for the token-delivery override). What changed: routes moved from app/api/auth/* to app/api/v1/auth/*; access token is now returned in the response body and read from Authorization: Bearer (no more access_token cookie — getAuthUser/requireAuth/requireAdmin now take request as a parameter); error responses moved from { "error": "message" } to { "error": { code, message, fields?, requestId } }; added forgot-password/reset-password (email delivery stubbed to console.log, no provider chosen yet); added accountType/agencyName/licenseNumber/verificationStatus/phone to User and a PasswordResetToken table (migration `20260922165634_add_account_type_verification_password_reset`); added one admin-only PATCH endpoint to approve/reject agency/agent verification; added per-route CORS headers + OPTIONS handlers in lib/http/cors.ts.

Migration gotcha hit while doing this: `npx prisma migrate dev` refused to run because `20260921120440_init/migration.sql`'s on-disk checksum no longer matched what Prisma recorded when it was first applied (expected — that file was hand-edited after being applied, to add `only_one_admin`, per the note above). Prisma's only built-in fix is `prisma migrate reset`, which drops all data; instead, with the user's explicit sign-off, the stored checksum in the `_prisma_migrations` table was updated directly (via a one-off Node script using `pg`) to match the current file content — a metadata-only fix, no schema or data change — after which `migrate dev` worked normally. If this happens again on a migration that's been hand-edited post-apply, that's the fix, not a reset.

2026-09-23 — added Google sign-in, by explicit request (overrides the earlier "no OAuth" rule). Flow: browser GET /api/v1/auth/google → 303 to Google with state + PKCE (S256), both kept in a 10-minute httpOnly google_oauth cookie (path /api/v1/auth/google, read-and-deleted on callback) → Google → GET /api/v1/auth/google/callback verifies state, exchanges the code, verifies the ID token (RS256, Google issuers, aud = client id), requires email_verified, finds/links/creates the user and records the login in OAuthAccount, sets the normal refresh cookie, and 303s to FRONTEND_ORIGIN/?auth=google (or ?auth_error=google on any failure). The frontend then calls POST /refresh for an access token — no token ever goes in a URL. Existing login already handles a null passwordHash via the dummy-hash path (same 401). Migration: 20260923091328_add_google_oauth. The repo root now holds backend-realstate/ (this app) and frontend-realstate/ (a copy of the frontend); run backend commands from backend-realstate/. Frontend side (frontend-realstate/src/app/App.tsx, LoginPage): a "Continue with Google" button that navigates to /api/v1/auth/google, and handling of ?auth=google (POST /refresh with credentials, then GET /me, show the signed-in panel) and ?auth_error=google (show an error). Frontend env: VITE_API_URL (defaults to http://localhost:3000). Verified end to end in Chrome with two real Google accounts: both created USER/MEMBER rows with no password plus an OAuthAccount row each; a wrong Google password never reaches the backend. The frontend repo's CLAUDE.md (frontend-realstate/FRONTEND_CLAUDE.md) got a matching §7.4b, §9.3 env rows, two §12 requests and a §13 entry. All of this, plus the repo restructure, was pushed as branch feat/be-google-auth to the nepal-bhoomi remote (main untouched), committed by explicit request.

Not yet updated: the frontend repo's own CLAUDE.md (a different repo, not checked out here) still needs its §13 change log updated per its own "any change to a shared contract must update this file in the same commit" rule — hand that entry to whoever owns that repo, or check it out separately if asked to update it directly.