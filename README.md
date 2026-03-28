# WorkflowHub

ComfyUI workflow catalog (see [PRD.md](./PRD.md)).

## Requirements

- **Node.js** 18.18+ or 20+ (LTS recommended)

## Setup

```bash
npm install
```

## Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server (Turbopack) at [http://localhost:3000](http://localhost:3000) |
| `npm run build` | Production build |
| `npm start` | Run production server (after `build`) |
| `npm run lint` | ESLint |

## Project layout

- `app/` — Next.js App Router (pages, layouts, API routes)
- `components/` — React UI components
- `lib/` — Shared utilities and server helpers
- `public/` — Static assets
