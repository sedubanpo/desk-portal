# Desk Operations UX Contract

## Scope

This contract covers the daily shared-work notice ledger, the shared asset ledger, purchase-request composition, and consumable quantity adjustment.

## Users And Jobs

- Staff need to notice shared work before entering individual records and acknowledge it without losing context.
- Asset operators need to find equipment by category, branch, status, location, or responsible staff member and update it in place.
- Purchase operators need to select low-stock items, set request quantities, add new items, and produce a readable request message.
- All authorized desk accounts need consumable increment and decrement controls to update the intended item even when legacy inventory rows have been normalized.

## Invariants

- Shared work remains visible to every authorized account and shows recorder, acknowledgement ratio, and latest update.
- Opening one shared-work row does not hide the other rows or reset during normal rerenders.
- Asset records keep the existing persisted fields; responsible staff selection remains compatible with free-text shared ownership.
- Purchase selection and quantities remain persisted through the existing supply snapshot.
- Quantity adjustment resolves an exact item ID first. Identity fallback requires an exact match of item name, product name, and unit; it must not guess from partial text.
- Errors on the supply surface identify themselves as `물품 관리`, never as another portal.

## States

- Loading and empty shared-work states occupy the ledger body and explain the next available action.
- Asset and purchase filters return a truthful empty state without clearing stored records.
- Selected purchase candidates have a visible row state and remain first in the candidate order.
- Narrow screens collapse ledger metadata before content and actions, preserving readable task and product identity.

## Traceability

| Contract | Owner | Verification |
| --- | --- | --- |
| Shared work is the first operational database surface | `docs/index.html` | Signed-in desktop and mobile visual QA |
| Asset category, staff identity, filters, and compact actions are available | `docs/index.html` | Signed-in asset-tab interaction and screenshot |
| Purchase candidates and request composer form one workflow | `docs/index.html` | Signed-in purchase-tab interaction and screenshot |
| Legacy ID adjustment reaches the canonical inventory item | `services/desk-api/src/desk/handlers.js` | `desk-handlers.test.js` regression test |
| Supply errors use the correct portal label | `docs/index.html` | Source assertion and browser error-path inspection |

## Risks

- Existing free-text asset managers may not match a staff icon; they remain readable as text.
- Very long purchase messages remain scrollable and copyable; the composer does not truncate stored content.
