# Daily Journal Visual QA

- Live URL: https://sedubanpo.github.io/desk-portal/
- Verified source commit: `ca1cd68`
- Browser: authenticated Google Chrome session
- Console warnings/errors: none

## Desktop, 1280px

- `desktop-1280-ledger.png`: the Assignment Ledger occupies the full content width.
- Ledger viewport: 1175px client width / 1175px scroll width; headings and wrapped text are not clipped.
- Search for `김광수` changed 53 rows to 2 and clearing restored 53.
- `삭제됨` status produced exactly one row; `전체` restored 53.
- `desktop-1280-manager.png`: task and manager columns measured about 560px / 631px.
- Assignee filter `홍성우` produced 23 unresolved items.
- `후속 필요` produced 23 items whose follow-up field was empty.
- Shared-work search `김광수` produced 1 of 1 item.

## Mobile, 390 x 844

- `mobile-390-top.png`: body client/scroll width was 375px / 375px, with no page overflow.
- Date navigation measured `72px 153px 72px`; Today uses the full 309px row.
- `mobile-390-ledger.png`: ledger scroll is contained locally, 285px client / 1080px content.
- `mobile-390-manager.png`: manager changes to a one-column layout at about 287px width.
- Worker tabs scroll inside their own strip, 315px client / 932px content.

## Behavioral Visual Checks

- During date changes, both counters immediately showed `확인 중`.
- On August 2, three consecutive samples remained `25건 / 1건`.
- Returning to August 1 again showed one loading state, then three consecutive `25건 / 1건` samples.
- An explicitly expanded shared-work item remained open after switching to Task Manager.
- Assignment, routine, assignee, queue-state, ledger-search, and ledger-status views all rendered without layout shifts.

## Mutation Boundary

The authenticated live QA did not press production save/delete actions. Input, persistence, all-assignee reads, ledger history, and idempotent writes were verified through the focused desk-api tests recorded in `behavioral-test.txt`.
