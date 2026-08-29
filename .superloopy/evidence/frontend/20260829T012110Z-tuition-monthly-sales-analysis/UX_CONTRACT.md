# Tuition Monthly Sales Analysis UX Contract

## Baseline

- Target: authenticated browser-hosted Desk Portal tuition settlement.
- Primary user: academy desk staff reconciling actual tuition receipts.
- Baseline evidence: the existing modal exposed only a due-date/paid-date chart and monthly TOP10 ranking.
- Desired outcome: staff can evaluate monthly growth and inspect actual receipts for an arbitrary date range without leaving the portal.

## Journey

1. Open `월별 매출 현황` from tuition settlement.
2. Review the latest-month actual receipts, month-over-month change, unique payer count, payment count, average, and peak month.
3. Compare monthly due-date and paid-date totals in the existing chart and scan the monthly detail table.
4. Switch to `기간 분석`, set start and end dates or use a preset, and review actual receipts against the immediately preceding period of equal length.
5. Switch to TOP10 or close the modal without mutating tuition records.

## Invariants

- Actual receipts use the normalized paid date and the corrected payment ledger.
- Full ISO dates are parsed before short month/day dates.
- Monthly payer counts de-duplicate students within each month.
- Period payer counts de-duplicate students across the selected range.
- A missing or zero previous baseline displays `비교 없음`, not a misleading percentage.
- Start date never remains after end date.
- The analysis is read-only and introduces no tuition write path.

## States

- Loading: existing portal loading feedback remains the owner while the overview API runs.
- Empty: KPI and table regions state that monthly data is unavailable; period controls remain non-mutating.
- Error: existing overview error alert reports failure and leaves the settlement state unchanged.
- Narrow viewport: the modal becomes a full-height working surface and KPI metrics reflow to two columns.

## Traceability

| Clause | Owner | Test / Evidence |
| --- | --- | --- |
| ISO and short dates normalize correctly | `normalizers.js` | `paid date parsing preserves...` |
| Monthly totals, growth, payer and payment counts | `handlers.js` | `monthly sales overview exposes...` |
| Period selection and equal-period comparison | `docs/index.html` | production browser interaction and screenshots |
| Expanded responsive modal | `docs/index.html` | desktop and narrow viewport screenshots |

## Risks

- Daily receipts with no normalized paid date cannot participate in arbitrary date ranges; they remain visible in month-level due-date aggregation where applicable.
- Period comparison is intentionally based on the immediately preceding equal-length calendar range, including days with no receipts.
