# Daily Journal Operations UX Contract

## Surface

- Target: authenticated internal desk portal in Chrome
- Area: Desk Management > Daily Work Log
- Primary users: desk staff and administrators
- Rendering: browser DOM UI backed by Firebase/desk-api data

## Outcomes

1. Pending and shared-work counts have a single loading-to-settled transition.
2. A stale request can never replace a newer date or worker selection.
3. Opening a shared-work item survives normal rerenders.
4. Worker navigation has three explicit workspaces:
   - All: full-width Assignment Ledger
   - Task Manager: unresolved queue and notice/assignment/routine management
   - Named worker: quick entry, personal queue, records, and report copy
5. Shared work is one line by default and expands only on explicit request.
6. Mobile pages never create body-level horizontal overflow; wide tabs and ledger tables scroll only inside their own regions.

## State Contract

- Pending and shared-work counters show `확인 중` while their request is unresolved.
- Quick and complete pending sources are merged before the UI receives one settled result.
- Carryover uses a stable all-assignee scope; worker tabs do not change the underlying count.
- Every asynchronous refresh carries a request identity, and stale responses are ignored.
- The explicitly opened shared-work ID is held independently from list rendering.

## Interaction Contract

| Workspace | Primary action | Required feedback |
| --- | --- | --- |
| All | Search/filter the assignment history | Row count and table update together |
| Task Manager | Filter unresolved work and manage notices | Active filter is visible; queue count matches rows |
| Named worker | Enter and review worker records | Save/read controls remain in the worker context |
| Shared work | Scan or expand one item | Default height remains compact; expanded item stays open |

## Safety And Accessibility

- Live browser QA was read-only to avoid adding or modifying production records.
- Write/read/idempotency behavior is covered by desk-api unit tests.
- Icon-only actions have accessible labels and stable 40px targets.
- Tables use sticky headers, wrapped cell content, and tabular numeric alignment.
- Accepted mobile tradeoff: the ledger retains a scoped horizontal table scroll so all columns remain available without shrinking text.

## Surface Evidence

| Target | Owner | Claims | Scope reason |
| --- | --- | --- | --- |
| Daily Work Log | Desk operations | Stable counters, persistent shared state, clear worker workspaces | Directly requested operating workflow |
| Assignment Ledger | Administrator | Full-page readable history and filters | Complete audit history is operationally important |
| Shared work strip | All desk staff | Fast scanning with optional detail | Shared notices appear on every worker context |
| Mobile layout | Desk staff | No page-level horizontal overflow | Portal is used on narrow screens as well as desktop |
