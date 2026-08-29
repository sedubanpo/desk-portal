# Cross-month Tuition Briefing Verification

## UX Delta

- Affected journey: desk staff opens `일일 수납 브리핑` and selects either paid-date or input-date basis.
- Previous behavior: the briefing ledger contained only the latest two generated tuition charge months.
- Corrected behavior: every generated tuition month that contains payment or settlement data contributes to the briefing ledger; the selected date and weekday filters remain authoritative.
- Adjacent journeys: the selected-month settlement table, KPIs, recent payment list, and workbook export remain month-scoped.
- Design impact: unchanged. No visual component, label, layout, or interaction changed.
- Visual evidence: not applicable. This is a server-owned data-scope correction with existing UI presentation.

## Invariants

- `납입일 기준` includes a payment when its normalized paid date falls in the selected range, regardless of charge month.
- `입력일자 기준` includes a payment when its normalized input timestamp falls in the selected range, regardless of charge month.
- Payments remain de-duplicated by the existing canonical payment identity.
- Generated months with no rows and no payments are omitted from the briefing bundle.
- No additional Firestore reads are introduced; the existing month-context records are reused.

## Automated Evidence

- `npm test` in `services/desk-api`: 103 passed, 0 failed.
- Regression fixture: querying the August summary with July, August, and September generated data returns all three briefing months.
- Regression fixture: the September charge paid and entered on `2026-08-28` remains present with both timestamps for frontend basis filtering.
- `git diff --check`: passed.

## Production Evidence

- Cloud Run revision `desk-portal-api-00039-qlp` serves 100% of production traffic and passed its health check.
- Authenticated Chrome, August settlement, briefing date `2026-08-28`.
- Visible month scope: `26-9월 · 26-8월 · 26-7월 · 26-6월`.
- Paid-date basis: 3 payments rendered for the selected date.
- Input-date basis: 3 payments rendered for the selected date.
- Both basis changes retained the cross-month scope and completed without a write action.

## Surface Evidence

| target | owner | claims | scope reason |
| --- | --- | --- | --- |
| Authenticated Desk Portal Web | Cloud Run tuition handler | Cross-month briefing bundle contains all generated months with data | The visible UI is unchanged; the handler owns which records reach the existing date filters |
