# Teacher Payroll Workspace UX Contract

## Baseline

- The teacher payroll screen previously presented every control and metric at similar visual weight.
- Monthly operating analysis was available only as a screen-bound report and could be affected by the current teacher filter.
- The existing monthly label could imply cash revenue or final profit even though the source is recognized lesson data.

## Affected Users

- Academy managers reviewing teacher hours, recognized lesson sales, and expected teacher pay.
- Desk administrators checking monthly settlement inputs before payroll approval.

## Primary Journey

1. Enter the teacher payroll module through the six-digit access gate.
2. Confirm the selected month and filter scope in the page header.
3. Review the five core settlement metrics in one continuous strip.
4. Adjust salary mode or teacher rules only when needed.
5. Open **월별 매출·강사비 분석** for an unfiltered month-over-month view.
6. Compare recognized net sales, expected teacher pay, and the balance before other operating expenses.

## Metric Truth

- `인정 순매출(정산 기준)`: recognized lesson sales after discounts; not tuition cash received.
- `규칙 적용 예상 강사비`: calculated from saved teacher salary rules; not confirmed payroll expense.
- `강사비 차감 잔여액`: recognized net sales minus expected teacher pay; not profit or operating margin.
- `당일취소 원본 금액`: source amount excluded from settlement; not a realized loss figure.
- Monthly analysis always uses all teachers and ignores the current screen filters.

## States

- Loading: a concise status line remains visible while monthly data is assembled.
- Empty: the KPI area clears and the table explains that no settlement data exists.
- Error: the status changes to an error treatment and the refresh control remains available.
- Narrow viewport: controls stack, KPI cards become two columns, and the wide monthly table scrolls inside its own frame.
- Reduced motion: button transitions are disabled when the user requests reduced motion.

## Ownership And Risks

- Source authority: the desk API payroll summary builder and the configured Google Sheets tabs.
- Other operating expenses such as rent, utilities, tax, and benefits are intentionally excluded.
- A cash profit-and-loss view must later reconcile this report with actual tuition receipts and the expense ledger.

## Traceability

- API: `services/desk-api/src/payroll/handlers.js`
- API tests: `services/desk-api/test/payroll-handlers.test.js`
- UI and states: `docs/index.html`
- Design guidance: `DESIGN.md`

