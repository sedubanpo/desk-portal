# Workspace redesign — 2026-09-08

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
