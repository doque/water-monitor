# Feature: Fix Spitzingsee Temperature Scraper

**Slug:** fix-spitzingsee-temperature
**Status:** Draft
**Branch:** feat/fix-spitzingsee-temperature

## Overview

The upstream page at `wassertemperatur.site/seen/water-temp-in-spitzingsee` has changed its HTML structure. It no longer provides historical temperature data (no Google Charts `arrayToDataTable` call, no HTML table of daily values). It now returns only a single inline current-temperature string: `Aktuelle Wassertemperatur im Spitzingsee: <span style="color:blue">5 °C</span>`. The scraper must be updated to extract the current temperature from this new markup, return an empty history array, and the UI must gracefully handle a lake that has a current temperature value but no chart data.

## User Stories

- As a dashboard user, I want to see the current Spitzingsee water temperature so that I know the lake conditions today.
- As a dashboard user, I want clear feedback when no historical chart data is available so that I understand the chart is intentionally empty rather than broken.

## Acceptance Criteria

1. When the Spitzingsee page returns the HTML pattern `Aktuelle Wassertemperatur im Spitzingsee: <span ...>X °C</span>`, the scraper extracts the numeric value `X` (integer or decimal) as the current temperature.
2. The extracted value is returned as a valid `WaterTemperatureDataPoint` with `temperature` set to the parsed number, `date` set to today's date and current time in `DD.MM.YYYY HH:MM` format, and `timestamp` set to the corresponding `Date` object.
3. The `history.temperatures` array is returned as an empty array `[]` (since no historical data is available from the source).
4. The `current.temperature` field is populated with the extracted data point; `previousDay` is `undefined`; `change` is `undefined`; `changeStatus` is `"stable"`.
5. The TemperatureCard for Spitzingsee displays the current temperature value (e.g. "5.0 °C") when `current.temperature` exists, even when `history.temperatures` is empty.
6. The RiverChart component, when rendered for Spitzingsee with `dataType === "temperature"` and an empty `history.temperatures` array, displays the existing empty-state message ("Keine Daten verfügbar" / "Für Temperatur sind derzeit keine Messwerte vorhanden.") instead of placeholder/fake data.
7. The TemperatureCard does not show a trend indicator for Spitzingsee when history is empty (the `formatTrendForTimeRange` call returns `null`).
8. The TemperatureCard remains clickable (not disabled/dimmed) when `current.temperature` exists, even if `history.temperatures` is empty. Clicking it selects the temperature pane and shows the empty chart state.
9. When the fetch to `wassertemperatur.site` fails (network error, non-200 status), the scraper returns `{ current: null, history: [], changeStatus: "stable" }` and the TemperatureCard shows "Keine Daten verfügbar" — same as current error behavior.
10. When the HTML response does not contain the expected `Aktuelle Wassertemperatur` pattern (site structure changes again), the scraper logs a warning and returns `{ current: null, history: [], changeStatus: "stable" }`.
11. The scraper correctly handles both integer values (e.g. `5 °C`) and decimal values (e.g. `14.4 °C` or `14,4 °C`), parsing the comma as a decimal separator.
12. No changes are made to any other water body's scraping or display logic.

## Technical Approach

### `utils/water-data.ts`

**Replace `fetchSpitzingseeTemperature()`** — gut the function body. Remove the calls to `parseSpitzingseeCurinfo()`, `parseSpitzingseeJavaScriptData()`, `parseSpitzingseeTableData()`, and `mergeSpitzingseeData()`. Replace with a simple implementation that:

1. Fetches the URL with the same headers and `cache: "no-store"`.
2. Loads the HTML into cheerio.
3. Searches for text matching the regex pattern `Aktuelle Wassertemperatur[^:]*:\s*` followed by a `<span>` whose text content matches `(-?\d+[.,]?\d*)\s*°\s*C`. A single regex on the full HTML: `/Aktuelle Wassertemperatur[^:]*:\s*<span[^>]*>(-?\d+[.,]?\d*)\s*°\s*C<\/span>/i`.
4. Parses the matched number (replacing `,` with `.`), constructs a `WaterTemperatureDataPoint` with today's date/time.
5. Returns `{ current: <datapoint>, history: [], changeStatus: "stable" }`.

**Delete the now-unused helper functions:** `parseSpitzingseeCurinfo()`, `parseSpitzingseeJavaScriptData()`, `parseSpitzingseeTableData()`, `parseJavaScriptDataString()`, `mergeSpitzingseeData()`, `processSpitzingseeDataPoints()`, and `processSpitzingseeData()`. These are only invoked within `fetchSpitzingseeTemperature()` and each other.

Also remove the module-level `const currentYear = 2025` (line 4) — only referenced by the deleted functions.

### `components/river-data/temperature-card.tsx`

**Change the display condition.** Currently the value display block requires both `river.current.temperature && hasTemperatureData` (history non-empty). Change this to require only `river.current.temperature`, so the card shows the value even when history is empty.

**Change `isDisabled` logic.** Currently `const isDisabled = !hasTemperatureData`. Change to `const isDisabled = !river.current?.temperature && !hasTemperatureData`, so the card stays clickable when current data exists.

### `components/river-data-display.tsx`

**Update `hasActualDataForType()`.** In the `"temperature"` case, also return `true` if `river.current?.temperature` exists (in addition to checking history length). This ensures the temperature pane remains selectable for Spitzingsee even with empty history.

### Files changed summary

| File | Action |
|---|---|
| `utils/water-data.ts` | Rewrite `fetchSpitzingseeTemperature()`; delete 7 helper functions; delete `currentYear` constant |
| `components/river-data/temperature-card.tsx` | Update display condition and disabled logic |
| `components/river-data-display.tsx` | Update `hasActualDataForType()` for temperature case |

## URL / State Changes

None.

## Edge Cases

1. **Integer without decimal** (e.g. `5 °C`): regex handles `5`, `5.0`, `14,4` — always parsed as float.
2. **Unexpected HTML**: log warning with first 500 chars of response, return `current: null`.
3. **Upstream down / timeout**: existing `try/catch` returns `{ current: null, history: [], changeStatus: "stable" }`.
4. **Extra whitespace around span**: regex uses `\s*` between tokens; cheerio text normalization handles inline whitespace.
5. **Temperature is 0°C**: valid for an alpine lake. Checks must use `!== null` / `!== undefined`, not truthiness.
6. **Negative temperature**: regex includes optional leading `-`.
7. **Mobile vs desktop**: no difference; TemperatureCard is the primary card for lakes on mobile.

## Out of Scope

- Restoring historical chart data for Spitzingsee.
- Sourcing history from an alternative provider.
- Adding an explanation banner for the empty chart.
- Hiding the time range selector when it has no effect.
- Changes to Bayern.de scraping (Schliersee, Tegernsee, rivers).

## Assumptions

1. The HTML pattern `Aktuelle Wassertemperatur im Spitzingsee: <span ...>X °C</span>` is stable enough to target.
2. Single current value with no chart history is acceptable UX — confirmed by product owner.
3. Timestamp on the generated datapoint uses server time at scrape time (page provides no timestamp).
4. All old Spitzingsee-specific helper functions are safe to delete (dead code after rewrite).

## Open Questions

None.

---

## Review Round 1 — FAIL

**Critical:** `isDisabled` in `temperature-card.tsx` used truthiness (`!river.current?.temperature`), which incorrectly disables the card at `temperature === 0`. Inconsistent with the display condition which already used explicit null check.

**Fix applied:** `river.current?.temperature == null && !hasTemperatureData`

## Review Round 2 — PASS

Fix confirmed correct. All 12 acceptance criteria satisfied. Ready to merge.

---

## Correction — Real HTML Structure

Initial spec was written against an incorrect HTML snippet. Actual page structure:

```html
<p class="temp-note">Wassertemperatur im Spitzingsee beträgt heute 3.6°C.</p>
<div class="temp-wrapper">
  <div class="temp-block cold"><div class="temp-value">3.6<span>°C</span></div><div class="temp-label">Heute</div></div>
  <div class="temp-block mild"><div class="temp-value">3.6<span>°C</span></div><div class="temp-label">Gestern</div></div>
  <div class="temp-block warm"><div class="temp-value">2.7<span>°C</span></div><div class="temp-label">Vor einer Woche</div></div>
</div>
```

Revised implementation: parse `.temp-block` widgets with cheerio → 3 data points (today / yesterday / last week). Enables real chart and trend indicator. Fallback to `temp-note` paragraph regex if no blocks found. AC3 (empty history) superseded — history now contains 3 points.

## Review Round 3 — PASS

All checks passed. One minor fix applied: `isNaN` guard added to fallback parse path for defensive parity with primary path.
