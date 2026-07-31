import {
  applyPayrollSettingsUpdates,
  buildPayrollSummary,
  mergePayrollOverrideBundles,
  normalizePayrollOverrideBundle,
  parsePayrollMonthName,
  parsePayrollRows,
  payrollOptions,
  payrollOverrideSignature,
  payrollSourceVersion
} from './normalizers.js';

export const PAYROLL_METHODS = Object.freeze([
  'getPayrollBootstrapData',
  'getPayrollMonthSummary',
  'getPayrollMonthlyAnalysis',
  'getPayrollSettings',
  'savePayrollSettings',
  'savePayrollOverrides'
]);

export const PAYROLL_WRITE_METHODS = Object.freeze([
  'savePayrollSettings',
  'savePayrollOverrides'
]);

function successFailure(message) { return { success: false, message }; }
function requestId(payload) { return String(payload?.clientRequestId || '').replace(/[^\w:.-]/g, '').slice(0, 120); }

export function createPayrollHandlers({ store, sheets, now = () => new Date() }) {
  if (!store || !sheets) throw new TypeError('payroll store and sheets reader are required.');

  const handlers = {
    async getPayrollBootstrapData() {
      const months = await sheets.listPayrollMonths();
      return months.length
        ? { success: true, months, selectedMonth: months[0], source: 'google-sheets-api' }
        : successFailure('급여 정산 월 탭(예: 26-02)을 찾을 수 없습니다.');
    },

    async getPayrollSettings() {
      return { success: true, settings: await store.getSettings(), source: 'firestore' };
    },

    async getPayrollMonthSummary(payload = {}) {
      const months = await sheets.listPayrollMonths();
      if (!months.length) return successFailure('급여 정산 월 탭(예: 26-02)을 찾을 수 없습니다.');
      const monthName = String(payload.monthName || months[0]).trim();
      const monthMeta = parsePayrollMonthName(monthName);
      if (!monthMeta) return successFailure(`월 탭 이름 형식이 올바르지 않습니다: ${monthName}`);
      if (!months.includes(monthName)) return successFailure(`선택한 월 탭을 찾을 수 없습니다: ${monthName}`);
      const [source, settings, savedOverrides] = await Promise.all([
        sheets.readPayrollMonth(monthName),
        store.getSettings(),
        store.getOverrides(monthName)
      ]);
      const requestedOverrides = normalizePayrollOverrideBundle(payload);
      const effectiveOverrides = mergePayrollOverrideBundles(savedOverrides, requestedOverrides);
      const rows = parsePayrollRows(source, monthMeta);
      const summary = buildPayrollSummary(rows, monthMeta, payrollOptions(payload, settings, effectiveOverrides));
      return {
        ...summary,
        success: true,
        selectedMonth: monthName,
        monthLabel: `${monthMeta.year}년 ${monthMeta.month}월`,
        salaryMode: payrollOptions(payload, settings, effectiveOverrides).salaryMode,
        ratioPercent: payrollOptions(payload, settings, effectiveOverrides).ratioPercent,
        hourlyRate: payrollOptions(payload, settings, effectiveOverrides).hourlyRate,
        months,
        savedOverrides: effectiveOverrides,
        overrideSignature: payrollOverrideSignature(effectiveOverrides),
        cache: { source: 'google-sheets-api', hit: false, sheetVersion: payrollSourceVersion(source), forceRefresh: Boolean(payload.forceRefresh) }
      };
    },

    async getPayrollMonthlyAnalysis(payload = {}) {
      const months = await sheets.listPayrollMonths();
      if (!months.length) return successFailure('급여 정산 월 탭(예: 26-02)을 찾을 수 없습니다.');
      const limit = Math.min(24, Math.max(1, Math.trunc(Number(payload.limit) || 12)));
      const selectedMonths = months.slice(0, limit);
      const settings = await store.getSettings();
      const calculationPayload = {
        ratioPercent: payload.ratioPercent,
        hourlyRate: payload.hourlyRate
      };
      const results = await Promise.all(selectedMonths.map(async monthName => {
        try {
          const monthMeta = parsePayrollMonthName(monthName);
          if (!monthMeta) throw new Error('invalid month tab name');
          const [source, overrides] = await Promise.all([
            sheets.readPayrollMonth(monthName),
            store.getOverrides(monthName)
          ]);
          const parsedRows = parsePayrollRows(source, monthMeta);
          const summary = buildPayrollSummary(parsedRows, monthMeta, payrollOptions(calculationPayload, settings, overrides));
          const kpi = summary.kpi || {};
          const teacherCount = new Set((summary.rows || [])
            .filter(row => row.recognized && row.teacher)
            .map(row => row.teacher)).size;
          const netSales = Math.round(Number(kpi.netSales) || 0);
          const estimatedPay = Math.round(Number(kpi.estimatedPay) || 0);
          return { row: {
            monthName,
            monthLabel: `${monthMeta.year}년 ${monthMeta.month}월`,
            grossSales: Math.round(Number(kpi.grossSales) || 0),
            discount: Math.round(Number(kpi.discount) || 0),
            netSales,
            estimatedPay,
            balanceAfterTeacherPay: netSales - estimatedPay,
            teacherPayRate: netSales > 0 ? Math.round((estimatedPay / netSales) * 1000) / 10 : null,
            recognizedHours: Number(kpi.recognizedHours) || 0,
            pureTeachingHours: Number(kpi.pureTeachingHours) || 0,
            recognizedLessons: Number(kpi.recognizedLessons) || 0,
            canceledAmount: Math.round(Number(kpi.canceledAmount) || 0),
            teacherCount
          } };
        } catch (error) {
          return { failure: { monthName, message: String(error?.message || error) } };
        }
      }));
      const rows = results.filter(result => result.row).map(result => result.row);
      const failedMonths = results.filter(result => result.failure).map(result => result.failure);
      if (!rows.length) return successFailure('월별 정산 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      rows.reverse();
      return {
        success: true,
        rows,
        months,
        failedMonths,
        scope: 'all-teachers-unfiltered',
        ruleBasis: 'current-saved-teacher-settings',
        ratioPercent: payrollOptions(calculationPayload, settings, {}).ratioPercent,
        hourlyRate: payrollOptions(calculationPayload, settings, {}).hourlyRate,
        source: 'google-sheets-api',
        generatedAt: now().toISOString()
      };
    },

    async savePayrollSettings(payload = {}, identity = {}) {
      const clientRequestId = requestId(payload);
      if (!clientRequestId) return successFailure('저장 요청 식별자가 없습니다. 다시 시도해 주세요.');
      const timestamp = now().toISOString();
      return store.saveSettings({
        requestId: clientRequestId,
        payload,
        identity,
        nowIso: timestamp,
        mutate: current => applyPayrollSettingsUpdates(current, payload, timestamp)
      });
    },

    async savePayrollOverrides(payload = {}, identity = {}) {
      const monthName = String(payload.monthName || '').trim();
      if (!parsePayrollMonthName(monthName)) return successFailure(`월 탭 이름 형식이 올바르지 않습니다: ${monthName}`);
      const clientRequestId = requestId(payload);
      if (!clientRequestId) return successFailure('저장 요청 식별자가 없습니다. 다시 시도해 주세요.');
      const result = await store.saveOverrides({ requestId: clientRequestId, monthName, overrides: payload, identity, nowIso: now().toISOString() });
      return { ...result, overrideSignature: payrollOverrideSignature(result.overrides) };
    }
  };

  return Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [name, async (payload, identity) => {
    try { return await handler(payload, identity); }
    catch (error) { return successFailure(`${/^getPayrollMonth/.test(name) ? '정산 데이터 계산' : '급여 처리'} 오류: ${error.message}`); }
  }]));
}
