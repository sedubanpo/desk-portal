import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTuitionHandlers } from '../src/tuition/handlers.js';
import { followupId, paidDateKey, paymentId, snapshotId, studentMemoId } from '../src/tuition/normalizers.js';

function clone(value) { return value == null ? value : structuredClone(value); }

function nestedValue(source, path) {
  return String(path || '').split('.').reduce((value, part) => value && value[part], source);
}

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
      const documentValue = nestedValue(document, field);
      if (operator === '==') return documentValue === value;
      if (operator === 'in') return Array.isArray(value) && value.includes(documentValue);
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

test('paid date parsing preserves full ISO dates before short month-day formats', () => {
  assert.equal(paidDateKey({ sourceDueMonth: '26-08s', paidAt: '2026-08-28', studentName: '김재희', amount: -1 }), '2026-08-28');
  assert.equal(paidDateKey({ sourceDueMonth: '26-08s', paidAt: '7/31', studentName: '김재희', amount: -1 }), '2026-07-31');
});

test('monthly sales overview exposes monthly growth, payer counts, and daily actual receipts', async () => {
  const seed = tuitionSeed();
  const second = {
    ...seed.payment,
    requestId: 'second-payment', studentName: '이서준', amount: -50000,
    paidAt: '2026-07-15', inputAt: '7/15 12:00', approvalNo: '5678'
  };
  const august = {
    ...seed.payment,
    requestId: 'august-payment', amount: -180000,
    paidAt: '2026-08-03', inputAt: '8/3 12:00', approvalNo: 'aug-1',
    sourceDueMonth: '26-08s', sourceMonth: '26-08s', originMonth: '26-08s'
  };
  seed.documents['tuitionMonthSnapshots/tm_26-07s'].payments = [seed.payment, second];
  seed.documents['tuitionMonthIndex/tmi_26-08s'] = { monthName: '26-08s' };
  seed.documents['tuitionMonthSnapshots/tm_26-08s'] = { success: true, selectedMonth: '26-08s', rows: [], payments: [august], allPayments: [august] };

  const result = await createTuitionHandlers({ store: memoryStore(seed.documents) }).getTuitionMonthlySalesOverview();

  assert.equal(result.success, true);
  assert.deepEqual(result.labels, ['26-07', '26-08']);
  assert.deepEqual(result.paidTotals, [150000, 180000]);
  assert.deepEqual(result.monthlyStats.map(item => ({ payerCount: item.payerCount, paymentCount: item.paymentCount, changePercent: item.changePercent })), [
    { payerCount: 2, paymentCount: 2, changePercent: null },
    { payerCount: 1, paymentCount: 1, changePercent: 20 }
  ]);
  assert.deepEqual(result.dailyPaid, [
    { dateKey: '2026-07-14', paidTotal: 100000, payerCount: 1, paymentCount: 1, studentNames: ['김재희'] },
    { dateKey: '2026-07-15', paidTotal: 50000, payerCount: 1, paymentCount: 1, studentNames: ['이서준'] },
    { dateKey: '2026-08-03', paidTotal: 180000, payerCount: 1, paymentCount: 1, studentNames: ['김재희'] }
  ]);
});

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

test('month summary prefers corrected recent payments over stale cross-month snapshot entries', async () => {
  const seed = tuitionSeed();
  const corrected = { ...seed.payment, amount: -80000, revision: 'correction-1', updatedAt: '2026-07-15T04:30:00.000Z' };
  seed.documents['tuitionMonthIndex/tmi_26-08s'] = { monthName: '26-08s' };
  seed.documents[`tuitionMonthSnapshots/${snapshotId('26-08s')}`] = {
    success: true,
    selectedMonth: '26-08s',
    rows: [],
    payments: [],
    allPayments: [seed.payment],
    todayPayments: [seed.payment]
  };
  seed.documents['tuitionPaymentReadIndexes/recent'] = { payments: [corrected], seeded: true };

  const result = await createTuitionHandlers({ store: memoryStore(seed.documents) })
    .getTuitionMonthSummary({ monthName: '26-08s' });

  assert.equal(result.success, true);
  assert.equal(result.allPayments.find(row => row.requestId === seed.payment.requestId)?.amount, -80000);
  assert.equal(result.allPayments.find(row => row.requestId === seed.payment.requestId)?.revision, 'correction-1');
  assert.equal(result.todayPayments.length, 1);
  assert.equal(result.todayPayments[0].amount, -80000);
});

test('legacy payment correction keeps one stable identity across month summaries', async () => {
  const seed = tuitionSeed();
  const legacy = { ...seed.payment };
  delete legacy.requestId;
  delete seed.documents[`tuitionPayments/${paymentId(seed.payment)}`];
  seed.documents[`tuitionPayments/${paymentId(legacy)}`] = legacy;
  seed.documents['tuitionPaymentReadIndexes/recent'].payments = [legacy];
  seed.documents['tuitionPaymentReadIndexes/payment_month_26-07s'].payments = [legacy];
  seed.documents['tuitionMonthSnapshots/tm_26-07s'].payments = [legacy];
  seed.documents['tuitionMonthSnapshots/tm_26-07s'].allPayments = [legacy];
  seed.documents['tuitionMonthSnapshots/tm_26-07s'].todayPayments = [legacy];
  seed.documents['tuitionMonthIndex/tmi_26-08s'] = { monthName: '26-08s' };
  seed.documents['tuitionMonthSnapshots/tm_26-08s'] = {
    success: true, selectedMonth: '26-08s', rows: [], payments: [],
    allPayments: [legacy], todayPayments: [legacy]
  };
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T04:30:00.000Z') });

  const corrected = await handlers.updateTuitionPaymentEntry({
    monthName: seed.month,
    payment: legacy,
    updatedPayment: { ...legacy, amount: -80000 },
    reason: '레거시 수납 금액 정정',
    clientRequestId: 'legacy-correction'
  }, { uid: 'staff-1', name: '관리자' });
  const august = await handlers.getTuitionMonthSummary({ monthName: '26-08s' });

  assert.equal(corrected.success, true, JSON.stringify(corrected));
  assert.equal(august.allPayments.length, 1);
  assert.equal(august.allPayments[0].amount, -80000);
  assert.equal(august.todayPayments.length, 1);
  assert.equal(august.todayPayments[0].amount, -80000);
});

test('month summary exposes every generated month with data for cross-month briefing', async () => {
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
  const septemberPayment = {
    dueDate: '26-09-01', studentName: '김도현', itemName: '납부금액', amount: -1400000,
    paidAt: '2026-08-28', business: '반포', paymentType: '결제링크', approvalNo: 'sep-1',
    inputAt: '2026-08-28 16:25', originMonth: '26-09s', sourceMonth: '26-09s', sourceDueMonth: '26-09s',
    requestId: 'september-payment', source: 'desk_portal'
  };
  seed.documents['tuitionMonthIndex/tmi_26-09s'] = { monthName: '26-09s' };
  seed.documents[`tuitionMonthSnapshots/${snapshotId('26-09s')}`] = {
    success: true,
    selectedMonth: '26-09s',
    rows: [{
      studentName: '김도현', school: '서울고', grade: '2', guideAmount: 1400000,
      collectedAmount: 1400000, outstandingAmount: 0, paymentCount: 1, unpaidStatus: '납부완료',
      contactCount: 1, lastContactAt: '2026-08-28T07:25:00.000Z', lastContactMemo: '', lastUpdatedAt: ''
    }],
    payments: [septemberPayment], allPayments: [septemberPayment], todayPayments: [septemberPayment]
  };
  seed.documents['tuitionPaymentReadIndexes/payment_month_26-09s'] = {
    monthName: '26-09s', payments: [septemberPayment], seeded: true
  };

  const result = await createTuitionHandlers({ store: memoryStore(seed.documents) })
    .getTuitionMonthSummary({ monthName: '26-08s' });

  assert.equal(result.success, true);
  assert.deepEqual(result.briefingMonths, ['26-09s', '26-08s', '26-07s']);
  assert.deepEqual(result.briefingPayments.map(row => row.requestId).sort(), ['august-payment', 'existing-payment', 'september-payment']);
  assert.deepEqual(result.briefingRows.map(row => row.sourceMonth).sort(), ['26-07s', '26-08s', '26-09s']);
  assert.equal(result.briefingPayments.find(row => row.requestId === 'september-payment')?.paidAt, '2026-08-28');
  assert.equal(result.briefingPayments.find(row => row.requestId === 'september-payment')?.inputAt, '2026-08-28 16:25');
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

test('payment update replaces one ledger entry and recalculates every payment index and snapshot', async () => {
  const seed = tuitionSeed();
  seed.documents['tuitionMonthlyReadIndexes/report_monthly_sales_Z2xvYmFs'] = { success: true };
  seed.documents['tuitionMonthlyReadIndexes/report_guide_dashboard_Z2xvYmFs'] = { success: true };
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T04:30:00.000Z') });
  const payload = {
    monthName: seed.month,
    payment: seed.payment,
    updatedPayment: {
      ...seed.payment,
      amount: -80000,
      paidAt: '7/15',
      paymentType: '서울페이',
      approvalNo: 'corrected-1'
    },
    reason: '승인 금액 오입력 정정',
    clientRequestId: 'update-1'
  };

  const first = await handlers.updateTuitionPaymentEntry(payload, { uid: 'staff-1', name: '관리자' });
  const second = await handlers.updateTuitionPaymentEntry(payload, { uid: 'staff-1', name: '관리자' });
  assert.equal(first.success, true, JSON.stringify(first));
  assert.equal(second.duplicate, true);

  const dump = store.dump();
  const snapshot = dump['tuitionMonthSnapshots/tm_26-07s'];
  assert.equal(snapshot.rows[0].collectedAmount, 80000);
  assert.equal(snapshot.rows[0].outstandingAmount, 20000);
  assert.equal(snapshot.rows[0].paymentCount, 1);
  assert.equal(snapshot.rows[0].unpaidStatus, '일부완료');
  assert.equal(snapshot.payments.length, 1);
  assert.equal(snapshot.payments[0].amount, -80000);
  assert.equal(snapshot.payments[0].paymentType, '서울페이');
  assert.equal(dump['tuitionPaymentReadIndexes/recent'].payments[0].amount, -80000);
  assert.equal(dump['tuitionPaymentReadIndexes/payment_month_26-07s'].payments[0].amount, -80000);
  assert.equal(dump['tuitionPaymentReadIndexes/daily_2026_07_14'], undefined);
  assert.equal(dump['tuitionPaymentReadIndexes/daily_2026_07_15'].payments[0].approvalNo, 'corrected-1');
  assert.equal(dump['tuitionPaymentChanges/tupd_update-1'].reason, '승인 금액 오입력 정정');
  assert.equal(dump['tuitionPaymentChanges/tupd_update-1'].previousPayment.amount, -100000);
  assert.equal(dump['tuitionMonthlyReadIndexes/report_monthly_sales_Z2xvYmFs'], undefined);
  assert.equal(dump['tuitionMonthlyReadIndexes/report_guide_dashboard_Z2xvYmFs'], undefined);
});

test('payment update ignores harmless canonical timestamp drift from the monthly snapshot', async () => {
  const seed = tuitionSeed();
  const canonicalKey = `tuitionPayments/${paymentId(seed.payment)}`;
  seed.documents[canonicalKey] = {
    ...seed.payment,
    createdAt: '2026-07-14T03:00:00.000Z',
    updatedAt: '2026-07-14T03:00:00.055Z'
  };
  seed.documents['tuitionMonthSnapshots/tm_26-07s'].payments[0] = {
    ...seed.payment,
    createdAt: '2026-07-14T03:00:00.000Z',
    updatedAt: '2026-07-14T03:00:00.000Z'
  };
  const requested = seed.documents['tuitionMonthSnapshots/tm_26-07s'].payments[0];
  const store = memoryStore(seed.documents);
  const result = await createTuitionHandlers({ store, now: () => new Date('2026-07-15T04:30:00.000Z') })
    .updateTuitionPaymentEntry({
      monthName: seed.month,
      payment: requested,
      updatedPayment: { ...requested, amount: -80000 },
      reason: '승인 금액 정정',
      clientRequestId: 'timestamp-drift-update'
    }, { uid: 'staff-1', name: '관리자' });

  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.payment.amount, -80000);
  assert.equal(store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows[0].collectedAmount, 80000);
});

test('payment update rejects semantic drift even when the legacy payment has no revision', async () => {
  const seed = tuitionSeed();
  const canonicalKey = `tuitionPayments/${paymentId(seed.payment)}`;
  seed.documents[canonicalKey] = {
    ...seed.payment,
    entryKind: 'adjustment',
    countsAsPayment: false,
    source: 'desk_portal_adjustment'
  };
  const store = memoryStore(seed.documents);
  const result = await createTuitionHandlers({ store })
    .updateTuitionPaymentEntry({
      monthName: seed.month,
      payment: seed.payment,
      updatedPayment: { ...seed.payment, amount: -80000 },
      reason: '오래 열린 화면의 정정',
      clientRequestId: 'semantic-drift-update'
    }, { uid: 'staff-1', name: '관리자' });

  assert.equal(result.success, false);
  assert.match(result.message, /변경되었습니다/);
  assert.equal(store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows[0].paymentCount, 1);
});

test('payment delete rejects a stale row after a concurrent correction', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T04:30:00.000Z') });
  const corrected = await handlers.updateTuitionPaymentEntry({
    monthName: seed.month,
    payment: seed.payment,
    updatedPayment: { ...seed.payment, amount: -80000, paidAt: '7/15' },
    reason: '결제 금액 정정',
    clientRequestId: 'delete-race-update'
  }, { uid: 'staff-1', name: '관리자' });
  const deleted = await handlers.deleteTuitionPaymentEntry({
    monthName: seed.month,
    payment: seed.payment,
    reason: '오래 열린 화면에서 삭제',
    clientRequestId: 'stale-delete'
  }, { uid: 'staff-2', name: '다른 관리자' });
  const dump = store.dump();

  assert.equal(corrected.success, true, JSON.stringify(corrected));
  assert.equal(deleted.success, false);
  assert.match(deleted.message, /변경되었습니다/);
  assert.equal(dump[`tuitionPayments/${paymentId(corrected.payment)}`].amount, -80000);
  assert.equal(dump['tuitionPaymentReadIndexes/daily_2026_07_15'].payments.length, 1);
});

test('payment history includes the original input and timestamped correction details', async () => {
  const seed = tuitionSeed();
  seed.documents[`tuitionPayments/${paymentId(seed.payment)}`] = {
    ...seed.payment,
    createdAt: '2026-07-14T03:00:00.000Z',
    updatedAt: '2026-07-14T03:00:00.000Z'
  };
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T04:30:00.000Z') });
  const corrected = await handlers.updateTuitionPaymentEntry({
    monthName: seed.month,
    payment: seed.payment,
    updatedPayment: { ...seed.payment, amount: -80000, paymentType: '서울페이' },
    reason: '결제 금액과 수단 정정',
    clientRequestId: 'history-update-1'
  }, { uid: 'staff-1', name: '관리자' });
  const history = await handlers.getTuitionPaymentHistory({ payment: corrected.payment });

  assert.equal(corrected.success, true, JSON.stringify(corrected));
  assert.equal(history.success, true, JSON.stringify(history));
  assert.deepEqual(history.events.map(event => event.action), ['updated', 'created']);
  assert.equal(history.events[0].changedAt, '2026-07-15T04:30:00.000Z');
  assert.equal(history.events[0].actorName, '관리자');
  assert.equal(history.events[0].reason, '결제 금액과 수단 정정');
  assert.equal(history.events[0].previousPayment.amount, -100000);
  assert.equal(history.events[0].payment.amount, -80000);
  assert.equal(history.events[1].changedAt, '2026-07-14T03:00:00.000Z');
  assert.equal(history.events[1].actorName, '기존 기록');
  assert.equal(history.historyComplete, true);
});

test('payment history finds the matching legacy audit beyond the first 500 global documents', async () => {
  const seed = tuitionSeed();
  for (let index = 0; index < 501; index += 1) {
    seed.documents[`tuitionPaymentChanges/a-${String(index).padStart(3, '0')}`] = {
      requestId: `other-${index}`,
      previousPayment: { ...seed.payment, requestId: `other-${index}`, studentName: `다른학생${index}` },
      updatedPayment: { ...seed.payment, requestId: `other-${index}`, studentName: `다른학생${index}` }
    };
  }
  seed.documents['tuitionPaymentChanges/z-target'] = {
    requestId: 'legacy-target-update',
    changedAt: '2026-07-15T04:30:00.000Z',
    reason: '기존 수정 기록',
    actorName: '관리자',
    previousPayment: seed.payment,
    updatedPayment: { ...seed.payment, amount: -80000 }
  };
  const store = memoryStore(seed.documents);
  const history = await createTuitionHandlers({ store }).getTuitionPaymentHistory({ payment: seed.payment });

  assert.equal(history.success, true, JSON.stringify(history));
  assert.deepEqual(history.events.map(event => event.action), ['updated', 'created']);
  assert.equal(history.events[0].payment.amount, -80000);
});

test('payment update rejects a stale editor even after an A to B to A correction cycle', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const handlers = createTuitionHandlers({ store, now: () => new Date('2026-07-15T04:40:00.000Z') });
  const first = await handlers.updateTuitionPaymentEntry({
    monthName: seed.month,
    payment: seed.payment,
    updatedPayment: { ...seed.payment, amount: -80000 },
    reason: '첫 번째 정정',
    clientRequestId: 'update-current'
  }, { uid: 'staff-1', name: '관리자' });
  const reverted = await handlers.updateTuitionPaymentEntry({
    monthName: seed.month,
    payment: first.payment,
    updatedPayment: { ...first.payment, amount: -100000 },
    reason: '원래 금액으로 재정정',
    clientRequestId: 'update-reverted'
  }, { uid: 'staff-1', name: '관리자' });
  const stale = await handlers.updateTuitionPaymentEntry({
    monthName: seed.month,
    payment: seed.payment,
    updatedPayment: { ...seed.payment, amount: -70000 },
    reason: '오래 열린 화면의 정정',
    clientRequestId: 'update-stale'
  }, { uid: 'staff-2', name: '다른 관리자' });

  assert.equal(first.success, true);
  assert.equal(reverted.success, true);
  assert.equal(stale.success, false);
  assert.match(stale.message, /변경되었습니다/);
  assert.equal(store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows[0].collectedAmount, 100000);
  assert.equal(store.dump()['tuitionPaymentChanges/tupd_update-stale'], undefined);
});

test('payment update rejects a selected month that differs from the payment source month', async () => {
  const seed = tuitionSeed();
  const store = memoryStore(seed.documents);
  const result = await createTuitionHandlers({ store }).updateTuitionPaymentEntry({
    monthName: '26-08s',
    payment: seed.payment,
    updatedPayment: { ...seed.payment, amount: -80000 },
    reason: '잘못된 월 요청',
    clientRequestId: 'update-wrong-month'
  }, { uid: 'staff-1', name: '관리자' });

  assert.equal(result.success, false);
  assert.match(result.message, /원본 월과 수정 월/);
  assert.equal(store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows[0].collectedAmount, 100000);
  assert.equal(store.dump()['tuitionMonthSnapshots/tm_26-08s'], undefined);
});

test('payment update aborts without writes when the monthly snapshot cannot be updated', async () => {
  const seed = tuitionSeed();
  delete seed.documents['tuitionMonthSnapshots/tm_26-07s'];
  const store = memoryStore(seed.documents);
  const result = await createTuitionHandlers({ store }).updateTuitionPaymentEntry({
    monthName: seed.month,
    payment: seed.payment,
    updatedPayment: { ...seed.payment, amount: -80000 },
    reason: '스냅샷 누락 검증',
    clientRequestId: 'update-without-snapshot'
  }, { uid: 'staff-1', name: '관리자' });

  assert.equal(result.success, false);
  assert.match(result.message, /수정을 중단/);
  assert.equal(store.dump()[`tuitionPayments/${paymentId(seed.payment)}`].amount, -100000);
  assert.equal(store.dump()['tuitionPaymentReadIndexes/payment_month_26-07s'].payments[0].amount, -100000);
  assert.equal(store.dump()['tuitionPaymentChanges/tupd_update-without-snapshot'], undefined);
});

test('payment update aborts when the target is missing from the source month payment list', async () => {
  const seed = tuitionSeed();
  seed.documents['tuitionMonthSnapshots/tm_26-07s'].payments = [];
  const store = memoryStore(seed.documents);
  const result = await createTuitionHandlers({ store }).updateTuitionPaymentEntry({
    monthName: seed.month,
    payment: seed.payment,
    updatedPayment: { ...seed.payment, amount: -80000 },
    reason: '부분 스냅샷 검증',
    clientRequestId: 'update-partial-snapshot'
  }, { uid: 'staff-1', name: '관리자' });

  assert.equal(result.success, false);
  assert.match(result.message, /수정을 중단/);
  assert.equal(store.dump()[`tuitionPayments/${paymentId(seed.payment)}`].amount, -100000);
  assert.equal(store.dump()['tuitionMonthSnapshots/tm_26-07s'].rows[0].collectedAmount, 100000);
  assert.equal(store.dump()['tuitionPaymentChanges/tupd_update-partial-snapshot'], undefined);
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
