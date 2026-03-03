# CLAUDE.md

See [AGENTS.md](./AGENTS.md) for the full project reference — architecture, data flow, URL parameters, component map, and coding conventions.

## Quick orientation

- **What it is:** Live water monitoring dashboard for Bavarian rivers/lakes (BFV Miesbach-Tegernsee)
- **Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Radix UI, Recharts
- **Data:** Scraped from hnd.bayern.de and nid.bayern.de (cheerio, server-side, no caching)
- **URL state:** `?id=<riverId>&pane=<flow|level|temperature>&interval=<timeRange>`
- **Language:** UI text is German throughout

## Feature pipeline

When the user provides feature input — a file path, a pasted block of text, or a ramble — run the pipeline in `.claude/workflow.md`. That file is the single source of truth for orchestration.

**Agent prompts** live in `.claude/agents/`:
- `prd-agent.md` — spec writer (model: opus)
- `coding-agent.md` — implementer (model: sonnet)
- `review-agent.md` — auditor (model: sonnet)

**Specs** are written to `specs/<slug>.md` and accumulate review rounds in-place.

---

## Run locally

```bash
pnpm dev
```

## Key entry points

| File | Purpose |
|---|---|
| `app/page.tsx` | Server component — fetches data, mounts provider |
| `components/river-data-display.tsx` | Client controller — URL state, selects, layout |
| `utils/water-data.ts` | All scraping logic and TypeScript types |
| `data/river-sources.json` | Static config for all water bodies |
| `contexts/river-data-context.tsx` | `useRiverData()` hook |
