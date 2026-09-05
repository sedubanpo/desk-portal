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

test('staff icon directory exposes only the name and position linkage', async () => {
  const handlers = createDeskHandlers({
    store: memoryStore(),
    loadStaffDirectory: async () => [
      { uid: 'staff-2', name: '안종성', staffPosition: '대리', loginId: '01086262428', phone: '01086262428' },
      { uid: 'staff-1', name: '김유민', staffPosition: '주임', email: 'staff@example.com' },
      { uid: 'missing-position', name: '직급없음', staffPosition: '' }
    ]
  });

  const result = await handlers.getDeskStaffDirectory();

  assert.deepEqual(result, {
    success: true,
    staff: [
      { uid: 'staff-1', name: '김유민', staffPosition: '주임' },
      { uid: 'staff-2', name: '안종성', staffPosition: '대리' }
    ]
  });
});

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

test('desk writes reject unsafe RTDB record IDs before constructing storage paths', async () => {
  const store = memoryStore();
  const handlers = createDeskHandlers({ store });

  const schedule = await handlers.saveDeskScheduleEntry({
    monthKey: '2026-07', entry: { id: '../other', date: '2026-07-15', worker: '안종성', start: '10:00', end: '18:00' }
  });
  const batch = await handlers.batchUpdateDeskScheduleEntries({ monthKey: '2026-07', deleteIds: ['safe-id', '../other'] });
  const task = await handlers.saveDeskDailyJournalTask({
    dateKey: '2026-07-15', task: { id: '../other', worker: '안종성', title: '경로 검사' }
  });
  const memo = await handlers.saveDeskDailyJournalMemo({
    dateKey: '2026-07-15', memo: { id: '../other', worker: '안종성', text: '경로 검사' }
  });
  const request = await handlers.saveDeskAttendanceCorrectionDecision({
    monthKey: '2026-07', requestId: '../other', decision: 'APPROVED'
  });

  assert.equal(schedule.success, false);
  assert.equal(batch.success, false);
  assert.equal(task.success, false);
  assert.equal(memo.success, false);
  assert.equal(request.success, false);
  assert.deepEqual(store.dump(), {});
});

test('schedule writes retain dated versions with actor and exact day snapshots', async () => {
  const store = memoryStore({ desk_portal: { monthly_schedule: { '2026-08': { entries: {
    first: { id: 'first', date: '2026-08-01', worker: '안종성', role: '오후 데스크', start: '13:30', end: '21:00' }
  } } } } });
  let stamp = '2026-07-31T06:00:00.000Z';
  const handlers = createDeskHandlers({ store, now: () => stamp });

  const saved = await handlers.saveDeskScheduleEntry({
    monthKey: '2026-08',
    entry: { id: 'first', date: '2026-08-01', worker: '안종성', role: '오후 데스크', start: '14:00', end: '22:00' }
  }, { uid: 'manager-1', name: '예스영어학원 관리자' });
  assert.equal(saved.latestVersion.actorName, '예스영어학원 관리자');
  assert.equal(saved.latestVersion.summary, '안종성 일정 수정');

  stamp = '2026-07-31T07:00:00.000Z';
  await handlers.saveDeskScheduleEntry({
    monthKey: '2026-08',
    entry: { id: 'second', date: '2026-08-01', worker: '이민현', role: '마감 담당', start: '16:00', end: '22:30' }
  }, { uid: 'manager-2', name: '홍성우' });

  const history = await handlers.getDeskScheduleDayHistory({ dateKey: '2026-08-01' });
  assert.equal(history.versions.length, 2);
  assert.equal(history.versions[0].actorName, '홍성우');
  assert.equal(history.versions[0].entries.length, 2);
  assert.equal(history.versions[1].beforeEntries[0].start, '13:30');
  assert.equal(history.versions[1].entries[0].start, '14:00');

  const month = await handlers.getDeskScheduleMonthData({ monthKey: '2026-08' });
  assert.equal(month.latestVersions['2026-08-01'].createdAt, '2026-07-31T07:00:00.000Z');
  assert.equal(month.latestVersions['2026-08-01'].entryCount, 2);
});

test('schedule batch writes one version for each affected date', async () => {
  const store = memoryStore({ desk_portal: { monthly_schedule: { '2026-08': { entries: {
    first: { id: 'first', date: '2026-08-01', worker: '안종성', start: '13:30', end: '21:00' },
    second: { id: 'second', date: '2026-08-02', worker: '이민현', start: '16:00', end: '22:30' }
  } } } } });
  const handlers = createDeskHandlers({ store, now: () => '2026-07-31T08:00:00.000Z' });
  const result = await handlers.batchUpdateDeskScheduleEntries({
    monthKey: '2026-08',
    deleteIds: ['first', 'second'],
    entries: []
  }, { uid: 'manager-1', name: '관리자' });
  assert.deepEqual(Object.keys(result.latestVersions).sort(), ['2026-08-01', '2026-08-02']);
  assert.equal((await handlers.getDeskScheduleDayHistory({ dateKey: '2026-08-01' })).versions[0].entries.length, 0);
  assert.equal((await handlers.getDeskScheduleDayHistory({ dateKey: '2026-08-02' })).versions[0].summary, '이민현 일정 삭제');
});

test('attendance punch, correction approval, and audit history remain linked', async () => {
  const store = memoryStore({ desk_portal: { monthly_schedule: { '2026-08': { entries: {
    shift: { id: 'shift', date: '2026-08-08', worker: '안종성', start: '09:30', end: '18:00' }
  } } } } });
  let stamp = '2026-08-08T00:31:00.000Z';
  const handlers = createDeskHandlers({ store, now: () => stamp });
  const staff = { uid: 'staff-1', name: '안종성', role: 'STAFF', staffPosition: '대리' };

  const clockIn = await handlers.saveDeskAttendancePunch({ dateKey: '2026-08-08', type: 'clockIn' }, staff);
  assert.equal(clockIn.success, true);
  assert.equal(clockIn.record.scheduledStart, '09:30');
  assert.equal(clockIn.record.clockIn, stamp);

  stamp = '2026-08-08T09:10:00.000Z';
  const clockOut = await handlers.saveDeskAttendancePunch({ dateKey: '2026-08-08', type: 'clockOut' }, staff);
  assert.equal(clockOut.record.clockOut, stamp);

  stamp = '2026-08-08T10:00:00.000Z';
  const requested = await handlers.saveDeskAttendanceCorrectionRequest({
    dateKey: '2026-08-08', requestedClockIn: '09:30', requestedClockOut: '18:00', reason: '현장 업무 후 기록'
  }, staff);
  assert.equal(requested.request.status, 'PENDING');

  stamp = '2026-08-08T10:30:00.000Z';
  const approved = await handlers.saveDeskAttendanceCorrectionDecision({
    monthKey: '2026-08', requestId: requested.request.id, decision: 'APPROVED'
  }, { uid: 'admin-1', name: '관리자', role: 'ADMIN' });
  assert.equal(approved.request.status, 'APPROVED');
  assert.equal(approved.record.corrected, true);
  assert.equal(approved.record.clockIn, '2026-08-08T00:30:00.000Z');
  assert.equal(approved.record.clockOut, '2026-08-08T09:00:00.000Z');

  const staffMonth = await handlers.getDeskAttendanceMonthData({ monthKey: '2026-08' }, staff);
  assert.equal(staffMonth.records.length, 1);
  assert.equal(staffMonth.requests.length, 1);
  assert.equal(staffMonth.audits.length, 4);
  assert.equal(staffMonth.summary[0].correctedDays, 1);
  assert.equal(staffMonth.summary[0].workedMinutes, 510);
});

test('staff attendance reads never expose another worker', async () => {
  const store = memoryStore({ desk_portal: { staff_attendance: { '2026-08': { '2026-08-08': {
    'staff-1': { uid: 'staff-1', name: '안종성', dateKey: '2026-08-08', clockIn: '2026-08-08T00:30:00.000Z' },
    'staff-2': { uid: 'staff-2', name: '이민현', dateKey: '2026-08-08', clockIn: '2026-08-08T07:00:00.000Z' }
  } } } } });
  const result = await createDeskHandlers({ store }).getDeskAttendanceMonthData(
    { monthKey: '2026-08' },
    { uid: 'staff-1', name: '안종성', role: 'STAFF' }
  );
  assert.deepEqual(result.records.map(item => item.uid), ['staff-1']);
});

test('self-punches cannot create past or future attendance records', async () => {
  const store = memoryStore();
  const handlers = createDeskHandlers({ store, now: () => '2026-08-08T01:00:00.000Z' });
  const identity = { uid: 'staff-1', name: '안종성' };

  const past = await handlers.saveDeskAttendancePunch({ dateKey: '2026-08-07', type: 'clockIn' }, identity);
  const future = await handlers.saveDeskAttendancePunch({ dateKey: '2026-08-09', type: 'clockIn' }, identity);

  assert.equal(past.success, false);
  assert.equal(future.success, false);
  assert.match(past.message, /정정 요청/);
  assert.deepEqual(store.dump(), {});
});

test('journal task write updates the day record and pending index together', async () => {
  const store = memoryStore();
  const handlers = createDeskHandlers({ store, now: () => '2026-07-15T03:00:00.000Z' });
  const saved = await handlers.saveDeskDailyJournalTask({ dateKey: '2026-07-15', task: { id: 'task-1', worker: '안종성', title: '마감 점검' } });
  assert.equal(saved.success, true);
  assert.equal(store.dump().desk_portal.daily_journal['2026-07-15'].tasks['task-1'].title, '마감 점검');
  assert.equal(store.dump().desk_portal.daily_pending_tasks['task-1'].title, '마감 점검');

  await handlers.saveDeskDailyJournalTask({ dateKey: '2026-07-15', task: { ...saved.task, completed: true } }, { uid: 'manager-1', name: '관리자' });
  assert.equal(store.dump().desk_portal.daily_pending_tasks?.['task-1'], undefined);
  assert.equal(store.dump().desk_portal.daily_journal['2026-07-15'].tasks['task-1'].createdByName, '관리자');
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

test('task ledger includes completed and soft-deleted assignment history', async () => {
  const store = memoryStore({ desk_portal: { daily_journal: {
    '2026-07-14': { tasks: { completed: { id: 'completed', worker: '안종성', title: '완료 업무', completed: true } } },
    '2026-07-15': { tasks: { pending: { id: 'pending', worker: '이민현', title: '확인 업무', progressStatus: '확인 필요', unresolvedReason: '답변 대기', nextAction: '7/16 재확인' } } }
  } } });
  const handlers = createDeskHandlers({ store, now: () => '2026-07-15T03:00:00.000Z' });

  await handlers.deleteDeskDailyJournalTask({ dateKey: '2026-07-15', id: 'pending' }, { uid: 'admin-1', name: '관리자' });
  const ledger = await handlers.getDeskDailyJournalTaskLedger();

  assert.equal(ledger.summary.total, 2);
  assert.equal(ledger.summary.completed, 1);
  assert.equal(ledger.summary.deleted, 1);
  assert.equal(ledger.tasks.find(item => item.id === 'pending').deletedByName, '관리자');
  assert.equal(store.dump().desk_portal.daily_journal['2026-07-15'].tasks.pending.deleted, true);
  assert.equal(store.dump().desk_portal.daily_pending_tasks?.pending, undefined);
});

test('legacy branch inventory becomes one shared item with preserved branch quantities and selections', async () => {
  const store = memoryStore({ desk_portal: { supplies: {
    consumables: [
      { id: 'paper-main', itemName: '종이', productName: 'A4', branch: '본관', qty: 1, maxQty: 3, safetyQty: 1, unit: '권' },
      { id: 'paper-annex', itemName: '종이', productName: 'A4', branch: '2관', qty: 2, maxQty: 3, safetyQty: 1, unit: '권' }
    ],
    purchaseSelections: {
      'paper-main': { selected: false, requestQty: 1 },
      'paper-annex': { selected: true, requestQty: 2 }
    },
    assets: []
  } } });
  const result = await createDeskHandlers({ store }).getDeskSuppliesData();

  assert.equal(result.success, true);
  assert.equal(result.data.consumables.length, 1);
  const paper = result.data.consumables[0];
  assert.equal(paper.id, 'paper-main');
  assert.equal(paper.branchStocks['본관'].qty, 1);
  assert.equal(paper.branchStocks['2관'].qty, 2);
  assert.equal(paper.branchStocks['3관'].qty, 0);
  assert.deepEqual(result.data.purchaseSelections['paper-main:본관'], { selected: false, requestQty: 1 });
  assert.deepEqual(result.data.purchaseSelections['paper-main:2관'], { selected: true, requestQty: 2 });
});

test('supply quantity adjustment uses a transaction and records the selected branch change', async () => {
  const store = memoryStore({ desk_portal: { supplies: { consumables: [{
    id: 'paper', itemName: '종이', productName: 'A4', unit: '권',
    branchStocks: {
      '본관': { qty: 1, maxQty: 3, safetyQty: 1 },
      '2관': { qty: 1, maxQty: 3, safetyQty: 1 },
      '3관': { qty: 0, maxQty: 3, safetyQty: 1 }
    }
  }], assets: [] } } });
  let transactions = 0;
  const original = store.transaction;
  store.transaction = async (...args) => { transactions += 1; return original(...args); };
  const handlers = createDeskHandlers({ store, now: () => '2026-08-08T07:25:00.000Z' });
  const result = await handlers.adjustDeskSupplyConsumable(
    { id: 'paper', branch: '2관', delta: 9 },
    { uid: 'desk-1', name: '안종성' }
  );
  assert.equal(result.success, true);
  assert.equal(result.data.consumables[0].branchStocks['본관'].qty, 1);
  assert.equal(result.data.consumables[0].branchStocks['2관'].qty, 3);
  assert.equal(result.data.consumables[0].branchStocks['3관'].qty, 0);
  assert.deepEqual(result.data.consumables[0].changeHistory[0], {
    id: result.data.consumables[0].changeHistory[0].id,
    itemName: '종이',
    branch: '2관',
    delta: 2,
    direction: 'increase',
    beforeQty: 1,
    afterQty: 3,
    changedAt: '2026-08-08T07:25:00.000Z',
    changedBy: '안종성',
    changedByUid: 'desk-1'
  });
  assert.equal(transactions, 1);
});

test('supply quantity adjustment resolves a normalized item when the client has a legacy id', async () => {
  const store = memoryStore({ desk_portal: { supplies: { consumables: [{
    id: 'canonical-paper', itemName: '복사용지', productName: 'A4 80g', unit: '박스',
    branchStocks: {
      '본관': { qty: 2, maxQty: 5, safetyQty: 1 },
      '2관': { qty: 0, maxQty: 5, safetyQty: 1 },
      '3관': { qty: 0, maxQty: 5, safetyQty: 1 }
    }
  }], assets: [] } } });
  const handlers = createDeskHandlers({ store, now: () => '2026-08-10T01:00:00.000Z' });
  const result = await handlers.adjustDeskSupplyConsumable({
    id: 'legacy-paper-2f', itemName: '복사용지', productName: 'A4 80g', unit: '박스', branch: '2관', delta: 1
  }, { uid: 'desk-1', name: '안종성' });
  assert.equal(result.success, true);
  assert.equal(result.data.consumables[0].branchStocks['2관'].qty, 1);
});

test('supply normalization preserves favorites and caps recent change history', async () => {
  const history = Array.from({ length: 55 }, (_, index) => ({
    id: `change-${index}`,
    itemName: '종이',
    branch: '본관',
    delta: index % 2 ? -1 : 1,
    changedAt: `2026-08-${String((index % 9) + 1).padStart(2, '0')}T0${index % 9}:00:00.000Z`,
    changedBy: '관리자'
  }));
  const store = memoryStore({ desk_portal: { supplies: { consumables: [{
    id: 'paper', itemName: '종이', productName: 'A4', favorite: true, changeHistory: history,
    branchStocks: { '본관': { qty: 1, maxQty: 3, safetyQty: 1 } }
  }], assets: [] } } });
  const handlers = createDeskHandlers({ store });
  const result = await handlers.getDeskSuppliesData();
  assert.equal(result.data.consumables[0].favorite, true);
  assert.equal(result.data.consumables[0].changeHistory.length, 50);
  assert.ok(result.data.consumables[0].changeHistory[0].changedAt >= result.data.consumables[0].changeHistory[1].changedAt);
  const saved = await handlers.saveDeskSupplyConsumable({ item: {
    id: 'paper', itemName: '종이', productName: 'A4 80g',
    branchStocks: { '본관': { qty: 1, maxQty: 3, safetyQty: 1 } }
  } });
  assert.equal(saved.data.consumables[0].favorite, true);
  assert.equal(saved.data.consumables[0].changeHistory.length, 50);
});

test('full supply snapshot preserves custom purchase requests', async () => {
  const store = memoryStore();
  const handlers = createDeskHandlers({ store });
  const expectedData = (await handlers.getDeskSuppliesData()).data;
  const result = await handlers.saveDeskSuppliesSnapshot({ expectedData, data: {
    consumables: [{ id: 'paper', itemName: '종이', productName: 'A4', unit: '권', tags: ['문구', '#복사용지'], branchStocks: {
      '본관': { qty: 2, maxQty: 3, safetyQty: 1 },
      '2관': { qty: 1, maxQty: 3, safetyQty: 1 },
      '3관': { qty: 0, maxQty: 3, safetyQty: 1 }
    } }],
    assets: [{ id: 'tablet', type: '태블릿', productName: 'iPad', branch: '3관' }],
    purchaseCustomRequests: [{ id: 'custom-1', itemName: '테스트 요청', requestQty: 2 }]
  } });
  assert.equal(result.success, true);
  assert.equal(result.data.consumables[0].branchStocks['본관'].qty, 2);
  assert.equal(result.data.consumables[0].branchStocks['2관'].qty, 1);
  assert.equal(result.data.consumables[0].branchStocks['3관'].qty, 0);
  assert.deepEqual(result.data.consumables[0].tags, ['#문구', '#복사용지']);
  assert.equal(result.data.assets[0].branch, '3관');
  assert.deepEqual(result.data.purchaseCustomRequests, [{ id: 'custom-1', itemName: '테스트 요청', requestQty: 2 }]);
});

test('full supply snapshot rejects a missing or stale baseline without replacing another write', async () => {
  const store = memoryStore({ desk_portal: { supplies: { purchaseRequestNote: '기존 요청' } } });
  const handlers = createDeskHandlers({ store });
  const expectedData = (await handlers.getDeskSuppliesData()).data;
  const missing = handlers.saveDeskSuppliesSnapshot({ data: { ...expectedData, purchaseRequestNote: '저장 시도' } });
  await assert.rejects(missing, error => error.status === 409 && error.code === 'supplies_snapshot_conflict');
  await handlers.saveDeskSupplyPurchaseState({ purchaseRequestNote: '다른 사용자의 변경' });
  const stale = handlers.saveDeskSuppliesSnapshot({
    expectedData,
    data: { ...expectedData, purchaseRequestNote: '저장 시도' }
  });

  await assert.rejects(stale, error => error.status === 409 && error.code === 'supplies_snapshot_conflict');
  assert.equal((await handlers.getDeskSuppliesData()).data.purchaseRequestNote, '다른 사용자의 변경');
});

test('full supply snapshot waits for the server baseline after a cached-null transaction callback', async () => {
  let stored = { purchaseRequestNote: '서버 기준' };
  const callbacks = [];
  const store = {
    get: async () => clone(stored),
    transaction: async (_path, update) => {
      callbacks.push(update(null));
      const next = update(clone(stored));
      callbacks.push(next);
      if (typeof next !== 'undefined') stored = clone(next);
      return clone(stored);
    }
  };
  const handlers = createDeskHandlers({ store });
  const expectedData = (await handlers.getDeskSuppliesData()).data;
  const result = await handlers.saveDeskSuppliesSnapshot({
    expectedData,
    data: { ...expectedData, purchaseRequestNote: '저장 완료' }
  });

  assert.equal(callbacks[0], null);
  assert.equal(result.success, true);
  assert.equal(result.data.purchaseRequestNote, '저장 완료');
  assert.equal(stored.purchaseRequestNote, '저장 완료');
});

test('full supply snapshot keeps the server value when its retried baseline is stale', async () => {
  let stored = { purchaseRequestNote: '다른 사용자의 서버 변경' };
  const callbacks = [];
  const store = {
    get: async () => ({ purchaseRequestNote: '이전 기준' }),
    transaction: async (_path, update) => {
      callbacks.push(update(null));
      const next = update(clone(stored));
      callbacks.push(next);
      if (typeof next !== 'undefined') stored = clone(next);
      return clone(stored);
    }
  };
  const handlers = createDeskHandlers({ store });
  const expectedData = (await handlers.getDeskSuppliesData()).data;

  await assert.rejects(
    handlers.saveDeskSuppliesSnapshot({ expectedData, data: { ...expectedData, purchaseRequestNote: '유실되면 안 되는 저장' } }),
    error => error.status === 409 && error.code === 'supplies_snapshot_conflict'
  );
  assert.equal(callbacks[0], null);
  assert.equal(callbacks[1].purchaseRequestNote, '다른 사용자의 서버 변경');
  assert.equal(stored.purchaseRequestNote, '다른 사용자의 서버 변경');
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
  const saved = await handlers.saveDeskPortalConfig({
    scope: 'daily', key: 'memoTypes', expectedValue: null, value: [{ id: 'general', label: '일반' }]
  });
  assert.equal(saved.success, true);
  const loaded = await handlers.getDeskPortalConfig({ scope: 'daily', key: 'memoTypes' });
  assert.deepEqual(loaded.value, [{ id: 'general', label: '일반' }]);
  const denied = await handlers.saveDeskPortalConfig({ scope: 'daily', key: '../private', expectedValue: null, value: 'blocked' });
  assert.equal(denied.success, false);
  assert.equal(store.dump().private, undefined);
});

test('portal config CAS rejects missing and stale baselines without replacing a newer value', async () => {
  const store = memoryStore({ desk_portal: { daily_config: { memoTypes: [{ id: 'existing', label: '기존' }] } } });
  const handlers = createDeskHandlers({ store });
  const expectedValue = (await handlers.getDeskPortalConfig({ scope: 'daily', key: 'memoTypes' })).value;

  await assert.rejects(
    handlers.saveDeskPortalConfig({ scope: 'daily', key: 'memoTypes', value: [{ id: 'draft', label: '초안' }] }),
    error => error.status === 409 && error.code === 'portal_config_conflict'
  );
  await store.set('desk_portal/daily_config/memoTypes', [{ id: 'other', label: '다른 사용자' }]);
  await assert.rejects(
    handlers.saveDeskPortalConfig({ scope: 'daily', key: 'memoTypes', expectedValue, value: [{ id: 'draft', label: '초안' }] }),
    error => error.status === 409 && error.code === 'portal_config_conflict'
  );
  assert.deepEqual((await handlers.getDeskPortalConfig({ scope: 'daily', key: 'memoTypes' })).value, [{ id: 'other', label: '다른 사용자' }]);
});

test('portal config CAS retries a cached-null callback against the server baseline', async () => {
  let stored = [{ id: 'existing', label: '서버 기준' }];
  const callbacks = [];
  const store = {
    get: async () => clone(stored),
    transaction: async (_path, update) => {
      callbacks.push(update(null));
      const next = update(clone(stored));
      callbacks.push(next);
      if (typeof next !== 'undefined') stored = clone(next);
      return clone(stored);
    }
  };
  const handlers = createDeskHandlers({ store });
  const expectedValue = (await handlers.getDeskPortalConfig({ scope: 'daily', key: 'memoTypes' })).value;
  const result = await handlers.saveDeskPortalConfig({
    scope: 'daily', key: 'memoTypes', expectedValue, value: [{ id: 'saved', label: '저장 완료' }]
  });

  assert.equal(callbacks[0], null);
  assert.equal(result.success, true);
  assert.deepEqual(result.value, [{ id: 'saved', label: '저장 완료' }]);
  assert.deepEqual(stored, [{ id: 'saved', label: '저장 완료' }]);
});
