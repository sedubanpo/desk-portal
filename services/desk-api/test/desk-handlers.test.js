import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDeskHandlers } from '../src/desk/handlers.js';

function clone(value) { return value == null ? value : structuredClone(value); }

function memoryStore(seed = {}) {
  let root = clone(seed);
  const parts = path => String(path || '').split('/').filter(Boolean);
  const read = path => parts(path).reduce((value, key) => value && value[key], root);
  const write = (path, value) => {
    const keys = parts(path);
    if (!keys.length) { root = clone(value); return; }
    let target = root;
    keys.slice(0, -1).forEach(key => { if (!target[key] || typeof target[key] !== 'object') target[key] = {}; target = target[key]; });
    if (value === null) delete target[keys.at(-1)]; else target[keys.at(-1)] = clone(value);
  };
  return {
    get: async path => clone(read(path)),
    set: async (path, value) => { write(path, value); return clone(value); },
    remove: async path => write(path, null),
    update: async (path, updates) => Object.entries(updates).forEach(([key, value]) => write([path, key].filter(Boolean).join('/'), value)),
    transaction: async (path, update) => { const next = update(clone(read(path))); if (typeof next !== 'undefined') write(path, next); return clone(read(path)); },
    dump: () => clone(root)
  };
}

test('schedule read preserves legacy shape and filters retired workers without mutating data', async () => {
  const store = memoryStore({ desk_portal: { monthly_schedule: { '2026-07': { entries: {
    current: { id: 'current', date: '2026-07-15', worker: '안종성', start: '14:00', end: '22:30' },
    retired: { id: 'retired', date: '2026-07-15', worker: '유지연', start: '14:00', end: '22:30' }
  } } } } });
  const handlers = createDeskHandlers({ store, now: () => '2026-07-15T00:00:00.000Z' });
  const result = await handlers.getDeskScheduleMonthData({ monthKey: '2026-07' });
  assert.equal(result.success, true);
  assert.deepEqual(result.entries.map(item => item.id), ['current']);
  assert.ok(store.dump().desk_portal.monthly_schedule['2026-07'].entries.retired, 'read path must not delete operating data');
});

test('schedule validation rejects retired workers before any write', async () => {
  const store = memoryStore();
  const result = await createDeskHandlers({ store }).saveDeskScheduleEntry({ monthKey: '2026-07', entry: { id: 'x', date: '2026-07-15', worker: '이창연', start: '10:00', end: '18:00' } });
  assert.equal(result.success, false);
  assert.match(result.message, /퇴사자/);
  assert.deepEqual(store.dump(), {});
});

test('journal task write updates the day record and pending index together', async () => {
  const store = memoryStore();
  const handlers = createDeskHandlers({ store, now: () => '2026-07-15T03:00:00.000Z' });
  const saved = await handlers.saveDeskDailyJournalTask({ dateKey: '2026-07-15', task: { id: 'task-1', worker: '안종성', title: '마감 점검' } });
  assert.equal(saved.success, true);
  assert.equal(store.dump().desk_portal.daily_journal['2026-07-15'].tasks['task-1'].title, '마감 점검');
  assert.equal(store.dump().desk_portal.daily_pending_tasks['task-1'].title, '마감 점검');

  await handlers.saveDeskDailyJournalTask({ dateKey: '2026-07-15', task: { ...saved.task, completed: true } });
  assert.equal(store.dump().desk_portal.daily_pending_tasks?.['task-1'], undefined);
});

test('pending task read returns every assignee when the worker filter is empty', async () => {
  const store = memoryStore({ desk_portal: { daily_pending_tasks: {
    'task-on-duty': { id: 'task-on-duty', dateKey: '2026-07-14', worker: '안종성', title: '당일 담당 업무', completed: false },
    'task-off-duty': { id: 'task-off-duty', dateKey: '2026-07-13', worker: '이민현', title: '다음 근무일 확인 업무', completed: false }
  } } });
  const handlers = createDeskHandlers({ store, now: () => '2026-07-15T03:00:00.000Z' });

  const all = await handlers.getDeskDailyJournalPendingTasks({ beforeDateKey: '2026-07-15', workers: [] });
  assert.deepEqual(all.tasks.map(item => item.id).sort(), ['task-off-duty', 'task-on-duty']);

  const filtered = await handlers.getDeskDailyJournalPendingTasks({ beforeDateKey: '2026-07-15', workers: ['안종성'] });
  assert.deepEqual(filtered.tasks.map(item => item.id), ['task-on-duty']);
});

test('supply quantity adjustment uses a transaction and clamps to stock bounds', async () => {
  const store = memoryStore({ desk_portal: { supplies: { consumables: [{ id: 'paper', itemName: '종이', productName: 'A4', qty: 1, maxQty: 3, safetyQty: 1, unit: '권' }], assets: [] } } });
  let transactions = 0;
  const original = store.transaction;
  store.transaction = async (...args) => { transactions += 1; return original(...args); };
  const handlers = createDeskHandlers({ store });
  const result = await handlers.adjustDeskSupplyConsumable({ id: 'paper', delta: 9 });
  assert.equal(result.success, true);
  assert.equal(result.data.consumables[0].qty, 3);
  assert.equal(transactions, 1);
});

test('full supply snapshot preserves custom purchase requests', async () => {
  const store = memoryStore();
  const result = await createDeskHandlers({ store }).saveDeskSuppliesSnapshot({ data: {
    consumables: [{ id: 'paper', itemName: '종이', productName: 'A4', qty: 1, maxQty: 3, safetyQty: 1, unit: '권' }],
    assets: [],
    purchaseCustomRequests: [{ id: 'custom-1', itemName: '테스트 요청', requestQty: 2 }]
  } });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.purchaseCustomRequests, [{ id: 'custom-1', itemName: '테스트 요청', requestQty: 2 }]);
});

test('recruiting month filter includes applicants by operational date fields', async () => {
  const store = memoryStore({ desk_portal: { hr_recruiting: { applicants: {
    july: { applicantName: '7월 지원자', nextContactAt: '2026-07-20', createdAt: '2026-06-01T00:00:00.000Z' },
    june: { applicantName: '6월 지원자', nextContactAt: '2026-06-20', createdAt: '2026-06-01T00:00:00.000Z' }
  } } } });
  const result = await createDeskHandlers({ store }).getDeskRecruitingApplicantsData({ monthKey: '2026-07' });
  assert.deepEqual(result.applicants.map(item => item.applicantName), ['7월 지원자']);
});

test('recruiting comments append transactionally and preserve concurrent notes', async () => {
  const store = memoryStore({ desk_portal: { hr_recruiting: { applicants: {
    applicant: { id: 'applicant', applicantName: '테스트 지원자', comments: [{ id: 'old', createdAt: '2026-07-16T01:00:00.000Z', content: '기존 메모' }] }
  } } } });
  let transactions = 0;
  const original = store.transaction;
  store.transaction = async (...args) => { transactions += 1; return original(...args); };
  const handlers = createDeskHandlers({ store, now: () => '2026-07-17T10:00:00.000Z' });
  const result = await handlers.addDeskRecruitingApplicantComment(
    { id: 'applicant', content: '새 코멘트' },
    { uid: 'staff-1', name: '테스트 근무자' }
  );
  assert.equal(result.success, true);
  assert.equal(transactions, 1);
  assert.deepEqual(result.applicant.comments.map(item => item.content), ['새 코멘트', '기존 메모']);
  assert.equal(result.comment.authorName, '테스트 근무자');
});

test('recruiting writes keep using the RTDB storage key when a legacy embedded id differs', async () => {
  const store = memoryStore({ desk_portal: { hr_recruiting: { applicants: {
    'legacy-storage-key': { id: 'embedded-applicant-id', applicantName: '레거시 지원자', subject: '수학' }
  } } } });
  const handlers = createDeskHandlers({ store, now: () => '2026-07-17T11:00:00.000Z' });
  const loaded = await handlers.getDeskRecruitingApplicantsData({});
  assert.equal(loaded.applicants[0].id, 'embedded-applicant-id');
  assert.equal(loaded.applicants[0].storageId, 'legacy-storage-key');

  const commented = await handlers.addDeskRecruitingApplicantComment({
    id: 'embedded-applicant-id', storageId: 'legacy-storage-key', content: '저장 키 확인'
  }, { uid: 'staff-1', name: '테스트 근무자' });
  assert.equal(commented.success, true);
  assert.equal(commented.applicant.storageId, 'legacy-storage-key');
  assert.equal(store.dump().desk_portal.hr_recruiting.applicants['legacy-storage-key'].comments[0].content, '저장 키 확인');
  assert.equal(store.dump().desk_portal.hr_recruiting.applicants['embedded-applicant-id'], undefined);

  const saved = await handlers.saveDeskRecruitingApplicant({ applicant: {
    ...commented.applicant, school: '수정 학교'
  } });
  assert.equal(saved.success, true);
  assert.equal(store.dump().desk_portal.hr_recruiting.applicants['legacy-storage-key'].school, '수정 학교');

  const deleted = await handlers.deleteDeskRecruitingApplicant({
    id: 'embedded-applicant-id', storageId: 'legacy-storage-key'
  });
  assert.equal(deleted.success, true);
  assert.equal(store.dump().desk_portal.hr_recruiting.applicants['legacy-storage-key'], undefined);
});

test('recruiting comments reject empty, oversized, and missing applicant writes', async () => {
  const store = memoryStore();
  const handlers = createDeskHandlers({ store });
  assert.equal((await handlers.addDeskRecruitingApplicantComment({ id: 'missing', content: '메모' })).success, false);
  assert.equal((await handlers.addDeskRecruitingApplicantComment({ id: 'missing', content: ' ' })).success, false);
  assert.equal((await handlers.addDeskRecruitingApplicantComment({ id: 'missing', content: 'x'.repeat(1001) })).success, false);
  assert.equal((await handlers.addDeskRecruitingApplicantComment({ id: 'applicant', storageId: '../invalid', content: '메모' })).success, false);
  assert.deepEqual(store.dump(), {});
});

test('portal config is proxied through an allowlisted server path', async () => {
  const store = memoryStore();
  const handlers = createDeskHandlers({ store });
  const saved = await handlers.saveDeskPortalConfig({ scope: 'daily', key: 'memoTypes', value: [{ id: 'general', label: '일반' }] });
  assert.equal(saved.success, true);
  const loaded = await handlers.getDeskPortalConfig({ scope: 'daily', key: 'memoTypes' });
  assert.deepEqual(loaded.value, [{ id: 'general', label: '일반' }]);
  const denied = await handlers.saveDeskPortalConfig({ scope: 'daily', key: '../private', value: 'blocked' });
  assert.equal(denied.success, false);
  assert.equal(store.dump().private, undefined);
});
