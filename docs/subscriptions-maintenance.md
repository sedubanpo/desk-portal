# 유료 구독 현황

물품 관리 → 유료 구독 현황 소메뉴의 월별 구독 원장. 기본 소메뉴는 소모품 현황이다. 기본 6개 서비스는 화면 기본값이며 금액/결제일은 임의로 생성하지 않는다.

## 저장 및 연동

기존 인증 API `getDeskPortalConfig` / `saveDeskPortalConfig` 사용.
- scope: `daily`
- 조회 key: `subscriptions`
- 개별 저장 key: `subscriptions/<serviceId>`
- 저장에는 조회한 `expectedValue`가 필요하며 동일 구독에 대한 동시 수정은 충돌로 거절된다.
- 원장 전체 덮어쓰기는 허용하지 않는다. 기존 재고 저장 경로와 분리되어 있다.

서비스 레코드:
```
{id, name, plan, active, logo, asset, description,
 payments: {"YYYY-MM": {date: "YYYY-MM-DD" 또는 "", amount: number 또는 null,
 currency: "KRW" | "USD", status: "unknown" | "scheduled" | "paid", note,
 updatedAt, updatedBy}}}
```
`updatedAt` / `updatedBy`는 변경된 월에 대해 서버 시각과 로그인 사용자로 기록한다. Firebase가 null/빈 객체를 제거할 수 있으므로 누락된 amount도 미입력이다. 0은 확정된 0원이다. 결제일은 선택한 월 안의 날짜다. 한 구독에 월 1개 합산 결제 기록을 관리하며 복수 청구건은 해당 월 합계와 비고에 기입한다.

공식 청구 연동 조사 결과(2026-09-24), Firebase만 Google Cloud Billing BigQuery 내보내기의 프로젝트별 비용을 연결할 수 있다. 이는 확정 결제액이 아닌 예상 비용이며 `SUBSCRIPTIONS_GCP_BILLING_TABLE`(project.dataset.table)과 `SUBSCRIPTIONS_FIREBASE_PROJECT_IDS`(쉼표 구분)를 Cloud Run 환경에 설정해야 활성화된다. 공개 가격표는 실제 결제액으로 사용하지 않는다.

Google Workspace 일반 고객 청구서, ChatGPT 구독, Supabase 월 인보이스 합계, Notion 청구, 배민클럽은 공식 조회 API가 없어 수동 입력을 유지한다. Google Workspace Reseller API는 리셀러의 구독 관리용이며 실제 청구 합계 API가 아니다. OpenAI Usage/Costs API는 OpenAI API 조직 비용이며 ChatGPT 구독료와 섞지 않는다.

연동 결과는 `linkedPayments`에 분리 저장하고 기존 `payments`(수동 입력)가 항상 우선한다. 동기화 실패·권한 없음·데이터 없음은 0원으로 쓰지 않으며 기존 성공 값과 사용자 비고를 보존한다. `sync`에는 출처, 대상 월, 예상/확정 구분, 마지막 시도/성공, 오류를 별도로 기록한다. 환율 변환 없이 통화별 합계만 표시한다.

Firebase가 아닌 Google Cloud 서비스가 추가될 경우 동일 결제 내보내기 행을 중복 합산하지 않도록 프로젝트 범위를 분리해야 한다. 현재 `google` 항목은 Google Workspace 전용이므로 Firebase와 중복되지 않는다.

## 로고와 보고

기본 로고 출처: `assets/subscriptions/SOURCES.md`. 사용자 로고는 PNG/JPEG/WebP, 입력 2MB 이하를 128px PNG로 축소한다. SVG 업로드는 지원하지 않는다. 구독 중지는 기록을 삭제하지 않는다.

보고 월에 활성 구독 및 기록이 있는 중지 구독을 PNG로 만든다. 로고는 동일 출처 자산 또는 래스터 data URL로 사용한다. 사용자 클릭에서 ClipboardItem의 PNG Promise를 바로 전달하며 PNG 다운로드도 제공한다. 보고서는 외부로 자동 전송하지 않는다.

## 검증 (2026-09-24)

- API 전체 테스트 199개 통과. 구독별 동시 저장 충돌, 다른 구독 독립 저장, 월별 보존, 비정상 금액/날짜/로고/루트 저장 거부 포함.
- 로컬 합성 데이터 화면: 기본 6개, 월별 기록 입력/전환, 사용자 구독 추가, 래스터 로고 업로드, 실제 image/png 클립보드 복사 확인.
- 1280px 및 390px DOM 크기 검사: 페이지 가로 넘침 없음, 모바일 표 내부 스크롤, 설정창 화면 내 배치.
- 별도 코드 리뷰의 이름/날짜 겹침과 업로드 경쟁 2건 수정 확인 완료.
- 운영 결제 데이터를 테스트로 쓰지 않았다. 화면 캡처 검증은 하지 않았다.
