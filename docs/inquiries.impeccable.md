# Inquiry dashboard handoff

Status: implemented locally; **not deployed**. This handoff describes the current school/source analysis and follow-up visibility update. Earlier production notes describe earlier revisions.

## Interface and behavior

The dashboard keeps the existing bright neutral surfaces and lime Operate accents. Its secondary analysis row contains school ranking, ranked demand, follow-up timing, and acquisition/contact analysis. Container widths above 1300px use four columns; widths at or below 1300px use two, and at or below 600px use one. Ranking lists scroll within their cards; detail dialogs constrain height and scroll on small screens.

- School ranking shows inquiry counts and shares of the selected arrival cohort. Logos reuse account-management `sharedIconAssets` through authenticated `GET /v1/inquiries/school-icons`: category is normalized to `SCHOOL`, status must be `ACTIVE` (missing status defaults to active), and the image URL must use HTTPS. `imageUrl` and legacy `downloadURL` are supported. Matching checks display name, lookup key without `school:`, and aliases, ignoring whitespace and letter case. Unmatched schools use the existing icon.
- “알게 된 경로” is the default tab; “연락 채널 활용” remains available in the same card. `acquisitionSource` reads the exact Notion property `에스학원 알게 된 경로는?`. Grouping trims only leading/trailing whitespace, groups identical remaining text, and retains blanks as `미입력`. There is no semantic classifier or inferred channel mapping. CSV includes the same raw-text groups.
- School, subject/other demand, acquisition-source, and contact-channel rows open detail dialogs for the selected period. Dialogs show grade and subject distributions, current registration count, and matching inquiries; selecting a name opens individual detail. Individual detail explicitly displays acquisition source as read-only text, with editing directed to Notion.
- Follow-up rows can be hidden and restored from the hidden tab. Visibility is shared among staff, not browser-local. Hidden inquiries leave the active follow-up queue and its timing counts but remain in the inquiry ledger and cohort analytics. Existing follow-up eligibility still applies to the hidden tab.

## Data and consistency

`POST /v1/inquiries/:id/visibility` accepts boolean `hidden` and `expectedHidden`. It verifies the inquiry belongs to the configured Notion source, then uses a Firestore transaction to detect conflicting staff changes. `deskInquiryMirror/main/queueVisibility/{id}` stores visibility, timestamp, and actor; list/detail/write responses merge this state. Hiding/restoring does not modify Notion, delete the inquiry, or change its progress/follow-up properties.

Mirror metadata now records `projectionVersion: 2`. On the first sync of an older projection, the service bypasses the recent-sync shortcut and performs a full query to backfill acquisition source. The version is recorded after successful synchronization; existing lease and error reporting behavior remains. No Notion schema migration is required for this update.

Cohort analysis still uses 입력 시간 with creation-time fallback in Asia/Seoul. Follow-up timing remains all-time. Registration is current status, and contact-channel totals are accumulated valid contacts for the selected cohort, not contacts occurring during the selected dates.

## Verification and limits

Reported by the implementation session: all 290 API tests passed before the final individual-detail and logo-compatibility fixes; 34 targeted inquiry/analytics tests passed afterward. Static review caught the missing individual acquisition-source field, which is now explicitly rendered read-only and was confirmed in the browser. Subsequent inquiry tests, including endpoint authorization, trusted actor attribution, and legacy `downloadURL` compatibility, passed 22/22 (`/private/tmp/inquiry-auth-tests.tap`). The browser layout detector reported no findings (`/private/tmp/inquiry-layout-scan.json`). These counts do not claim the entire suite was rerun after the last fixes.

Browser verification used synthetic data only. Session screenshots: `/private/tmp/inquiry-desktop.png`, `/private/tmp/inquiry-mobile.png`, and `/private/tmp/inquiry-mobile-popup.png`. These temporary files are inspection artifacts, not durable production evidence. Live Notion behavior, production asset availability, and deployed visibility persistence have not been verified for this revision. Deployment remains outstanding.

Primary implementation: `docs/inquiries.js`, `docs/inquiries.css`, `docs/inquiry-analytics.js`, and `services/desk-api/src/inquiries/{model,service,router}.js`.
