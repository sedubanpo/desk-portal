import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPayrollHandlers } from '../src/payroll/handlers.js';
import { buildPayrollSummary, parsePayrollMonthName, parsePayrollRows } from '../src/payroll/normalizers.js';

const source = {
  headers: ['이름', '수업일', '반명', '출결', '관', 'tr', '시작', '종료', '시간', '시간당', '금액', '참고', '할인'],
  values: [
    ['김학생', '7/1', '수학-1:1', '출석', '반포', '김강사', '10:00', '12:00', '2', '100000', '200000', '', ''],
    ['이학생', '7/1', '수학-정규', '출석', '반포', '김강사', '11:00', '13:00', '2', '100000', '200000', '', ''],
    ['박학생', '7/2', '수학-정규', '당일취소', '반포', '김강사', '10:00', '12:00', '2', '100000', '200000', '', '']
  ]
};

function memoryStore(initial = {}) {
  let settings = initial.settings || {};
  const overrides = new Map(Object.entries(initial.overrides || {}));
  const audits = new Map();
  return {
    async getSettings() { return structuredClone(settings); },
    async getOverrides(month) { return structuredClone(overrides.get(month) || {}); },
    async saveSettings({ requestId, payload, identity, mutate }) {
      if (audits.has(requestId)) return { ...structuredClone(audits.get(requestId)), duplicate: true };
      settings = mutate(settings);
      const result = { success: true, settings: structuredClone(settings), actor: identity.uid, updateCount: payload.updates.length };
      audits.set(requestId, result);
      return result;
    },
    async saveOverrides({ requestId, monthName, overrides: next }) {
      if (audits.has(requestId)) return { ...structuredClone(audits.get(requestId)), duplicate: true };
      overrides.set(monthName, structuredClone(next));
      const result = { success: true, monthName, overrides: structuredClone(next) };
      audits.set(requestId, result);
      return result;
    }
  };
}

function sheets() {
  return {
    async listPayrollMonths() { return ['26-07', '26-06']; },
    async readPayrollMonth(month) { assert.equal(month, '26-07'); return structuredClone(source); }
  };
}

test('payroll parser and ratio summary preserve recognition, overlap, and cancellation rules', () => {
  const meta = parsePayrollMonthName('26-07');
  const rows = parsePayrollRows(source, meta);
  const summary = buildPayrollSummary(rows, meta, {
    salaryMode: 'ratio', ratioPercent: 50, hourlyRate: 30000,
    teacherSettings: {}, effectiveOverrides: {}
  });
  assert.equal(rows.length, 3);
  assert.equal(summary.kpi.recognizedLessons, 2);
  assert.equal(summary.kpi.recognizedHours, 4);
  assert.equal(summary.kpi.pureTeachingHours, 3);
  assert.equal(summary.kpi.netSales, 400000);
  assert.equal(summary.kpi.canceledAmount, 200000);
  assert.equal(summary.kpi.estimatedPay, 200000);
  assert.equal(summary.rows.find(row => row.name === '박학생').recognized, false);
});

test('amount overrides recalculate gross, net, teacher pay, and canceled totals', () => {
  const meta = parsePayrollMonthName('26-07');
  const rows = parsePayrollRows(source, meta);
  const recognizedRow = rows.find(row => row.name === '김학생');
  const canceledRow = rows.find(row => row.name === '박학생');
  const summary = buildPayrollSummary(rows, meta, {
    salaryMode: 'ratio', ratioPercent: 50, hourlyRate: 30000,
    teacherSettings: {},
    effectiveOverrides: {
      amountOverrides: [
        { rowKey: recognizedRow.rowKey, amount: 25000 },
        { rowKey: canceledRow.rowKey, amount: 0 }
      ]
    }
  });

  assert.equal(summary.kpi.grossSales, 225000);
  assert.equal(summary.kpi.netSales, 225000);
  assert.equal(summary.kpi.estimatedPay, 112500);
  assert.equal(summary.kpi.canceledAmount, 0);
  assert.equal(summary.rows.find(row => row.name === '김학생').amount, 25000);
  assert.equal(summary.rows.find(row => row.name === '김학생').amountManuallyOverridden, true);
  assert.equal(summary.rows.find(row => row.name === '박학생').amountManuallyOverridden, true);
});

test('all-teacher summary applies each teacher pay mode and keeps their overlapping hours separate', () => {
  const mixedSource = {
    headers: source.headers,
    values: [
      ['비율학생', '7/1', '수학-정규', '출석', '반포', '비율강사', '10:00', '12:00', '2', '100000', '200000', '', ''],
      ['시급학생', '7/1', '영어-정규', '출석', '반포', '시급강사', '10:00', '12:00', '2', '100000', '200000', '', ''],
      ['시급학생2', '7/1', '국어-정규', '출석', '반포', '시급강사2', '10:00', '12:00', '2', '100000', '200000', '', '']
    ]
  };
  const meta = parsePayrollMonthName('26-07');
  const summary = buildPayrollSummary(parsePayrollRows(mixedSource, meta), meta, {
    salaryMode: 'ratio', ratioPercent: 50, hourlyRate: 30000,
    teacherSettings: {
      '비율강사': { salaryMode: 'ratio' },
      '시급강사': { salaryMode: 'hourly', hourlyRate: 40000 },
      '시급강사2': { salaryMode: 'hourly', hourlyRate: 40000 }
    },
    effectiveOverrides: {}
  });
  assert.equal(summary.kpi.pureTeachingHours, 6);
  assert.equal(summary.kpi.ratioPay, 100000);
  assert.equal(summary.kpi.hourlyPay, 160000);
  assert.equal(summary.kpi.estimatedPay, 260000);
  assert.equal(summary.kpi.mixedTeacherModes, true);
});

test('payroll month handler reads Google Sheets and returns the legacy response shape', async () => {
  const handlers = createPayrollHandlers({ store: memoryStore(), sheets: sheets(), now: () => new Date('2026-07-15T05:00:00Z') });
  const response = await handlers.getPayrollMonthSummary({ monthName: '26-07', salaryMode: 'ratio', ratioPercent: 50 });
  assert.equal(response.success, true);
  assert.deepEqual(response.months, ['26-07', '26-06']);
  assert.equal(response.selectedMonth, '26-07');
  assert.equal(response.cache.source, 'google-sheets-api');
  assert.equal(response.rows.length, 3);
  assert.ok(response.calendar.weeks.every(Array.isArray));
  assert.ok(Array.isArray(response.teacherGroups));
  assert.ok(response.overrideSignature);
});

test('monthly analysis loads each month without screen filters and returns teacher-pay balances', async () => {
  const monthSources = {
    '26-07': source,
    '26-06': {
      headers: source.headers,
      values: [
        ['윤학생', '6/3', '영어-정규', '출석', '반포', '시급강사', '10:00', '12:00', '2', '100000', '200000', '', '10%']
      ]
    }
  };
  const handlers = createPayrollHandlers({
    store: memoryStore({ settings: {
      '김강사': { salaryMode: 'ratio' },
      '시급강사': { salaryMode: 'hourly', hourlyRate: 40000 }
    } }),
    sheets: {
      async listPayrollMonths() { return ['26-07', '26-06']; },
      async readPayrollMonth(month) { return structuredClone(monthSources[month]); }
    },
    now: () => new Date('2026-07-31T12:00:00Z')
  });

  const response = await handlers.getPayrollMonthlyAnalysis({ limit: 12, teacherName: '무시할화면필터', ratioPercent: 60, hourlyRate: 30000 });
  assert.equal(response.success, true);
  assert.equal(response.scope, 'all-teachers-unfiltered');
  assert.deepEqual(response.rows.map(row => row.monthName), ['26-06', '26-07']);
  assert.deepEqual(response.rows[0], {
    monthName: '26-06', monthLabel: '2026년 6월', grossSales: 200000, discount: 20000,
    netSales: 180000, estimatedPay: 80000, balanceAfterTeacherPay: 100000,
    teacherPayRate: 44.4, recognizedHours: 2, pureTeachingHours: 2,
    recognizedLessons: 1, canceledAmount: 0, teacherCount: 1
  });
  assert.equal(response.rows[1].netSales, 400000);
  assert.equal(response.rows[1].estimatedPay, 240000);
  assert.equal(response.rows[1].canceledAmount, 200000);
  assert.equal(response.ratioPercent, 60);
  assert.equal(response.ruleBasis, 'current-saved-teacher-settings');
  assert.deepEqual(response.failedMonths, []);
});

test('monthly analysis preserves healthy months and marks a zero-net pay rate as unavailable', async () => {
  const handlers = createPayrollHandlers({
    store: memoryStore({ settings: { '시급강사': { salaryMode: 'hourly', hourlyRate: 40000 } } }),
    sheets: {
      async listPayrollMonths() { return ['26-07', '26-06']; },
      async readPayrollMonth(month) {
        if (month === '26-06') throw new Error('temporary Sheets failure');
        return {
          headers: source.headers,
          values: [['무료학생', '7/1', '영어-정규', '출석', '반포', '시급강사', '10:00', '12:00', '2', '0', '0', '', '']]
        };
      }
    }
  });

  const response = await handlers.getPayrollMonthlyAnalysis({ limit: 12 });
  assert.equal(response.success, true);
  assert.equal(response.rows.length, 1);
  assert.equal(response.rows[0].estimatedPay, 80000);
  assert.equal(response.rows[0].balanceAfterTeacherPay, -80000);
  assert.equal(response.rows[0].teacherPayRate, null);
  assert.deepEqual(response.failedMonths.map(item => item.monthName), ['26-06']);
});

test('settings and overrides replay the same business request without a second mutation', async () => {
  const store = memoryStore();
  const handlers = createPayrollHandlers({ store, sheets: sheets(), now: () => new Date('2026-07-15T05:00:00Z') });
  const payload = {
    clientRequestId: 'settings-1', monthName: '26-07',
    updates: [{ teacher: '김강사', salaryMode: 'hourly', hourlyRate: 50000, paid: true }]
  };
  const first = await handlers.savePayrollSettings(payload, { uid: 'admin-1', name: '관리자' });
  const replay = await handlers.savePayrollSettings(payload, { uid: 'admin-1', name: '관리자' });
  assert.equal(first.settings['김강사'].hourlyRate, 50000);
  assert.equal(first.settings['김강사'].paidByMonth['26-07'], true);
  assert.equal(replay.duplicate, true);

  const overridePayload = {
    clientRequestId: 'override-1', monthName: '26-07',
    freeIncludedRowKeys: ['26-07:2:test'],
    amountOverrides: [{ rowKey: '26-07:2:test', amount: 25000 }]
  };
  const saved = await handlers.savePayrollOverrides(overridePayload, { uid: 'admin-1' });
  const duplicate = await handlers.savePayrollOverrides(overridePayload, { uid: 'admin-1' });
  assert.deepEqual(saved.overrides.freeIncludedRowKeys, ['26-07:2:test']);
  assert.deepEqual(saved.overrides.amountOverrides, [{ rowKey: '26-07:2:test', amount: 25000 }]);
  assert.equal(duplicate.duplicate, true);
});

test('invalid month and missing request ids fail before touching storage', async () => {
  const handlers = createPayrollHandlers({ store: memoryStore(), sheets: sheets() });
  assert.equal((await handlers.getPayrollMonthSummary({ monthName: '26-13' })).success, false);
  assert.match((await handlers.savePayrollOverrides({ monthName: '26-07' }, {})).message, /요청 식별자/);
  assert.match((await handlers.savePayrollSettings({ updates: [] }, {})).message, /요청 식별자/);
});
