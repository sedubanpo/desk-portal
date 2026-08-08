import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTuitionHandlers } from '../src/tuition/handlers.js';
import { followupId, paymentId, snapshotId, studentMemoId } from '../src/tuition/normalizers.js';

function clone(value) { return value == null ? value : structuredClone(value); }

function memoryStore(seed = {}) {
  const documents = new Map(Object.entries(seed).map(([key, value]) => [key, clone(value)]));
  let transactions = 0;
  const listDocuments = collection => [...documents.entries()]
    .filter(([key]) => key.startsWith(`${collection}/`))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ id: key.slice(collection.length + 1), ...clone(value) }));
  return {
    get: async key => clone(documents.get(key) || null),
    list: async (collection, limit = 1000) => listDocuments(collection).slice(0, limit),
    listWhere: async (collection, field, operator, value, limit = 1000) => listDocuments(collection).filter(document => {
      if (operator === '==') return document[field] === value;
      if (operator === 'in') return Array.isArray(value) && value.includes(document[field]);
      throw new Error(`unsupported memoryStore operator: ${operator}`);
    }).slice(0, limit),
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
  const previousPayment = {
    dueDate: '26-06-01', studentName: '김재희', itemName: '납부금액', amount: -90000,
    paidAt: '6/14', business: '반포', paymentType: '계좌이체', approvalNo: 'prev-1',
    inputAt: '6/14 12:00', originMonth: '26-06s', sourceMonth: '26-06s', sourceDueMonth: '26-06s',
    requestId: 'previous-payment', source: 'desk_portal'
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
      'tuitionPaymentReadIndexes/payment_month_26-06s': { monthName: '26-06s', payments: [previousPayment], seeded: true },
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
  assert.equal(result.rows[0].previousPaymentMethod, '계좌이체');
  assert.equal(result.cache.source, 'firestore-snapshot');
});

test('month summary exposes the latest two generated months for briefing', async () => {
  const seed = tuitionSeed();
  const augustPayment = {
    dueDate: '26-08-01', studentName: '신유진', itemName: '납부금액', amount: -200000,
    paidAt: '7/31', business: '반포', paymentType: '현장카드', approvalNo: 'aug-1',
    inputAt: '7/31 15:00', originMonth: '26-08s', sourceMonth: '26-08s', sourceDueMonth: '26-08s',
    requestId: 'august-payment', source: 'desk_portal'
  };
  seed.documents['tuitionMonthIndex/tmi_26-08s'] = { monthName: '26-08s' };
  seed.documents[`tuitionMonthSnapshots/${snapshotId('26-08s')}`] = {
    success: true,
    selectedMonth: '26-08s',
    rows: [{
      studentName: '신유진', school: '세화여고', grade: '2', guideAmount: 200000,
      collectedAmount: 200000, outstandingAmount: 0, paymentCount: 1, unpaidStatus: '납부완료',
      contactCount: 1, lastContactAt: '2026-07-31T05:00:00.000Z', lastContactMemo: '', lastUpdatedAt: ''
    }],
    payments: [augustPayment],
    allPayments: [augustPayment],
    todayPayments: [augustPayment]
  };
  seed.documents['tuitionPaymentReadIndexes/payment_month_26-08s'] = {
    monthName: '26-08s', payments: [augustPayment], seeded: true
  };

  const result = await createTuitionHandlers({ store: memoryStore(seed.documents) })
    .getTuitionMonthSummary({ monthName: '26-08s' });

  assert.equal(result.success, true);
  assert.deepEqual(result.briefingMonths, ['26-08s', '26-07s']);
  assert.deepEqual(result.briefingPayments.map(row => row.requestId).sort(), ['august-payment', 'existing-payment']);
  assert.deepEqual(result.briefingRows.map(row => row.sourceMonth).sort(), ['26-07s', '26-08s']);
  assert.equal(result.monthAvailability.find(item => item.monthName === '26-08s')?.hasData, true);
  assert.equal(result.monthAvailability.find(item => item.monthName === '26-07s')?.hasData, true);
});

test('month summary merges newly registered active students without reviving inactive students', async () => {
  const seed = tuitionSeed();
  seed.documents['students/new-active'] = {
    studentId: 'new-active', studentName: '신유진', school: '세화여고', grade: '2',
    status: 'ACTIVE', active: true, isActive: true
  };
  seed.documents['students/stopped'] = {
    studentId: 'stopped', studentName: '이중지', school: '반포중', grade: '2',
    status: 'STOPPED', active: false, isActive: false
  };
  const result = await createTuitionHandlers({ store: memoryStore(seed.documents) })
    .getTuitionMonthSummary({ monthName: seed.month });
  assert.equal(result.success, true);
  assert.deepEqual(result.rows.map(row => row.studentName), ['김재희', '신유진']);
  assert.equal(result.rows[1].studentId, 'new-active');
  assert.equal(result.rows[1].school, '세화여고');
  assert.equal(result.rows[1].grade, '2');
  assert.equal(result.rows[1].guideAmount, 0);
  assert.equal(result.rows[1].collectedAmount, 0);
  assert.equal(result.rows[1].outstandingAmount, 0);
  assert.equal(result.rows[1].unpaidStatus, '안내이전');
  assert.equal(result.kpi.totalStudents, 2);
});

test('creating a tuition month seeds active students and never overwrites an existing month', async () => {
  const seed = tuitionSeed();
  seed.documents['students/active-a'] = {
    studentId: 'active-a', studentName: '신유진', school: '세화여고', grade: '2',
    status: 'ACTIVE', active: true
  };
  seed.documents['students/active-b'] = {
    studentId: 'active-b', studentName: '송태영', school: '세화고', grade: '1',
    status: '등록', active: true
  };
  seed.documents['students/stopped'] = {
    studentId: 'stopped', studentName: '이중지', status: 'STOPPED', active: false
  };
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-28T06:00:00.000Z') });

  const created = await handlers.createTuitionMonth({
    monthName: '26-08s',
    clientRequestId: 'create-26-08'
  }, { uid: 'staff-1', name: '관리자' });
  assert.equal(created.success, true);
  assert.equal(created.created, true);
  assert.equal(created.selectedMonth, '26-08s');
  assert.deepEqual(created.months, ['26-08s', '26-07s']);
  assert.deepEqual(created.rows.map(row => row.studentName), ['송태영', '신유진']);
  assert.equal(created.rows.every(row => row.guideAmount === 0 && row.unpaidStatus === '안내이전'), true);
  assert.equal(created.allPayments.length, 1);
  assert.equal(store.dump()['tuitionPaymentReadIndexes/payment_month_26-08s'].seeded, true);

  const existingSnapshot = store.dump()[`tuitionMonthSnapshots/${snapshotId('26-08s')}`];
  existingSnapshot.rows[0].guideAmount = 999;
  const repeatedStore = memoryStore({
    ...store.dump(),
    [`tuitionMonthSnapshots/${snapshotId('26-08s')}`]: existingSnapshot
  });
  const repeated = await createTuitionHandlers({ store: repeatedStore }).createTuitionMonth({
    monthName: '26-08s',
    clientRequestId: 'create-26-08-again'
  });
  assert.equal(repeated.success, true);
  assert.equal(repeated.created, false);
  assert.equal(repeatedStore.dump()[`tuitionMonthSnapshots/${snapshotId('26-08s')}`].rows[0].guideAmount, 999);
});

test('active student queries find a canonical record beyond the first 1000 alias documents', async () => {
  const seed = tuitionSeed();
  for (let index = 0; index < 1001; index += 1) {
    const id = `ROW-${String(index).padStart(4, '0')}`;
    seed.documents[`students/${id}`] = {
      studentId: id, studentName: `과거별칭${index}`, status: 'MERGED',
      identityStatus: 'ALIAS', isAlias: true
    };
  }
  seed.documents['students/student_216f618b10487bec1f77e52c'] = {
    studentId: 'student_216f618b10487bec1f77e52c', studentName: '송태영', school: '세화고', grade: '1',
    status: 'ACTIVE', active: true, isActive: true, identityStatus: 'CANONICAL'
  };
  const result = await createTuitionHandlers({ store: memoryStore(seed.documents) })
    .getTuitionMonthSummary({ monthName: seed.month, keyword: '송태영' });
  assert.equal(result.success, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].studentName, '송태영');
  assert.equal(result.rows[0].school, '세화고');
  assert.equal(result.rows[0].grade, '1');
  assert.equal(result.rows[0].unpaidStatus, '안내이전');
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
    paidAt: '7/15', business: '반포', paymentType: '결제링크', cardCompany: '현대카드', approvalNo: '5678',
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
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].latestCardCompany, '현대카드');
  assert.equal(dump['tuitionPaymentReadIndexes/payment_month_26-07s'].payments.length, 2);
  assert.equal(dump['tuitionPaymentReadIndexes/daily_2026_07_15'].payments.length, 1);
  assert.ok(dump['tuitionPayments/tp_append-1']);
  assert.equal(dump['tuitionPayments/tp_append-1'].paymentType, '결제링크');
  assert.equal(dump['tuitionPayments/tp_append-1'].cardCompany, '현대카드');
});

test('first payment for a master-only student materializes a snapshot row', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T03:30:00.000Z') });
  const result = await handlers.appendTuitionPaymentEntry({
    monthName: seed.month, studentName: '신유진', dueDate: '26-07-01', amount: -200000,
    paidAt: '7/15', business: '반포', paymentType: '신한카드', approvalNo: '9999',
    clientRequestId: 'new-student-payment'
  }, { uid: 'staff-1', name: '관리자' });
  assert.equal(result.success, true, JSON.stringify(result));
  const row = store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows.find(item => item.studentName === '신유진');
  assert.equal(row.collectedAmount, 200000);
  assert.equal(row.paymentCount, 1);
  assert.equal(row.unpaidStatus, '납부완료');
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
  const payload = { monthName: seed.month, studentName: '김재희', guideAmount: 100000, unpaidStatus: '안내완료', contactChannel: '카톡', memo: '문자 안내', clientRequestId: 'followup-1' };
  const first = await handlers.saveTuitionFollowup(payload, { uid: 'staff-1', name: '관리자' });
  const second = await handlers.saveTuitionFollowup(payload, { uid: 'staff-1', name: '관리자' });
  assert.equal(first.success, true, JSON.stringify(first));
  assert.equal(first.contactCount, 1);
  assert.equal(second.duplicate, true);
  const dump = store.dump();
  assert.equal(dump[`tuitionFollowups/${followupId(seed.month, '김재희')}`].contactCount, 1);
  assert.equal(dump[`tuitionFollowups/${followupId(seed.month, '김재희')}`].contactChannel, '카톡');
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].contactCount, 1);
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].contactChannel, '카톡');
  assert.equal(dump['tuitionContactLogs/tl_followup-1'].contactChannel, '카톡');
});

test('first status save for a master-only student materializes a snapshot row', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T05:00:00.000Z') });
  const result = await handlers.saveTuitionStatusOnly({
    monthName: seed.month, studentName: '신유진', guideAmount: 0,
    unpaidStatus: '안내완료', clientRequestId: 'new-student-status'
  }, { uid: 'staff-1', name: '관리자' });
  assert.equal(result.success, true, JSON.stringify(result));
  const row = store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows.find(item => item.studentName === '신유진');
  assert.equal(row.guideAmount, 0);
  assert.equal(row.unpaidStatus, '안내완료');
});

test('tuition detail visibility persists in the monthly snapshot and excludes hidden students from KPIs', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T05:20:00.000Z') });
  const saved = await handlers.saveTuitionStatusOnly({
    monthName: seed.month,
    studentName: '김재희',
    guideAmount: 100000,
    unpaidStatus: '납부완료',
    hiddenFromTuition: true,
    clientRequestId: 'hide-student-1'
  }, { uid: 'staff-1', name: '관리자' });
  assert.equal(saved.success, true);
  assert.equal(saved.hiddenFromTuition, true);
  assert.equal(store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows[0].hiddenFromTuition, true);

  const summary = await handlers.getTuitionMonthSummary({ monthName: seed.month });
  assert.equal(summary.rows[0].hiddenFromTuition, true);
  assert.equal(summary.kpi.totalStudents, 0);
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
  assert.equal(result.adjustmentPayment.entryKind, 'adjustment');
  assert.equal(result.adjustmentPayment.countsAsPayment, false);
  assert.equal(result.adjustmentPayment.adjustmentForRequestId, 'existing-payment');
  const dump = store.dump();
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].guideAmount, 120000);
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].collectedAmount, 120000);
  assert.equal(dump['tuitionPayments/tp_adjust-1'].amount, -20000);
  assert.equal(dump['tuitionPayments/tp_adjust-1'].countsAsPayment, false);
  assert.equal(dump['tuitionPaymentReadIndexes/recent'].payments.length, 1);
  assert.equal(dump['tuitionPaymentReadIndexes/payment_month_26-07s'].payments.length, 2);
  assert.equal(dump['tuitionMonthSnapshots/tm_26-07s'].rows[0].paymentCount, 1);
});

test('first amount adjustment for a master-only student materializes a snapshot row', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T06:00:00.000Z') });
  const result = await handlers.saveTuitionAmountAdjustment({
    monthName: seed.month, studentName: '신유진', guideAmount: 300000, collectedAmount: 0,
    reason: '신규생 안내금액 등록', clientRequestId: 'new-student-adjustment'
  }, { uid: 'staff-1', name: '관리자' });
  assert.equal(result.success, true, JSON.stringify(result));
  const row = store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows.find(item => item.studentName === '신유진');
  assert.equal(row.guideAmount, 300000);
  assert.equal(row.collectedAmount, 0);
  assert.equal(row.outstandingAmount, 300000);
});
