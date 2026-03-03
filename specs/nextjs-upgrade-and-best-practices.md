# Feature: Next.js Upgrade, Spitzingsee Fix, and Chart Rendering Best Practices

**Slug:** nextjs-upgrade-and-best-practices
**Status:** Draft
**Branch:** feat/nextjs-upgrade-and-fixes

## Overview

This feature bundles three closely related improvements to the water monitoring dashboard: upgrading Next.js from 15.2.6 to 16.1.6, auditing and hardening the Spitzingsee temperature data path so null values cannot cause runtime errors, and fixing four best-practice violations in how chart state is derived from URL GET parameters (double `router.replace` calls, stale time-range validation on river switch, leftover debug logging, and suboptimal `useSearchParams()` Suspense placement). Together these changes ensure the app runs on the latest framework version, handles the Spitzingsee temperature source reliably, and renders charts from URL parameters without redundant navigation calls or console noise.

## User Stories

- As a visitor, I want the dashboard to load on Next.js 16 so that I benefit from the latest performance improvements and security patches.
- As a visitor viewing Spitzingsee, I want the temperature card and chart to render correctly (or show a clear empty state) regardless of whether the upstream temperature source returns data, so that I am never shown a broken UI.
- As a visitor arriving via a shared URL with `?id=spitzingsee&pane=temperature&interval=1w`, I want the chart to render in a single navigation step without visible flicker, so the experience feels instant and professional.
- As a developer, I want stale debug logs removed and Suspense boundaries placed correctly so that the codebase follows Next.js 16 best practices and produces clean console output.

## Acceptance Criteria

### Task 1 — Next.js Upgrade

1. `package.json` pins `next` to `16.1.6` and `react` / `react-dom` to the version required by Next.js 16 (React 19.x — confirm exact peer dep after upgrade).
2. The `swcMinify` key is removed from `next.config.mjs`. No other removed or renamed config keys remain.
3. `pnpm install` succeeds with zero peer-dependency errors related to `next`, `react`, or `react-dom`.
4. `pnpm build` completes without errors.
5. `pnpm dev` starts the dev server and the dashboard renders at `http://localhost:3000` without console errors attributable to the upgrade.
6. If any other Next.js 16 breaking changes surface during the build (e.g. changed imports, removed APIs), they are resolved in this branch — the build must be green.

### Task 2 — Spitzingsee Temperature Robustness

7. The return type of `fetchSpitzingseeTemperature` in `utils/water-data.ts` is updated so that the `current` field is explicitly typed as `WaterTemperatureDataPoint | null` (not a silent type lie).
8. All call sites that consume the return value of `fetchSpitzingseeTemperature` continue to handle `current: null` without runtime errors — specifically, `fetchWaterTemperature` and any downstream consumers in `river-data-display.tsx` and the metric cards.
9. When the Spitzingsee upstream source is unreachable or returns malformed HTML, the temperature card for Spitzingsee displays the standard empty/no-data state (same behavior as any other water body with missing temperature data) rather than crashing or showing `NaN`/`undefined`.
10. The cheerio parsing logic in `fetchSpitzingseeTemperature` itself is not changed (it is already correct per the provided HTML structure).

### Task 3 — Best Practices for Chart Rendering from GET Parameters

**Issue A — Double `router.replace` in `availableOptions` guard**

11. The `useEffect` in `components/river-data-display.tsx` that guards against an invalid `timeRange` when `availableOptions` is defined calls only `setTimeRange(largest)` and does NOT call `router.replace(...)` directly.
12. The separate URL-sync `useEffect` remains the single source of truth for calling `router.replace(...)` when any of `selectedRiverId`, `selectedPane`, or `timeRange` change.
13. Switching to a lake (e.g. Spitzingsee) with a time range that exceeds the available data span results in exactly one `router.replace` call (not two).

**Issue B — `handleRiverChange` stale time-range validation**

14. `handleRiverChange` in `components/river-data-display.tsx` is updated so that when `availableOptions` is defined for the target water body, it selects the largest valid time range from that set rather than from the hardcoded per-type list.
15. When `availableOptions` is not yet defined (data not loaded or not a lake), `handleRiverChange` falls back to the existing hardcoded `isTimeRangeValidForWaterBody` / `getLargestAvailableTimeRange` logic.
16. Switching from a river (e.g. Schlierach) to Spitzingsee sets `timeRange` to the largest entry in `availableOptions` in one step, with no subsequent override by the `availableOptions` guard effect.

**Issue C — Remove debug `console.log` calls**

17. All `console.log` calls containing `"[v0]"` in `components/river-data-display.tsx` (specifically inside `getDefaultsForRiver`) are removed.
18. No other `console.log("[v0]"` calls exist anywhere in the repository after this change.

**Issue D — `useSearchParams()` Suspense boundary**

19. In `app/page.tsx`, the `<RiverDataDisplay />` component is wrapped in its own `<Suspense fallback={<RiverDataSkeleton />}>` boundary inside `RiverDataContainer`.
20. The outer `<Suspense>` around `<RiverDataContainer>` in the default export may remain (it guards the async server component's data fetch), but the inner Suspense specifically isolates the `useSearchParams()` call per Next.js 16 best-practice guidance.
21. `RiverDataSkeleton` is already imported and available in `app/page.tsx`; no new skeleton component is needed.

### Cross-cutting

22. The full test sequence — `pnpm install && pnpm build` — passes on the final commit of the branch.
23. Manual smoke test: navigate to `/?id=spitzingsee&pane=temperature&interval=1w` — the chart renders with temperature data (or a clean empty state) in a single visual step, with no console warnings or errors, no double URL update, and no `[v0]` log output.

## Technical Approach

### Task 1 — Next.js Upgrade

- In `package.json`, bump `next` from `15.2.6` to `16.1.6`. Check whether `react` and `react-dom` need a minor bump to satisfy Next.js 16's peer deps; if so, bump them too.
- In `next.config.mjs`, delete the `swcMinify: true` line. Scan the rest of the config object for any other keys deprecated or removed in Next.js 16 (e.g. `experimental.appDir` — unlikely but verify).
- Run `pnpm install`. Resolve any peer-dep conflicts.
- Run `pnpm build`. If new errors appear (changed default behavior, removed APIs), fix them in the relevant source files.

### Task 2 — Spitzingsee Temperature Type Fix

- In `utils/water-data.ts`, locate the return-type annotation (or inferred type) of `fetchSpitzingseeTemperature`. Change the `current` field from `WaterTemperatureDataPoint` to `WaterTemperatureDataPoint | null`.
- Audit every place `fetchSpitzingseeTemperature`'s return value is consumed. The key consumer is `fetchWaterTemperature`, which assembles the `temperatures` history array and `current.temperature`. Confirm that null-checks already exist or add them. The `hasActualDataForType` function in `components/river-data-display.tsx` already returns false when `current.temperature` is nullish, so the metric cards and chart should degrade gracefully.
- If TypeScript errors surface in card components (`temperature-card.tsx`, `river-chart.tsx`) due to the stricter type, add appropriate null guards (e.g. optional chaining or early returns).

### Task 3A — Remove double `router.replace`

- In `components/river-data-display.tsx`, find the `useEffect` whose dependency array includes `availableOptions` and `timeRange`. Inside its body, remove the direct `router.replace(...)` call. Leave only the `setTimeRange(largest)` call. The URL-sync `useEffect` (the one that watches `[selectedRiverId, selectedPane, timeRange]`) will pick up the state change and issue a single `router.replace`.

### Task 3B — Fix `handleRiverChange` stale validation

- In `components/river-data-display.tsx`, modify `handleRiverChange` to use `availableOptions` to determine the largest valid time range when switching to a lake. When `availableOptions` is defined (lake, data loaded), use `availableOptions[availableOptions.length - 1].value` as the fallback time range. When undefined, fall back to `getLargestAvailableTimeRange`. This eliminates the intermediate invalid state that triggers the guard effect.

### Task 3C — Remove debug logs

- In `components/river-data-display.tsx`, delete all lines matching `console.log("[v0]"` inside `getDefaultsForRiver` and anywhere else in the file.

### Task 3D — Inner Suspense for `useSearchParams()`

- In `app/page.tsx`, inside the `RiverDataContainer` async server component, wrap the `<RiverDataDisplay ... />` JSX in `<Suspense fallback={<RiverDataSkeleton />}>`. Import `Suspense` from React and confirm `RiverDataSkeleton` is already imported. The outer Suspense around `<RiverDataContainer />` in the page's default export remains unchanged.

## URL / State Changes

None. The URL parameter schema (`id`, `pane`, `interval`) is unchanged. The only behavioral change is that state transitions that previously caused two `router.replace` calls now cause one.

## Edge Cases

1. **Spitzingsee source returns empty HTML or HTTP error** — `fetchSpitzingseeTemperature` already catches errors and returns `{ current: null, history: [] }`. With the type fix, TypeScript will enforce that consumers handle this. The temperature card should display its no-data state.
2. **User lands on `/?id=spitzingsee&pane=temperature&interval=6m`** — `6m` is not in `availableOptions` for Spitzingsee. The `availableOptions` guard will fire once, set `timeRange` to the largest available (e.g. `1w`), and the URL-sync effect will issue a single `router.replace` to correct the interval. No double replace.
3. **User switches rapidly between rivers** — The `urlUpdateInProgressRef` guard already prevents re-entrant `router.replace` calls. The fix to `handleRiverChange` reduces the number of state changes per switch, making rapid switching more stable.
4. **Next.js 16 changes default caching or fetch behavior** — The app already uses `force-dynamic` on all routes and `cache: "no-store"` on fetches. These should continue to work, but must be verified during the build/smoke-test step.
5. **`next-pwa` compatibility with Next.js 16** — `next-pwa` declares `next >= 9.0.0` as a peer dep, so it should install without conflict. If it uses internal Next.js APIs that changed in v16, the build will fail; in that case, upgrade `next-pwa` to its latest version.
6. **Mobile vs. desktop** — No layout changes; all fixes are data-flow and framework-level.

## Out of Scope

- Adding new water bodies or data sources.
- Changing the visual design of any component.
- Adding automated tests.
- Upgrading Tailwind CSS, Radix UI, Recharts, or any dependency other than `next`, `react`, and `react-dom`.
- Refactoring the scraping layer.
- Migrating to Next.js 16's new `dynamicIO` or `use cache` APIs.
- Adding error-boundary components.

## Assumptions

1. Next.js 16.1.6 is the latest stable 16.x release. If unavailable, use the latest 16.x on npm.
2. React 19.x remains the required peer dependency for Next.js 16.
3. `next-pwa` is compatible with Next.js 16 without code changes.
4. `availableOptions` in `river-data-display.tsx` is computed synchronously as a `useMemo` and is available inside `handleRiverChange` via closure.
5. Both Suspense boundaries in `app/page.tsx` serve different purposes and both are kept.

## Open Questions

None.

---

## Review Round 1 — FAIL

**Critical:**
1. **AC#14/16 — `availableOptions` dead code in `handleRiverChange`**: `availableOptions` is derived from `activeRiver` (the current/source river). When switching FROM a non-lake river TO a lake, `activeRiver.isLake` is `false` so `availableOptions` is `undefined`. The condition `newRiver.isLake && availableOptions` is always `false` for the river→lake case. Must compute filtered options for the target river inline: call `filterTimeRangeOptions(targetBaseOptions, getHistorySpanDays(targetHistory))` using the new river's data.
2. **AC#2 — `eslint.ignoreDuringBuilds` removed without authorization**: Spec only required removing `swcMinify`. Restore `eslint: { ignoreDuringBuilds: true }` to `next.config.mjs`.

**Minor:**
- `fetchWaterTemperature` return type still declares `current: WaterTemperatureDataPoint` (non-nullable) despite delegating to `fetchSpitzingseeTemperature` which now returns `| null`. The type lie was meant to be eliminated.
- `app/global-error.tsx` `<button>` has no Tailwind styling — add `className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"`.

**Over-implementation (revert):**
- `turbopack: {}` in `next.config.mjs` — not requested; remove.
- `tsconfig.json` formatting/`jsx`/`include` changes — not requested; revert all tsconfig changes.
- `app/global-error.tsx` — spec explicitly states "no error-boundary components"; however the build requires it for Next.js 16. **Keep the file but style the button.**

---

## Review Round 2 — PASS

All 23 acceptance criteria pass. The critical bugs from Round 1 (stale `availableOptions` in `handleRiverChange`, missing `eslint.ignoreDuringBuilds`, type lie in `fetchWaterTemperature`) are fixed. `turbopack: {}` confirmed as required by Next.js 16 for `next-pwa` compatibility. `tsconfig.json` format changes are auto-applied by Next.js 16 at build time, not a code change. Ready to merge.
