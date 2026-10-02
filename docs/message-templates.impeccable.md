# Message Templates implementation record

Status: implemented locally; not deployed. Surface mode: Operate. The existing portal's bright lime/neutral design remains authoritative; this change does not establish a new global visual world.

## Scope

`docs/index.html` integrates `docs/message-templates.js` and `docs/message-templates.css`. Search precedes three transient name inputs for student, teacher and applicant. Categories, library and output form the main workbench, with source editing collapsed by default. The student, teacher and applicant fields have translucent line symbols and visible labels. Copy/save actions use pale lime rather than dark green. No raster assets were added.

`{학생명}`, `{강사명}`, `{담당강사}` and `{지원자명}` are replaced in preview and copied output using the temporary inputs; teacher input supplies both teacher tokens. Stored template source retains its placeholders. Unresolved placeholders trigger a confirmation before copying.

The server module `services/desk-api/src/desk/message-templates.js` owns create/update/delete audit entries for templates and tags. Records retain authenticated actor UID/name, server time and before/after values under `dailyConfig/messageTemplates/history`, committed with the configuration in the same compare-and-swap transaction. Existing history is preserved rather than accepted from client submissions. Legacy records receive no invented creation or historical event timestamps.

## Validation and limits

The implementation owner reports synthetic browser checks covering name substitution, successful and failed saves, create/update/delete operations, and audit actor/time display. The backend suite passed 286 tests. Independent review returned ship based on source and screenshots; that reviewer did not repeat the live browser checks. These checks establish local implementation readiness, not production deployment.

Captured desktop and mobile evidence: `/private/tmp/template-desktop-delivery.png` and `/private/tmp/template-mobile-final.png`. These temporary paths are session evidence, not durable repository assets.

## Maintenance

Keep global tokens in `docs/workspace.css`; scope composition refinements to the message-template surface. Preserve the search → names → category/library/output reading order, keyboard-visible focus, readable wrapped message text, and explicit absence of legacy history. Keep audit attribution and event generation on the server.
