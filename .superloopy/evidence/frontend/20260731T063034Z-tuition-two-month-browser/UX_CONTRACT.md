# UX Contract

## Goal

- Replace the tuition-month dropdown with a year browser that exposes all 12 months.
- Make generated months visibly interactive and months without usable data visibly off.
- Keep the selected-month settlement view scoped to one month.
- Make the tuition briefing use the latest two generated months regardless of the selected month.
- Show the two included months inside the briefing.

## Responsive Behavior

- Wide desktop: 12 months remain on one row.
- Compact desktop/tablet: months wrap to 6 columns.
- Mobile: months wrap to 4 columns.
- Month and year controls retain at least 40px hit targets.

## States

- Selected month: dark green background with white text.
- Available month: quiet green-white surface with a visible border.
- Missing or empty month: grey surface, muted text, and disabled interaction.
- Briefing: identifies the included months before the daily totals.

