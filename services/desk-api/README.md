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

## 구형 인증 경로 폐기

기존 Apps Script 고정 비밀번호와 RTDB 비밀값을 사용하는 이관·비교 스크립트는 실행을 차단했습니다. 현재 운영 API는 이 값들을 사용하지 않습니다. 추가 유지보수는 ADC와 현행 권한 검증을 사용해 별도로 구현해야 합니다.

Firebase 콘솔의 데이터베이스 비밀값 취소는 소스 제거와 별도 작업입니다. RTDB 데이터베이스와 런타임 서비스 계정 IAM은 계속 필요합니다.

## 안전 경계

- 급여·캘린더를 포함한 현재 운영 호출은 Cloud Run을 사용합니다.
- GitHub Pages의 운영 호출은 Firebase ID 토큰을 사용하는 Cloud Run 경로만 허용합니다.
- 과거 수강료 백필 메서드는 유지보수 전용으로 남아 있으며 운영 라우터에서 거부됩니다.
- 서비스 계정 키 파일을 저장소나 프론트엔드에 두지 않습니다.
- Cloud Run에서는 런타임 서비스 계정의 Application Default Credentials와 자기 위임 토큰을 사용합니다.
