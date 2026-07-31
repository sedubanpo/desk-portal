# Visual QA

## Viewports

- 1440 x 900: MacBook-class desktop viewport.
- 1920 x 1080: 27-inch monitor-class viewport.

## Checks

- PASS: All 12 months are visible without horizontal scrolling.
- PASS: The selected month, other available month, and unavailable months are distinguishable without relying on text alone.
- PASS: The year controls and next-month action do not overlap.
- PASS: The filter row remains aligned beneath the month browser.
- PASS: The briefing clearly states both included months.
- PASS: Text remains inside its controls and no controls overlap.

## Measurements

- 1440px viewport: document width 1440px, one month row, 12 month buttons, 9 off states, 1 selected state.
- 1920px viewport: document width 1920px, one month row, 193px top toolbar height.

## Runtime Limitation

The production page requires an authenticated academy account. Visual layout was checked in a browser preview that uses the production component structure and CSS states; data-contract and routing behavior are covered by automated tests.
