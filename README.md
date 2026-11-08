# Campus DevPulse

Campus DevPulse is a shared development tracker for the Campus Management ERP. It tracks engineering progress across the ERP modules and areas shown in the provided navigation reference; it does not implement the ERP itself.

## Local setup

Requires Node.js 24 LTS or newer and npm. Copy `.env.example` to `.env` and configure values as needed. Install and run:

```sh
npm install
npm run dev
```

Vite serves the interface at `http://localhost:5173` and proxies `/api` to Express on port 3001. The app creates `.data/devpulse.sqlite` on first start. The 34 modules shown in the reference are seeded with their sidebar area and four empty development stages. Seeding is idempotent and does not overwrite user edits. A prior DevPulse 35-module database is migrated by renaming matching modules in place and retaining unmatched modules as inactive history. No developers, assignments, tasks, progress, blockers, or deadlines are seeded.

Initial impact and difficulty values are deterministic planning estimates (high impact: Student 360, Fees, Attendance, Academics, Exams, Employees, Campuses; higher difficulty: Fees, Accounting, HR & Payroll, Timetable, LMS, Face Kiosk). The Settings page documents these estimates; they are editable per module.

## Build and run

```sh
npm run build
npm start
```

The production command starts one Express service. It serves `dist/` and the API on the `PORT` environment variable (default 3001). `/api/health` is a basic service health endpoint.

## Environment variables

| Variable         | Purpose                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `PORT`           | HTTP listen port; Render supplies this automatically.                            |
| `NODE_ENV`       | Set to `production` for static frontend serving.                                 |
| `DATABASE_PATH`  | SQLite file path. Local default: `.data/devpulse.sqlite`.                        |
| `POSTGRES_URL`   | Server-side PostgreSQL connection used by the Vercel API.                       |
| `GEMINI_API_KEY` | Optional server-side key for the AI Companion. Never use a `VITE_` prefix.       |
| `GEMINI_MODEL`   | Optional Gemini model name; default is `gemini-3.8-flash`.                       |
| `APP_ACCESS_KEY` | Optional shared key. When set, the app issues a signed HTTP-only session cookie. |

With no `APP_ACCESS_KEY`, the app is open to anyone who can reach its URL. Set a strong value before deploying publicly. This is shared access, not individual authentication.

## Database and backups

SQLite is stored at `DATABASE_PATH`, with foreign keys enabled, WAL mode and a five-second busy timeout. The app never writes the database into the frontend build. Use **Settings & Data → Export JSON** for a complete backup; the same page can restore a backup transactionally after confirmation. CSV export contains module and stage progress for Excel. Keep a separate copy of backups outside the app service.

## Gemini AI Companion

Create a Gemini API key in Google AI Studio and set it as `GEMINI_API_KEY` in the server environment. Set `GEMINI_MODEL` if the desired supported model differs from the default. The browser never receives the API key. The AI Companion is optional; regular tracking works without it. Ask a question in the AI Companion page to verify configuration. Exact module lists and counts are calculated by the server from current project data and take precedence over generated text.

## Vercel deployment

The Vercel API uses PostgreSQL and the private `devpulse` schema in `deploy/schema.sql`. The local development server continues to use SQLite; the two databases do not synchronize automatically. Connect a PostgreSQL database to the Vercel project and set `POSTGRES_URL` for production. Protect access to the deployment with Vercel Authentication or `APP_ACCESS_KEY`.

To copy existing local data into an **empty** PostgreSQL schema, set `POSTGRES_URL` and `SQLITE_PATH` in your shell and run `node deploy/import-sqlite.mjs`. The import runs in a transaction and stops if the destination already contains records. It does not alter the SQLite file. Do not commit connection strings or API keys.

## Render deployment

1. Create a **single web service** from this repository.
2. Use build command `npm install && npm run build` and start command `npm start`.
3. Attach a persistent disk to the service. Persistent disk availability depends on the Render service plan.
4. Set `NODE_ENV=production`, `DATABASE_PATH=/var/data/devpulse.sqlite`, and a strong `APP_ACCESS_KEY`. Set `GEMINI_API_KEY` and `GEMINI_MODEL` only if AI is needed. Render provides `PORT`.
5. Deploy and open `/api/health` to confirm the service is running. Verify data persistence by editing a stage, restarting/redeploying the service, and checking the stage again.

Keep one service instance using the local SQLite disk. Do not horizontally scale this service against one SQLite file. The production database resides on the persistent disk and is not overwritten by module seeding during deployments.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The API workflow test exercises module seeding, stage calculations/readiness, developer assignment, task persistence, validation and JSON restore against a temporary SQLite database.
