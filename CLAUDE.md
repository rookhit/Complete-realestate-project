# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Project

Backend for a real estate website, built with Next.js (App Router), TypeScript, Prisma and PostgreSQL hosted on Supabase (free tier). A friend builds the frontend; this repo provides the API.

The developer works on Windows with PowerShell. Give commands that work there.

Current phase: authentication and authorization foundation only.

Scope

In scope now:

Endpoints: register, login, refresh, logout, current user (me).
Password hashing with bcryptjs, JWT access tokens with jose, refresh tokens stored hashed in Postgres.
Two roles, USER and ADMIN, with exactly one ADMIN.
Reusable server-side guards: getAuthUser(), requireAuth(), requireAdmin().
A seed script that creates the single admin.

Out of scope. Do NOT build these unless I ask:

Middleware / proxy route protection (I will add it later).
Reactions, comments, inquiries (the inquiry channel, WhatsApp or email, is not decided yet).
Password reset, email verification, OAuth / social login, 2FA, admin dashboard.
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
Cookies: both httpOnly, secure in production, sameSite: "lax".
access_token: path /, max age 15 minutes.
refresh_token: path /api/auth, max age 7 days.
Never return tokens in a JSON body. Never suggest localStorage for tokens.
Logout: revoke the refresh token row and clear both cookies.
The role inside the access token is trusted until it expires (15 minutes). Accepted trade-off.
Roles
Public register ALWAYS creates USER. Ignore any role, isAdmin or similar field in request bodies.
Exactly one ADMIN, created only by prisma/seed.ts from ADMIN_EMAIL and ADMIN_PASSWORD. No API creates or promotes an admin.
Postgres enforces it: add this line by hand at the end of the first migration SQL (Prisma cannot express partial indexes): CREATE UNIQUE INDEX "only_one_admin" ON "User" ("role") WHERE "role" = 'ADMIN';
The admin logs in through the same login endpoint as everyone else.
Authorization
getAuthUser(): reads the access_token cookie, verifies it, returns { id, role } or null.
requireAuth(): returns the user or throws a 401 { "error": "Login required" }.
requireAdmin(): calls requireAuth(), then throws a 403 { "error": "Forbidden" } if the role is not ADMIN.
Checks always run on the server inside route handlers. Middleware / proxy will only be a convenience for redirects, never the security boundary.
API endpoints

All under app/api/auth/. All accept and return JSON.

Method	Path	Who	Behavior
POST	/api/auth/register	anyone	Validate, create a USER, issue tokens, return the user. 409 if the email exists.
POST	/api/auth/login	anyone	Verify credentials, issue tokens, return the user. Same 401 for wrong password and unknown email.
POST	/api/auth/refresh	has refresh cookie	Rotate the refresh token, issue a new access token. 401 if invalid.
POST	/api/auth/logout	anyone	Revoke the refresh token, clear cookies.
GET	/api/auth/me	logged in	Return { id, email, name, role }.
Data model (auth only)
Role enum: USER, ADMIN.
User: id (cuid), email (unique, stored lowercase), name (optional), passwordHash, role (default USER), createdAt, updatedAt.
RefreshToken: id, tokenHash (unique), userId, expiresAt, revokedAt (optional), createdAt. Relation to User with cascade delete. Index on userId.
File layout
app/api/auth/register/route.ts
app/api/auth/login/route.ts
app/api/auth/refresh/route.ts
app/api/auth/logout/route.ts
app/api/auth/me/route.ts
lib/prisma.ts                  single shared Prisma client
lib/auth/password.ts           hashPassword, verifyPassword
lib/auth/jwt.ts                signAccessToken, verifyAccessToken
lib/auth/refresh-token.ts      create, rotate, revoke (hash stored in DB)
lib/auth/cookies.ts            set and clear auth cookies
lib/auth/guards.ts             getAuthUser, requireAuth, requireAdmin, HttpError
lib/validation/auth.ts         zod schemas
prisma/schema.prisma
prisma/seed.ts

The import alias @/* maps to the repo root (no src/ folder).

Environment variables

Names only. Never print, log or commit values. Only I edit .env.

DATABASE_URL: Supabase pooled connection string (used by the running app).
DIRECT_URL: Supabase direct or session-pooler string (used for migrations), if the installed Prisma version needs it.
JWT_ACCESS_SECRET: at least 32 random characters.
ADMIN_EMAIL, ADMIN_PASSWORD: used only by the seed script.
FRONTEND_ORIGIN (optional): the frontend's origin, used for CORS and the Origin check.
Security rules
Validate every request body with zod. Only pick known fields.
Normalize email with trim and lowercase.
Login returns the same generic error for a wrong password and an unknown email. When the user does not exist, still run a dummy bcrypt comparison so response time is similar.
NEVER return passwordHash, token hashes or tokens from any endpoint. Use an explicit Prisma select and never return a full User row.
Never log passwords, tokens or secrets.
Require Content-Type: application/json on POST routes. If FRONTEND_ORIGIN is set, reject state-changing requests whose Origin header does not match it.
Handle errors in one place. Return { "error": "message" } with the right status (400, 401, 403, 409, 500). No stack traces or database errors in responses.
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