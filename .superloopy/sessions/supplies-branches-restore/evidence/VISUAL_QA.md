# Supplies Branch Visual QA

## Production surface

- URL: `https://sedubanpo.github.io/desk-portal/?branch-fix=049bfe4`
- Browser: Google Chrome, academy profile
- Deployment commit: `049bfe4`
- Surface: Desk Portal > 물품 관리 > 소모품 현황

## Verified behavior

- The branch tabs always render in this order: `전체`, `본관`, `2관`, `3관`.
- Selecting `2관` keeps all four tabs visible and renders the existing empty inventory state.
- Selecting `3관` keeps all four tabs visible and renders the existing empty inventory state.
- The consumable form still offers `본관`, `2관`, and `3관` as save targets.
- Stored custom branches remain append-only after the fixed academy branches.

## Visual review

- Existing `DESIGN.md` tokens and the established segmented-control styling are unchanged.
- No color, typography, spacing, radius, shadow, motion, or responsive CSS was added or changed.
- Active, inactive, and empty states remain visually coherent with the existing portal.
- No new visible copy, decorative effects, horizontal overflow, or layout nesting was introduced.
- The narrow-layout behavior is unchanged because this fix only changes the branch option array used by the existing responsive component.

## Evidence

- `chrome-supplies-2branch-redacted.jpg`: production view with `2관` selected.
- `chrome-supplies-3branch-redacted.jpg`: production view with `3관` selected.
- `live-branch-verification.txt`: live DOM verification summary.
- `G001-C002-capture.txt`: full automated regression suite.

## Result

PASS. The missing academy branches are restored without changing the existing interface design or weakening empty-state behavior.
