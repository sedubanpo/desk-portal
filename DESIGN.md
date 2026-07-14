# Desk Portal Design System

## Atmosphere / Signature

Desk Portal is a dense operations console for academy front-desk work. It should feel calm, exact, and fast to scan: white working surfaces, forest-green command color, compact controls, clear numeric hierarchy, and border-led depth instead of decorative effects.

## Color

- `--ds-bg-app` `#E8F0EB`: application background.
- `--ds-bg-panel` `#FFFFFF`: primary working surface.
- `--ds-bg-subtle` `#F7FBF8`: quiet secondary surface.
- `--ds-bg-warm` `#FFFCF4`: low-alert shared work surface.
- `--ds-fg` `#102133`: main text.
- `--ds-fg-soft` `#334155`: dense body text.
- `--ds-muted` `#667789`: secondary text.
- `--ds-primary` `#0D684D`: primary action and active state.
- `--ds-primary-strong` `#064E3B`: selected navigation state.
- `--ds-on-primary` `#FFFFFF`: text on primary actions.
- `--ds-border` `#D8E4DE`: default hairline.
- `--ds-border-soft` `#EDF2EF`: quiet separators.
- `--ds-ring` `rgba(13, 104, 77, 0.16)`: focus ring.
- `--ds-danger` `#B91C1C`: destructive emphasis.
- `--ds-danger-bg` `#FFF1F2`: destructive quiet surface.
- `--ds-warning` `#C2410C`: warning text.
- `--ds-warning-bg` `#FFF7ED`: warning surface.
- `--ds-blue` `#2563EB`: informational accent.
- `--ds-dim-strong` `#334155`: unavailable schedule surface top.
- `--ds-dim-deep` `#1F2937`: unavailable schedule surface bottom.

## Typography

- Font stack: `"Pretendard", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Page title: 22-25px, weight 900, line-height 1.2, letter-spacing 0.
- Section title: 16-18px, weight 900, line-height 1.3, letter-spacing 0.
- Dense label: 11-13px, weight 850-950, line-height 1.25.
- Body: 13-14px, weight 700-850, line-height 1.45-1.6.
- Numeric cells: tabular numerals, weight 850-950.

## Spacing

Base unit is 4px.

- `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 20px, `--space-6` 24px.
- Dense control gap: 6-8px.
- Panel padding: 12-18px.
- Table cell padding: 8-12px.

## Components

- Buttons: inline-flex, centered icon and label, 38-44px minimum height for tool buttons, 8px radius, no text clipping. Primary uses `--ds-primary`; ghost uses white surface and `--ds-border`.
- Amount correction: the editable amount cell retains its existing semantic surface and reveals a pencil on hover/focus. Its modal uses the 8px control radius, `--ds-bg-subtle` calculation summary, and `--ds-bg-warm` audit note. `안내금액` and `순수납액` are editable; `미납액` remains derived.
- Segmented controls: same height across items, active state uses green fill or green underline, inactive state remains white.
- Cards: 8-12px radius, `--ds-border`, white or subtle surface, no nested decorative card effect.
- Tables: sticky header when scrollable, tabular numerals, amount cells use right or compact block alignment, horizontal overflow only inside the table wrapper.
- Report schedule cards: time block gets fixed readable width, worker detail gets remaining width, unavailable workers use low-saturation dim treatment.

## Motion

Only transform, opacity, and filter. Hover lift is 1px maximum. Durations stay between 120ms and 180ms. Reduced motion may remove lift effects.

## Depth

Depth is border-led. Use one soft operational shadow only for panels that float above a scrolled surface: `0 10px 24px rgba(15,23,42,0.035)`.

## Control Tokens

- `--ds-control-height` `40px`, `--ds-control-radius` `8px`.
- `--ds-shadow-panel` `0 10px 24px rgba(15,23,42,0.035)`.
