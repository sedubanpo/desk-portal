# Daily Journal Recovery Evidence

- Surface: authenticated browser-hosted Desk Portal
- Affected users: administrator and staff accounts
- Primary outcome: daily journal, shared work, and live status leave loading state after RTDB stalls
- Client owner: `docs/index.html`
- Service owner: `services/desk-api/src/desk/store.js`
- Deployment owner: `services/desk-api/scripts/deploy.sh`

## Acceptance Trace

| Claim | Implementation | Proof |
| --- | --- | --- |
| A stalled RTDB read recovers | 8-second timeout, reconnect, one retry | `test-output.txt` store recovery test |
| Shared work remains common | Shared tasks bypass staff-private worker filtering | frontend source contract test |
| Live status remains common | Live feed combines all memo and task items without account filtering | frontend source contract test |
| Loading cannot remain indefinite | Daily journal and live feed render explicit error and retry states | frontend source contract test |
| Staff can log out | Header logout action signs out Firebase and clears local desk state | frontend source contract test |
| Account name remains readable | Header notice shrinks first; identity gets a larger bound and full title | source inspection and detector receipt |

## Design Impact

Scoped visual delta inside the existing Desk Portal system. The forest header, compact controls, typography, and spacing remain unchanged. Only header width negotiation and the visible network-error state changed.

## Detector

Impeccable detector ran once after UI edits. It reported only pre-existing global warnings for legacy side borders, fonts, transitions, shadows, and a radial background; none point to the changed header or journal recovery blocks.
