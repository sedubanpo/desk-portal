# Recruiting Applicant Database Visual QA

Validated on 2026-07-17 in the signed-in Chrome `학원` profile against the production Desk Portal.

## Production surface

- URL: `https://sedubanpo.github.io/desk-portal/?v=d9b0123`
- Cloud Run revision: `desk-portal-api-00011-nqh`
- Applicant rows rendered: 17
- Browser console warnings/errors: 0

## Interaction checks

- Stage labels render as rectangular semantic markers; rejected and recommended rows use distinct danger and success colors.
- The applicant list uses a fixed database grid with sticky headers, row and column separators, and compact management controls.
- The comment composer opens inside the selected applicant cell, updates `aria-expanded`, and focuses the comment input.
- No production comment was submitted during QA.

## Responsive checks

- 390x844: table wrapper remained inside the viewport and owned horizontal scrolling.
- 768x900: table wrapper remained inside the viewport and owned horizontal scrolling.
- 1280x800: table wrapper remained inside the viewport and owned horizontal scrolling.
- The existing full application shell has document-level overflow at 390px; the redesigned table itself remains contained and does not add page-level overflow.

