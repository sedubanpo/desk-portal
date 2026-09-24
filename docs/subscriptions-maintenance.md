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

실시간 금액 조사/연동은 아직 구현하지 않았다. 후속 연동은 해당 서비스·월만 갱신하고 다른 월, 사용자 비고, 로고를 보존해야 한다. 새 필드를 추가하려면 서버 검증과 보고 집계 의미도 함께 검토한다. 환율 변환 없이 통화별 합계만 표시하며 결제 예정 금액도 입력 합계에 포함한다.

## 로고와 보고

기본 로고 출처: `assets/subscriptions/SOURCES.md`. 사용자 로고는 PNG/JPEG/WebP, 입력 2MB 이하를 128px PNG로 축소한다. SVG 업로드는 지원하지 않는다. 구독 중지는 기록을 삭제하지 않는다.

보고 월에 활성 구독 및 기록이 있는 중지 구독을 PNG로 만든다. 로고는 동일 출처 자산 또는 래스터 data URL로 사용한다. 사용자 클릭에서 ClipboardItem의 PNG Promise를 바로 전달하며 PNG 다운로드도 제공한다. 보고서는 외부로 자동 전송하지 않는다.

## 검증 (2026-09-24)

- API 전체 테스트 199개 통과. 구독별 동시 저장 충돌, 다른 구독 독립 저장, 월별 보존, 비정상 금액/날짜/로고/루트 저장 거부 포함.
- 로컬 합성 데이터 화면: 기본 6개, 월별 기록 입력/전환, 사용자 구독 추가, 래스터 로고 업로드, 실제 image/png 클립보드 복사 확인.
- 1280px 및 390px DOM 크기 검사: 페이지 가로 넘침 없음, 모바일 표 내부 스크롤, 설정창 화면 내 배치.
- 별도 코드 리뷰의 이름/날짜 겹침과 업로드 경쟁 2건 수정 확인 완료.
- 운영 결제 데이터를 테스트로 쓰지 않았다. 화면 캡처 검증은 하지 않았다.
