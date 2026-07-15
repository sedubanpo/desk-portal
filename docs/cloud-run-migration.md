# 데스크 포털 Cloud Run 마이그레이션

## 1단계 상태

운영 트래픽을 변경하지 않은 채 아래 기반을 추가합니다.

1. Cloud Run용 Node.js API 서비스
2. Firebase ID 토큰 검증
3. Firestore `users/{uid}` 기반 역할 및 활성 상태 검증
4. GitHub Pages origin 제한 CORS
5. 공개 `/health`, 보호된 `/v1/me`
6. 기존 Apps Script API 43개에 대한 전환 수량 계약

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

## 다음 단계

2단계에서는 수강료 조회 API를 Cloud Run으로 옮겨 기존 Apps Script 결과와 대조합니다. 쓰기와 삭제는 아직 기존 경로를 유지합니다.
