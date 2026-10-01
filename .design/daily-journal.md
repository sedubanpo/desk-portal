# Daily journal personal work

Mode: Operate. Expand the existing lime/olive daily journal; preserve navigation, attendance, shared notices, quick records and the live activity view.

## User request

Workers need to save tasks for themselves, choose their own progress and retain a change history. Improve the unresolved-work UI in the supplied daily journal screen.

## Scope and behavior

- Own named tab: native “내 업무 추가” disclosure with title, details, initial status and next action. Assignee is the signed-in identity; selected journal date is explicit.
- Queue: title first, staff identity and actual registration/carryover date below, compact semantic status. Filters use persisted status.
- Expanded work: native progress selector (대기 / 진행 중 / 확인 필요 / 완료), progress memo, next action, save and history.
- Completion: move into completed disclosure; retain history; “다시 진행” sets 진행 중.
- Loading/error: disable during save, preserve input, roll back uncertain optimistic status, recover server baseline, retry. History failure has a retry action. Auth changes discard outstanding history responses.
- Other workers: no self composer; progress inputs disabled; no save/history buttons. Server independently checks owner and authenticated role.
- Administrators retain assignment/deletion permissions. Staff retain existing shared notice publication and own acknowledgement behavior.
- Historical records with no events say that history is absent; do not fabricate old events or modify operational data for QA.

## Evidence

269 Node tests passed. Ten browser scenarios passed on actual extracted queue functions, production CSS and authenticated Express handlers using a synthetic in-memory store. Desktop 1440 and mobile 390 captures are in `.impeccable/review/personal-tasks/`. No mobile page overflow or page errors. The fixture substitutes staff avatar artwork and unrelated portal/sync plumbing; it does not prove production Firebase, deployment or the complete hub shell.

The bounded CSS detector found one pre-existing side border at workspace.css:562, outside this task. No new finding in the personal queue rules.

Production activation requires the API and Pages together.

User polish: show unresolved count as plain tabular text beside the title; align action icons/labels using inline-flex; remove empty error-row gaps, duplicate field margins, nested memo padding and redundant spacing before the task list. Keep 40px action targets.
