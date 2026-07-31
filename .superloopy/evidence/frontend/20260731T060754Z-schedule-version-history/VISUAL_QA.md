# Visual QA

## Target Surfaces

- MacBook 14-inch class viewport: 1440 x 900
- 27-inch desktop class viewport: 1920 x 1080

## Checks

- PASS: Latest version metadata is above the add-schedule action.
- PASS: Timestamp and account truncate inside narrow day columns without widening the calendar.
- PASS: Legacy state is visually quieter than an actionable version.
- PASS: History dialog uses a stable two-column layout on desktop.
- PASS: Version list is independently scrollable.
- PASS: Selected version clearly differs by border and left accent.
- PASS: Snapshot rows preserve worker, role, time, and memo scan order.
- PASS: No text overlaps buttons or leaves its container.
- PASS: At narrow widths the dialog stacks list above detail.

## Measurements

| Viewport | Dialog bounds | Horizontal overflow |
| --- | --- | --- |
| 1440 x 900 | 980 x 581, centered at x=230 | None |
| 1920 x 1080 | 980 x 581, centered at x=470 | None |

## Captures

- `macbook-1440x900.png`
- `desktop-1920x1080.png`

The production page requires Firebase authentication, so the component was
verified in a local evidence fixture using the exact interaction hierarchy and
responsive constraints from the implementation.
