import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const frontendPath = new URL('../../../docs/index.html', import.meta.url);

test('Firebase identity and the server-issued six-digit PIN token protect payroll', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /cloudIdentity:\s*null/);
  assert.match(source, /state\.cloudIdentity = body && body\.user \? body\.user : null/);
  assert.match(source, /identity\.permissions\.canManagePayroll === true/);
  assert.match(source, /state\.privilegedAccessKey = "firebase-role"/);
  assert.match(source, /if \(state\.cloudApiReady && state\.firebaseUser\)/);
  assert.match(source, /id="privPinInputs"/);
  assert.match(source, /inputmode="numeric"/);
  assert.match(source, /\/v1\/payroll\/unlock/);
  assert.match(source, /x-payroll-unlock-token/);
  assert.match(source, /강사별 급여 방식 합산/);
  assert.match(source, /급여 내역서를 출력할 강사를 먼저 선택/);
  assert.doesNotMatch(source, /030606/);
  assert.match(source, /var days = Array\.isArray\(week\)/);
});

test('teacher payroll exposes an unfiltered monthly sales and teacher-pay analysis', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /id="openPayrollMonthlyAnalysisBtn"/);
  assert.match(source, /id="payrollMonthlyAnalysisModal"/);
  assert.match(source, /getPayrollMonthlyAnalysis: true/);
  assert.match(source, /runServer\("getPayrollMonthlyAnalysis", \{/);
  assert.match(source, /ratioPercent: state\.ratioPercent/);
  assert.match(source, /teacherSettings: state\.teacherSettings \|\| \{\}/);
  assert.match(source, /analysis\.inputSignature === inputSignature/);
  assert.match(source, /state\.payroll\.monthlyAnalysis\.loaded = false/);
  assert.match(source, /state\.payroll\.monthlyAnalysis\.inputSignature = ""/);
  assert.match(source, /전체 강사 · 필터 미적용 · 현재 저장 규칙/);
  assert.match(source, /인정 순매출\(정산 기준\)/);
  assert.match(source, /규칙 적용 예상 강사비/);
  assert.match(source, /강사비 차감 잔여액/);
  assert.match(source, /임대료, 관리비, 세금 등 다른 운영비가 반영되지 않습니다/);
  assert.match(source, /balance-negative/);
  assert.match(source, /일부 " \+ analysis\.failedMonths\.length \+ "개월 제외/);
  assert.match(source, /\.desk-global-tools \{\s*display: none;/);
});

test('production frontend has no Apps Script or direct RTDB transport fallback', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.doesNotMatch(source, /script\.google\.com\/macros/);
  assert.doesNotMatch(source, /sedu-portal-default-rtdb\.firebaseio\.com/);
  assert.doesNotMatch(source, /DESK_RTDB_AUTH/);
  assert.doesNotMatch(source, /desk cloud read fallback/);
  assert.match(source, /DESK_SCHEDULE_DIRECT_RTDB_ENABLED = false/);
  assert.match(source, /DESK_DAILY_DIRECT_TASK_WRITE_ENABLED = false/);
  assert.match(source, /DESK_DAILY_DIRECT_MEMO_WRITE_ENABLED = false/);
  assert.match(source, /Cloud Run으로 이전되지 않은 기능입니다/);
  assert.match(source, /Firebase에 등록된 근무자 로그인 ID와 비밀번호/);
  assert.doesNotMatch(source, /canFallbackFromDeskFirebaseLogin_/);
  assert.doesNotMatch(source, /verifyDeskLegacyPassword_/);
});

test('supply management keeps every academy branch visible without inventory rows', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /var branches = \["전체", "본관", "2관", "3관"\]/);
  assert.match(source, /var seen = \{ "전체": true, "본관": true, "2관": true, "3관": true \}/);
  assert.match(source, /\(state\.desk\.supplies\.consumables \|\| \[\]\)\.forEach/);
});

test('unfinished assignments remain visible when the assignee is not scheduled today', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /if \(!\(workerNames \|\| \[\]\)\.length\) return true;/);
  assert.match(source, /var workerKey = "all";/);
  assert.match(source, /fetchDeskDailyPendingTasksRealtime_\(safeDateKey, \[\]\)/);
  assert.match(source, /Promise\.all\(\[quickScan, serverScan\]\)/);
  assert.match(source, /carryoverRequestId/);
  assert.match(source, /function moveDeskDailyDate_\(delta\) \{\s*resetDeskDailyCarryoverLoad_\(\);/);
  assert.match(source, /deskJournalTodayBtnEl\.addEventListener\("click", function\(\) \{\s*resetDeskDailyCarryoverLoad_\(\);/);
  assert.doesNotMatch(source, /quickScan\.then\(function\(items\)/);
  assert.match(source, /state\.desk\.daily\.carryoverDateKey === dateKey/);
  assert.match(source, /!item\.completed && !isDeskSharedTask_\(item\) && item\.dateKey < dateKey/);
  assert.match(source, /deskJournalPendingSummaryEl\.textContent = isDeskDailyCarryoverLoading_/);
  assert.match(source, /deskJournalSharedSummaryCountEl\.textContent = carryoverLoading && !sharedTasks\.length \? "확인 중"/);
});

test('assignment ledger exposes ownership, progress, follow-up, and deletion history', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.doesNotMatch(source, /data-desk-editor-tab="ledger"/);
  assert.match(source, /if \(selectedWorker === "전체"\) \{\s*renderDeskTaskLedger_\(\)/);
  assert.match(source, /\.desk-journal-layout\.ledger-mode \.desk-journal-side \{\s*display: none !important/);
  assert.match(source, /getDeskDailyJournalTaskLedger: true/);
  assert.match(source, /업무 \/ 메모<\/th><th>입력자<\/th><th>담당자<\/th><th>배정 일시<\/th><th>진행 상태<\/th><th>미해결 사유 \/ 후속 단계/);
  assert.match(source, /data-desk-ledger-next=/);
  assert.match(source, /aria-label="업무 배정 원장 검색"/);
  assert.match(source, /aria-label="업무 배정 원장 진행 상태 필터"/);
  assert.match(source, /해결하지 못한 업무는 다음 후속 단계를 입력해 주세요/);
  assert.match(source, /서버 저장 확인 필요/);
});

test('daily journal manager keeps unresolved work visible while managing shared and routine work', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /id="deskJournalManagerBoard"/);
  assert.match(source, /data-desk-task-filter="후속 필요"/);
  assert.match(source, /data-desk-manager-worker-filter=/);
  assert.match(source, /후속 단계 미입력/);
  assert.match(source, /data-desk-shared-manager-search=/);
  assert.match(source, /renderDeskJournalManagerBoard_\(visibleTasks\)/);
  assert.match(source, /renderDeskSharedTaskManagerBoard_\(tasks, deskJournalManagerBoardEl\)/);
  assert.match(source, /deskJournalManagerBoardEl\.addEventListener\("click"/);
  assert.match(source, /deskJournalManagerBoardEl\.addEventListener\("input"/);
  assert.match(source, /completedItems = completedItems\.filter\(function\(item\)/);
  assert.match(source, /document\.querySelectorAll\("\[data-desk-task-filter\]"\)[\s\S]*?btn\.addEventListener\("click"/);
  assert.doesNotMatch(source, /desk-important-badge">이월 ' \+ escapeHtml\(item\.dateKey\)/);
});

test('shared work stays compact and preserves the explicitly opened item across renders', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /openSharedTaskId/);
  assert.match(source, /data-desk-shared-summary-id=/);
  assert.match(source, /state\.desk\.daily\.openSharedTaskId === sharedId \? "" : sharedId/);
  assert.match(source, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
  assert.match(source, /min-height: 48px/);
});

test('selected-day schedule report uses responsive worker cards and distinguishes an empty connected calendar', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /class="desk-day-report-summary"/);
  assert.match(source, /grid-template-columns: repeat\(auto-fit, minmax\(360px, 1fr\)\)/);
  assert.match(source, /container-type: inline-size/);
  assert.match(source, /@container \(min-width: 1400px\)/);
  assert.match(source, /class="desk-day-report-worker-head"/);
  assert.match(source, /renderDeskDayReportSummary_\(dayItems, workerCount, countedHours\)/);
  assert.match(source, /sourceName === "calendarApi"/);
  assert.match(source, /연동 정상 · 일정 없음/);
  assert.match(source, /checkedAt: new Date\(\)\.toISOString\(\)/);
});

test('monthly schedule exposes dated version history and account attribution per day', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /getDeskScheduleDayHistory: true/);
  assert.match(source, /class="desk-day-version-btn"/);
  assert.match(source, /data-desk-schedule-history=/);
  assert.match(source, /최종 /);
  assert.match(source, /버전 기록 시작 전/);
  assert.match(source, /id="deskScheduleHistoryModal"/);
  assert.match(source, /selected\.actorName \|\| "계정 정보 없음"/);
  assert.match(source, /이 버전의 근무표/);
});

test('recruiting comments use write idempotency and the applicant table keeps compact filters', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /\^\(create\|save\|delete\|append\|update\|batchUpdate\|adjust\|add\)/);
  assert.match(source, /addDeskRecruitingApplicantComment: true/);
  assert.match(source, /storageId: applicant && applicant\.storageId \|\| id/);
  assert.match(source, /data-desk-hr-storage-id/);
  assert.match(source, /id="deskHrSubjectTabs" role="tablist"/);
  assert.match(source, /data-desk-hr-special-details/);
  assert.doesNotMatch(source, /<th class="col-role">직무\/과목<\/th>/);
});

test('tuition settlement exposes compact editing, payment methods, contact channels, and message settings', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /id="tuitionPaymentPaidAt" class="modal-input" type="date"/);
  assert.match(source, /tuitionPaymentPaidAtEl\.value = getTodayDateKey_\(\)/);
  ['결제링크', '현장카드', '계좌이체', '현금', '서울페이', '기타'].forEach(method => {
    assert.match(source, new RegExp(`data-tuition-choice="${method}"`));
  });
  ['카톡', '전화', '문자', '구두\\(대화\\)'].forEach(channel => {
    assert.match(source, new RegExp(`data-tuition-choice="${channel}"`));
  });
  assert.match(source, /buildTuitionPreviousMethod_\(row\.previousPaymentMethod\)/);
  assert.match(source, /return \(d\.getMonth\(\) \+ 1\) \+ "\/" \+ d\.getDate\(\)/);
  assert.match(source, /id="tuitionTemplateSettingsModal"/);
  assert.match(source, /ensureTuitionStudentPrefix_/);
  assert.match(source, /class="tuition-amount-copy"/);
  assert.match(source, /grid-template-columns: minmax\(0, 1fr\) 12px/);
  assert.match(source, /\.tuition-amount-cell\.is-editable i,[\s\S]*?\.tuition-amount-cell\.is-editable svg \{[\s\S]*?width: 11px;[\s\S]*?height: 11px;/);
  assert.match(source, /\.tuition-student-name\.tuition-name-link \{[\s\S]*?font-weight: 950;/);
  assert.match(source, /class="tuition-col-contact-head">마지막 연락<\/th>/);
  assert.match(source, /\.tuition-col-contact \{[\s\S]*?width: 136px;[\s\S]*?min-width: 136px;[\s\S]*?max-width: 136px;/);
  assert.match(source, /\.tuition-amount-cell \.v \{[\s\S]*?white-space: nowrap;/);
  assert.match(source, /function isTuitionAdjustmentPayment_\(row\)/);
  assert.match(source, /function isTuitionDatedPayment_\(row\)/);
  assert.match(source, /function buildTuitionEffectivePaymentRows_\(rows\)/);
  assert.match(source, /var all = buildTuitionEffectivePaymentRows_\(state\.tuition\.payments \|\| \[\]\)/);
  assert.match(source, /var list = buildTuitionEffectivePaymentRows_\(sourceRows\)\.filter/);
  assert.match(source, /count: list\.filter\(function\(row\) \{ return !isTuitionAdjustmentPayment_\(row\); \}\)\.length/);
  assert.match(source, /id="tuitionMonthCreateBtn"/);
  assert.match(source, /class="tuition-month-search"/);
  assert.match(source, /id="tuitionKeywordInput" type="search"/);
  assert.match(source, /id="tuitionKeywordClearBtn"/);
  assert.match(source, /\.tuition-month-search \{[\s\S]*?border: 2px solid #238b68;/);
  assert.match(source, /\.tuition-month-create-btn \{[\s\S]*?width: 42px;[\s\S]*?height: 42px;/);
  assert.match(source, /tuitionKeywordClearBtnEl\.hidden = !state\.tuition\.keyword/);
  assert.doesNotMatch(source, /<span>다음 달 시작<\/span>/);
  assert.match(source, /id="tuitionMonthGrid" role="tablist"/);
  assert.match(source, /id="tuitionYearLabel"/);
  assert.doesNotMatch(source, /id="tuitionMonthSelect"/);
  assert.match(source, /Array\.from\(\{ length: 12 \}/);
  assert.match(source, /item && item\.generated && item\.hasData/);
  assert.match(source, /className = "tuition-month-btn"/);
  assert.match(source, /state\.tuition\.briefingPayments/);
  assert.match(source, /state\.tuition\.briefingRows/);
  assert.match(source, /state\.tuition\.briefingMonths/);
  assert.match(source, /usesBriefingBundle \? state\.tuition\.briefingPayments/);
  assert.match(source, /포함 월 ·/);
  assert.match(source, /createTuitionMonth: true/);
  assert.match(source, /function formatTuitionMonthLabel_/);
  assert.match(source, /return year \+ "-" \+ parseInt\(match\[2\], 10\) \+ "월"/);
});
