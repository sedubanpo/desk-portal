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
    catch (error) { return successFailure(`${name === 'getPayrollMonthSummary' ? '정산 데이터 계산' : '급여 처리'} 오류: ${error.message}`); }
  }]));
}
