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

## Project layout

- `app/` — Next.js App Router (pages, layouts, API routes)
- `components/` — React UI components
- `lib/` — Shared utilities and server helpers
- `prisma/` — Prisma schema and SQL migrations
- `public/` — Static assets
