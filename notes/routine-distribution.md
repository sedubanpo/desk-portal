# 루틴 업무 분배 — 구현·운영 기록

2026-10-23 구현 기준. 기존 `DESIGN.md`를 유지하고 이번 확장만 기록한다. 배포 식별자와 운영 확인 결과는 배포 담당자가 아래에 추가한다.

## 사용 흐름과 권한

일일업무일지에서 **루틴 업무 분배**를 열면 서울 날짜 기준 **오늘의 배정**이 표시된다. 날짜 선택, 전체·내 업무·미배정·완료 필터와 등급·유형·담당자 필터를 함께 사용할 수 있다. 미배정 필터는 책임 또는 보조 중 하나라도 비어 있는 업무를 포함한다.

**루틴 보관함**은 S(최우선 필수), A(당일 필수), B(일반 정기), C(여유 시 수행) 원본을 관리한다. 등록 시 업무명, 수행 방법·완료 기준, 유형, 등급, 반복 요일, 기본 책임·보조를 저장한다. 제목으로 유형을 제안하며 사용자가 직접 수정한 유형은 유지한다. 사용 중 해제는 원본 일시 중지이며 이미 생성된 날짜별 업무를 삭제하지 않는다.

| 작업 | 허용 대상 |
| --- | --- |
| 원본 등록, 날짜별 책임·보조 배정 및 등급 변경 | 인증된 데스크 근무자 |
| 기존 원본 수정·중지·등급 이동 | 원본 작성자 또는 업무 관리자 |
| 날짜별 상태 변경 | 현재 책임·보조 담당자 또는 업무 관리자 |

업무 관리자는 `ADMIN` 또는 `permissions.canManageDailyTasks === true`다. 책임과 보조는 각각 최대 한 명이며 같은 사람을 양쪽에 지정할 수 없다. `내가 맡기`, 근무자 선택, 역할 맞바꾸기를 제공한다. 후보에는 본인·근무 여부·책임/보조 배정 수가 표시된다. 비근무자는 자동 배정에서 제외하지만 활성 근무자라면 수동 배정할 수 있다.

상태는 대기, 진행 중, 완료, 오늘 제외다. 오늘 제외는 사유가 필수다. 완료 시 처리자·시각·처리 당시 역할을 저장한다.

## 날짜별 스냅샷과 동시 수정

오늘의 배정 탭을 열거나 날짜를 변경·새로고침할 때 해당 날짜를 준비한다. 예약 작업이나 자정 cron은 없다. 활성 원본 중 요일에 해당하는 업무만 만들고, 같은 원본 ID가 이미 존재하면 덮어쓰지 않는다. 따라서 원본 제목·내용·반복 요일·기본 담당자 변경은 이미 생성된 업무에 소급되지 않는다. 이후 새 원본이 추가되면 다시 열 때 해당 날짜에 새 업무가 추가될 수 있다.

기본 담당자는 활성 직원이며 해당 날짜 월간 근무표에 `unavailable`이 아닌 항목이 있을 때만 배정된다. 판정은 근무표의 직원 이름과 디렉터리 이름을 대조한다. 비근무·근무표 누락 시 역할을 비워 두고 원래 기본 담당 UID는 보존한다. 나중에 근무표를 변경해도 기존 배정은 자동 재계산하지 않는다.

날짜별 변경은 행위자·시각·이전/이후 책임·보조·상태·등급 및 사유를 남긴다. 생성 이력을 포함해 업무당 300건을 넘는 변경은 거절하며 이력을 잘라내지 않는다. 원본은 작성자와 최근 수정자·시각·버전을 저장한다.

배정·역할 맞바꾸기·등급 변경 직후 **방금 변경 실행 취소**를 제공한다. 취소도 새 변경으로 저장하며 원본 또는 날짜 문서의 버전이 맞아야 한다. 다른 사용자의 변경이 있으면 409 충돌로 거절하고 다시 불러온다. 날짜 문서 전체의 버전을 검사하므로 다른 업무의 변경도 충돌을 일으킬 수 있다. 다른 저장, 탭·날짜 변경, 새로고침 이후에는 직전 취소가 유지되지 않는다. 상태 변경이나 원본 일반 편집의 취소 기능은 없다.

## 화면 구현 기록

기존 포털의 라임·올리브 방향과 상속 글꼴을 따른다. 크림색 작업면(`#fffef8`), 짙은 녹색 본문(`#344937`), 라임 선택면(`#e2ecba`)과 경계선으로 구분한다. 제목 24px(좁은 화면 21px), 원본 제목 16px, 보조 정보 12px이다. 좌측 장식 강조선은 추가하지 않는다.

보관함은 4열에서 1000px 이하 2열, 580px 이하 1열로 전환된다. 오늘 업무는 내용·책임·보조·상태 열로 구성하고 좁은 화면에서 두 열로 재배치한다. 등급 이름을 항상 표시하므로 열의 색만으로 구분하지 않는다. 원본 등급은 손잡이를 끌어 이동하거나 같은 버튼을 눌러 선택한다. 날짜별 등급은 버튼으로 변경한다. 포커스 윤곽선, 저장 중 중복 조작 방지, 상태 메시지를 제공한다.

등급 손잡이의 문자형 기호는 현재 구현의 잔여 표현이며 재사용할 아이콘 규칙으로 채택하지 않는다. 이 확장의 직접 지정 색상·반경을 포털 전체 토큰으로 승격하지 않는다.

## API와 저장 경로

프런트는 `docs/routine-distribution.js`, 스타일은 `docs/routine-distribution.css`이며 `docs/index.html`의 기존 패널·인증 흐름에 연결된다. API 구현은 `services/desk-api/src/desk/routines.js`, 메서드 등록과 허브 알림 통합은 `services/desk-api/src/desk/handlers.js`다.

| 메서드 | 역할 |
| --- | --- |
| `getDeskRoutineBoard` | 원본·선택 날짜 업무·직원·근무표 읽기 |
| `saveDeskRoutineTemplate` | 원본 생성/수정, 원본 버전 검사 |
| `prepareDeskRoutineDay` | 날짜별 누락 업무 생성, 중복 생성 방지 |
| `updateDeskRoutineDay` | 배정·등급·상태 변경, 날짜 버전 검사 |

원본: `desk_portal/routine_distribution/templates/{id}`. 날짜별 업무: `desk_portal/routine_distribution/days/{YYYY-MM-DD}`의 `items`. 근무표: `desk_portal/monthly_schedule/{YYYY-MM}`. 원본/날짜 쓰기는 저장소 트랜잭션을 사용한다.

허브 알림은 서울 기준 오늘의 날짜 문서만 추가 조회한다. 현재 담당 업무에서 타인이 본인에게 배정한 이력을 찾아 기존 허브 알림 파이프라인으로 전달한다. 루틴 전체 날짜 스캔이나 별도 주기적 폴링은 추가하지 않는다. 다른 클라이언트의 변경을 확인하려면 화면의 새로고침을 사용한다.

## 검증과 운영 범위

- 배포 담당자가 전달한 검증 결과: Node 테스트 415건 통과. 재실행 위치는 `services/desk-api`, 명령은 `npm test`다. 루틴 전용 검증은 `test/routines.test.js`에 있다.
- 실제 `docs/index.html`에 로컬 합성 API를 연결한 통합 브라우저 검증 통과. 증거: `/tmp/desk-routine-proof/integrated-desktop.png`, `/tmp/desk-routine-proof/integrated-library.png`, `/tmp/desk-routine-proof/integrated-mobile.png`.
- 이 검증은 운영 데이터 쓰기를 포함한 실서비스 E2E 검증이 아니다. 기존 일지 루틴은 별도로 유지하며 자동 이전하지 않는다.
- 충돌 메시지가 나오면 최신 내용을 다시 확인하고 변경을 재선택한다. 저장 성공 후 화면 갱신 실패 메시지가 나오면 새로고침으로 저장 결과부터 확인한다.
- 기본 담당이 비어 있으면 해당 월 근무표·이름 일치·직원 활성 상태를 확인한 뒤 그 날짜 업무에서 수동 배정한다. 원본을 수정해도 과거 스냅샷은 갱신되지 않는다.

## 배포 기록

배포 대기. 정확한 커밋·프런트/API 배포 식별자와 배포 후 읽기 확인 결과를 이곳에 추가한다.

## 회귀 검사와 배포 기준
- 기존 업무 팔로우, 학생 리워드, 전월 수강료 브라우저 검사는 통과했다.
- 기존 사무실 브라우저 검사는 드래그 연속 동작 중 DOM 교체/대기 시간 초과로 끝까지 통과하지 못했다. 기존 사무실 구현 및 스타일은 변경하지 않았다. 새 루틴의 등급 드래그 검사는 통과했다. 기존 사무실 전체 회귀 통과로 해석하지 않는다.
- 배포 전 GitHub Pages HTML은 기준 커밋 `82d7c3fdef4a72a77966312b35ff1ad9e5b63c2a`와 바이트 단위 일치했다. 기존 Cloud Run 소스 아카이브의 서버 파일 50개도 해당 기준 커밋과 일치했다.
- 운영 데이터의 생성·변경은 배포 검증에 사용하지 않는다. 배포 후 공개 정적 파일 일치, 서버 health revision, 인증 없는 요청의 401 응답을 확인한다.

## 2026-10-23 보관함 삭제

- 원본 작성자 또는 업무 관리자에게 삭제 버튼을 제공한다. 확인창에서 취소가 기본 포커스이며 삭제 범위와 기존 이력 보존을 안내한다.
- `deleteDeskRoutineTemplate`는 원본 버전을 검사한 뒤 원본을 최소 삭제 표식(id, creator, version, active:false, deletedAt, deletedBy)으로 바꾼다. 이전 화면에서 수정/실행 취소로 되살리는 것을 방지한다. 원본 목록과 이후 날짜 생성에서 삭제 표식을 제외한다. 날짜별 items, 완료 정보, 변경 이력은 수정하지 않는다.
- Node 테스트 417건 및 실제 HTML 브라우저 검증 통과: 확인창 취소/Escape, 삭제 확인, 원본 제거, 기존 날짜 업무 유지, 드래그, 모바일. 서버 테스트는 작성자/관리자 권한, 오래된 버전 충돌, 완료 스냅샷 동일성, 이후 날짜 미생성, 삭제 원본 재저장 거절을 포함한다.
- `npm test`가 독립 브라우저 스크립트까지 자동 실행해 런타임 경로/작업 디렉터리 오류를 내던 점을 고쳐 단위·HTTP 테스트 폴더만 실행한다. 브라우저 검사는 저장소 루트에서 PLAYWRIGHT_MODULE을 지정해 별도로 실행한다.

## Library bulk cleanup (2026-10-24)
- Select individual editable templates or all editable results in the current search/state filter. Changing search, state or tab clears selection.
- Confirm selected titles before deleting or enabling. Activation previews stored repeat weekdays; no weekday/default-role changes are implied.
- Sequential existing version-checked APIs preserve creator/manager permissions and dated snapshots. Refresh once after the batch instead of once per item. Successful items leave selection; failed items remain for review/retry. An auth disposal stops further requests.
- Local browser regression covers filtered selection, permissions, activation/cancel, bulk deletion/cancel, partial failure/retry, snapshot preservation and mobile overflow. Production business records are not mutated for QA.

## Daily bulk assignment (2026-10-24)
Select visible daily tasks and assign responsible/helper together. Each role supports keeping its current value, clearing it, choosing any active worker, and a self shortcut. Preflight validates distinct roles against each task's retained role. Updates are sequential using each response's day version; the batch stops on conflict/error, retains remaining selection and refreshes once. Date/filter/search changes clear selection. Only dated assignments change; templates and status/history are preserved by the existing API.
Mock browser checks cover self/other assignment, one-role preservation, duplicate-role rejection, filtered selection, partial failure stop and cancel. No real worker assignments were altered for QA.

## Today allocation board (2026-10-24)

**오늘 업무 배치** is a separate submenu beside **오늘의 배정**, using the selected date's existing snapshot. The left pool contains tasks missing either responsible or helper; a partially assigned task remains there until both roles are filled. Staff sections show separate 책임/보조 drop zones, sorted with scheduled staff first. Search narrows task cards; 오늘 제외 tasks are omitted, with their count retained in the heading.

Drag a task into a staff role zone, or select its title button and activate the destination role button with pointer or keyboard. Cards keep grade, title and status together, with a compact 입력·책임·보조 identity line. Assignment changes only the destination role for the selected date, preserves the other role, rejects assigning one person to both roles, and reuses the existing date-version guard and immediate undo. Templates are unchanged.

The pool stays left and scrolls independently on desktop; at 650px and below it stacks above the staff sections. Each staff section keeps its two labelled role zones. Existing lime/olive surfaces, borders and focus states carry the interaction; no raster assets ship with this board. This section records behavior and layout, not an additional verification claim.
