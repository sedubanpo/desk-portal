# Tuition Amount Adjustment Visual QA

## Scope

- Allow desk staff to adjust a student's monthly guide amount and collected amount.
- Keep unpaid amount derived from guide amount minus collected amount.
- Record a required correction reason and preserve the original payment ledger.

## Static Verification

- Parsed the inline portal script and the Apps Script source successfully.
- Confirmed the client calls `saveTuitionAmountAdjustment` with a retry-safe request ID.
- Confirmed the server acquires the tuition write lock, updates the guide amount audit entry, and records only the collected-amount delta as a `수강료 정정` payment.
- Confirmed the table renders guide and collected amounts as explicit edit controls while unpaid remains derived and read-only.

## Browser Evidence

- Opened the local static preview at `http://127.0.0.1:4173/` in the in-app browser.
- The real portal rendered its access-password overlay before the tuition screen. No credentials were entered and no live financial record was changed for visual QA.
- Because the authenticated screen was not available in the test browser, the amount-adjustment modal was not exercised against production data. The implementation was verified through source parsing and static interaction wiring instead.

## Design-System Check

- The new correction modal and editable amount states use the documented `--ds-*` tokens.
- Repository-wide token lint remains blocked by legacy CSS in `docs/index.html`: 1,823 pre-existing undeclared-color findings and 1,117 pre-existing off-scale-spacing findings. These findings are outside the new correction styles and are recorded here rather than silently waived.

## Result

Implementation is ready for deployment. A post-deploy authenticated smoke test should use a non-production or explicitly approved test adjustment; no student payment was created, changed, or deleted during this verification.
