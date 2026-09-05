# Desk Portal

운영 화면은 `docs/index.html`, 업무 API는 `services/desk-api`에서 관리합니다. GitHub Pages는 `main`의 `/docs`를 배포합니다.

- 포털 주소: https://sedubanpo.github.io/desk-portal/
- 인증: Firebase ID 토큰과 Cloud Run의 Firestore 계정·앱 권한 검증
- 데이터 접근: Cloud Run 런타임 서비스 계정의 Application Default Credentials(ADC)
- 급여 추가 인증: 서버에서 관리하는 급여 PIN 및 제한된 유효기간의 토큰

## 개발과 검증

```bash
npm --prefix services/desk-api ci
npm --prefix services/desk-api test
```

운영 데이터나 인증된 운영 화면을 테스트 자료로 저장하지 않습니다. 합성 데이터로 검증하고 `.superloopy/`의 로컬 증거는 배포하거나 커밋하지 않습니다.

## 구형 Apps Script 폐기

`apps-script/payroll`은 기존 웹앱 주소의 이전 안내만 제공합니다. 업무 함수, 고정 비밀번호 검증, 브라우저의 데이터베이스 인증값은 제거했습니다. 기존 API 요청에는 `legacy_retired` 오류를 반환합니다. JSONP 콜백은 실행하지 않습니다.

구형 동기화·이관·비교 도구는 실행을 차단했습니다. 다른 폴더의 예전 파일을 가져오거나 옛 Apps Script 버전을 다시 배포하지 마세요. 현재 화면은 Apps Script를 호출하지 않습니다.

배포는 `apps-script/payroll`에서 `clasp push` 후 새 버전을 만들고, 기존 배포 ID들을 새 버전으로 갱신합니다. 파일에서 인증값을 제거해도 데이터베이스 비밀값 자체가 폐기되지는 않습니다. Firebase 콘솔에서 기존 비밀값을 별도로 취소해야 합니다. 데이터베이스와 Cloud Run 서비스 계정 권한은 현재 업무에 필요하므로 유지합니다.

Git 기록의 기존 값과 외부 복제본은 별도 관리 대상입니다. 기록 재작성은 별도 승인 없이 수행하지 않습니다.

## 배포

API 배포·권한 설명은 `services/desk-api/README.md`를 참고하세요. 프론트엔드와 API 변경이 서로 의존할 경우 함께 반영해야 합니다.

현재 GitHub 요금제에서 비공개 저장소의 Pages가 비활성화된 경우, 소스 반영만으로 포털이 복구되지는 않습니다. Pages 사용 조건과 저장소 공개 상태를 확인해야 합니다.
