# Nepal Bhoomi — Real Estate

Two separate apps in one repository:

| Folder | What | Stack | Dev URL |
|---|---|---|---|
| [`backend-realstate/`](backend-realstate) | Auth API | Next.js (App Router), Prisma 7, PostgreSQL (Supabase) | http://localhost:3000 |
| [`frontend-realstate/`](frontend-realstate) | Website | Vite, React, Tailwind | http://localhost:5173 |

## Run locally

Backend (needs a `.env`; the variable names are listed in `backend-realstate/CLAUDE.md`):

```bash
cd backend-realstate
npm install
npx prisma generate
npm run dev
```

Frontend:

```bash
cd frontend-realstate
npm install
npm run dev
```

The frontend calls `http://localhost:3000` by default; set `VITE_API_URL` for other environments.
The backend only accepts browser requests from `FRONTEND_ORIGIN` (e.g. `http://localhost:5173`).

## Docs

- `backend-realstate/API.md`: every endpoint, request and response.
- `backend-realstate/CLAUDE.md`: auth design, security rules, data model.
- `frontend-realstate/FRONTEND_CLAUDE.md`: frontend notes and the shared change log.

Never commit `.env` files; they are ignored by `.gitignore`.
