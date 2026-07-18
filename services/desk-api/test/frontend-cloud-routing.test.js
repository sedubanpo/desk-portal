import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const frontendPath = new URL('../../../docs/index.html', import.meta.url);

test('Firebase identity replaces the Apps Script payroll password gate', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /cloudIdentity:\s*null/);
  assert.match(source, /state\.cloudIdentity = body && body\.user \? body\.user : null/);
  assert.match(source, /identity\.permissions\.canManagePayroll === true/);
  assert.match(source, /state\.privilegedAccessKey = "firebase-role"/);
  assert.match(source, /if \(state\.cloudApiReady && state\.firebaseUser\)/);
  assert.match(source, /autocomplete="current-password"/);
  assert.match(source, /var days = Array\.isArray\(week\)/);
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

test('recruiting comments use write idempotency and the applicant table keeps compact filters', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /\^\(save\|delete\|append\|update\|batchUpdate\|adjust\|add\)/);
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
});
