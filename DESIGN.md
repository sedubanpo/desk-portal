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
- Inline amount edit: editable amounts read as table text, not standalone cards. Label and tabular amount stay together without wrapping, while an 11px pencil occupies a fixed trailing slot inside the 40px hit area. Hover/focus uses `--ds-bg-subtle` and `--ds-ring` without lift or panel shadow.
- Icon choice controls: payment and contact methods use a compact grid of 40px minimum-height buttons with Lucide icons, 8px radius, `--ds-border`, and a `--ds-primary` selected state. Labels remain visible beside icons and the native hidden input remains the form value authority.
- Previous payment method: the student identity line may show one 24px icon action beside the name. It uses `--ds-bg-subtle`, `--ds-muted`, and a tooltip; it is informational and does not use a pill silhouette.
- Contact timestamps: table timestamps use `M/D(요일) HH:mm`, tabular numerals, and local Korean time. Empty values remain `-`.
- Tuition table density: the last-contact column stays at 136px, editable amount columns preserve a one-line numeric value, and body copy uses the dense 800-950 weight range for consistent scanning.
- Tuition row visibility: each student identity line may expose one 28px `eye-off` action for reversible monthly hiding. The table header owns the compact hidden-count toggle; revealed hidden rows use the existing subtle surface and remain restorable without changing payment history.
- Tuition payment metadata: the payment form keeps card company as a short optional text field beside approval metadata. Daily briefing treats `결제링크` as its own route while preserving card company as supporting record detail.
- Tuition message settings: template management uses a single modal working surface with an unframed list and editor. Student names are injected as a fixed prefix and are not stored inside the editable template body.
- Payment deletion: recent-payment rows use a compact trash icon with a tooltip. Deletion opens a focused confirmation modal that shows the selected payment facts, requires a reason, and uses the semantic danger color only for the irreversible command.
- Segmented controls: same height across items, active state uses green fill or green underline, inactive state remains white.
- Cards: 8-12px radius, `--ds-border`, white or subtle surface, no nested decorative card effect.
- Tables: sticky header when scrollable, tabular numerals, amount cells use right or compact block alignment, horizontal overflow only inside the table wrapper.
- Supply inventory matrix: one shared item owns one stable row; `본관`, `2관`, and `3관` each have a named stock cell with current quantity, safety/maximum reference, a five-pixel quantity gauge, and compact increment/decrement controls in one horizontal adjustment lane. Branch identity stays visible in the sticky table header, stock cells, and edit fieldsets: forest tint for `본관`, cool blue for `2관`, and warm amber for `3관`. Do not add a second branch register above the matrix. Color always appears with the branch name, never as the only identifier.
- Inventory state uses Lucide icon plus semantic color and text beside the item name: `package-x`/red for `재고 없음`, `triangle-alert`/amber for `보충 필요`, and `circle-check`/green for `안정 재고`. Include affected branch detail in the same item line and do not repeat status in each branch cell or a separate overall-status column. Status treatments are inline labels, not rounded badges.
- Supply search is the primary inventory lookup control. It uses the primary green border, a visible green focus ring, and a concrete light placeholder such as `예: A4, 종이컵, 프린터 토너`.
- Favorite items sort before status priority and Korean item name. The star action is compact and persistent; a `즐겨찾기만` filter may narrow the matrix without changing the default favorite-first order.
- Quantity changes append a bounded audit trail with item, branch, signed quantity, resulting quantity, local date/time, and authenticated changer. History stays collapsed by default and opens as a full-width table directly below its item row; show the latest 20 entries in the UI while retaining up to 50 in stored data.
- The supply header stays sticky inside the table scroll region, and only this matrix may scroll horizontally at narrow widths. Summary metrics form one divider-led strip rather than independent floating cards; editing remains inline below the matrix.
- Teacher payroll workspace: the page header owns monthly analysis and lock actions; filters sit in one 8px operational toolbar; the five primary metrics share one bordered strip with separators instead of five floating cards. The expected-pay metric uses a quiet green emphasis, and all dynamic amounts use tabular numerals.
- Payroll monthly analysis: the modal uses four compact KPI cards, one combined monthly chart, and one sticky-axis table. Revenue is labelled `인정 순매출(정산 기준)`, teacher expense is labelled `규칙 적용 예상 강사비`, and the difference is labelled `강사비 차감 잔여액`, never profit. A warm note discloses that other operating expenses are excluded.
- Report schedule cards: time block gets fixed readable width, worker detail gets remaining width, unavailable workers use low-saturation dim treatment.
- Daily journal counts: the page-level unresolved count is owned by the all-assignee carryover query. It displays `확인 중` until that single query settles and must never publish a partial quick-scan count.
- Daily journal worker tabs: `전체` owns the full-width assignment ledger, `업무 관리자` owns unresolved follow-up plus notice/assignment/routine management, and a named worker owns quick input, that worker's queue, records, and report.
- Daily journal shared work: shared work is the primary notice ledger below attendance. Each row exposes task, recorder, acknowledgement ratio, and latest update in aligned columns; one explicitly selected row may open for details and acknowledgements, and its state persists across polling renders.
- Daily journal utility metrics: record counts, unresolved totals, report-ready counts, sync state, and manual refresh do not occupy a dedicated card row. Automatic sync remains the system behavior; shared work receives the first operational surface.
- Asset ledger: category and product share the primary identity cell with a Lucide category icon. Branch, location, staff identity, status, note, and compact icon actions stay aligned in a dense table. Registration is a narrow working pane, and the ledger owns search plus branch and status filters.
- Purchase workspace: replenishment candidates render as a single selectable ledger with inventory context and inline request quantity. Selection uses a quiet green row state rather than full warning cards. The request composer remains visible beside the candidate list on wide screens and follows it on narrow screens.
- Daily journal manager: unresolved ownership and follow-up stay visible in the left pane while the right pane switches among shared work, direct assignment, and routine templates. Assignee filters use 40px controls and count badges use tabular numerals.
- Assignment ledger: the ledger takes the full working width, keeps a sticky table header inside its own scroll region, wraps long task and follow-up text, and reserves a stable 40px save action so columns do not shift.

## Motion

Only transform, opacity, and filter. Hover lift is 1px maximum. Durations stay between 120ms and 180ms. Reduced motion may remove lift effects.

## Depth

Depth is border-led. Use one soft operational shadow only for panels that float above a scrolled surface: `0 10px 24px rgba(15,23,42,0.035)`.

## Control Tokens

- `--ds-control-height` `40px`, `--ds-control-radius` `8px`.
- `--ds-shadow-panel` `0 10px 24px rgba(15,23,42,0.035)`.
