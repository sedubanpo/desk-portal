# 문의 동기화 시간초과 수정 — 2026-10-28

## 범위와 기준

- 소스: `desk-portal-cost-optimization`, origin/main `8f97b56`, 코드 변경 `60670b8`.
- 배포 전 운영 revision: `desk-portal-api-cost-20261028` (100%). 운영 소스 ZIP 70개 파일을 로컬 서비스 파일과 비교, 불일치 0.
- 대상은 desk-portal-api 문의 동기화뿐. 다른 앱/공용 Firebase 함수와 운영 원장 수정 없음. 시험 sync-job 호출이나 Notion 전체 스캔 수행하지 않음.

## 원인과 관측 범위

- 기존 요청 로그(최근 35개)에서 예약 동기화 정상 요청도 대체로 24~29초, 15:45 KST 요청 30.000884730초 504 확인. 이전 revision에서도 동일 경로 30초 504 존재.
- 실제 서비스 제한 30초. Scheduler는 5분 주기/attemptDeadline 300초. sync-job는 force=true로 매번 전체 조회 후 문의/요약별 Firestore 트랜잭션을 순차 실행.
- 읽기 전용 단일 meta 조회: 최근 syncedAt/fullSyncedAt 갱신, syncLeaseUntil=0, syncError 빈 값. 영구 lease 정체는 관측되지 않음. 과거 504 개별 실행의 최종 완료 여부는 기존 단계별 로그 부재로 확정 불가.

## 변경

- src/inquiries/sync-work.js: 최대 8개 저장 작업, 오류 발생 시 신규 작업 중단 및 이미 시작한 작업 drain.
- service.js: 문의 mirror/연락 summary 저장 병렬화. Notion은 기존 직렬 rate limit 유지. 전체/증분/60초 overlap/10분 full cadence와 강제 full 의미 유지. 연락 기록은 기존처럼 전체 집계하여 삭제·이동·취소 반영 유지.
- 각 동기화 트랜잭션에서 meta 소유권/lease 확인; watermark 비교 보존. unavailable 판정도 트랜잭션·관측 시각 비교로 변경하여 새 동시 저장 보호. 종료 metadata도 소유권 확인.
- 90초 협력적 작업 예산: Notion 요청 signal 취소, 큐 대기 및 429 backoff 중단, 페이지/행 작업 시작 전 검사. 실패 시 watermark 전진 없음. 진행 중 Firestore RPC는 취소하거나 성공으로 간주하지 않고 기다린 뒤 lease 정리. 따라서 90초는 모든 RPC를 강제 종료하는 wall-clock 보장이 아님.
- 완료/실패의 단계, 건수, 시간, 오류 코드만 구조화 로그. 개인정보/원문/키 없음.
- sync-job 응답에 completed/skipped 구분 추가. 오류는 기존 errorHandler로 비정상 HTTP 반환. held lease 건너뛰기를 완료로 표시하지 않음.

## 설정/비용/공용 영향

- Cloud Run timeout 30→180초 적용: 90초 작업 예산 이후 drain/정리 여유. Scheduler attemptDeadline 300초 및 5분 cadence/기존 retry 설정 변경 없음. lease는 기존 300초, 소유권 확인으로 만료된 실행의 덮어쓰기 차단.
- timeout은 서비스 전체 요청에 적용. office stream 소스 변경 없음, 자체 22초 종료/8초 heartbeat 및 요청별 인증 유지. 다른 요청도 실패 시 이전보다 오래 대기할 수 있음.
- API calls/Firestore row writes 수를 줄이는 변경이 아님. guard로 동기화 row transaction당 meta read 1개 추가(재시도 시 추가 가능). 동시 저장 상한 8로 부하 제한. 비용 절감액 주장 없음. 시간초과 후 실행/재시도 불확실성과 순차 RPC 대기 감소 목적.
- 심각한 Firestore 장애에서 drain이 서비스 제한을 넘을 가능성은 남음. 그 경우 Cloud Run timeout 및 300초 lease 만료 뒤 다음 기존 예약 실행이 복구; 새로운 반복 작업은 생성하지 않음.

## 검증

- 서버 전체 442개 통과: notes/inquiry-sync-20261028/tests.txt.
- 신규/강화 fixture: 병렬 최대8, 실패 drain, 부분 mirror 저장 후 다음 실행 복구, lease 중복·만료·교체, 최신 page/summary 관측 보호, 이동과 복귀, 증분 overlap/full 유지, 예산 초과 실패, 인증과 응답 상태, Notion 큐/429 취소, office stream 22초 종료.
- 기존 contact idempotency, 삭제/복원, pagination, 권한 테스트 통과.
- 합성 160건×5ms 작업: 직렬 918ms, 병렬8 113ms. 실제 운영 성능이나 청구액 측정이 아님.

## 배포/운영 관측

- 새 revision `desk-portal-api-inquiry-sync-20261028`, 100% 트래픽. 2026-10-28 16:24:51 KST health에서 새 revision/ok:true 확인.
- Cloud Build `168a3ab1-ebcc-4c74-87c0-424912e26027` SUCCESS. 업로드 소스 ZIP 71개 파일과 로컬 비교 불일치 0. 이전/새 revision spec은 image와 timeoutSeconds 제외 동일(환경변수·시크릿 참조·리소스 등 유지).
- 코드 `60670b8`를 origin/main에 fast-forward push 완료. 새 프런트 코드 변경 없음.
- 기존 Scheduler 16:25:03 KST 실행: HTTP 200 / 14.746875367s. 완료 이벤트 durationMs=14670, full=true, pageCount=662, summaryCount=3. 운영 재현 호출 없이 기존 예약을 관측.
- 이후 단일 meta 문서 읽기: projectionVersion=2, syncedAt/fullSyncedAt=2026-10-28T07:25:03.553Z, syncLeaseUntil=0, syncError 빈 문자열.
- 이 규모에서 guard 추가 읽기는 정상 무재시도 기준 665회/실행 + 종료 meta 확인. 매 5분 같은 규모라면 행 guard만 하루 약191,520 read 추가. 이 변경을 총 읽기 비용 절감으로 표현하지 않는다.
- 운영 관측은 배포 직후 기존 예약 1회. 장기 장애 부재나 모든 외부 서비스 지연 상황을 보증하지 않는다. 브라우저 연결 차단으로 UI 추가 검증은 수행하지 않았으며 API fixture/기존 운영 로그로 검증했다.
- 원본 Notion/금융 원장에 임의 쓰기 없음. 정상 예약 실행이 기존 방식으로 mirror/summary/meta를 갱신했다. 새 예약·모니터링·다른 서비스 배포 없음.

## 롤백

`gcloud run services update-traffic desk-portal-api --project fir-lms-prod --region asia-northeast3 --to-revisions desk-portal-api-cost-20261028=100`

기존 revision의 30초 설정과 이미지로 복귀한다. 데이터 마이그레이션이 없어 데이터 롤백 불필요. 이후 배포 시 서비스 template timeout은 별도 확인 필요.
