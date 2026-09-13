# Workspace redesign — 2026-09-08

## Tuition import addition — 2026-09-13

This section supersedes the earlier no-service-change invariant only for tuition import. Audience: authenticated academy desk staff (user screenshots, high confidence). Existing manual receipt edits/deletes and tuition sign convention remain authoritative. Supplied account-management screenshot is an approved reference for identity tiles and school emblems, adapted to the desk lime/neutral theme; student statuses and other records are not copied from it.

Journey: export-adjacent upload button → local XLSX parsing → per-row student and due-month selection → server duplicate preview → input eligible rows → per-row durable results → month/action-filtered audit history. File name is retained as provenance; phone numbers are not transmitted or persisted by this feature. Unknown students/months, invalid rows, canceled payments and ambiguous manual matches stay visible with a reason. Cancellations require original-payment/refund reconciliation through existing receipt management; no inferred refunds are written.

Persistence: Cloud Run tuition handlers and Firestore transaction store own receipts, indexes, snapshots, audit and durable import markers. Payment fingerprint is approval/date/signed amount; manual no-approval student/date/amount matches are conservatively excluded. Same student/day and approval/date/amount guard documents serialize appends. Transactions recheck ledger matches and update all affected records atomically. Edited/deleted imports keep original fingerprint markers to prevent replay resurrection. Staff identity comes from existing authentication middleware. No production student or receipt mutation is part of QA.

State/focus: file input and preview are local and retained across modal close; busy controls prevent double submission; individual failures remain retryable through rechecking. Native dialog traps focus, Escape closes when idle and returns focus to upload. Preview table owns horizontal scrolling; dialog owns vertical scrolling. Month and student selections invalidate preview approval. Existing status controls stay visible on quiet white rows; recent receipts use full row width and label receipt/refund explicitly.

Proof map: parser cases → docs/payment-link-parser.js → payment-link-parser.test.js; duplicate/provenance/rollback cases → tuition/payment-link.js, handlers.js, store.js → payment-link.test.js and tuition-handlers.test.js; interface → payment-link-upload.js, tuition-import.css and existing renderer → synthetic Chrome interaction/geometry receipt. New service paths remain behind staff authentication and write idempotency. Chrome/macOS Korean keyboard/pointer tested; real Windows, assistive-technology usability and production payment writes remain unverified. Screenshot capture remains excluded under the prior user constraint; DOM/AX evidence is narrower than pixel visual approval.

## Evidence and scope
Supplied desktop standalone/SSO screenshots show repeated module navigation, full worker roster, and an always-visible activity rail competing with the daily journal. User requests intranet-inspired clarity and no dark left accent stripes. Reference authority covers hierarchy and tone, not exact pixel replication or invented capabilities.

## Decisions
- Six desk workflows and two settlement workflows are always reachable from one named navigation region.
- Desk workflow navigation switches back from settlement using the existing module renderer. Teacher payroll continues through its original privileged-access handler.
- Existing employee roster and settlement rules are retained inside a native details disclosure. Activity begins collapsed and remains expandable with its existing toggle.
- The main header supplies location, clock, account controls and existing notice. Page task headings remain owned by their panels.
- Light neutral surfaces, restrained indigo active navigation, ordinary text weight and consistent controls replace heavy green surfaces. Semantic payment red/blue remains.
- Narrow layouts retain all controls; wide tables own horizontal scrolling. No decorative left/right accent strips.

## Invariants and proof
No service/schema or financial rules change. No production mutation or authentication changes. Source/runtime tests cover module routing and prior regressions. Local synthetic HTML fixture uses production markup/CSS with simulated navigation solely for rendered layout geometry; it does not prove authenticated business operations. Desktop, embedded-width and narrow layout are checked through browser DOM/computed geometry without screenshots under the prior capture constraint.

## Limitations
No participant study or production business-operation testing. The user confirmed the daily journal as the default landing workflow. Keyboard native buttons/details, visible focus, current-page state and unclipped navigation are required.
