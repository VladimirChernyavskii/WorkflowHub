# WorkflowHub

ComfyUI workflow catalog (see [PRD.md](./PRD.md)).

## Requirements

- **Node.js** 18.18+ or 20+ (LTS recommended)
- **PostgreSQL** 16+ for app data and Prisma Migrate (optional locally: Docker via `docker compose` below)

## Setup

```bash
npm install
```

Copy [`.env.example`](./.env.example) to `.env` or `.env.local` and set `DATABASE_URL` for your PostgreSQL instance. The app validates environment on load: `DATABASE_URL` must be set; limits from PRD §8 (`MEDIA_*`, `ANON_*`, `DOWNLOAD_*`, `REVIEW_*`) are optional and use [PRD.md](./PRD.md) defaults when unset.

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
