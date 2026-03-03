# Feature: Dynamic Time Range Options Based on Data Span

**Slug:** dynamic-time-range-options
**Status:** Draft
**Branch:** feat/dynamic-time-range-options

## Overview

The time range dropdown displays a static list of options regardless of how much historical data is actually available. For Spitzingsee, this means showing "2w", "1m", "2m", and "6m" even though only ~7 days of data exist (3 data points: today, yesterday, last week). Selecting these longer ranges shows the exact same 3 points — confusing and misleading. This feature dynamically filters the dropdown so only options whose duration is meaningfully covered by the available data are shown. Applies to all water bodies.

## User Stories

- As a user viewing Spitzingsee, I want the time range dropdown to only show "1w" so I am not misled into thinking more historical data exists.
- As a user viewing any water body, I want every dropdown option to show a meaningfully different view of the data.
- As a user, I always want at least one option visible regardless of data sparsity.

## Acceptance Criteria

1. Given a water body whose active history spans N days (oldest to newest timestamp in the relevant history array), the dropdown only includes options whose duration in days is ≤ `N × 1.5`.
2. At least one option is always shown — if filtering removes all, retain the smallest option from the base set.
3. Spitzingsee with its current ~7-day span shows only "1w"; "2w", "1m", "2m", "6m" are not rendered.
4. If the currently selected time range is not in the filtered set (e.g. URL had `?interval=6m`), automatically fall back to the largest available option and update the URL via `router.replace()`.
5. Rivers with a full week of data are unaffected — all 7 options remain visible.
6. Lakes (non-Spitzingsee) with data spanning 10 days show "1w" and "2w" only (10 × 1.5 = 15 days; "1m" = 30 days is hidden).
7. While data is loading (`isLoading === true`), show the full unfiltered base option set to avoid layout shift.
8. When the user switches water bodies, options re-filter immediately; if the selected range is invalid for the new body, fall back to the largest available.
9. The active data type determines which history array is used for span calculation: `"temperature"` → `history.temperatures`, `"level"` → `history.levels`, `"flow"` → `history.flows`.

## Technical Approach

### `utils/water-data.ts`

Export a utility function:

```ts
export function getHistorySpanDays(dataPoints: { timestamp: Date }[]): number {
  if (dataPoints.length < 2) return 0
  const times = dataPoints.map(p => p.timestamp.getTime())
  return (Math.max(...times) - Math.min(...times)) / (1000 * 60 * 60 * 24)
}
```

### `components/river-data/time-range-select.tsx`

Export a duration map and filter utility:

```ts
export const timeRangeDurationDays: Record<TimeRangeOption, number> = {
  "1h": 1/24, "2h": 2/24, "6h": 6/24, "12h": 12/24,
  "24h": 1, "48h": 2, "1w": 7, "2w": 14, "1m": 30, "2m": 60, "6m": 180,
}

export function filterTimeRangeOptions<T extends { value: TimeRangeOption }>(
  baseOptions: readonly T[],
  spanDays: number
): T[] {
  const max = spanDays * 1.5
  const filtered = baseOptions.filter(o => timeRangeDurationDays[o.value] <= max)
  return filtered.length > 0 ? filtered : [baseOptions[0]]
}
```

No changes to `TimeRangeSelect`'s props or rendering — it already accepts the options it renders via its internal selection. Instead, add an optional `filteredOptions` prop override:

```ts
interface TimeRangeSelectProps {
  value: TimeRangeOption
  onValueChange: (value: TimeRangeOption) => void
  isLake?: boolean
  lakeName?: string
  filteredOptions?: readonly { value: TimeRangeOption; label: string }[]  // new
}
```

When `filteredOptions` is provided, use it instead of the internally computed options array.

### `components/river-data-display.tsx`

1. Import `getHistorySpanDays` and `filterTimeRangeOptions`.
2. Compute `spanDays` from the active river's history array that corresponds to `activeDataType` (AC-9).
3. Compute `filteredOptions` from the base option set using `filterTimeRangeOptions`.
4. Pass `filteredOptions` to `<TimeRangeSelect>`.
5. In the `useEffect` that watches `activeRiver` / `activeDataType` changes (or wherever `selectedTimeRange` is validated), add a check: if `selectedTimeRange` is not in `filteredOptions`, set it to the last element of `filteredOptions`.
6. Do not compute `filteredOptions` during loading state — pass `undefined` so `TimeRangeSelect` falls back to its full base set (AC-7).

The multiplier constant `1.5` should be defined as a named constant at the module level: `const DATA_SPAN_MULTIPLIER = 1.5`.

## URL / State Changes

No new URL parameters. Existing `?interval=<value>` parameter is reused. If the URL value is not in the filtered set on load, the initialization effect already falls back to defaults — no additional handling needed there. The AC-4 fallback only needs to trigger when switching water bodies after initialization.

## Edge Cases

| Scenario | Behaviour |
|---|---|
| `history` array empty or 1 point | `spanDays = 0`; show only the smallest base option |
| All data points share the same timestamp | `spanDays = 0`; same as above |
| `spanDays` exactly equals an option's duration | Option is shown (`duration <= spanDays × 1.5`) |
| User bookmarked a URL with `?interval=6m` for Spitzingsee | Initialization effect handles it; falls back to largest valid option |
| Water body switches while selected range is valid for both | No change to selected range |
| `isLoading` is true | `filteredOptions` is `undefined`; `TimeRangeSelect` uses full base set |

## Out of Scope

- Fetching additional historical data.
- Showing a tooltip/indicator explaining why options are hidden.
- Filtering based on data point density within a range (only total span is considered).

## Assumptions

1. The 1.5× multiplier is appropriate — shows an option when data covers ≥ 2/3 of its duration.
2. `timestamp` fields on all history data points are reliable `Date` objects.
3. Applying to all water bodies (not just Spitzingsee) is correct — the principle is universal.
4. The base option sets (`spitzingseeTimeRangeOptions`, `otherLakeTimeRangeOptions`, `riverTimeRangeOptions`) remain the source of truth for ordering and the superset of possible options.

## Open Questions

None.

---

## Review Round 1 — FAIL

**Critical:** `availableOptions` applied filtering to rivers as well as lakes, causing options to be hidden for any river with fewer than ~4.67 days of history. AC5 violated.

**Fix applied:** Added `!activeRiver.isLake` guard to `availableOptions` memo — rivers always receive `undefined` (full base set). Guard effect already had an early return for `undefined`, so river time ranges are never accidentally reset.

## Review Round 2 — PASS

All checks passed. Ready to merge.
