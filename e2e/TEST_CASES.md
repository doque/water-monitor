# E2E Test Cases - Water Monitor

## 1. Initial Page Load
- [ ] Page loads successfully with river selector visible
- [ ] Default river (Mangfall) is selected
- [ ] Default pane (Abfluss) is active
- [ ] Chart renders with data
- [ ] Time range selector shows river options (1h, 6h, 12h, 24h, etc.)

## 2. URL State Mapping
- [ ] `?id=leitzach` selects Leitzach river
- [ ] `?id=tegernsee` selects Tegernsee lake
- [ ] `?pane=level` activates Pegel pane
- [ ] `?pane=temperature` activates Temperatur pane
- [ ] `?interval=6h` sets 6 hour time range
- [ ] Combined params `?id=schliersee&pane=level&interval=2w` work together
- [ ] Invalid river ID falls back to first river
- [ ] Invalid pane falls back to available pane

## 3. Pane Switching
- [ ] Clicking Abfluss card activates flow pane
- [ ] Clicking Pegel card activates level pane
- [ ] Clicking Temperatur card activates temperature pane
- [ ] Active pane has blue highlight
- [ ] URL updates when pane changes

## 4. Pane Persistence When Switching Waters
- [ ] Select Pegel on Mangfall, switch to Leitzach → stays on Pegel
- [ ] Select Temperatur on Mangfall, switch to Tegernsee → stays on Temperatur
- [ ] Select Abfluss on Mangfall, switch to Tegernsee → falls back (lakes have no Abfluss)

## 5. Time Range Selection
- [ ] Rivers show hourly options (1h, 6h, 12h, 24h, 2d, 1w)
- [ ] Lakes show daily/weekly options (1w, 2w, 1m, 6m, 12m, 24m)
- [ ] Selecting time range updates chart
- [ ] URL updates when time range changes
- [ ] Switching from river (1h) to lake adjusts to valid range

## 6. Chart Rendering
- [ ] Chart shows "Entwicklung" title
- [ ] Flow chart displays m³/s values
- [ ] Level chart displays cm values
- [ ] Temperature chart displays °C values
- [ ] "Keine Daten verfügbar" shown when no data

## 7. Lake Level (Tegernsee/Schliersee)
- [ ] Pegel card shows deviation from 24M average (e.g., "+12 cm")
- [ ] Pegel card shows "24M Mittel: X.XX m ü. NN"
- [ ] Chart Y-axis shows "24M Mittel" label at 0 line
- [ ] Chart shows orange dashed reference line for average
- [ ] Mittel label visible for all time ranges (1w, 2w, 1m, 6m, 12m, 24m)

## 8. Webcam Display
- [ ] Spitzingsee shows webcam image
- [ ] Tegernsee shows Prasserbad webcam image
- [ ] Clicking webcam opens external link (foto-webcam.org)
- [ ] Rivers with webcams (Leitzach, Weißach, Schlierach) show webcam

## 9. Data Sources Footer
- [ ] Rivers show Abfluss, Pegel, Temperatur source links
- [ ] Lakes with GKD level show "Pegel (GKD)" link
- [ ] Clicking source link opens in new tab
- [ ] Spitzingsee shows no "Datenquellen:" text

## 10. Mobile Responsiveness
- [ ] River selector works on mobile viewport
- [ ] Cards stack vertically on mobile
- [ ] Chart is readable on mobile
- [ ] Time range selector works on mobile
