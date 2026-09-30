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

Endpoints: register, login, refresh, logout, current user (me), forgot-password, reset-password, verify-email, resend-verification, Google sign-in (start + callback).
One admin-only endpoint to list users (not a dashboard).
Password hashing with bcryptjs, JWT access tokens with jose, refresh tokens stored hashed in Postgres.
Password reset tokens stored hashed in Postgres, the reset link emailed via Gmail SMTP.
Email verification with a 6-digit emailed code before the first login (added by explicit request on 2026-09-26).
Two authorization roles, USER and ADMIN, with exactly one ADMIN.
Reusable server-side guards: getAuthUser(), requireAuth(), requireAdmin().
A seed script that creates the single admin.

Database schema (tables only, no endpoints yet) for properties, locations, amenities, reactions, comments, journal articles and team members (added by explicit request on 2026-09-28), plus testimonials, videos, site settings, the admin Messages inbox and Free Listing submissions (2026-09-30). See the 2026-09-28 and 2026-09-30 entries under "Implementation status".

Out of scope. Do NOT build these unless I ask:

Middleware / proxy route protection (I will add it later).
API endpoints for the content tables above, and inquiries (the inquiry channel, WhatsApp or email, is not decided yet).
OAuth / social login other than Google, admin dashboard. (TOTP 2FA was added by explicit request on 2026-09-24; email verification + real email delivery on 2026-09-26.)

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
Password reset: 32 random bytes hashed with SHA-256 in a PasswordResetToken table (same pattern as refresh tokens), 15 minute expiry, single-use. The reset (mark token used + new password + lockout reset + revoke all refresh tokens) is one transaction in lib/auth/password-reset.ts. forgot-password always responds 204 regardless of whether the email exists. Resetting the password revokes all of that user's refresh tokens and marks the email verified (the link arrived by email). The link (FRONTEND_ORIGIN/reset-password?token=...) is emailed after the response (lib/email/send-later.ts, next/server after()) so timing doesn't reveal which emails exist.
Email verification (lib/auth/email-verification.ts): User.emailVerifiedAt; one EmailVerificationCode row per user (userId unique, SHA-256 of "userId:code", 15 min, 5 tries right or wrong via a conditional increment, resend cooldown 60 s; failures counts wrong codes across resends and 10 set lockedUntil = 24 h: no code sent or accepted, 429, current code killed; the next send after the lock resets the count). Register creates the user unverified and returns { verificationRequired, email } with NO session. Login with the right password on an unverified account re-sends a code (cooldown permitting) and returns the same shape. POST /auth/verify-email { email, code } verifies and starts the session. Google sign-in creates/marks users verified. Register on an existing email (verified or not) is 409; an unverified squatter's account is reclaimed by the owner through forgot-password. Users created before 2026-09-26 were backfilled as verified by the migration. Unverified USER accounts are deleted UNVERIFIED_ACCOUNT_TTL_DAYS (7) after createdAt by deleteExpiredUnverifiedUsers: all of them on every register and in the cron job, and the one for the email on login (then a normal 401). Frontend constant UNVERIFIED_ACCOUNT_DAYS in App.tsx must match.
Email (lib/email/mailer.ts, nodemailer): Gmail SMTP with an App Password. Without GMAIL_USER/GMAIL_APP_PASSWORD: in development the message is printed to the server console; in production sending throws (logged, never the body).
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
POST	/api/v1/auth/register	anyone	Validate, create an unverified USER, email a 6-digit code, return { verificationRequired: true, email }. No session. 409 if the email exists.
POST	/api/v1/auth/verify-email	anyone	{ email, code } → { user, accessToken } + refresh cookie. Same 400 for every failure; 429 while the account is locked (10 wrong codes across resends, 24 h). 20 failures/15 min per IP.
POST	/api/v1/auth/resend-verification	anyone	{ email } → always 204; emails a new code only to an unverified account, max once a minute. 10/h per IP.
POST	/api/v1/auth/login	anyone	Verify credentials, issue tokens, return { user, accessToken } — or { verificationRequired, email } when the email isn't verified (code re-sent), or { mfaRequired, mfaToken } when 2FA is on. Same 401 for wrong password and unknown email. Lockout is per (client IP, email), applied to unknown emails too: 5 wrong → 429 for 15 min, doubling (max 24 h); 50 failures/day on one account only raises a login_attack_suspected audit event. See lib/auth/login-lockout.ts.
POST	/api/v1/auth/login/2fa	has mfaToken (body or mfa_pending cookie)	{ code } = TOTP or recovery code → { user, accessToken } + refresh cookie.
POST	/api/v1/auth/2fa/setup	logged in (fresh)	{ password? } → { secret, otpauthUrl }.
POST	/api/v1/auth/2fa/enable	logged in (fresh)	{ code } → { recoveryCodes, accessToken }; revokes all other sessions.
POST	/api/v1/auth/2fa/disable	logged in (fresh)	{ password?, code } → 204.
POST	/api/v1/auth/refresh	has refresh cookie	Rotate the refresh token, return { accessToken }. 401 if invalid.
POST	/api/v1/auth/logout	anyone	Revoke the refresh token, clear the cookie. 204.
GET	/api/v1/auth/me	logged in (Bearer)	Return { user }.
POST	/api/v1/auth/forgot-password	anyone	Always 204. Emails a reset link if the email matches a user.
POST	/api/v1/auth/verify-reset-token	anyone	204 if the reset token is still usable, else 400. Does not consume it.
POST	/api/v1/auth/reset-password	has valid reset token	Set the new password, revoke all refresh tokens for that user. 204.
GET	/api/v1/admin/users	admin only	Return { users } (id, email, name, phone, role, emailVerifiedAt, createdAt), newest first.
GET	/api/cron/cleanup-tokens	scheduler (Bearer CRON_SECRET)	Deletes dead refresh/reset tokens and email codes, old RateLimit rows, audit logs > 180 days, unverified accounts > 7 days. 404 while CRON_SECRET is unset.
GET	/api/v1/auth/google	anyone (browser navigation)	303 to Google with state + PKCE; the state/verifier live in a short-lived httpOnly cookie.
GET	/api/v1/auth/google/callback	Google	Verify state + ID token, find/link/create the user, record the login in OAuthAccount, set the refresh cookie, 303 to FRONTEND_ORIGIN/?auth=google (or ?auth_error=google).
Data model (auth only)
Role enum: USER, ADMIN. AuthProvider enum: GOOGLE.
User: id (cuid), email (unique, stored lowercase), name, phone, passwordHash (optional — null for Google-only users), role (default USER), emailVerifiedAt, lastLoginAt, lastLoginIp, sessionsRevokedAt, totpSecret (encrypted), totpEnabledAt, totpLastUsedStep, createdAt, updatedAt.
LoginLockout: key ("<ip>:<sha256(email)>", primary key), failedCount, lockedUntil, updatedAt.
MfaRecoveryCode: id, userId (cascade), codeHash (unique), usedAt, createdAt. Index on userId.
EmailVerificationCode: id, userId (unique, cascade), codeHash, attempts, expiresAt, sentAt. Index on expiresAt.
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
lib/auth/email-verification.ts sendVerificationCode (cooldown), verifyEmailCode
lib/email/mailer.ts            sendEmail (Gmail SMTP via nodemailer; console fallback in dev)
lib/email/send-later.ts        sendEmailAfterResponse (next/server after())
lib/email/templates.ts         verification code + password reset emails
app/api/v1/auth/verify-email/route.ts
app/api/v1/auth/resend-verification/route.ts
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
GMAIL_USER, GMAIL_APP_PASSWORD: the Gmail address that sends mail and a Google App Password for it (needs 2-Step Verification on that Google account). Read lazily. Required in production.
EMAIL_FROM_NAME: optional sender display name (default "Nepal Bhoomi").
Security rules
Validate every request body with zod. Only pick known fields.
Normalize email with trim and lowercase.
Login returns the same generic error for a wrong password and an unknown email. When the user does not exist, still run a dummy bcrypt comparison so response time is similar.
NEVER return passwordHash, token hashes or tokens from any endpoint. Use an explicit Prisma select and never return a full User row.
Never log passwords, tokens or secrets.
Require Content-Type: application/json on POST routes. Reject state-changing requests whose Origin header does not match FRONTEND_ORIGIN. If FRONTEND_ORIGIN is missing: skipped in development, 500 in production (fail closed).
Reset links and verification codes are only ever printed to the console by the dev fallback (GMAIL_* unset, NODE_ENV !== "production").
Handle errors in one place. Return { "error": { "code", "message", "fields"?, "requestId" } } with the right status (400, 401, 403, 404, 409, 500), per the frontend's error envelope contract. No stack traces or database errors in responses.
Supabase REST API lockout: every table has RLS enabled with no policies, and anon/authenticated have no privileges (migration 20260924160000_enable_rls). The backend connects as postgres (table owner, bypasses RLS) so it is unaffected. EVERY new table's migration must add `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` (Prisma can't express it) — otherwise Supabase's REST API exposes it.
Google linking to an existing account (same email) clears that account's passwordHash, revokes its refresh tokens and marks it verified only if its email was never verified (pre-account hijacking); a verified account is just linked.
A successful password reset also invalidates every other unused reset token of that user.
Rate limiting: per-IP fixed windows in the Postgres RateLimit table (lib/auth/rate-limit.ts, no Redis), sized for shared IPs (carrier NAT, cybercafés): failed logins 30/15 min and failed 2FA 20/15 min (assertUnderFailureLimit + recordRateLimitFailure: successes never count), failed email codes 20/15 min (failure-only), register 20/h, forgot-password 10/h, resend-verification 10/h (enforceRateLimit: every request counts) → 429 RATE_LIMITED with Retry-After. The IP comes from x-forwarded-for / x-real-ip, which are only trustworthy behind a proxy that overwrites them (Vercel etc.). Never use the IP as proof of identity.
Audit log: lib/auth/audit.ts logAuthEvent() writes to AuditLog (register, login, login_failed, login_locked, login_attack_suspected, mfa_challenge, mfa_failed, mfa_enabled, mfa_disabled, google_login, logout, password_reset_requested, password_reset, refresh_token_reuse, refresh_user_agent_mismatch, email_verification_sent, email_verified, email_verification_failed). Best-effort (never throws). Never put passwords, tokens or token hashes in metadata. Routine refreshes are deliberately NOT logged (one row per user per 15 min would flood the free-tier database).
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

Dependencies actually installed (pinned, not "latest", because prisma's "latest" npm tag currently points to an 8.0.0 release candidate): prisma@7.10.0, @prisma/client@7.10.0, @prisma/adapter-pg@7.10.0, pg, @types/pg, bcryptjs@3.0.3, jose@6.2.12, zod@4.6.5, tsx, nodemailer@10 + @types/nodemailer (2026-09-26).

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

2026-09-24 — admin, videos, repo uploads (by explicit request):
- Admin display name set to "Nepal Bhoomi Admin" (DB row + prisma/seed.ts). Admin TOTP 2FA enrolled (via the /2fa/setup + /2fa/enable API); admin endpoints require it.
- Frontend (frontend-realstate): first admin page (user list from GET /api/v1/admin/users, navbar link only for ADMIN), and "Explore in Video" now plays the 4 Nepal Bhoomi YouTube videos (details in FRONTEND_CLAUDE.md §7 "Company videos").
- requests.http: every POST sends `Origin: {{origin}}` (@origin = http://localhost:5173) — without it the backend's Origin/CSRF check answers 403. Passwords in it are placeholders (YOUR_ADMIN_PASSWORD); never commit a real one.
- Uploaded snapshots (fresh single-commit history, secret-scanned, no .env): rookhit/Realstate-Backend- (backend at root + frontend/ folder; superseded) and rookhit/Complete-realestate-project (backend-realstate/ + frontend-realstate/ + README). This repo's own history was pushed to Prajjwalgautam/Nepal-Bhoomi-Real-Estate-website- as branch `feat/auth-2fa-admin-videos` (main untouched), committed by explicit request.
- Verified a fresh clone runs on another machine with only the .env added: needs Node 20.19+ / 22.12+ / 24+ (Prisma 7), `npm install`, `npx prisma generate`, `npm run dev`. On a brand-new clone `npx tsc --noEmit` reports LayoutProps missing until `next dev`/`next build` (or `next typegen`) has run once.

2026-09-26 — email verification + emailed password reset, by explicit request ("Gmail OTP send, verification before login, keep the link for forgot password"). Migration 20260926090353_email_verification (User.emailVerifiedAt, EmailVerificationCode + RLS, existing users backfilled as verified). Gmail SMTP via nodemailer, emails sent with after(). Frontend: shared VerifyEmailForm (register + login), forgot-password form now calls the API, new /reset-password page (App reads ?token= then replaceState to "/"; production hosting must serve index.html for /reset-password). Verified against Supabase with throwaway users (register → no session, 409 on repeat, unverified login → code, wrong/unknown/reused code 400, 5-try limit, resend cooldown, correct code → session, forgot → link → reset verifies an unverified account) and the reset page in Chrome; test data deleted. Real Gmail delivery not yet tested (GMAIL_* not set at the time).

2026-09-28 — content schema, by explicit request (migration 20260928161901_property_content_schema; tables only, no endpoints). Modelled on the frontend's data/properties.ts, data/content.ts, data/reviews.ts, icons/amenities.tsx and FRONTEND_CLAUDE.md §6/§7.8, with the user's rules:
- Property: title required (NOT NULL + CHECK not blank); listing enum FOR_SALE | FOR_RENT (exactly one); type enum of the 5 PROPERTY_TYPES; featured and verified are independent booleans; price BigInt? in whole rupees (per month for rent), NULL = no price given = "Negotiable" (no separate flag; CHECK price > 0); furnishing enum UNFURNISHED | SEMI_FURNISHED | FULLY_FURNISHED (nullable); bedrooms/bathrooms/floors/buildYear nullable instead of the frontend's 0 / "—"; areas as value + unit enum; facing/roadSurface enums; gallery String[] (0+ image URLs) + videoUrl String? (at most one video, added in migration 20260928*_property_video_url; files for both live in Cloudflare R2, the DB stores URLs only; no PropertyVideo table by decision) + highlights String[]; admin-editable reactionCount; deletedAt soft delete (the admin's Undo keeps id and ref); ref "NB-013" unique, assigned by the server.
- PropertyLocation (1:1): district required (CHECK not blank; must be one of the frontend's 77 spellings — validate in the API), address, googleMapsUrl (stored only, the frontend doesn't use it yet), optional latitude/longitude, mapX/mapY (0-100 decorative grid).
- Amenity (name unique + group MAIN_FEATURES | ROOMS | FURNISHED) with PropertyAmenity join table. The 69 names live in prisma/amenities.ts (copy of the frontend's AMENITIES) and are upserted by prisma/seed.ts (never deleted).
- FloorPlan (label, imageUrl, position) → Room (name, dimensions, position).
- PropertyReaction: one per (user, property), signed-in users only. PropertyComment: star rating 1-5 (CHECK), body, authorName snapshot, userId SetNull, server-set verified, status PENDING | PUBLISHED | REJECTED (moderation).
- TeamMember (frontend TeamMember shape + position) and Article (journal; slug unique, optional authorId → TeamMember SetNull + authorName, publishedAt NULL = draft, position).
- RLS enabled on all 10 new tables. Verified against Supabase inside rolled-back transactions (valid property with location/amenities/rooms, NULL price, both flags, duplicate reaction, blank title, bad enums, price 0, missing/blank district, rating 6, duplicate slug). Next: the API endpoints in FRONTEND_CLAUDE.md §0.4 (map enums to the frontend's display strings; BigInt price needs converting for JSON).

2026-09-30 — schema brought up to date with the frontend admin (merged frontend commit 39e4d56), by explicit request (migration 20260930120000_admin_content_nb_id; tables only, no endpoints; the content tables were empty, so nothing was migrated):
- NB ID: Property keeps the generated `id` and gets `nbNumber Int @unique` (CHECK > 0), chosen by the admin. The API returns `nbId` = ("NBS" for FOR_SALE, "NBL" for FOR_RENT) + number padded to 3 digits; one sequence for sale and rent; taken number → 409 REF_TAKEN; never reused (soft delete keeps it). Replaces `ref` ("NB-013"). The frontend field was renamed `propId`/`propRef` → `nbId` (labels "NB ID") at the user's request.
- type, badge, facing, roadSurface, builtAreaUnit, landAreaUnit are now String (the PropertyType/PropertyBadge/Facing/RoadSurface/LandAreaUnit/BuiltAreaUnit enums are dropped) because Admin → Dropdown Options can add values; validate against SiteSetting "options:<key>" in the API. listing stays an enum (the NB ID prefix depends on it). Furnishing enum/column dropped (the frontend has none; furnishings are amenities).
- Land area: landAreaUnit may be "R-A-P-D" with landAreaRapd "4-4-0-1" (CHECK: 4 parts, aana 0-15, paisa 0-3, dam 0-3; landAreaValue NULL), plus landAreaSqft Int (every unit converted, indexed) for sorting/filtering.
- Floor plan: `floorPlan Json?` = PlanBox[] { id, name, area, x, y, w, h } (percentages). FloorPlan and Room tables dropped.
- PropertyComment.deletedAt (review Undo). Message (MessageKind ENQUIRY | CALLBACK | CONTACT | EMAIL; propertyId SetNull; read, replied, deletedAt). ListingSubmission (ListingStatus NEW | DRAFT | PUBLISHED | REJECTED, statusBeforeReject, private seller name/phone/email, fields as typed, amenities, photos, draft Json, propertyId unique SetNull). Testimonial (rating CHECK 1-5), Video (youtubeUrl or sources Json, posterUrl, captions Json, position), SiteSetting (key → Json: stats, featuredDistricts, contact, services, options:<key>).
- RLS enabled on the 5 new tables. Verified against Supabase inside a rolled-back transaction (23 checks: custom type, R-A-P-D format, shared NB number, message/listing links and SetNull, RLS, anon has no SELECT), then applied with `prisma migrate deploy`. tsc + lint clean.
- API mapping to remember: googleMapsUrl ↔ mapUrl, latitude/longitude ↔ lat/lng, gallery[0] ↔ hero, BigInt price → number in JSON.

2026-09-30 (later) — signed-in only, by explicit decision: liking (PropertyReaction), reviewing (PropertyComment) and free listings (ListingSubmission) require a logged-in user — use requireAuth() on those POST/DELETE routes and take userId from the token, never the body. The heart is the only like: there is no favourites table or /me/favourites endpoint. Migration 20260930140000_signed_in_reviews_listings: PropertyComment.authorAvatarUrl (copied from the account at posting, e.g. the Google pictureUrl; NULL = initials) and ListingSubmission.userId (→ User, SetNull, indexed; the seller contact fields stay, pre-filled from the account and editable). userId stays nullable on both only so the row survives account deletion. The review body no longer carries a name: authorName comes from User.name. Verified in a rolled-back transaction (4 checks), applied with migrate deploy; tsc + lint clean. Frontend: requestSignIn() in auth.tsx, login prompts on the heart / Write a Review / Free Listing page.

2026-09-30 (map) — approximate location, by explicit decision. Visitors see a ~500 m irregular area, never the exact point (frontend: data/maps.ts, components/ui/leaflet-maps.tsx; FRONTEND_CLAUDE.md §0.5 "Approximate location"). Backend job when building the property endpoints: PropertyLocation.googleMapsUrl / latitude / longitude are ADMIN-ONLY (never in public responses). Add a stored shifted centre (e.g. approxLatitude / approxLongitude on PropertyLocation — not in the schema yet): generated once on save with a random bearing and distance 350 × √(0.2 + 0.8·u) m, regenerated only when the location changes, sent publicly as `approx: { lat, lng }`. Resolve maps.app.goo.gl short links server-side on save to get the coordinates.

2026-09-30 (location mode) — the admin chooses per property: Approximate area (default) or Exact location. Migration 20260930160000_location_mode: enum LocationMode (APPROXIMATE | EXACT), PropertyLocation.locationMode (default APPROXIMATE), approxLatitude / approxLongitude (the stored shifted centre from the "map" entry above, now in the schema), CHECKs that both coordinate pairs are all-or-nothing. Public responses: `approx` = latitude/longitude when EXACT, approxLatitude/approxLongitude when APPROXIMATE, plus `locationMode`; googleMapsUrl and (in APPROXIMATE) latitude/longitude never. Verified in a rolled-back transaction (6 checks), applied; tsc + lint clean.

Open items (none block running the app):
- Needs a decision: the enquiry/contact/free-listing forms send nothing (need an API or a WhatsApp link); register's 409 still reveals registered emails; real page URLs in the frontend; reconcile this backend with apps/api on feat/monorepo-and-auth-hardening (FRONTEND_CLAUDE.md §7.4/§12).
- Before production: rotate DATABASE/DIRECT password, GOOGLE_CLIENT_SECRET, JWT_ACCESS_SECRET and TOTP_ENCRYPTION_KEY (all appeared in a chat transcript) and re-enrol admin 2FA; change the weak admin password; set CRON_SECRET and schedule /api/cron/cleanup-tokens; deploy behind a proxy that sets X-Forwarded-For; set VITE_API_URL for the frontend build; keep frontend and API on the same site (SameSite=Strict cookie); consider Supabase transaction pooler (6543) for serverless and hosting near the DB (ap-northeast-2); Supabase free tier pauses when idle and has limited backups.
- Small: log requestId with server errors (guards.ts errorResponse); remove spaces before "=" in .env keys; upgrade frontend Vite 6.3.5 → 6.4.3; add a `typecheck` script (next typegen && tsc --noEmit); restrict `next dev` to localhost (it listens on the LAN).

