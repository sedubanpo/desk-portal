# Recruiting Applicant Views Visual QA

Validated on 2026-07-17 in the signed-in Chrome `학원` profile against the production Desk Portal.

## Production surface

- URL: `https://sedubanpo.github.io/desk-portal/?v=8fc075c`
- Cloud Run revision: `desk-portal-api-00011-nqh`
- Applicant rows rendered: 17
- Sync state after interaction: `Firebase 서버 저장`

## Interaction checks

- Stage labels render as rectangular semantic markers; rejected and recommended rows use distinct danger and success colors.
- The redundant `직무/과목` column is absent. The applicant cell retains the concise role label below the name.
- Subject tabs render as `전체`, `국어`, `영어`, `수학`, `과학`, and `사회`, with live counts from the currently filtered records.
- Selecting the math tab reduced the production table from 17 rows to 2 rows, and returning to `전체` restored all 17 rows.
- All special-note regions were collapsed on first render. The selected region opened below its applicant, updated `aria-expanded`, exposed the existing notes and focused the input.
- The comment write method is classified as a write request, so the Cloud Run transport adds `x-idempotency-key` before sending.
- No production comment was submitted during QA.

## Responsive checks

- 390x844: existing table wrapper contract owns horizontal scrolling.
- 768x900: existing table wrapper contract owns horizontal scrolling.
- 1280x800: existing table wrapper contract owns horizontal scrolling.
- The existing full application shell has document-level overflow at 390px; the redesigned table itself remains contained and does not add page-level overflow.

## Automated checks

- Desk API regression suite: 50 passed, 0 failed.
- Frontend cloud-routing assertions cover idempotency classification, subject tabs, collapsed special-note details, and the removed role column.
- The production inline script passes `node --check` and `git diff --check`.
