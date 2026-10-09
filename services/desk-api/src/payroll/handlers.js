import { createHash } from 'node:crypto';
import { WORKFORCE_METHODS, WORKFORCE_WRITES } from './workforce.js';
import { isIntranetMonth, payrollMonths } from './intranet.js';
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
  ...WORKFORCE_METHODS,
  'getPayrollWorkbookExport',
  'getPayrollBootstrapData',
  'getPayrollMonthSummary',
  'getPayrollMonthlyAnalysis',
  'getPayrollSettings',
  'getPayrollFinalizations',
  'savePayrollFinalization',
  'savePayrollSettings',
  'savePayrollOverrides'
]);

export const PAYROLL_WRITE_METHODS = Object.freeze([
  'savePayrollFinalization',
  ...WORKFORCE_WRITES,
  'savePayrollSettings',
  'savePayrollOverrides'
]);

function calculationVersion(settings, summary) { return createHash('sha256').update(JSON.stringify({settings,kpi:summary.kpi,rows:summary.rows.map(r=>[r.rowKey,r.recognized,r.netAmount,r.recognizedHours,r.settlementPercentApplied,r.effectiveHourlyRate])})).digest('hex'); }

function successFailure(message) { return { success: false, message }; }
function requestId(payload) { return String(payload?.clientRequestId || '').replace(/[^\w:.-]/g, '').slice(0, 120); }

export function createPayrollHandlers({ store, sheets, intranet, now = () => new Date() }) {
  if (!store || !sheets) throw new TypeError('payroll store and sheets reader are required.');

  const listMonths = async () => {
    const legacy = await sheets.listPayrollMonths().catch(error => { if (!intranet) throw error; return []; });
    return intranet ? payrollMonths(legacy,now()) : legacy;
  };
  const readSource = async (name) => {
    if (isIntranetMonth(name)) {
      if (!intranet) throw new Error('인트라넷 데이터 연결이 설정되지 않았습니다.');
      const source = await intranet.readMonth(name);
      return {...source, sourceName:'intranet'};
    }
    const source = await sheets.readPayrollMonth(name);
    return {rows:parsePayrollRows(source,parsePayrollMonthName(name)),version:payrollSourceVersion(source),sourceName:'google-sheets-api'};
  };
  const handlers = {
    async readExportMonth(monthName) {
      const meta=parsePayrollMonthName(monthName);
      if(!meta || !(await listMonths()).includes(monthName))throw new Error('선택 월의 정산 자료가 없습니다.');
      const [source,settings,overrides]=await Promise.all([readSource(monthName),store.getSettings(),store.getOverrides(monthName)]);
      const options=payrollOptions({},settings,overrides);
      const summary=buildPayrollSummary(source.rows,meta,options);
      const teachers=[...new Set(source.rows.map(r=>r.teacher).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko')).map(name=>{
        const own=buildPayrollSummary(source.rows,meta,{...options,teacherName:name});
        return {name,subject:[...new Set(own.rows.map(r=>r.subject).filter(Boolean))].join(', '),settings:settings[name]||null,kpi:own.kpi,gross:own.rows.filter(r=>!r.sourcePending).reduce((n,r)=>n+r.amount,0),pending:own.rows.some(r=>r.sourcePending)};
      });
      return {summary,teachers};
    },
    async getPayrollBootstrapData() {
      const months = await listMonths();
      return months.length
        ? { success: true, months, selectedMonth: months[0], source: isIntranetMonth(months[0]) ? 'intranet' : 'google-sheets-api' }
        : successFailure('급여 정산 월 탭(예: 26-02)을 찾을 수 없습니다.');
    },

    async getPayrollSettings() {
      return { success: true, settings: await store.getSettings(), source: 'firestore' };
    },

    async getPayrollMonthSummary(payload = {}) {
      const months = await listMonths();
      if (!months.length) return successFailure('급여 정산 월 탭(예: 26-02)을 찾을 수 없습니다.');
      const monthName = String(payload.monthName || months[0]).trim();
      const monthMeta = parsePayrollMonthName(monthName);
      if (!monthMeta) return successFailure(`월 탭 이름 형식이 올바르지 않습니다: ${monthName}`);
      if (!months.includes(monthName)) return successFailure(`선택한 월 탭을 찾을 수 없습니다: ${monthName}`);
      const [source, settings, savedOverrides] = await Promise.all([
        readSource(monthName),
        store.getSettings(),
        store.getOverrides(monthName)
      ]);
      const requestedOverrides = normalizePayrollOverrideBundle(payload);
      const effectiveOverrides = mergePayrollOverrideBundles(savedOverrides, requestedOverrides);
      const rows = source.rows;
      const summary = buildPayrollSummary(rows, monthMeta, payrollOptions(payload, settings, effectiveOverrides));
      return {
        ...summary,
        success: true,
        finalizationVersion: calculationVersion(settings,summary),
        selectedMonth: monthName,
        monthLabel: `${monthMeta.year}년 ${monthMeta.month}월`,
        salaryMode: payrollOptions(payload, settings, effectiveOverrides).salaryMode,
        ratioPercent: payrollOptions(payload, settings, effectiveOverrides).ratioPercent,
        hourlyRate: payrollOptions(payload, settings, effectiveOverrides).hourlyRate,
        months,
        savedOverrides: effectiveOverrides,
        overrideSignature: payrollOverrideSignature(effectiveOverrides),
        teacherSettings: settings,
        sourcePendingCount: rows.filter(row => row.sourcePending).length,
        sourcePendingRows: rows.filter(row => row.sourcePending).map(({name,teacher,classDateKey,start,end,attendanceCode,sourcePendingReason,studentId,lessonId})=>({name,teacher,classDateKey,start,end,attendanceCode,sourcePendingReason,studentId,lessonId})),
        cache: { source: source.sourceName, hit: false, sheetVersion: source.version, forceRefresh: Boolean(payload.forceRefresh) }
      };
    },

    async getPayrollMonthlyAnalysis(payload = {}) {
      const months = await listMonths();
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
            readSource(monthName),
            store.getOverrides(monthName)
          ]);
          const parsedRows = source.rows;
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
            absenceEstimatedAmount: kpi.absenceEstimatedAmount ?? null,
            absenceUnknownCount: Number(kpi.absenceUnknownCount) || 0,
            sourcePendingCount: parsedRows.filter(row=>row.sourcePending).length,
            source: source.sourceName,
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
        source: 'month-dependent',
        generatedAt: now().toISOString()
      };
    },

    async getPayrollFinalizations(payload = {}) {
      const monthName=String(payload.monthName||'');
      if(!parsePayrollMonthName(monthName)) return successFailure('정산 월을 선택해 주세요.');
      return {success:true,records:await store.getFinalizations(monthName)};
    },

    async savePayrollFinalization(payload = {}, identity = {}) {
      if(identity.role!=='ADMIN') return successFailure('관리자만 정산을 확정할 수 있습니다.');
      const monthName=String(payload.monthName||'');
      const meta=parsePayrollMonthName(monthName), id=requestId(payload);
      if(!meta||!id)return successFailure('정산 월과 요청 식별자가 필요합니다.');
      const [source,settings,overrides]=await Promise.all([readSource(monthName),store.getSettings(),store.getOverrides(monthName)]);
      if(source.version!==payload.expectedSourceVersion || payrollOverrideSignature(overrides)!==payload.expectedOverrideSignature) return successFailure('원본 또는 정산 내역이 변경되었습니다. 새로고침한 뒤 확정해 주세요.');
      const summary=buildPayrollSummary(source.rows,meta,payrollOptions({teacherName:String(payload.teacherName||'')},settings,overrides));
      if(calculationVersion(settings,summary)!==payload.expectedFinalizationVersion)return successFailure('화면과 서버의 저장된 정산 조건이 다릅니다. 변경 내용을 저장하고 새로고침해 주세요.');
      if(summary.rows.some(row=>row.sourcePending)) return successFailure('확인 필요한 수업을 인트라넷에서 수정한 뒤 확정해 주세요.');
      if(!summary.rows.length)return successFailure('확정할 수업이 없습니다.');
      return store.saveFinalization({requestId:id,monthName,identity,nowIso:now().toISOString(),snapshot:{teacherName:String(payload.teacherName||''),sourceVersion:source.version,overrideSignature:payrollOverrideSignature(overrides),kpi:summary.kpi,rows:summary.rows.map(({rowKey,name,teacher,classDateKey,start,end,attendanceCode,recognizedHours,amount,discount,netAmount,recognized,settlementPercentApplied,effectiveSalaryMode,effectiveHourlyRate})=>({rowKey,name,teacher,classDateKey,start,end,attendanceCode,recognizedHours,amount,discount,netAmount,recognized,settlementPercentApplied,effectiveSalaryMode,effectiveHourlyRate})),settings}});
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
