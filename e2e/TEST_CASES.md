# E2E Test Cases - Water Monitor

Tests run in parallel using 3 browser sessions for faster execution.

## Rivers Suite
- [x] Default page loads with selector and chart
- [x] URL id param selects water body
- [x] Pane param activates correct pane
- [x] Flow chart shows m³/s units
- [x] Level chart shows cm units
- [x] Rivers show hourly time range options
- [x] Data sources footer shows links

## Lakes Suite
- [x] Lake ID param selects lake
- [x] Lakes default to level pane (no flow)
- [x] Lakes show weekly/monthly time ranges
- [x] Lake level shows 24M Mittel reference
- [x] Lake with webcam displays image
- [x] Lake shows GKD data source

## Navigation Suite
- [x] Combined URL params work together
- [x] Pane persists when switching water bodies
- [x] Mobile viewport renders correctly

## Running Tests

```bash
pnpm test                    # Local (spawns dev server)
pnpm test --production       # Production deployment
pnpm test https://custom.url # Custom URL
```
