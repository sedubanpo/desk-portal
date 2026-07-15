# 데스크 포털 Cloud Run 마이그레이션

## 5단계 완료 상태

2026-07-15 기준 운영 웹의 업무 호출을 Firebase 인증 기반 Cloud Run API로 전환했습니다.

1. Cloud Run용 Node.js API 서비스
2. Firebase ID 토큰 검증
3. Firestore `users/{uid}` 기반 역할 및 활성 상태 검증
4. GitHub Pages origin 제한 CORS
5. 근무표·일일 업무일지·비품·채용 API
6. 수강료 조회·입력·수정·삭제 트랜잭션
7. Google Sheets API 기반 급여 계산과 Firestore 설정·예외값 저장
8. Google Calendar API 기반 데스크 일정 조회
9. 기존 Apps Script 사용자 업무 38개와 Cloud 전용 업무 4개에 대한 전환 수량 계약
10. 포털 설정 및 중지·퇴원생 검색의 Cloud Run 중계
11. 브라우저의 Apps Script JSONP 및 직접 RTDB 연결 제거

배포 대상은 Firebase Auth와 Firestore가 있는 `fir-lms-prod`, 리전은 `asia-northeast3`, 서비스명은 `desk-portal-api`입니다. 운영 기능 플래그는 5단계에서 Cloud Run 경로로 전환했습니다.

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

## 운영 경계

- 운영 브라우저는 Apps Script URL이나 RTDB 인증값을 보유하지 않습니다.
- 근무표·업무일지·비품·채용 데이터의 기존 RTDB 형식은 유지하되 Cloud Run 서비스 계정만 접근합니다.
- 수강료·급여 쓰기는 Firestore 트랜잭션과 멱등성 키로 보호합니다.
- 수납 삭제처럼 파괴적인 작업은 대상 문서, 작성자, 사유를 감사 로그로 남깁니다.
- 과거 데이터 복구용 수강료 백필 5개 메서드는 유지보수 전용이며 운영 웹에서 호출할 수 없습니다.

## Google Workspace 연동

Cloud Run 런타임 서비스 계정에 급여 시트 뷰어 권한과 데스크 캘린더 일정 세부정보 보기 권한을 직접 부여합니다. 런타임은 서비스 계정 키 대신 Application Default Credentials로 자기 위임 토큰을 발급받아 Sheets·Calendar 읽기 전용 scope를 사용합니다.

급여 설정은 `payrollSettings/global`, 월별 수동 보정값은 `payrollOverrides/{month}`에 저장하며 쓰기 요청은 Firestore 트랜잭션과 요청 ID 감사 기록으로 보호합니다.

## 완료 기준

- Firebase 로그인과 `users/{uid}`, `userAppAccess/{uid}` 권한 확인 성공
- 데스크·수강료·급여·Google Workspace 조회가 Cloud Run 응답으로 동작
- 인증 누락, 허용되지 않은 origin, 유지보수 메서드가 차단
- 브라우저 코드에 Apps Script 호출 주소와 RTDB 인증값이 없음
- Chrome `학원` 프로필에서 운영 화면 회귀 검증 완료
