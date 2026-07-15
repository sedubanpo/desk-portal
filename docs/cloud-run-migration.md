# 데스크 포털 Cloud Run 마이그레이션

## 4단계 상태

운영 트래픽을 변경하지 않은 채 아래 기반과 업무 API를 추가했습니다.

1. Cloud Run용 Node.js API 서비스
2. Firebase ID 토큰 검증
3. Firestore `users/{uid}` 기반 역할 및 활성 상태 검증
4. GitHub Pages origin 제한 CORS
5. 근무표·일일 업무일지·비품·채용 API
6. 수강료 조회·입력·수정·삭제 트랜잭션
7. Google Sheets API 기반 급여 계산과 Firestore 설정·예외값 저장
8. Google Calendar API 기반 데스크 일정 조회
9. 기존 Apps Script API 43개 중 39개에 대한 전환 수량 계약

배포 대상은 Firebase Auth와 Firestore가 있는 `fir-lms-prod`, 리전은 `asia-northeast3`, 서비스명은 `desk-portal-api`입니다. 4단계 배포도 최종 전환 전까지 운영 기능 플래그를 유지합니다.

## 인증 흐름

```text
GitHub Pages
  -> Firebase Auth 로그인
  -> ID token을 Authorization Bearer 헤더로 전달
  -> Cloud Run이 토큰 서명/만료/폐기 여부 검증
  -> Firestore users/{uid}, userAppAccess/{uid} 조회
  -> ACTIVE 상태, 근무자 역할, apps.deskPortal 권한 확인
  -> 업무 API 처리
```

Cloud Run의 Firebase Admin SDK는 런타임 서비스 계정의 Application Default Credentials를 사용합니다. 서비스 계정 JSON 키를 코드나 브라우저에 넣지 않습니다.

## 운영 전환 원칙

- 기능별로 읽기 API를 먼저 병렬 검증한 뒤 쓰기 API를 전환합니다.
- 쓰기 API는 Firestore 트랜잭션과 멱등성 키를 갖춘 뒤에만 운영 경로로 연결합니다.
- 수납 삭제처럼 파괴적인 작업은 대상 문서, 작성자, 사유를 감사 로그로 남깁니다.
- 각 단계는 기존 Apps Script 경로를 유지한 상태에서 검증하고, 확인 후 기능 플래그로 전환합니다.

## Google Workspace 연동

Cloud Run 런타임 서비스 계정에 급여 시트 뷰어 권한과 데스크 캘린더 일정 세부정보 보기 권한을 직접 부여합니다. 런타임은 서비스 계정 키 대신 Application Default Credentials로 자기 위임 토큰을 발급받아 Sheets·Calendar 읽기 전용 scope를 사용합니다.

급여 설정은 `payrollSettings/global`, 월별 수동 보정값은 `payrollOverrides/{month}`에 저장하며 쓰기 요청은 Firestore 트랜잭션과 요청 ID 감사 기록으로 보호합니다.

## 다음 단계

5단계에서는 Chrome `학원` 프로필로 전체 기능의 Cloud Run 실호출을 검증하고, 남은 유지보수 전용 메서드의 경계를 확정한 뒤 기능 플래그를 단계적으로 전환합니다.
