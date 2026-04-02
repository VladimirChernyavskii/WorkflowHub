# WorkflowHub

ComfyUI workflow catalog (see [PRD.md](./PRD.md)).

## Requirements

- **Node.js** 18.18+ or 20+ (LTS recommended)
- **PostgreSQL** 16+ for app data and Prisma Migrate (optional locally: Docker via `docker compose` below)

## Public catalog API

`GET /api/workflows` returns only **published** workflows. Query: `page` (default 1), `pageSize` (default 20, max 100). Optional **`q`** — case-insensitive substring match on `title` and `description` (max 200 characters). If `q` is omitted or only whitespace after trim, no text filter is applied (full catalog under pagination).

**Filters** (combined with **`q`** and each other by logical **AND**): repeat **`tag`** for each tag **slug** (e.g. `?tag=portrait&tag=sdxl`); a row must have **every** listed tag. Optional **`base_model`** and **`comfy_version`** — exact match on the stored strings (same spelling/casing as in the database). A **tag slug that does not exist** still yields a valid response with an **empty** `workflows` list and `total: 0` (no separate 404 for unknown tags). Validation: at most **20** `tag` parameters, each slug ≤ **100** characters; `base_model` and `comfy_version` ≤ **200** characters; invalid query → **400** with `{ error, issues }`.

**Sort** (PRD §14): optional **`sort`** — `date` (default), `rating` (`average_rating`), or `downloads` (`unique_download_count`). Optional **`order`** — `desc` (default) or `asc`. For **`sort=date`**, ordering is **`published_at`** first (nulls last when `order=desc`, nulls first when `order=asc`), then **`updated_at`** in the same direction, then **`id`** ascending for stability. For **`rating`** and **`downloads`**, the primary column is sorted as requested, then **`id`** ascending. Invalid `sort` / `order` → **400** with `{ error, issues }`.

**Evolving filter UX** (case-insensitive matching, substring filters, catalog field typeahead / `GET /api/catalog/suggestions`): see [PRD.md](./PRD.md) **§14.7** and engineering tasks **TASK-040–042** in [`tasks.json`](./tasks.json). Until those tasks are implemented, filter behavior remains as described in the **Filters** paragraph above.

## Setup

```bash
npm install
```

Copy [`.env.example`](./.env.example) to `.env` or `.env.local` and set `DATABASE_URL` for your PostgreSQL instance. The app validates environment on load: `DATABASE_URL` and **`SESSION_SECRET`** (32+ characters, server-only signing key for the HTTP-only session cookie) are required; limits from PRD §8 (`MEDIA_*`, `ANON_*`, `DOWNLOAD_*`, `REVIEW_*`) are optional and use [PRD.md](./PRD.md) defaults when unset. Optional **`SESSION_MAX_AGE_DAYS`** (default `30`) controls how long the session cookie remains valid.

**Google sign-in (TASK-013)** is optional for local/CI builds: if you set **`GOOGLE_CLIENT_ID`** and **`GOOGLE_CLIENT_SECRET`**, you must also set **`AUTH_BASE_URL`** to the public origin (no trailing slash), e.g. `http://localhost:3000`. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID (Web application) and add **Authorized redirect URI**: `{AUTH_BASE_URL}/api/auth/google/callback` (scopes: `openid email profile`). Then open [`/login`](http://localhost:3000/login) and use **Sign in with Google**.

### Dev session cookie (TASK-012)

You can still attach a session to an existing `users.id` in **development only** (bypass OAuth for testing):

1. Ensure a user row exists (open **`npm run db:studio`** → table `users` → copy a row’s `id`, or insert a test user there).
2. Run `npm run dev`, then:

```bash
curl -s -X POST http://localhost:3000/api/dev/session -H "Content-Type: application/json" -d "{\"userId\":\"PASTE-UUID-HERE\"}"
```

3. Repeat the request with `curl -c cookies.txt` and inspect the file, or open the site in a browser (same origin) after a client-side `fetch` with `credentials: "include"`, then in DevTools → Application → Cookies verify **`HttpOnly`**, **`SameSite=Lax`**, and **`Secure` absent** on local HTTP (in production over HTTPS, `Secure` is set — see JSDoc in [`lib/session-cookie.ts`](./lib/session-cookie.ts)).
4. Clear the session: `curl -s -X DELETE http://localhost:3000/api/dev/session` (with the same cookie jar if using curl).

The route **`POST|DELETE /api/dev/session`** returns **404** when `NODE_ENV` is not `development`.

To run PostgreSQL locally with Docker:

```bash
docker compose up -d db
```

Wait until the container is healthy, then apply migrations to a **clean** database:

```bash
npm run db:migrate:deploy
```

For interactive schema work (creates new migration files), use:

```bash
npm run db:migrate
```

In CI or production, use `npm run db:migrate:deploy` with `DATABASE_URL` set (no prompts).

### Object storage (S3-compatible)

Artifacts (workflow JSON and media) target an **S3-compatible** bucket (AWS S3, Cloudflare R2, MinIO, etc.). Configuration is optional until features use storage; variables are documented in [`.env.example`](./.env.example).

| Variable | Notes |
|----------|--------|
| `S3_BUCKET` | If set, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are required. |
| `S3_ENDPOINT` | Custom API URL (typical for MinIO or R2). Omit for default AWS endpoints. |
| `S3_REGION` | Defaults to `us-east-1` when unset; R2 often uses `auto`. |
| `S3_FORCE_PATH_STYLE` | Set to `true` for many MinIO setups. |

The app uses [`@aws-sdk/client-s3`](https://www.npmjs.com/package/@aws-sdk/client-s3) only on the server (`server-only` in [`lib/s3.ts`](./lib/s3.ts)); secrets are not exposed via `NEXT_PUBLIC_*`.

**Smoke check** (loads `.env` then `.env.local` — same keys as Next.js):

```bash
npm run storage:smoke
```

This runs `HeadBucket` against `S3_BUCKET`. On success you should see `S3 smoke OK`; wrong credentials or ACL produce a clear SDK error.

## Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server (Turbopack) at [http://localhost:3000](http://localhost:3000) |
| `npm run build` | Production build |
| `npm start` | Run production server (after `build`) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenerate Prisma Client after schema changes |
| `npm run db:migrate` | Prisma Migrate (dev): create/apply migrations interactively |
| `npm run db:migrate:deploy` | Apply existing migrations (clean DB / CI / prod) |
| `npm run db:studio` | Prisma Studio (browse DB) |
| `npm run storage:smoke` | S3-compatible storage connectivity (`HeadBucket`) |

## Project layout

- `app/` — Next.js App Router (pages, layouts, API routes)
- `components/` — React UI components
- `lib/` — Shared utilities and server helpers
- `prisma/` — Prisma schema and SQL migrations
- `public/` — Static assets
