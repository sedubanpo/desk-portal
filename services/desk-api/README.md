# Desk Portal Cloud Run API

데스크 포털의 Apps Script 중계를 단계적으로 제거하기 위한 Cloud Run 서비스입니다. 1단계에서는 운영 기능을 전환하지 않고 Firebase Auth 인증 경계와 배포 기반만 제공합니다.

## 현재 제공 API

- `GET /health`: 공개 상태 확인
- `GET /v1/me`: Firebase ID 토큰 검증 및 Firestore 근무자 권한 확인
- `GET /v1/migration`: 인증된 근무자용 마이그레이션 상태 확인

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

배포 스크립트는 필요한 Google Cloud API를 활성화하고 런타임용 `desk-portal-api-runtime`과 빌드용 `desk-portal-api-build` 서비스 계정을 분리합니다. 빌드 계정에는 Cloud Run Builder 역할만, 런타임 계정에는 Firestore 접근 역할만 부여합니다. Cloud Run 서비스 자체는 Firebase 클라이언트가 호출할 수 있도록 공개 ingress를 사용하지만, 업무 API는 애플리케이션 계층에서 Firebase ID 토큰과 Firestore 역할을 모두 검증합니다.

## 안전 경계

- 1단계에는 수납·정산·일지 등 업무 쓰기 API가 없습니다.
- 기존 Apps Script 요청 경로와 GitHub Pages 설정은 바꾸지 않습니다.
- 서비스 계정 키 파일을 저장소나 프론트엔드에 두지 않습니다.
- Cloud Run에서는 런타임 서비스 계정의 Application Default Credentials를 사용합니다.
