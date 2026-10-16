# Desk Portal Cloud Run API

데스크 포털의 Apps Script 중계를 제거한 Cloud Run 서비스입니다. 5단계 운영 전환에서는 Firebase Auth 인증 경계 안에서 근무표, 일일 업무일지, 비품, 채용, 포털 설정, 수강료, 급여 및 데스크 캘린더 API를 제공합니다.

## 현재 제공 API

- `GET /health`: 공개 상태 확인
- `GET /v1/me`: Firebase ID 토큰 검증 및 Firestore 근무자 권한 확인
- `GET /v1/migration`: 인증된 근무자용 마이그레이션 상태 확인
- `POST /v1/desk/:method`: 4단계 데스크 업무 API. 본문은 `{ "payload": { ... } }` 형식입니다.

모든 `/v1/*` 요청은 `Authorization: Bearer <Firebase ID token>` 헤더가 필요합니다. 토큰 검증 뒤 Firestore `users/{uid}`와 `userAppAccess/{uid}`를 읽어 계정 상태와 역할을 재검증합니다.

역할은 현재 S-LMS 계정 계약의 `ADMIN`, `STAFF`, `DESK`, `INSTRUCTOR`를 인식하되, `userAppAccess/{uid}.apps.deskPortal`이 `true`인 계정만 허용합니다. 따라서 기본 강사 계정은 데스크 포털에 접근할 수 없습니다. `users/{uid}.status`가 `ACTIVE`가 아닌 계정도 차단합니다.

## 로컬 실행

Application Default Credentials가 설정된 환경에서 실행합니다.

```bash
npm install
npm test
GOOGLE_CLOUD_PROJECT=fir-lms-prod npm start
```

## Cloud Run 배포

```bash
gcloud auth login
GOOGLE_CLOUD_PROJECT=fir-lms-prod bash scripts/deploy.sh
```

배포 스크립트는 필요한 Google Cloud API를 활성화하고 런타임용 `desk-portal-api-runtime`과 빌드용 `desk-portal-api-build` 서비스 계정을 분리합니다. 빌드 계정에는 Cloud Run Builder 역할만, 런타임 계정에는 Firestore·기존 RTDB 접근 및 자기 자신에 대한 Workspace 토큰 발급 권한만 부여합니다. 급여 시트는 뷰어, 데스크 캘린더는 일정 세부정보 보기 권한으로 런타임 계정에 직접 공유하며 서비스 계정 키 파일은 만들지 않습니다. Cloud Run 서비스 자체는 Firebase 클라이언트가 호출할 수 있도록 공개 ingress를 사용하지만, 업무 API는 애플리케이션 계층에서 Firebase ID 토큰과 Firestore 역할을 모두 검증합니다.

쓰기 요청은 반드시 `x-idempotency-key`를 포함해야 하며, 동일 사용자·메서드·키의 완료 응답은 Firestore 영수증에서 재사용됩니다. 수강료 입력은 `clientRequestId`도 함께 저장해 브라우저 재시도와 서버 재시작 뒤에도 중복 입력을 막습니다. 결제 원장, 월·일·최근 인덱스, 월별 스냅샷, 삭제 감사기록은 Firestore 트랜잭션으로 함께 변경됩니다. 비품 수량 변경은 Realtime Database 트랜잭션으로 처리합니다.

## Firebase 구독 비용 연동

유료 구독 현황의 Firebase 항목은 Cloud Billing BigQuery 내보내기가 준비된 경우에만 프로젝트별 예상 비용을 조회합니다.

- `SUBSCRIPTIONS_GCP_BILLING_TABLE`: 표준 또는 상세 결제 내보내기 테이블의 전체 이름(`project.dataset.table`)
- `SUBSCRIPTIONS_FIREBASE_PROJECT_IDS`: Firebase로 집계할 Google Cloud 프로젝트 ID(쉼표 구분)

런타임 서비스 계정에는 쿼리 실행 프로젝트의 BigQuery Job User와 내보내기 데이터 세트의 BigQuery Data Viewer 권한이 필요합니다. 연동 결과는 확정 결제액이 아니라 예상 비용으로 별도 저장되며, 사람이 입력한 결제액을 덮어쓰지 않습니다. 다른 서비스의 공개 가격표나 OpenAI API 비용은 구독 결제액으로 가져오지 않습니다.

## 구형 인증 경로 폐기

기존 Apps Script 고정 비밀번호와 RTDB 비밀값을 사용하는 이관·비교 스크립트는 실행을 차단했습니다. 현재 운영 API는 이 값들을 사용하지 않습니다. 추가 유지보수는 ADC와 현행 권한 검증을 사용해 별도로 구현해야 합니다.

Firebase 콘솔의 데이터베이스 비밀값 취소는 소스 제거와 별도 작업입니다. RTDB 데이터베이스와 런타임 서비스 계정 IAM은 계속 필요합니다.

## 안전 경계

- 급여·캘린더를 포함한 현재 운영 호출은 Cloud Run을 사용합니다.
- GitHub Pages의 운영 호출은 Firebase ID 토큰을 사용하는 Cloud Run 경로만 허용합니다.
- 과거 수강료 백필 메서드는 유지보수 전용으로 남아 있으며 운영 라우터에서 거부됩니다.
- 서비스 계정 키 파일을 저장소나 프론트엔드에 두지 않습니다.
- Cloud Run에서는 런타임 서비스 계정의 Application Default Credentials와 자기 위임 토큰을 사용합니다.


## 개인 업무와 진행 이력

`saveDeskDailyJournalTask`는 인증된 STAFF/DESK가 본인에게 개인 업무를 만들고 배정된 본인 업무의 진행을 변경할 수 있게 합니다. 담당자 변경, 타인 배정, 루틴 작성 및 삭제는 관리자 권한을 유지합니다. 관리자가 배정한 제목·상세를 직원이 바꾸는 것은 허용하지 않습니다. 작성자·변경자와 시간은 서버에서 기록하며, 기존 작성자 미상 기록을 새 작성자로 덮어쓰지 않습니다.

업무와 이력은 `desk_portal/daily_journal/{dateKey}` 트랜잭션에서 함께 저장됩니다. 업무는 `tasks/{id}`, 이력은 `taskHistory/{id}/{eventId}`에 저장합니다. `selfCreated`는 서버에서 결정하고 `version`은 실제 변경마다 증가합니다. 버전을 보내는 클라이언트의 오래된 변경은 거부하며, 동일 내용 재시도는 이력을 추가하지 않습니다. 기존 클라이언트의 버전 없는 요청은 호환성을 유지합니다. 캐시가 비어 있거나 오래된 첫 콜백에서도 서버 상태를 확인한 뒤 판단합니다.

미해결 가속 인덱스는 별도로 갱신하며, 실패 후 같은 요청을 재시도하면 인덱스를 복구합니다. 조회 시 정본 업무의 완료·삭제 상태가 인덱스보다 우선합니다.

`getDeskDailyJournalTaskHistory`는 `{dateKey,id,beforeVersion?}`를 받습니다. 관리자 또는 해당 담당자만 조회할 수 있으며 최신 30건과 `nextBeforeVersion`을 반환합니다. 이벤트는 추가/내용 수정/상태 변경/삭제, 전후 값, 변경 필드, 서버 변경자와 시간을 포함합니다. 이전 이력이 없으면 `legacy:true`를 반환합니다. 운영 데이터 백필이나 Notion 스키마 변경은 필요하지 않습니다.

화면과 API를 함께 배포해야 개인 업무 및 이력 기능이 동작합니다. 기존 Cloud Run 환경변수·시크릿 연결·서비스 계정·IAM을 유지하는 배포 경로를 사용해야 합니다. 이번 변경을 위해 광범위한 IAM 재설정이나 시크릿 목록 대체를 실행하지 않습니다.


## 2026년 9월 이후 정산 자료

9월부터 인트라넷 원본 수업에 현행 단가 상속, 자동 청구시간, 저장된 수업별 배분 및 학생 할인 규칙을 순서대로 적용합니다. 계산 스냅샷은 `scripts/sync-intranet-projection.mjs`로 인트라넷 원본에서 생성하며 참조 파일 해시를 함께 저장합니다. 학생 할인은 할인 전 매출과 할인액으로 나누되 순매출의 원 단위 반올림은 인트라넷과 동일하게 유지합니다. 금액·시수가 아직 미확인인 수업은 제외하고 월별 분석에 제외 건수를 표시합니다. 원본 출결·단가·할인 정책을 수정하거나 과거 스프레드시트로 대체하지 않습니다.

## 미니 사무실

일일 업무일지 상단의 `mini-office.js/css`는 당일 근무표와 활성 직원 디렉터리에서 근무자를 연결합니다. 본관 3석, 2관·3관 각 1석을 제공하며 미배치 근무자는 별도로 표시합니다. 이름이 같은 활성 계정이 여러 개면 자동 연결하지 않습니다. 이름 앞 아이콘은 포털의 기존 직급 아이콘을 재사용합니다.

`getDeskOffice`, `getDeskOfficeHistory`, `saveDeskOffice`, 인증된 `GET /v1/office/stream?dateKey=YYYY-MM-DD`를 사용합니다. 스트림은 기존 Cloud Run 요청 제한 내에서 22초마다 재연결하고 매번 인증을 다시 확인합니다. 화면이 숨겨지거나 계정·날짜가 바뀌면 구독을 해제합니다. 업무 상태는 접속 상태나 출퇴근을 의미하지 않습니다.

업무 상태와 감사 이력은 RTDB `desk_portal/daily_journal/{date}/office`에 저장합니다. 자리 선점과 버전을 서버 트랜잭션에서 검사하며 직원은 본인 UID, 관리자는 대리 처리할 수 있습니다. 완료 시 같은 날짜의 `memos/office-{taskId}`와 업무 상태를 하나의 트랜잭션으로 갱신하여 이중 기록을 방지합니다. 업무일지에는 시작 시각, 완료 시각, 내용, 소요시간 및 실제 처리자를 남깁니다. 취소는 감사 이력만 남기며 완료 일지를 만들지 않습니다. 전날 미완료 업무는 별도 안내하고 원래 업무일에 완료 기록을 남깁니다. 그 이전 업무도 업무일지 날짜 선택으로 조회·종료할 수 있습니다.

배포 시 API를 먼저 반영하고 화면을 배포해야 합니다. 신규 IAM 또는 공개 DB 규칙 변경은 필요하지 않습니다. 검증 명령:

```sh
node --test services/desk-api/test/office.test.js
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node services/desk-api/scripts/test-office-browser.mjs
```

브라우저 검증은 합성 근무자와 메모리 저장소를 사용하는 로컬 서버에서 수행하며 운영 업무 기록을 생성하지 않습니다.

업무 말풍선은 종이가 겹친 형태로 표시하며 클릭하면 해당 근무자의 날짜별 업무 히스토리를 조회합니다. 시작·수정·완료·취소 시각과 실제 처리자를 표시하고 수정 전 내용은 펼쳐 볼 수 있습니다. 자리 이동은 업무 히스토리에서 제외합니다. 서버에서 근무자별로 필터링하여 최신순 50건씩 반환하며 이전 기록은 커서로 추가 조회합니다. 팝업 기록은 열기·날짜 변경·새로고침 시 조회하며, 기존 일반 일지 기록을 소급하여 업무 시작 이력으로 만들지는 않습니다.

미니 사무실의 공용 칠판은 포털 상단과 동일한 `getDeskGlobalNoticeItems_()` 결과를 사용합니다. 게시 중인 공동 공지 전체를 표시하며 숨김·삭제·완료 공지는 제외합니다. 제목을 누르면 상세 내용과 기록자를 표시하고, 기존 공지 데이터 갱신을 반영하면서 펼침 상태를 유지합니다. 모바일 관 선택과 무관하게 공통으로 노출합니다.

미니 사무실 입력 보호: 업무 시작은 선택한 자리와 업무를 한 트랜잭션으로 저장하며 자리 충돌 시 업무도 시작하지 않습니다. 자리만 저장하면 입력창과 업무 초안을 유지하고 저장 버전을 갱신합니다. 완료는 입력창의 최종 내용을 저장하며 변경 전·후 내용을 히스토리에 남깁니다. 내용이 없는 기존 완료 요청은 저장된 업무 내용을 사용하는 방식으로 호환합니다. 미배치 근무자도 상세 창의 업무 히스토리 버튼으로 이력을 조회할 수 있습니다.
