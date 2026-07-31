# Teacher payroll access and readiness verification

Date: 2026-07-31 (Asia/Seoul)
Source commit: `c4e256e Secure and validate teacher payroll`
Production API revision: `desk-portal-api-00021-688`

## Acceptance criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Teacher payroll requires a six-digit PIN | PASS | Six separate numeric inputs are shown before the module opens. |
| PIN is verified server-side | PASS | `/v1/payroll/unlock` requires Firebase staff authentication and payroll permission. The PIN and token signing secret are stored in Secret Manager. |
| Brute-force protection is present | PASS | Five failed attempts trigger a 15-minute lockout. Unlock tokens expire after 30 minutes. |
| Payroll requests cannot bypass the gate | PASS | Every payroll API method requires a valid unlock token in addition to staff authentication and permission. |
| Desktop layout is usable | PASS | `payroll-pin-desktop.png`; dialog 420 px wide in a 1761 x 957 viewport, centered with no overlap. |
| Mobile layout is usable | PASS | `payroll-pin-mobile.png`; dialog 343 px wide in a 375 x 829 viewport, fully visible with no overlap. |
| Keyboard interaction is usable | PASS | Auto-advance, paste, Backspace, arrow navigation, focus state, and disabled submit until six digits are present were exercised. |
| Browser runtime is clean | PASS | Chrome visual QA returned zero error-level console messages. |
| Payroll regression suite passes | PASS | 69 tests passed, including mixed ratio/hourly aggregation and overlapping teachers. |
| Production endpoint is protected | PASS | Unauthenticated `/v1/payroll/unlock` returned `authentication_required`; production health check passed. |

## Calculation review

- Fixed all-teacher aggregation so each teacher's configured ratio/hourly mode is applied independently.
- Fixed pure teaching-time aggregation so simultaneous lessons taught by different teachers are not collapsed into one interval.
- Prevented printing a payslip while `전체 강사` is selected.
- Disabled global salary controls in all-teacher view and made the per-teacher aggregation rule explicit.

## Operational readiness

Status: ready for calculation and payroll preparation; final payout remains conditional.

1. The current May view contains 419 suspicious rows out of 1,693. These must be reviewed or accepted before payment is finalized.
2. There is no immutable month-close snapshot. Later edits to the source spreadsheet can change recalculated payroll, so the final reviewed result should be exported and retained until a month-close lock is implemented.
3. The shared PIN is an additional access gate, not an identity mechanism. Individual Firebase authentication and payroll permission remain the authoritative user controls.

## Artifacts

- `payroll-pin-desktop.png`
- `payroll-pin-mobile.png`
