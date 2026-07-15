import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTuitionHandlers } from '../src/tuition/handlers.js';
import { followupId, paymentId, snapshotId, studentMemoId } from '../src/tuition/normalizers.js';

function clone(value) { return value == null ? value : structuredClone(value); }

function memoryStore(seed = {}) {
  const documents = new Map(Object.entries(seed).map(([key, value]) => [key, clone(value)]));
  let transactions = 0;
  return {
    get: async key => clone(documents.get(key) || null),
    list: async collection => [...documents.entries()].filter(([key]) => key.startsWith(`${collection}/`)).map(([key, value]) => ({ id: key.slice(collection.length + 1), ...clone(value) })),
    transaction: async (keys, mutate) => {
      transactions += 1;
      const current = Object.fromEntries([...new Set(keys.filter(Boolean))].map(key => [key, clone(documents.get(key) || null)]));
      const change = await mutate(current);
      Object.entries(change?.writes || {}).forEach(([key, value]) => documents.set(key, clone(value)));
      (change?.deletes || []).forEach(key => documents.delete(key));
      return clone(change?.result);
    },
    dump: () => Object.fromEntries([...documents.entries()].map(([key, value]) => [key, clone(value)])),
    transactionCount: () => transactions
  };
}

function tuitionSeed() {
  const month = '26-07s';
  const payment = {
    dueDate: '26-07-01', studentName: '김재희', itemName: '납부금액', amount: -100000,
    paidAt: '7/14', business: '반포', paymentType: '신한카드', approvalNo: '1234',
    inputAt: '7/14 12:00', originMonth: month, sourceMonth: month, sourceDueMonth: month,
    requestId: 'existing-payment', source: 'desk_portal'
  };
  return {
    month,
    payment,
    documents: {
      'tuitionMonthIndex/tmi_26-07s': { monthName: month },
      [`tuitionMonthSnapshots/${snapshotId(month)}`]: {
        success: true,
        selectedMonth: month,
        rows: [{
          studentName: '김재희', school: '교육청', grade: '3', guideAmount: 100000,
          collectedAmount: 100000, outstandingAmount: 0, paymentCount: 1, unpaidStatus: '납부완료',
          contactCount: 0, lastContactAt: '', lastContactMemo: '', lastUpdatedAt: ''
        }],
        payments: [payment], allPayments: [payment], todayPayments: [payment],
        snapshot: { source: 'migration', computedAt: '2026-07-14T00:00:00.000Z', schemaVersion: 'v4' }
      },
      'tuitionPaymentReadIndexes/recent': { payments: [payment], seeded: true },
      'tuitionPaymentReadIndexes/payment_month_26-07s': { monthName: month, payments: [payment], seeded: true },
      'tuitionPaymentReadIndexes/daily_2026_07_14': { dateKey: '2026-07-14', payments: [payment] },
      [`tuitionPayments/${paymentId(payment)}`]: payment
    }
  };
}

test('month summary reads the snapshot and attaches student memo warnings', async () => {
  const seed = tuitionSeed();
  const memoKey = `tuitionStudentMemos/${studentMemoId('김재희')}`;
  seed.documents[memoKey] = { studentName: '김재희', memos: { 'memo-1': { id: 'memo-1', createdAt: '2026-07-14T01:00:00.000Z', memo: '안내 보류', author: '관리자' } } };
  const result = await createTuitionHandlers({ store: memoryStore(seed.documents) }).getTuitionMonthSummary({ monthName: seed.month });
  assert.equal(result.success, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].tuitionMemoWarning.latestMemo, '안내 보류');
  assert.equal(result.cache.source, 'firestore-snapshot');
});

test('inactive student search reads Firestore student records only', async () => {
  const store = memoryStore({
    'students/inactive-1': { studentName: '이중지', school: '반포중', grade: '2', status: 'STOPPED' },
    'students/active-1': { studentName: '이재원', school: '반포중', grade: '2', status: 'ACTIVE' }
  });
  const result = await createTuitionHandlers({ store }).getTuitionInactiveStudentCandidates({ keyword: '이' });
  assert.equal(result.success, true);
  assert.deepEqual(result.rows.map(row => row.name), ['이중지']);
  assert.equal(result.rows[0].source, 'firestore');
});

test('payment append updates the ledger, indexes, and snapshot in one transaction and replays duplicates', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T03:30:00.000Z') });
  const payload = {
    monthName: seed.month, studentName: '김재희', dueDate: '26-07-01', amount: -50000,
    paidAt: '7/15', business: '반포', paymentType: '현대카드', approvalNo: '5678',
    clientRequestId: 'append-1'
  };
  const first = await handlers.appendTuitionPaymentEntry(payload, { uid: 'staff-1', name: '관리자' });
  const second = await handlers.appendTuitionPaymentEntry(payload, { uid: 'staff-1', name: '관리자' });
  assert.equal(first.success, true);
  assert.equal(second.duplicate, true);
  assert.equal(store.transactionCount(), 2);
  const dump = store.dump();
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].collectedAmount, 150000);
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].payments.length, 2);
  assert.equal(dump['tuitionPaymentReadIndexes/payment_month_26-07s'].payments.length, 2);
  assert.equal(dump['tuitionPaymentReadIndexes/daily_2026_07_15'].payments.length, 1);
  assert.ok(dump['tuitionPayments/tp_append-1']);
});

test('payment delete writes an audit record and removes the payment everywhere atomically', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T04:00:00.000Z') });
  const result = await handlers.deleteTuitionPaymentEntry({
    monthName: seed.month,
    payment: seed.payment,
    reason: '중복 입력',
    clientRequestId: 'delete-1'
  }, { uid: 'staff-1', name: '관리자' });
  assert.equal(result.success, true);
  const dump = store.dump();
  assert.equal(dump[`tuitionPayments/${paymentId(seed.payment)}`], undefined);
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].payments.length, 0);
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].collectedAmount, 0);
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].unpaidStatus, '확인필요');
  assert.equal(dump['tuitionPaymentReadIndexes/payment_month_26-07s'], undefined);
  assert.equal(dump['tuitionPaymentDeletions/tdel_delete-1'].reason, '중복 입력');
});

test('followup retries do not increment contact count twice', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T05:00:00.000Z') });
  const payload = { monthName: seed.month, studentName: '김재희', guideAmount: 100000, unpaidStatus: '안내완료', memo: '문자 안내', clientRequestId: 'followup-1' };
  const first = await handlers.saveTuitionFollowup(payload, { uid: 'staff-1', name: '관리자' });
  const second = await handlers.saveTuitionFollowup(payload, { uid: 'staff-1', name: '관리자' });
  assert.equal(first.success, true, JSON.stringify(first));
  assert.equal(first.contactCount, 1);
  assert.equal(second.duplicate, true);
  assert.equal(store.dump()[`tuitionFollowups/${followupId(seed.month, '김재희')}`].contactCount, 1);
  assert.equal(store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows[0].contactCount, 1);
});

test('amount adjustment records only the collected delta and keeps snapshot totals consistent', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T06:00:00.000Z') });
  const result = await handlers.saveTuitionAmountAdjustment({
    monthName: seed.month,
    studentName: '김재희',
    guideAmount: 120000,
    collectedAmount: 120000,
    reason: '금액 정정',
    clientRequestId: 'adjust-1'
  }, { uid: 'staff-1', name: '관리자' });
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.adjustmentPayment.amount, -20000);
  const dump = store.dump();
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].guideAmount, 120000);
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].collectedAmount, 120000);
  assert.equal(dump['tuitionPayments/tp_adjust-1'].amount, -20000);
});
