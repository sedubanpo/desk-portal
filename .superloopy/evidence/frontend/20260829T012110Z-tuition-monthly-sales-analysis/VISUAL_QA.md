# Visual QA

## Production Target

- URL: `https://sedubanpo.github.io/desk-portal/`
- API revision: `desk-portal-api-00038-bl2`
- Browser: authenticated Chrome session

## Desktop

- `monthly-desktop.png`: expanded modal shows five summary metrics, the existing comparison chart, and a six-column monthly detail table without overlap.
- `period-desktop.png`: date range controls, presets, equal-period comparison metrics, and daily receipt chart are simultaneously visible.
- TOP10 tab retained its month navigation, ranking, and student history entry points.

## Narrow Viewport

- `period-mobile.png`: validated at 390 x 844.
- Dialog scroll width equaled client width (`326px`), proving no horizontal overflow in the analysis surface.
- KPI strip reflowed to two columns and date controls wrapped without clipping labels or values.

## Behavior

- Default period resolved to the latest 30 ledger days.
- Period total, previous equal-period percentage, payment count, daily average, and de-duplicated payer count rendered from the production API.
- Monthly and TOP10 tabs remained usable after period analysis.
- Browser console reported no warnings or errors during tab switching.

## Limitation

- The Impeccable mechanical detector was attempted once from the wrong working directory and could not locate the target; no detector pass is claimed. Script compilation, automated tests, and production browser evidence cover this delivery.
