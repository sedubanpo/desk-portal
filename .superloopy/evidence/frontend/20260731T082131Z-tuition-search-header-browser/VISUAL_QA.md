# Visual QA

## Viewports

- 1280 x 800: current MacBook browser-class viewport.
- 1920 x 1080: 27-inch monitor-class viewport.

## Checks

- PASS: Search occupies the former oversized next-month action area.
- PASS: Green border band makes search recognizable without extra explanatory copy.
- PASS: Search text and placeholder do not collide with icons.
- PASS: Compact month creation button remains visible and does not dominate the header.
- PASS: Year controls, search, creation button, and 12 month buttons do not overlap.
- PASS: No horizontal page overflow is introduced.

## Measurements

- 1280 x 800: search 614 x 44px, creation button 42 x 42px, page width 1280/1280px, overlaps 0.
- 1920 x 1080: search 986 x 44px, creation button 42 x 42px, page width 1920/1920px, overlaps 0.
- Month controls: 12 rendered at both viewports.

## Runtime Limitation

The production page requires an authenticated academy account. Visual layout is checked in a browser preview using the production component geometry and states; frontend structure and behavior are covered by automated tests.
