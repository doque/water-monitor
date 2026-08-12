# Water Monitor — Agent Reference

Bavarian river/lake monitoring dashboard for BFV Miesbach-Tegernsee.
Next.js 15 App Router · React 19 · TypeScript · Tailwind · Radix UI · Recharts

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, `force-dynamic`) |
| UI | React 19, Tailwind CSS v3, Radix UI Select/Tabs, shadcn/ui |
| Charts | Recharts (`AreaChart` + `ResponsiveContainer`) |
| Scraping | Cheerio (server-side HTML parsing) |
| Package mgr | pnpm |
| Deployment | Vercel |

---

## File Map

```
app/
  page.tsx                 Server component — fetches initial data, wraps provider
  layout.tsx               Root layout — Inter font, ThemeProvider, PWA meta
  api/water-levels/
    route.ts               GET /api/water-levels — calls fetchRiversData(), no cache
  globals.css

components/
  admin-mode-header.tsx    Logo header; 5 clicks = toggle admin mode
  river-data-display.tsx   Main controller — URL state, selects, card/chart layout
  river-data-skeleton.tsx  Loading skeleton
  river-data/
    river-select.tsx       Water body dropdown (Radix Select)
    time-range-select.tsx  Time window dropdown; different options per water body type
    flow-card.tsx          Abfluss (m³/s) metric card — clickable pane selector
    level-card.tsx         Pegel (cm) metric card — clickable pane selector
    temperature-card.tsx   Temperatur (°C) metric card — clickable pane selector
    river-chart.tsx        Recharts AreaChart — main visualization
    webcam-card.tsx        Live webcam image card
    data-sources-footer.tsx Links to source URLs

contexts/
  river-data-context.tsx   RiverDataProvider + useRiverData hook

data/
  river-sources.json       Static config for all 9 water bodies

utils/
  water-data.ts            fetchRiversData(), scrapers, types
  formatters.tsx           formatTrendForTimeRange(), getChangeIndicator()
  chart.ts                 createAsciiChart() (ASCII debug util, unused in UI)
  admin-mode.ts            Cookie-based admin mode helpers
```

---

## Data Flow

```
river-sources.json
       │
       ▼
utils/water-data.ts   (server-side, cheerio scraping)
  fetchRiversData()
    └─ fetchRiverData(config)          ← per water body, parallel
         ├─ fetchWaterLevel(levelUrl)  → hnd.bayern.de/pegel/.../tabelle?methode=wasserstand
         ├─ fetchWaterFlow(flowUrl)    → hnd.bayern.de/pegel/.../tabelle?methode=abfluss
         └─ fetchWaterTemperature(url)
              ├─ Bayern.de parsing    → nid.bayern.de/wassertemperatur/.../tabelle
              └─ Spitzingsee parsing  → wassertemperatur.site (JS array + HTML table merge)
       │
       ▼
app/page.tsx  [Server Component]
  fetchRiversData(includeAllRivers=true)
  → RiverDataProvider initialData={riversData}
    → RiverDataDisplay
       │
       ├─ OR client refetch via: fetch('/api/water-levels')
       └─ contexts/river-data-context.tsx  (RiverDataProvider, useRiverData)
```

**No caching anywhere.** Every fetch has `cache: "no-store"` + `Cache-Control: no-cache` headers.

---

## Data Sources

| Water body | Type | Level | Flow | Temperature | Webcam |
|---|---|---|---|---|---|
| Mangfall (Schmerold) | River | — | ✓ | ✓ | — |
| Leitzach (Stauden) | River | ✓ | ✓ | ✓ | ✓ |
| Weißach (Oberach) | River | ✓ | ✓ | ✓ | ✓ |
| Schlierach (Miesbach) | River | ✓ | ✓ | ✓ | ✓ |
| Söllbach (Bad Wiessee) | River* | ✓ | ✓ | ✓ | — |
| Zeiselbach (Bad Wiessee) | River* | ✓ | ✓ | — | — |
| Schliersee | Lake | — | — | ✓ (daily) | — |
| Tegernsee | Lake | — | — | ✓ (daily) | — |
| Spitzingsee | Lake | — | — | ✓ (daily) | ✓ |

\* Marked `"adminOnly": true` in `river-sources.json` — hidden in normal mode.

**Split gauges:** each metric of a water body can come from a *different* station. Mangfall
has no Pegel at all and draws its two metrics from two stations:

| Metric | Station | Live source | GKD slug key |
|---|---|---|---|
| Pegel | — | *(removed)* | — |
| Abfluss | Schmerold Q | `hnd.bayern.de/pegel/inn/schmerold-q-18202001` | `gkdFlowSlug` |
| Temperatur | Feldolling | `nid.bayern.de/wassertemperatur/bayern/feldolling-18204006` | `gkdSlug` |

`levelUrl`/`flowUrl`/`temperatureUrl` are already independent for live scraping. For GKD long
ranges, `gkdSlug` is the default and `gkdFlowSlug`/`gkdTemperatureSlug` override per type —
both fall back to `gkdSlug` when absent. **`useGkdData` bails out entirely when `gkdSlug` is
empty**, so it must always hold a valid slug even if that metric isn't the "primary" one.
A wrong slug 404s, and every fetch path swallows that silently, so probe before trusting it.

A metric is dropped by omitting its URL: the pane stays visible but renders disabled (`--`),
and `DataSourcesFooter` omits the link.

`DataSourcesFooter` labels each link with its gauge via `extractStationName()`, which derives
the display name from the URL slug (`schmerold-q-18202001` → "Schmerold Q").

**Bayern.de scraping target:** `table.tblsort tbody tr` → first `td` = date, `td.center` = value.
**Date format:** `DD.MM.YYYY HH:MM` (German).

---

## URL Parameters

`/?id=<riverId>&pane=<dataType>&interval=<timeRange>`

### `id` — water body identifier
- **Explicit `id` in `river-sources.json` wins** when present. Mangfall pins `"id": "schmerold-18202000"` so its URL stayed stable after its `levelUrl` was removed.
- **Rivers:** otherwise the slug extracted from `levelUrl`, e.g. `schmerold-18202000` from `.../pegel/isar/schmerold-18202000/tabelle`. Always the **level** slug — a differing `flowUrl` slug never affects the ID.
- **No `levelUrl` and no `id`:** falls back to `river-<name>-<location>`.
- **Lakes:** `lake-<name>` (name lowercased, spaces → hyphens), e.g. `lake-schliersee`
- ID generation is in `getRiverOrLakeId()` in `river-data-display.tsx` and `getRiverId()` in `river-select.tsx` — keep these in sync.

### `pane` — active data view
`"flow"` | `"level"` | `"temperature"`

### `interval` — time window
| Rivers | Lakes | Spitzingsee only |
|---|---|---|
| `1h` `2h` `6h` `12h` `24h` `48h` `1w` | `1w` `2w` `1m` `2m` | `1w` `2w` `1m` `2m` `6m` |

### Initialization logic (`river-data-display.tsx`)
1. `useEffect` fires once when `!isLoading && riversWithIds.length > 0`
2. Read `searchParams.get("id"|"pane"|"interval")`
3. No params → first river, `getDefaultsForRiver()` (flow→level→temp; 24h/2w for lake)
4. Params present → validate; fall back to smart defaults if pane has no data
5. After init, `isInitializedRef.current = true`
6. Second `useEffect` watches state and calls `router.replace()` to sync URL
7. Guard `urlUpdateInProgressRef` prevents re-entrancy

---

## Time Range → Data Points Mapping

Rivers use 15-minute HND data:

| interval | data points (sliced from history) |
|---|---|
| 1h | 4 |
| 2h | 8 |
| 6h | 24 |
| 12h | 48 |
| 24h | 96 |
| 48h | 192 |
| 1w | 672 (decimated to ~100 for chart) |

Lakes use daily data:

| interval | data points |
|---|---|
| 1w | 7 |
| 2w | 14 |
| 1m | 30 |
| 2m | 60 |
| 6m | 180 |

---

## Admin Mode

- **Toggle:** click logo 5× within 3 s → `toggleAdminMode()`
- **Storage:** cookie `water_monitor_admin_mode=true` (1-year expiry)
- **Effects:**
  - `adminOnly` water bodies (Söllbach, Zeiselbach) become visible
  - `RiverSelect` shows status emojis (🔴🟡🟢) + current values
  - Chart and FlowCard colored by `alertLevel` (red/amber/blue)
  - Schliersee/Tegernsee use `situation` field for color (not flow thresholds)
- **Event:** `window.dispatchEvent(new CustomEvent("adminModeChanged", { detail: { adminMode } }))`

### Flow Thresholds (per river in `river-sources.json`)
```json
"flowThresholds": {
  "green": [min, max],          // single range
  "yellow": [min, max],
  "red": [[null, min], [max, null]]  // multiple ranges (array of arrays)
}
```
`getAlertLevelFromFlow(flow, thresholds)` → `"normal"` | `"warning"` | `"alert"`

---

## Chart Architecture

`RiverChart` uses Recharts `AreaChart`:
- `prepareChartData()` slices history, reverses to chronological, maps to `{ time, label, fullDate, value }`
- Custom `CustomXAxisTick` — renders two lines (date + time) for `1w` river range
- Custom `CustomTooltip` — hidden on mobile (`!isMobile`)
- Y-axis always starts at 0; padding calculated proportionally
- Chart colors: blue by default; in admin mode: red/amber/blue per alert level
- Spitzingsee always blue (even in admin mode)
- Dark mode detected via `MutationObserver` on `document.documentElement.classList`

---

## Key Types (`utils/water-data.ts`)

```ts
RiverData {
  name: string
  location: string
  current: { level?, temperature?, flow? }
  history: { levels[], temperatures[], flows[] }
  previousDay: { level?, temperature?, flow? }
  changes: { levelPercentage?, levelStatus?, temperatureChange?, flowPercentage?, ... }
  urls: { level, temperature?, flow? }
  webcamUrl?: string
  flowThresholds?: Thresholds
  alertLevel?: "normal" | "warning" | "alert"
  isLake?: boolean
}

TimeRangeOption = "1h"|"2h"|"6h"|"12h"|"24h"|"48h"|"1w"|"2w"|"1m"|"2m"|"6m"
DataType = "level" | "temperature" | "flow"
```

---

## Coding Conventions

- All UI text is **German** (Abfluss, Pegel, Wasserstand, Keine Daten verfügbar, etc.)
- `"use client"` on every interactive component; page/layout are server components
- `useMemo` for all derived data in components (performance-sensitive)
- `useCallback` for event handlers passed as props
- Tailwind only — no CSS modules, no styled-components
- shadcn/ui component primitives in `components/ui/`
- `sm:` breakpoint = 768px, `md:` = 768px (desktop card grid)
- Mobile layout: single primary card above chart, 2-col secondary below
- Desktop layout: 3-col card grid above chart
- Error states use yellow (`bg-yellow-50`) for data issues, red (`bg-red-50`) for fetch errors

---

## Adding a New Water Body

1. Add entry to `data/river-sources.json` with `name`, `location`, URLs, `flowThresholds` (rivers) or `isLake: true` (lakes)
2. River IDs auto-derive from `levelUrl` slug — no manual ID assignment needed. Set an explicit `id` only when there is no `levelUrl`, or to keep an existing URL working after a source change
3. Lakes auto-get `lake-<name>` ID
4. Admin-only: add `"adminOnly": true` and it's filtered out in `fetchRiversData()` and `filteredRivers` unless admin mode
5. Split gauges: add `gkdFlowSlug` / `gkdTemperatureSlug` so GKD long ranges hit the right station (see Data Sources)

## Adding a New URL Parameter

1. Add to `validateUrlParams()` validation logic
2. Add to the URL-update `useEffect` `params.set()` block
3. Add `searchParams.get()` in the initialization `useEffect`
4. Update this file

---

## Skills Applied

- **recharts** — AreaChart with ResponsiveContainer, custom ticks/tooltip, memoized data prep
- **vercel-react-best-practices** — server-side initial fetch, `useMemo`/`useCallback`, `force-dynamic`
- **vercel-composition-patterns** — context provider pattern, data flows down via `RiverDataProvider`
- **web-design-guidelines** — responsive grid, accessible Radix UI primitives, dark mode support
