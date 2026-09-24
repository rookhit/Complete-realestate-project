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
One admin-only endpoint to list users (not a dashboard).
Password hashing with bcryptjs, JWT access tokens with jose, refresh tokens stored hashed in Postgres.
Password reset tokens stored hashed in Postgres (email delivery is stubbed — see below).
Two authorization roles, USER and ADMIN, with exactly one ADMIN.
Reusable server-side guards: getAuthUser(), requireAuth(), requireAdmin().
A seed script that creates the single admin.

Out of scope. Do NOT build these unless I ask:

Middleware / proxy route protection (I will add it later).
Reactions, comments, inquiries (the inquiry channel, WhatsApp or email, is not decided yet).
Email verification, OAuth / social login other than Google, admin dashboard. (TOTP 2FA was added by explicit request on 2026-09-24.)
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
Refresh token: 32 random bytes, NOT a JWT. Store only its SHA-256 hash in the RefreshToken table. Expires in 7 days. Rotate on every refresh: revoke the old row (conditional update, so concurrent refreshes can't both win), issue a new token. Reject expired, revoked or unknown tokens. Each row records the ipAddress and userAgent it was issued to. A refresh whose User-Agent is a different browser/OS family (version digits ignored, lib/http/request-context.ts) is rejected and that token revoked. A token already rotated more than 30 s ago (rotatedAt) being presented again = reuse → revoke ALL of the user's refresh tokens and write a refresh_token_reuse audit event. Within 30 s it's a harmless double-refresh race (two tabs): 409 CONFLICT + Retry-After and the cookie is NOT cleared (clearing it would delete the winning tab's new cookie and log the user out); the frontend retries once. Same 409 when the conditional rotation update loses. IP is recorded only, never enforced (mobile IPs change constantly).
Access token delivery: returned in the JSON response body on register/login/refresh, kept in memory by the frontend, sent back as `Authorization: Bearer <token>`. This overrides the original "never return tokens in a JSON body" rule — done by explicit request to match the frontend's contract (its §8.2b in-memory-token flow). There is no access_token cookie anymore.
Refresh token cookie: httpOnly, secure in production, sameSite: "strict" (changed from lax on 2026-09-24; it's only ever sent by fetch, never on navigation), path /api/v1/auth, max age 7 days. A 401 from /refresh clears it. Never suggest localStorage for it.
Logout: revoke the refresh token row and clear the refresh cookie. Responds 204 (frontend contract), no body.
The role inside the access token is trusted by requireAuth until it expires (15 minutes). requireFreshAuth and requireAdmin instead read role + sessionsRevokedAt from the database and reject tokens whose iat (whole seconds) is before User.sessionsRevokedAt. sessionsRevokedAt is set by password reset, refresh-token reuse (revokeAllSessionsForUser), Google linking to an existing account, and enabling 2FA.
2FA (TOTP, lib/auth/totp.ts + lib/auth/mfa.ts, no package): RFC 6238, SHA1, 6 digits, 30 s, ±1 step. Secret AES-256-GCM encrypted with TOTP_ENCRYPTION_KEY, user id as AAD. totpLastUsedStep blocks replay. 8 recovery codes (MfaRecoveryCode, SHA-256 hashed, single use). Login with 2FA on returns { mfaRequired, mfaToken } (JWT, same secret, audience "realstate-mfa", 5 min) instead of a session; POST /auth/login/2fa finishes. Google sign-in for a 2FA account puts the mfaToken in an httpOnly mfa_pending cookie (path /api/v1/auth/login/2fa) and redirects to ?auth=google_mfa. setup/disable re-check the current password (skipped for Google-only accounts). Limits: 10 tries/15 min per IP ("mfa"), 5 wrong codes/passwords per 15 min per user. The ADMIN must have 2FA on: requireAdmin returns 403 otherwise.
Password reset: 32 random bytes hashed with SHA-256 in a PasswordResetToken table (same pattern as refresh tokens), 15 minute expiry, single-use. The reset (mark token used + new password + lockout reset + revoke all refresh tokens) is one transaction in lib/auth/password-reset.ts. forgot-password always responds 204 regardless of whether the email exists. Resetting the password revokes all of that user's refresh tokens. Email delivery is stubbed: the reset link is logged to the server console, not emailed — no provider is configured yet.
Security headers: next.config.ts sends nosniff, X-Frame-Options DENY, Referrer-Policy no-referrer, CSP "default-src 'none'; frame-ancestors 'none'", CORP same-site, Permissions-Policy on every response, Cache-Control: no-store on /api/*, HSTS in production only; poweredByHeader off.
CORS: lib/http/cors.ts sets Access-Control-Allow-Origin (only when it matches FRONTEND_ORIGIN), -Credentials and -Headers; every route exports an OPTIONS handler. This is done per-route, not in middleware, since middleware stays out of scope.
Roles
Public register ALWAYS creates USER. Ignore any role, isAdmin or similar field in request bodies.
Exactly one ADMIN, created only by prisma/seed.ts from ADMIN_EMAIL and ADMIN_PASSWORD. No API creates or promotes an admin.
Postgres enforces it: this line is at the end of the baseline migration SQL (prisma/migrations/20260924130000_init) (Prisma cannot express partial indexes): CREATE UNIQUE INDEX "only_one_admin" ON "User" ("role") WHERE "role" = 'ADMIN';
The admin logs in through the same login endpoint as everyone else, and never through Google (Google login rejects ADMIN accounts).
Registration is member-only, matching the frontend. There are no agency/agent account types.
Authorization
getAuthUser(request): reads Authorization: Bearer <token> from the request header (not a cookie), verifies it, returns { id, role } or null.
requireAuth(request): returns the user or throws a 401 { "error": { "code": "UNAUTHENTICATED", ... } }.
requireFreshAuth(request): requireAuth + one DB lookup (see "Authentication design"); use for anything sensitive. /auth/me and the 2FA routes use it.
requireAdmin(request): calls requireFreshAuth(request), then throws a 403 { "error": { "code": "FORBIDDEN", ... } } if the role is not ADMIN or the admin hasn't enabled 2FA.
Checks always run on the server inside route handlers. Middleware / proxy will only be a convenience for redirects, never the security boundary.
API endpoints

Base path /api/v1. All accept and return JSON.

Method	Path	Who	Behavior
POST	/api/v1/auth/register	anyone	Validate, create a USER, issue tokens, return { user, accessToken }. 409 if the email exists.
POST	/api/v1/auth/login	anyone	Verify credentials, issue tokens, return { user, accessToken } — or { mfaRequired, mfaToken } when 2FA is on. Same 401 for wrong password and unknown email. Lockout is per (client IP, email), applied to unknown emails too: 5 wrong → 429 for 15 min, doubling (max 24 h); 50 failures/day on one account only raises a login_attack_suspected audit event. See lib/auth/login-lockout.ts.
POST	/api/v1/auth/login/2fa	has mfaToken (body or mfa_pending cookie)	{ code } = TOTP or recovery code → { user, accessToken } + refresh cookie.
POST	/api/v1/auth/2fa/setup	logged in (fresh)	{ password? } → { secret, otpauthUrl }.
POST	/api/v1/auth/2fa/enable	logged in (fresh)	{ code } → { recoveryCodes, accessToken }; revokes all other sessions.
POST	/api/v1/auth/2fa/disable	logged in (fresh)	{ password?, code } → 204.
POST	/api/v1/auth/refresh	has refresh cookie	Rotate the refresh token, return { accessToken }. 401 if invalid.
POST	/api/v1/auth/logout	anyone	Revoke the refresh token, clear the cookie. 204.
GET	/api/v1/auth/me	logged in (Bearer)	Return { user }.
POST	/api/v1/auth/forgot-password	anyone	Always 204. Logs a reset link to the console if the email matches a user.
POST	/api/v1/auth/verify-reset-token	anyone	204 if the reset token is still usable, else 400. Does not consume it.
POST	/api/v1/auth/reset-password	has valid reset token	Set the new password, revoke all refresh tokens for that user. 204.
GET	/api/v1/admin/users	admin only	Return { users } (id, email, name, phone, role, createdAt), newest first.
GET	/api/cron/cleanup-tokens	scheduler (Bearer CRON_SECRET)	Deletes dead refresh/reset tokens, old RateLimit rows, audit logs > 180 days. 404 while CRON_SECRET is unset.
GET	/api/v1/auth/google	anyone (browser navigation)	303 to Google with state + PKCE; the state/verifier live in a short-lived httpOnly cookie.
GET	/api/v1/auth/google/callback	Google	Verify state + ID token, find/link/create the user, record the login in OAuthAccount, set the refresh cookie, 303 to FRONTEND_ORIGIN/?auth=google (or ?auth_error=google).
Data model (auth only)
Role enum: USER, ADMIN. AuthProvider enum: GOOGLE.
User: id (cuid), email (unique, stored lowercase), name, phone, passwordHash (optional — null for Google-only users), role (default USER), lastLoginAt, lastLoginIp, sessionsRevokedAt, totpSecret (encrypted), totpEnabledAt, totpLastUsedStep, createdAt, updatedAt.
LoginLockout: key ("<ip>:<sha256(email)>", primary key), failedCount, lockedUntil, updatedAt.
MfaRecoveryCode: id, userId (cascade), codeHash (unique), usedAt, createdAt. Index on userId.
RefreshToken: id, tokenHash (unique), userId, ipAddress, userAgent, expiresAt, revokedAt (optional), rotatedAt (optional, set only by /refresh rotation), createdAt. Relation to User with cascade delete. Indexes on userId, expiresAt, revokedAt.
AuditLog: id, userId (optional, SetNull on user delete), event, ipAddress, userAgent, metadata (Json), createdAt. Indexes on userId, createdAt.
RateLimit: key ("<action>:<ip>", primary key), count, windowStart.
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
app/api/v1/admin/users/route.ts
lib/prisma.ts                  single shared Prisma client
lib/auth/password.ts           hashPassword, verifyPassword
lib/auth/jwt.ts                signAccessToken, verifyAccessToken
lib/auth/refresh-token.ts      create, rotate, revoke, revokeAllForUser (hash stored in DB)
lib/auth/password-reset.ts     create, consume (hash stored in DB, single-use)
lib/auth/login-lockout.ts      per-(IP, email) lockout (LoginLockout table), account attack alert, recordSuccessfulLogin
lib/auth/session.ts            startSession (access token + refresh cookie + last login + audit)
lib/auth/totp.ts               TOTP, base32, secret encryption, recovery code generation/hashing
lib/auth/mfa.ts                verifySecondFactor, begin/completeTotpSetup, disableTotp, assertCurrentPassword
lib/http/body.ts               readJsonBody (Content-Type + Origin checks + zod parse) for newer routes
app/api/v1/auth/login/2fa/route.ts
app/api/v1/auth/2fa/{setup,enable,disable}/route.ts
lib/auth/rate-limit.ts         enforceRateLimit(action, ip), Postgres-backed
lib/auth/audit.ts              logAuthEvent (AuditLog table)
lib/http/request-context.ts    getRequestContext (client IP + User-Agent), isSameUserAgentFamily
lib/cron/cleanup-tokens.ts     cleanupExpiredTokens
app/api/v1/auth/verify-reset-token/route.ts
app/api/cron/cleanup-tokens/route.ts
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
CRON_SECRET: at least 32 random characters; enables GET /api/cron/cleanup-tokens (optional).
TOTP_ENCRYPTION_KEY: 32 random bytes, base64 (encrypts 2FA secrets). Read lazily; required as soon as anyone uses 2FA. Changing it makes every stored 2FA secret unreadable (users would need recovery codes / re-setup).
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI: Google OAuth web client. Read lazily, so the rest of the API starts without them.
Security rules
Validate every request body with zod. Only pick known fields.
Normalize email with trim and lowercase.
Login returns the same generic error for a wrong password and an unknown email. When the user does not exist, still run a dummy bcrypt comparison so response time is similar.
NEVER return passwordHash, token hashes or tokens from any endpoint. Use an explicit Prisma select and never return a full User row.
Never log passwords, tokens or secrets.
Require Content-Type: application/json on POST routes. Reject state-changing requests whose Origin header does not match FRONTEND_ORIGIN. If FRONTEND_ORIGIN is missing: skipped in development, 500 in production (fail closed).
forgot-password logs the reset link only when NODE_ENV !== "production" (until email OTP exists, forgot-password does nothing visible in production).
Handle errors in one place. Return { "error": { "code", "message", "fields"?, "requestId" } } with the right status (400, 401, 403, 404, 409, 500), per the frontend's error envelope contract. No stack traces or database errors in responses.
Supabase REST API lockout: every table has RLS enabled with no policies, and anon/authenticated have no privileges (migration 20260924160000_enable_rls). The backend connects as postgres (table owner, bypasses RLS) so it is unaffected. EVERY new table's migration must add `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` (Prisma can't express it) — otherwise Supabase's REST API exposes it.
Google linking to an existing account (same email) clears that account's passwordHash and revokes its refresh tokens, because registration doesn't verify email ownership (pre-account hijacking). Relax this to "only if the email was never verified" once email OTP verification exists.
A successful password reset also invalidates every other unused reset token of that user.
Rate limiting: per-IP fixed windows in the Postgres RateLimit table (lib/auth/rate-limit.ts, no Redis), sized for shared IPs (carrier NAT, cybercafés): failed logins 30/15 min and failed 2FA 20/15 min (assertUnderFailureLimit + recordRateLimitFailure: successes never count), register 20/h, forgot-password 10/h (enforceRateLimit: every request counts) → 429 RATE_LIMITED with Retry-After. The IP comes from x-forwarded-for / x-real-ip, which are only trustworthy behind a proxy that overwrites them (Vercel etc.). Never use the IP as proof of identity.
Audit log: lib/auth/audit.ts logAuthEvent() writes to AuditLog (register, login, login_failed, login_locked, login_attack_suspected, mfa_challenge, mfa_failed, mfa_enabled, mfa_disabled, google_login, logout, password_reset_requested, password_reset, refresh_token_reuse, refresh_user_agent_mismatch). Best-effort (never throws). Never put passwords, tokens or token hashes in metadata. Routine refreshes are deliberately NOT logged (one row per user per 15 min would flood the free-tier database).
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

npm supply-chain notes from installing: npm 11's install-scripts gate blocked postinstall for prisma, @prisma/engines, esbuild and unrs-resolver (needed for Prisma's engine binary and native deps) — approved via `npm install-scripts approve <pkg>`, recorded in package.json's `allowScripts`. `npm audit` still reports 4 high-severity findings in mysql2/deepmerge-ts, transitive dev-only dependencies of the prisma CLI itself (unused, since this project is Postgres-only); fixing them would force-downgrade prisma to 6.19.3, so they were left as-is with the user's sign-off.

lib/auth/guards.ts holds more than the three functions named in "Authorization" above: it also exports `HttpError`, `requireJsonContentType`, `requireAllowedOrigin`, and `errorResponse` (the single place that turns a thrown HttpError, or any other error, into the `{ "error": "message" }` JSON response with the right status, per the "Handle errors in one place" rule). Every route calls these instead of duplicating the checks.

The admin was seeded as admin@gmail.com via `npm run db:seed`. The seed sets its display name to "Nepal Bhoomi Admin" (also applied to the existing row on 2026-09-24). The admin has TOTP 2FA enabled (enrolled 2026-09-24); re-running the seed does not touch 2FA.

2026-09-22 — aligned with the frontend's proposed API contract, by explicit request (see "Scope" above for what this changed and "Authentication design" for the token-delivery override). What changed: routes moved from app/api/auth/* to app/api/v1/auth/*; access token is now returned in the response body and read from Authorization: Bearer (no more access_token cookie — getAuthUser/requireAuth/requireAdmin now take request as a parameter); error responses moved from { "error": "message" } to { "error": { code, message, fields?, requestId } }; added forgot-password/reset-password (email delivery stubbed to console.log, no provider chosen yet); added phone to User and a PasswordResetToken table; added per-route CORS headers + OPTIONS handlers in lib/http/cors.ts.


2026-09-23 — added Google sign-in, by explicit request (overrides the earlier "no OAuth" rule). Flow: browser GET /api/v1/auth/google → 303 to Google with state + PKCE (S256), both kept in a 10-minute httpOnly google_oauth cookie (path /api/v1/auth/google, read-and-deleted on callback) → Google → GET /api/v1/auth/google/callback verifies state, exchanges the code, verifies the ID token (RS256, Google issuers, aud = client id), requires email_verified, finds/links/creates the user and records the login in OAuthAccount, sets the normal refresh cookie, and 303s to FRONTEND_ORIGIN/?auth=google (or ?auth_error=google on any failure). The frontend then calls POST /refresh for an access token — no token ever goes in a URL. Existing login already handles a null passwordHash via the dummy-hash path (same 401).  The repo root now holds backend-realstate/ (this app) and frontend-realstate/ (a copy of the frontend); run backend commands from backend-realstate/. Frontend side (frontend-realstate/src/app/App.tsx, LoginPage): a "Continue with Google" button that navigates to /api/v1/auth/google, and handling of ?auth=google (POST /refresh with credentials, then GET /me, show the signed-in panel) and ?auth_error=google (show an error). Frontend env: VITE_API_URL (defaults to http://localhost:3000). Verified end to end in Chrome with two real Google accounts: both created USER rows with no password plus an OAuthAccount row each; a wrong Google password never reaches the backend. The frontend repo's CLAUDE.md (frontend-realstate/FRONTEND_CLAUDE.md) got a matching §7.4b, §9.3 env rows, two §12 requests and a §13 entry. All of this, plus the repo restructure, was pushed as branch feat/be-google-auth to the nepal-bhoomi remote (main untouched), committed by explicit request.

Not yet updated: the frontend repo's own CLAUDE.md (a different repo, not checked out here) still needs its §13 change log updated per its own "any change to a shared contract must update this file in the same commit" rule — hand that entry to whoever owns that repo, or check it out separately if asked to update it directly.

2026-09-24 — removed agency/agent sign-up (accountType, agencyName, licenseNumber, verificationStatus and the admin verification endpoint) to match the frontend, which is member-only. Replaced the admin endpoint with GET /api/v1/admin/users. The four migrations were then squashed into a single baseline, prisma/migrations/20260924130000_init, and the Supabase `_prisma_migrations` history was reset to that one row with `prisma migrate resolve --applied` (history-only change, no table or data changes). For future schema changes, use `npx prisma migrate dev --name <name>` on top of this baseline.

2026-09-24 — security hardening, by explicit request, from a generic "Authentication System Implementation Guide" the user pasted, adapted to this codebase rather than copied. Added: RefreshToken.ipAddress/userAgent/rotatedAt, User.lastLoginAt/lastLoginIp, AuditLog and RateLimit tables (migration 20260924150000_add_audit_log_rate_limit_session_context), per-IP rate limiting, audit logging, refresh-token reuse detection + User-Agent binding, atomic rotation and atomic password reset, reset TTL 1 h → 15 min, POST /auth/verify-reset-token, refresh cookie SameSite lax → strict, cleanup job + cron route. Deliberately NOT taken from the guide (don't re-add without asking): Redis/express-rate-limit (Express middleware, doesn't run in route handlers; needs new packages and a Redis server), enforcing IP match on refresh, logout revoking all sessions / requiring an access token, hardcoded role "USER" in new tokens, a sessionId JWT claim, deleting (vs marking used) reset tokens, the guide's changed response shapes/cookie name, password-complexity rules, logging tokens or emails in console.warn, real email sending (no provider chosen yet). Verified end to end against Supabase with a throwaway user (register, refresh, reuse in/after grace window, UA mismatch, browser-version change, lockout, rate limit, forgot/verify/reset, audit rows), then the test data was deleted.

2026-09-24 — security review fixes: RLS on all tables + revoked anon/authenticated grants (the Supabase REST API could read User incl. password hashes); Google linking now clears an unverified password and revokes sessions; reset invalidates sibling reset tokens. Frontend: removed unused react-router (high-severity advisory). Follow-up the same day closed the lockout DoS/enumeration, stale access tokens for sensitive routes, admin 2FA and production reset-link logging (next entry).

2026-09-24 — closed the remaining review items, by explicit request (migration 20260924170000_lockout_per_ip_sessions_2fa; also made 20260924160000_enable_rls shadow-database safe and synced its checksum). Lockout moved from User.failedLoginCount/lockedUntil to LoginLockout per (IP, email) — fixes lock-anyone-out DoS and the 429 email-enumeration leak. Added sessionsRevokedAt + requireFreshAuth (admin, /me, 2FA routes). Added TOTP 2FA with recovery codes; admin endpoints require it; Google sign-in honours it. FRONTEND_ORIGIN missing in production now fails closed; reset link only logged outside production. next.config.ts pins turbopack.root (stray package-lock.json in the user's home dir). Verified end to end (lockout from two IPs, unknown-email lockout, 2FA setup/enable/login/replay/recovery/limits/disable, stale token after reset and after enabling 2FA, lockout cleared by reset), test data deleted. Still open by decision: 15-min validity of a copied access token on routes using plain requireAuth; register's 409 reveals existing emails and the reset link is console-only until email OTP; admin 2FA must be enrolled once via requests.http (no settings UI yet).

2026-09-24 — final-review fixes, by explicit request: (1) two tabs refreshing at once no longer log the user out (409 instead of 401 + cookie wipe; frontend auth.tsx retries once); (2) rate limits made shared-IP friendly (failure-only counting for login/2FA, higher register/forgot limits); (5) security headers on the API (next.config.ts) and a production-only Content-Security-Policy meta tag in the frontend build (frontend-realstate/vite.config.ts; every external host the site loads must be listed there). Verified: race + limits end to end (10/10), headers via curl, CSP via headless Chrome on the production build (no violations; only the home page was exercised). Still open from the final report: forgot-password timing leak and register 409 (fix with email OTP), X-Forwarded-For only trustworthy behind a proxy, dev server reachable on the LAN, CRON_SECRET unset (no cleanup), frontend has no type-check/lint step, Google+2FA redirect untested live, rotate secrets shared in chat before production.

