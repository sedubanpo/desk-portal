# Mandatory training records

The HR screen defaults to recruiting. `docs/training-hr.js` adds the separate training tab. `docs/training.html` is the login-protected employee submission entry point; the supplied 2026 guide is copied unchanged to `docs/training-guide-2026.html`.

## Access

`/v1/training` authenticates active Firebase ADMIN/STAFF/DESK/INSTRUCTOR accounts. Desk Portal app access is not required for an employee's own training records. Other Desk API routes retain their existing access checks. Only ADMIN, or a user with both `apps.deskPortal` and `permissions.canManageTraining`, manages courses, all workers, reviews and internal education. Permissions come from stored account/access documents, not request bodies.

All course applicability defaults to pending. The supplied guide is a preset, not a blanket applicability determination. Managers designate required/exempt per worker. Uploads change status to submitted, never approved. Review approval needs a certificate or a same-course internal session with the worker in its participant list and an evidence attachment. Workers cannot view group photographs or other employees' records.

## Storage

Metadata: Firestore `deskTraining/{year}/{courses|records|sessions}`. Existing deployed Firestore wildcard rules deny direct client reads/writes; all access is through the API. Version checks prevent stale forms from replacing newer metadata. Records retain employee names so former staff remain visible in historical years.

Files: private `gs://fir-lms-prod-training-evidence/training/{year}/{records|sessions}/{recordId}/{fileId}`. Uniform bucket access and public access prevention are enabled. The Cloud Run runtime service account has objectUser access. No public URLs or Firebase download tokens are created. Download endpoints authorize the parent record and respond as attachments. Uploaded PDF/JPEG/PNG/WebP signatures are checked; max 10 MiB per file, 30 files per record. Existing files are retained when more are added. No retention deletion policy is configured.

The employee submission URL does not contain a session/SSO token. The standalone page uses the existing login alias system with session persistence, and clears state on sign-out. Neither request-text copying nor this feature sends messages to staff automatically.

## Validation

`npm test --prefix services/desk-api` covers identity spoofing, unauthorized file access, approval without evidence, internal session links, stale saves, MIME mismatch and size limits. Synthetic local browser checks cover target assignment, record saving, request-text copying, internal education, mobile containment and worker-only screens. Production employee evidence is not used for testing.

관리 화면은 실무자 탭을 기본으로 표시하며 INSTRUCTOR 계정은 강사 탭으로 분리합니다. 이름 라벨은 userProfiles의 department/subjects 및 staffPosition을 사용합니다. 일반 근무자는 본인 과정별 제출·검수 카드만 조회합니다.
