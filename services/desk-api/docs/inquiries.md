# 신규문의 관리센터

## Scope
Menu below 일일 업무일지. Authorized active ADMIN/STAFF/DESK with deskPortal access can read, edit, trash, restore and record contacts. INSTRUCTOR is denied. No browser Notion tokens. No automatic calls or messages.

Notion source: `5a9e0b14-58d8-4163-812b-48e4df51dcbc` (신규문의 DB). Notion remains authoritative. Existing properties and page bodies are preserved. New properties: 문의 담당자, 문의 진행상태, 재연락 관리, 다음 연락일, 다음 할 일, 최근 연락일, 최근 연락 결과. Separate history DB has 문의 relation, 연락 결과, 메모, 기록자/시각, 요청 ID, 기록 상태, 수정자/시각. Contacts can be corrected or cancelled, never erased by the contact correction action.

## Configuration
- `NOTION_INQUIRY_TOKEN`: Secret Manager reference to ACCOUNT_MANAGEMENT_NOTION_TOKEN, connection sedu catch.
- `NOTION_INQUIRY_SOURCE_ID`: source ID above.
- `NOTION_INQUIRY_HISTORY_ID`: data source of 신규문의 연락 이력.
- `NOTION_INQUIRY_SYNC_KEY`: secret for server-only scheduled sync.

## Sync and consistency
`GET /v1/inquiries` refreshes incremental changes when >45s old. Open visible tab polls every minute unless editing. `POST /sync` and the authenticated scheduled `POST /sync-job` perform a complete query, including pagination. Full queries also reconcile previously seen missing records using direct lookup to distinguish trash/moved/inaccessible. Last confirmed sync and failures are displayed. No webhook subscription is required; scheduled polling is the deployed transport. No instant-delivery guarantee.

Firestore `deskInquiryMirror/main/items` is a server-only read mirror; operations and locks are subcollections. Client rules must deny direct access. Item writes compare remote edited times to avoid older sync results replacing newer writes. Per-page leases serialize portal edits. Notion has no atomic compare-and-set: pre-read version comparison and post-write verification detect common conflicts but cannot eliminate a simultaneous direct Notion edit between those calls. Portal writes patch only changed properties.

Every write uses a request ID, fingerprint and durable operation journal. A lost response can be retried with the same ID. Contact log creation is checked by unique request ID; an ambiguous POST result never blindly creates a duplicate. If Notion returned an ambiguous create result and repeated lookup finds no history, an operator must reconcile the operation instead of generating a new request. Partial saves return errors, not success. Audit journal stores actor, time, original values and requested changes. Delete uses Notion in_trash and supports restore while recoverable in Notion.

## Legacy and reporting
Blank new stage derives conservatively from explicit legacy values: 신규등원/압구정관 등록 => 등록 완료; 타원등록 => 종료; 등원예정/상담예정 => 상담 예약; other completed contacts => 상담 중. Existing 연락금지 is excluded. Legacy values are shown and never rewritten automatically. Incomplete items default to followup; missing date remains 일정 미지정. Contact completion alone does not close a lead. Dates use Asia/Seoul. Charts use creation date, default last 30 days, selected date interval independent of task filters. School top four plus other; subject charts count selections; missing values explicit. Trash excluded.

## Verification
Unit/integration tests use fake Notion and Firestore; verify auth, wrong-source ID, input, real upstream mutations, stale edits, idempotency, contact history, trash/restore and error semantics. Browser QA uses synthetic data only. Do not create or delete real prospect records for QA.

## Idempotent setup
After sharing the original DB and its parent 신규문의 등록 page with sedu catch, run `python3 services/desk-api/scripts/setup-inquiries.py --output /private/tmp/inquiry-history-config.json` using the authorized operator's gcloud account. Only missing properties are added; the existing named direct-child history DB is reused. Output contains IDs, never secrets. Set NOTION_INQUIRY_HISTORY_ID to the returned sourceId and deploy before directing traffic to the new revision. Configure a five-minute scheduler to POST /v1/inquiries/sync-job with the secret header x-inquiry-sync-key; do not put the secret into source control.

## Production configuration (2026-09-27)
History database `19cbe931-3579-4398-a8fb-0f251cc9ea95`; history source `f1dd3c9c-c0b3-4ef6-b337-c2cd01f0c283`. The source and parent page are shared with sedu catch. Notion date properties retain minute precision in verified behavior: contact display timestamps are normalized to a minute; 기록 시각 원본 preserves the exact ISO timestamp for ordering. History versions hash properties, not only last_edited_time. Mirror reads track their request start time to prevent same-minute older reads from replacing later writes.

Live Notion isolated QA passed edit, contact creation, request replay, history correction/cancellation, trash and restore. Test content was created in a separate temporary page with separate databases, then moved to trash. No real prospect record was edited. Original inquiry mirror initially contained 628 records.

## Contact workflow update (2026-09-28)
First contact displays the Notion 입력 시간 property (creation timestamp fallback) in Asia/Seoul. Charts use the same date. Explicit 연락 방법 (전화/카톡/문자) is persisted in Notion history. Counts and most recent actor are rebuilt from valid histories, excluding cancelled/trashed entries; unknown legacy reply methods are not guessed. Server-only contactSummaries mirrors rebuild during synchronization and after contact edits. Nickname is captured from the authenticated account with name fallback.
Progress choices: 상담 중, 연락두절, 타원 등록, 연락 보류, 재연락 대상. Existing enrollment/closed statuses remain readable and are not bulk rewritten. Changing to 상담 중/연락두절/재연락 대상 enables followup, while 타원 등록/연락 보류 excludes it. The progress dialog saves 진행상황 비고 separately from existing 특이사항.
Run setup-inquiries.py before deploying this version; it appends select options preserving existing values and adds only the missing history method/source note properties. Calendar presets and custom range affect charts only. Contact buttons record completed actions and do not send any communications.
