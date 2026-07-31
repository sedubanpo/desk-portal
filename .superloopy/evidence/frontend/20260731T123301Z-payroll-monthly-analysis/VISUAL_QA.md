# Visual QA

## Environment

- Browser: Google Chrome headless
- Desktop viewport: 1440 x 1000
- Mobile viewport: 390 x 844
- Source: local `docs/index.html` served over HTTP
- Data: deterministic payroll-shaped fixture matching production value lengths

## Results

| Check | Desktop | Mobile |
| --- | --- | --- |
| Page horizontal overflow | None (`1440 / 1440`) | None (`390 / 390`) |
| Monthly modal overflow | None | Modal contained at `356px`; table scrolls within its frame |
| Empty icon buttons | 0 | 0 |
| Console errors | 0 | 0 |
| Long currency values | Fit within KPI strip | Fit within two-column KPI layout |
| Primary action visibility | Visible in page header | Full-width above filters |
| Reduced navigation width | N/A | Three module tabs fit viewport; global status tools collapse |

## Captures

- `teacher-payroll-desktop.png`
- `teacher-payroll-mobile.png`
- `monthly-analysis-desktop.png`
- `monthly-analysis-mobile.png`

## Notes

- The monthly table intentionally keeps its first column sticky and uses horizontal scrolling on narrow screens.
- The modal is internally scrollable so the page behind it does not determine its height.
- The analysis disclosure remains visible and states that other operating expenses are excluded.

