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
