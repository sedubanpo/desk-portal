# Desk Portal

## Platform
Web: static HTML/CSS/JavaScript served by GitHub Pages, standalone or embedded in the SEDU SSO workspace.

## Users and tasks
Repository and supplied screenshots identify academy front-desk staff managing daily journals, follow-up, responses, schedules, supplies, recruiting, templates, tuition and teacher payroll. This is product evidence, not a usability study.

## Constraints
Preserve existing authenticated handlers, payroll authorization, unsaved data, payment calculations and status grouping. Do not access production records for design QA. Use synthetic local fixtures. User explicitly excludes dark accent strips at the left of elements.

## Current request
Use the supplied intranet as structural and visual guidance: a light navigation rail, quiet surfaces, clear working area. The user confirmed that the daily journal remains the default landing screen.

User confirmed light lime green as brand color; prioritize detailed daily journal, employee workspace, attendance, and clean login in this iteration.

## Routine distribution (approved 2026-10-23)
Staff use Today assignments and a separate routine library. S/A/B/C mean highest priority required, required today, regular, and optional when available. Templates hold repeating weekdays and default responsible/helper staff; each date takes an immutable task-content snapshot. Non-working defaults are left unassigned. All authenticated desk staff may assign themselves or others and change date-specific roles; responsible and helper are distinct, at most one each. Either assignee may complete; admins may manage completion. Original templates may be edited by their author or an authorized task manager. Grade dragging has a button alternative. Role/grade changes have version-guarded undo and all day changes preserve actor/time and before/after history. Existing journal routines are retained separately. New distribution opens from the daily journal. No production records are used for QA.
