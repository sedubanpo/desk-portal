# UX Receipt

## Goal

Give each staff account a personal attendance workflow while preserving manager oversight and preventing unauthorized schedule or payroll changes.

## Before / After

| Area | Before | After |
| --- | --- | --- |
| Shared-work notice | Only today's loaded shared tasks could rotate | All loaded unfinished shared tasks, including carryovers, rotate with the recorder name |
| Monthly schedule | Staff could see the same editing controls as managers | Schedule editing controls are hidden for read-only staff and server writes require `canManageSchedules` or `ADMIN` |
| Teacher payroll | Tab was visible before the privileged PIN gate | Tab is hidden unless the account has `canManagePayroll` or `ADMIN` |
| Daily journal | No attendance action | Compact clock-in, clock-out, and correction-request controls use the signed-in account |
| Correction workflow | No request or approval path | Staff submit corrected times and a reason; administrators approve or reject in the monthly attendance view |
| Auditability | Schedule history existed, attendance history did not | Punches, correction requests, decisions, and corrected records retain actor and timestamp audit data |
| Attendance insight | No per-worker summary | Monthly completed-day, late, early-leave, corrected-day, and worked-time summary |

## Interaction Contract

- Clock-in and clock-out are available only for the current Seoul date.
- A duplicate punch is rejected by the API.
- Staff attendance reads are filtered to the authenticated UID.
- Correction approval is administrator-only and does not overwrite the original record until approved.
- Schedule write authorization is enforced in the API, independent of hidden controls.

