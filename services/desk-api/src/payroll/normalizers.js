import { createHash } from 'node:crypto';

export const PAYROLL_SUSPICION_SETTINGS_KEY = '__suspicionRules';

function text(value) { return String(value ?? '').trim(); }
export function number(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number.parseFloat(text(value).replace(/,/g, '').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function round(value, digits = 0) { const scale = 10 ** digits; return Math.round(number(value) * scale) / scale; }
function clamp(value, min, max, fallback = min) { const parsed = number(value, fallback); return Math.max(min, Math.min(max, parsed)); }
function sha(value) { return createHash('sha256').update(String(value)).digest('hex'); }

export function parsePayrollMonthName(value) {
  const match = text(value).match(/^(\d{2}|\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  return { sheetName: match[0], year, month, daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

export function normalizePayrollOverrideBundle(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const free = new Set((Array.isArray(source.freeIncludedRowKeys) ? source.freeIncludedRowKeys : []).map(text).filter(Boolean));
  const recognition = new Map();
  (Array.isArray(source.recognitionOverrides) ? source.recognitionOverrides : []).forEach(item => {
    const rowKey = text(item?.rowKey);
    if (rowKey && typeof item?.recognized === 'boolean') recognition.set(rowKey, item.recognized);
  });
  const rates = new Map();
  (Array.isArray(source.rateAdjustments) ? source.rateAdjustments : []).forEach(item => {
    const rowKey = text(item?.rowKey);
    const rate = round(item?.rate, 2);
    if (rowKey && rate > 0) rates.set(rowKey, rate);
  });
  const settlements = new Map();
  (Array.isArray(source.settlementPercentOverrides) ? source.settlementPercentOverrides : []).forEach(item => {
    const rowKey = text(item?.rowKey);
    if (rowKey) settlements.set(rowKey, round(clamp(item?.percent, 0, 200, 0), 2));
  });
  const normalized = {
    freeIncludedRowKeys: [...free].sort(),
    recognitionOverrides: [...recognition].sort(([a], [b]) => a.localeCompare(b)).map(([rowKey, recognized]) => ({ rowKey, recognized })),
    rateAdjustments: [...rates].sort(([a], [b]) => a.localeCompare(b)).map(([rowKey, rate]) => ({ rowKey, rate })),
    settlementPercentOverrides: [...settlements].sort(([a], [b]) => a.localeCompare(b)).map(([rowKey, percent]) => ({ rowKey, percent }))
  };
  if (source.updatedAt) normalized.updatedAt = text(source.updatedAt);
  return normalized;
}

export function mergePayrollOverrideBundles(base, overlay) {
  const first = normalizePayrollOverrideBundle(base);
  const patch = normalizePayrollOverrideBundle(overlay);
  const free = new Set([...first.freeIncludedRowKeys, ...patch.freeIncludedRowKeys]);
  const recognition = new Map(first.recognitionOverrides.map(item => [item.rowKey, item.recognized]));
  patch.recognitionOverrides.forEach(item => recognition.set(item.rowKey, item.recognized));
  const rates = new Map(first.rateAdjustments.map(item => [item.rowKey, item.rate]));
  patch.rateAdjustments.forEach(item => rates.set(item.rowKey, item.rate));
  const settlements = new Map(first.settlementPercentOverrides.map(item => [item.rowKey, item.percent]));
  patch.settlementPercentOverrides.forEach(item => settlements.set(item.rowKey, item.percent));
  return normalizePayrollOverrideBundle({
    freeIncludedRowKeys: [...free],
    recognitionOverrides: [...recognition].map(([rowKey, recognized]) => ({ rowKey, recognized })),
    rateAdjustments: [...rates].map(([rowKey, rate]) => ({ rowKey, rate })),
    settlementPercentOverrides: [...settlements].map(([rowKey, percent]) => ({ rowKey, percent }))
  });
}

export function payrollOverrideSignature(value) { return sha(JSON.stringify(normalizePayrollOverrideBundle(value))); }

function suspicionClassType(value) {
  const normalized = text(value).replace(/\s+/g, '');
  if (/개별정규|개별/.test(normalized)) return '개별';
  if (/1:1|1대1|일대일/.test(normalized)) return '1:1';
  if (/2:1|2대1/.test(normalized)) return '2:1';
  return normalized;
}

export function normalizeSuspicionSettings(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const rules = (Array.isArray(source.rules) ? source.rules : []).map(rule => ({
    classType: suspicionClassType(rule?.classType),
    hours: round(rule?.hours, 1),
    rate: Math.max(0, Math.round(number(rule?.rate)))
  })).filter(rule => rule.classType && rule.hours > 0);
  return {
    enabled: source.enabled !== false,
    rateTolerancePercent: clamp(source.rateTolerancePercent, 0, 100, 8),
    rateToleranceWon: Math.max(0, Math.round(number(source.rateToleranceWon, 3000))),
    earliestHour: clamp(source.earliestHour, 0, 23, 8),
    latestHour: clamp(source.latestHour, 1, 24, 23),
    maxLessonHours: clamp(source.maxLessonHours, 1, 12, 5),
    rules
  };
}

function salaryMode(value) { return text(value).toLowerCase() === 'hourly' ? 'hourly' : 'ratio'; }

export function normalizePayrollSettings(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = {};
  Object.entries(source).forEach(([teacher, raw]) => {
    if (teacher === PAYROLL_SUSPICION_SETTINGS_KEY) {
      result[teacher] = normalizeSuspicionSettings(raw);
      return;
    }
    const name = text(teacher);
    if (!name || !raw || typeof raw !== 'object') return;
    const paidByMonth = Object.fromEntries(Object.entries(raw.paidByMonth || {}).filter(([, paid]) => typeof paid === 'boolean'));
    result[name] = {
      salaryMode: salaryMode(raw.salaryMode),
      hourlyRate: Math.max(0, number(raw.hourlyRate)),
      oneToOneSettlementMode: text(raw.oneToOneSettlementMode).toLowerCase() === 'ratio' ? 'ratio' : 'hourly',
      oneToOneRatioPercent: clamp(raw.oneToOneRatioPercent, 0, 100, 50),
      bankName: text(raw.bankName).slice(0, 80),
      accountNumber: text(raw.accountNumber).slice(0, 120),
      accountHolder: text(raw.accountHolder).slice(0, 80),
      paidByMonth,
      updatedAt: text(raw.updatedAt)
    };
  });
  if (!result[PAYROLL_SUSPICION_SETTINGS_KEY]) result[PAYROLL_SUSPICION_SETTINGS_KEY] = normalizeSuspicionSettings({});
  return result;
}

export function applyPayrollSettingsUpdates(current, payload, nowIso) {
  const next = normalizePayrollSettings(current);
  if (Object.hasOwn(payload || {}, 'suspicionRules')) next[PAYROLL_SUSPICION_SETTINGS_KEY] = normalizeSuspicionSettings(payload.suspicionRules);
  const monthName = text(payload?.monthName);
  (Array.isArray(payload?.updates) ? payload.updates : []).forEach(item => {
    const teacher = text(item?.teacher);
    if (!teacher) return;
    const previous = next[teacher] || { paidByMonth: {} };
    next[teacher] = {
      salaryMode: salaryMode(item.salaryMode),
      hourlyRate: Math.max(0, number(item.hourlyRate)),
      oneToOneSettlementMode: text(item.oneToOneSettlementMode).toLowerCase() === 'ratio' ? 'ratio' : 'hourly',
      oneToOneRatioPercent: clamp(item.oneToOneRatioPercent, 0, 100, 50),
      bankName: text(item.bankName).slice(0, 80),
      accountNumber: text(item.accountNumber).slice(0, 120),
      accountHolder: text(item.accountHolder).slice(0, 80),
      paidByMonth: { ...(previous.paidByMonth || {}), ...(monthName ? { [monthName]: Boolean(item.paid) } : {}) },
      updatedAt: nowIso
    };
  });
  return next;
}

function normalizeStudent(value) { return text(value).replace(/^\/+/, '').trim(); }
function header(value) { return text(value).replace(/\s+/g, '').toLowerCase(); }
function headerIndex(headers, candidates, fallback) {
  for (const candidate of candidates) { const index = headers.indexOf(header(candidate)); if (index !== -1) return index; }
  return fallback;
}
function columnMap(headers) {
  return {
    name: headerIndex(headers, ['이름'], 0), classDate: headerIndex(headers, ['수업일'], 1), className: headerIndex(headers, ['반명'], 2),
    attendance: headerIndex(headers, ['출결'], 3), room: headerIndex(headers, ['관'], 4), tr: headerIndex(headers, ['tr'], 5),
    start: headerIndex(headers, ['시작'], 6), end: headerIndex(headers, ['종료'], 7), hours: headerIndex(headers, ['시간'], 8),
    hourlyRate: headerIndex(headers, ['시간당'], 9), amount: headerIndex(headers, ['금액'], 10), note: headerIndex(headers, ['참고'], 11),
    discount: headerIndex(headers, ['할인'], 12)
  };
}
function parseTime(value) {
  const match = text(value).match(/(오전|오후)?\s*(\d{1,2})\s*:\s*(\d{1,2})/);
  if (!match) return null;
  let hour = Number(match[2]); const minute = Number(match[3]);
  if (match[1] === '오후' && hour < 12) hour += 12;
  if (match[1] === '오전' && hour === 12) hour = 0;
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}
function dateInfo(value, meta) {
  const raw = text(value); const match = raw.match(/(\d{1,2})\s*\/\s*(\d{1,2})/); const dayOnly = raw.match(/(\d{1,2})/);
  let month = match ? Number(match[1]) : meta.month; let day = match ? Number(match[2]) : (dayOnly ? Number(dayOnly[1]) : 1);
  if (month < 1 || month > 12) month = meta.month;
  if (day < 1 || day > 31) day = 1;
  const maxDay = new Date(Date.UTC(meta.year, month, 0)).getUTCDate();
  if (day > maxDay) { month = meta.month; day = Math.min(day, meta.daysInMonth); }
  return { dateKey: `${meta.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, label: `${month}/${day}`, day };
}
function classType(value) { const raw = text(value); const ratio = raw.match(/\d+\s*:\s*\d+/); if (ratio) return ratio[0].replace(/\s+/g, ''); if (/개별정규/.test(raw)) return '개별정규'; if (/개별/.test(raw)) return '개별'; if (/정규/.test(raw)) return '정규'; if (/특강/.test(raw)) return '특강'; if (/보강|보충/.test(raw)) return '보강'; return raw ? raw.split('-')[0].trim() : '미분류'; }
function subject(value) { const raw = text(value).replace(/\s+/g, ''); if (/수학|math|미적|기하|확통|대수/i.test(raw)) return '수학'; if (/영어|eng|토플|텝스|toeic/i.test(raw)) return '영어'; if (/국어|kor|문학|독해|화작|언매/i.test(raw)) return '국어'; if (/과학|sci|물리|화학|생명|지구과학/i.test(raw)) return '과학'; if (/사회|사탐|역사|정치|경제|지리/i.test(raw)) return '사회'; if (/논술|에세이/i.test(raw)) return '논술'; return '기타'; }
function schoolType(value) { const raw = text(value).replace(/\s+/g, ''); if (/초등|초/i.test(raw)) return '초등'; if (/중등|중/i.test(raw)) return '중등'; if (/고등|고|n수|재수|반수/i.test(raw)) return '고등/N수'; return '미분류'; }
function gradeBand(value) { const raw = text(value); if (/재수|반수|n수|N수|N\d/.test(raw)) return 'N수'; const grade = raw.match(/([1-6])\s*학년/); if (grade) { const parsed = Number(grade[1]); return parsed <= 2 ? '초등' : parsed <= 3 ? '중등' : '고등'; } const short = raw.match(/-(\d)\s*h/i); return short ? (Number(short[1]) <= 2 ? '중등' : '고등') : '미분류'; }
function attendanceCode(value) { const raw = text(value).replace(/\s+/g, ''); if (!raw) return '기타'; if (/출석/.test(raw)) return '출석'; if (/지각/.test(raw)) return '지각'; if (/당일취소|당취/.test(raw)) return '당일취소'; if (/결석예고/.test(raw)) return '결석예고'; if (/결석보강/.test(raw)) return '결석보강'; if (/보강|보충/.test(raw)) return '보강'; if (/프리/.test(raw)) return '프리'; if (/결석/.test(raw)) return '결석'; return raw; }
function simpleHash(value) { let hashValue = 2166136261; for (const character of String(value)) { hashValue ^= character.charCodeAt(0); hashValue += (hashValue << 1) + (hashValue << 4) + (hashValue << 7) + (hashValue << 8) + (hashValue << 24); } return (hashValue >>> 0).toString(36); }

export function parsePayrollRows(source, monthMeta) {
  const values = Array.isArray(source?.values) ? source.values : [];
  const headers = Array.isArray(source?.headers) ? source.headers.map(header) : [];
  const indexes = columnMap(headers);
  return values.map((row = [], offset) => {
    const teacher = text(row[indexes.tr]); const name = normalizeStudent(row[indexes.name]); const className = text(row[indexes.className]);
    if (!teacher && !name && !className) return null;
    const date = dateInfo(row[indexes.classDate], monthMeta); const start = text(row[indexes.start]); const end = text(row[indexes.end]);
    const startMinutes = parseTime(start); const endMinutes = parseTime(end);
    const hours = Math.max(0, number(row[indexes.hours]) || (startMinutes != null && endMinutes > startMinutes ? round((endMinutes - startMinutes) / 60, 2) : 0));
    const type = classType(className); const detectedSubject = subject(className); const detectedSchoolType = schoolType(className); const detectedGradeBand = gradeBand(className);
    const rowNumber = offset + 2;
    const parts = [name, date.dateKey, className, text(row[indexes.attendance]), teacher, start, end, hours, number(row[indexes.hourlyRate]), number(row[indexes.amount]), number(row[indexes.discount])];
    return {
      rowNumber, rowKey: `${monthMeta.sheetName}:${rowNumber}:${simpleHash(JSON.stringify(parts))}`,
      name, classDateRaw: text(row[indexes.classDate]), classDateKey: date.dateKey, classDateLabel: date.label, day: date.day,
      className, attendance: text(row[indexes.attendance]), attendanceCode: attendanceCode(row[indexes.attendance]), room: text(row[indexes.room]), teacher,
      start, end, startMinutes, endMinutes, hours, rate: number(row[indexes.hourlyRate]), amount: number(row[indexes.amount]), note: text(row[indexes.note]),
      discount: number(row[indexes.discount]), classType: type, schoolType: detectedSchoolType, gradeBand: detectedGradeBand, subject: detectedSubject,
      rateSignature: [detectedSubject, detectedSchoolType, detectedGradeBand, type].join('|')
    };
  }).filter(Boolean).sort((a, b) => a.classDateKey.localeCompare(b.classDateKey) || a.start.localeCompare(b.start) || a.rowNumber - b.rowNumber);
}

export function payrollSourceVersion(source) {
  return sha(JSON.stringify({ headers: source?.headers || [], values: source?.values || [] }));
}

function attendance(value, freeIncluded) { const raw = text(value).replace(/\s+/g, ''); if (/당일취소|당취/.test(raw)) return { recognized: false, freeEligible: false, label: '당일취소 미인정' }; if (/프리/.test(raw)) return { recognized: Boolean(freeIncluded), freeEligible: true, label: freeIncluded ? '프리 수동인정' : '프리 미인정' }; if (/결석보강/.test(raw)) return { recognized: true, freeEligible: false, label: '결석보강 인정' }; if (/보강|보충/.test(raw)) return { recognized: true, freeEligible: false, label: '보강 인정' }; if (/지각/.test(raw)) return { recognized: true, freeEligible: false, label: '지각 인정' }; if (/출석/.test(raw)) return { recognized: true, freeEligible: false, label: '출석 인정' }; return { recognized: false, freeEligible: false, label: '미인정' }; }
function discountPercent(value) { let parsed = number(value); if (parsed <= 0) return 0; if (parsed <= 1) parsed *= 100; return clamp(parsed, 0, 100, 0); }
function intervalHours(intervals = []) { if (!intervals.length) return 0; const sorted = [...intervals].sort((a, b) => a[0] - b[0] || a[1] - b[1]); let total = 0; let [start, end] = sorted[0]; for (const current of sorted.slice(1)) { if (current[0] <= end) end = Math.max(end, current[1]); else { total += end - start; [start, end] = current; } } return round((total + end - start) / 60, 2); }
function oneToOneRule(settings, teacher, fallback) { const config = settings?.[teacher] || {}; return { useRatio: text(config.oneToOneSettlementMode).toLowerCase() === 'ratio', ratioPercent: clamp(config.oneToOneRatioPercent, 0, 100, fallback || 50) }; }
function isOneToOne(value) { return text(value).replace(/\s+/g, '') === '1:1'; }
function studentBaselines(rows) { const groups = new Map(); rows.forEach(row => { if (!row.name || row.rate <= 0 || row.amount <= 0) return; [[row.name, row.subject, row.classType], [row.name, '', row.classType], [row.name, row.subject, ''], [row.name, '', '']].forEach(parts => { const key = parts.join('|'); groups.set(key, [...(groups.get(key) || []), row.rate]); }); }); const result = new Map(); groups.forEach((rates, key) => { const counts = new Map(); rates.forEach(rate => counts.set(Math.round(rate), (counts.get(Math.round(rate)) || 0) + 1)); const best = [...counts].sort((a, b) => b[1] - a[1])[0]; if (best) result.set(key, best[0]); }); return result; }
function suggestedRate(row, baselines) { for (const key of [[row.name, row.subject, row.classType], [row.name, '', row.classType], [row.name, row.subject, ''], [row.name, '', '']].map(parts => parts.join('|'))) { if (number(baselines.get(key)) > 0) return number(baselines.get(key)); } return 0; }

function suspicionMap(rows, settingsInput) {
  const settings = normalizeSuspicionSettings(settingsInput);
  if (!settings.enabled) return {};
  const configured = new Map(settings.rules.map(rule => [`${rule.classType}|${round(rule.hours, 1)}`, rule.rate]));
  const result = {};
  rows.forEach(row => {
    const reasons = [];
    const expected = configured.get(`${suspicionClassType(row.classType)}|${round(row.hours, 1)}`) || 0;
    const tolerance = Math.max(settings.rateToleranceWon, expected * settings.rateTolerancePercent / 100);
    if (expected > 0 && Math.abs(number(row.amount || row.rate * row.hours) - expected) > tolerance) reasons.push(`설정 기준 ${suspicionClassType(row.classType)} ${round(row.hours, 1)}시간 ${Math.round(expected).toLocaleString('ko-KR')}원 대비 이탈`);
    if (row.startMinutes == null || row.endMinutes == null) reasons.push('수업 시작/종료 시간 파싱 불가');
    else if (row.endMinutes <= row.startMinutes) reasons.push('종료 시간이 시작 시간보다 빠르거나 같습니다');
    else {
      if (row.startMinutes < settings.earliestHour * 60 || row.endMinutes > settings.latestHour * 60) reasons.push('설정 운영시간 밖 수업');
      const duration = (row.endMinutes - row.startMinutes) / 60;
      if (duration > settings.maxLessonHours || row.hours > settings.maxLessonHours) reasons.push(`1회 수업 시간이 ${settings.maxLessonHours}시간 초과`);
      if (Math.abs(duration - row.hours) >= 0.25) reasons.push('시작-종료 시간과 입력 시수가 불일치');
    }
    if (row.rate > 0 && row.hours > 0 && row.amount > 0 && Math.abs(row.amount - row.rate * row.hours) >= Math.max(1000, row.rate * row.hours * 0.03)) reasons.push('금액과 시간당 금액 x 시수 불일치');
    if (discountPercent(row.discount) > 70) reasons.push('할인율이 70%를 초과합니다');
    const teacherHint = [...text(row.className).matchAll(/\(([^)]+)\)/g)].at(-1)?.[1]?.trim() || '';
    if (teacherHint && !/\d|h|H|시간|분|초|중|고|N수/.test(teacherHint) && teacherHint.replace(/\s+/g, '').toLowerCase() !== row.teacher.replace(/\s+/g, '').toLowerCase()) reasons.push(`반명 표기 강사(${teacherHint})와 TR(${row.teacher}) 불일치`);
    if (reasons.length) result[row.rowKey] = [...new Set(reasons)].join('\n');
  });
  return result;
}

function teacherOptions(rows) {
  const counters = new Map();
  rows.forEach(row => { if (!row.teacher) return; if (!counters.has(row.teacher)) counters.set(row.teacher, new Map()); const map = counters.get(row.teacher); map.set(row.subject, (map.get(row.subject) || 0) + 1); });
  const teachers = [...counters.keys()].sort((a, b) => a.localeCompare(b, 'ko'));
  const groups = new Map();
  teachers.forEach(teacher => { const main = [...counters.get(teacher)].sort((a, b) => b[1] - a[1])[0]?.[0] || '기타'; groups.set(main, [...(groups.get(main) || []), teacher]); });
  const order = ['수학', '영어', '국어', '과학', '사회', '논술', '기타'];
  const subjects = [...groups.keys()].sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)) || a.localeCompare(b, 'ko'));
  return { subjects: ['', ...subjects], teachers, teacherGroups: subjects.map(subjectName => ({ subject: subjectName, teachers: groups.get(subjectName).sort((a, b) => a.localeCompare(b, 'ko')) })) };
}

function calendar(meta, days) {
  const weeks = []; let week = Array(new Date(Date.UTC(meta.year, meta.month - 1, 1)).getUTCDay()).fill(null);
  for (let day = 1; day <= meta.daysInMonth; day += 1) {
    const key = `${meta.year}-${String(meta.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const item = days[key];
    week.push({ day, dateKey: key, recognizedHours: round(item?.recognizedHours, 2), pureTeachingHours: round(item?.pureTeachingHours, 2), netSales: Math.round(number(item?.netSales)), settlementAmount: Math.round(number(item?.settlementAmount)), canceledAmount: Math.round(number(item?.canceledAmount)), lessonCount: number(item?.lessonCount), classTypes: Object.keys(item?.classTypeMap || {}).sort((a, b) => item.classTypeMap[b] - item.classTypeMap[a]), classTypeHours: Object.entries(item?.classTypeHourMap || {}).map(([type, hours]) => ({ type, hours: round(hours, 2) })).sort((a, b) => b.hours - a.hours) });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return { year: meta.year, month: meta.month, weeks };
}

export function buildPayrollSummary(rows, monthMeta, input = {}) {
  const settings = normalizePayrollSettings(input.teacherSettings || {}); const mode = salaryMode(input.salaryMode); const ratioPercent = clamp(input.ratioPercent, 0, 100, 50); const hourlyRate = Math.max(0, number(input.hourlyRate));
  const overrides = normalizePayrollOverrideBundle(input.effectiveOverrides || {}); const free = new Set(overrides.freeIncludedRowKeys); const recognition = new Map(overrides.recognitionOverrides.map(item => [item.rowKey, item.recognized])); const rates = new Map(overrides.rateAdjustments.map(item => [item.rowKey, item.rate])); const settlements = new Map(overrides.settlementPercentOverrides.map(item => [item.rowKey, item.percent]));
  const filtered = rows.filter(row => (!input.subjectFilter || row.subject === input.subjectFilter) && (!input.teacherName || row.teacher === input.teacherName) && (!input.classTypeFilter || row.classType === input.classTypeFilter));
  const baselines = studentBaselines(rows); const suspicions = suspicionMap(rows, settings[PAYROLL_SUSPICION_SETTINGS_KEY]); const days = {}; const detail = []; const typeTotals = {}; const finance = {}; const attendanceTotals = {}; const intervals = {}; const workingDays = new Set();
  let recognizedHoursTotal = 0; let grossTotal = 0; let discountTotal = 0; let netTotal = 0; let canceledTotal = 0; let recognizedLessons = 0; let ratioPay = 0; let oneToOnePay = 0;
  const bucket = type => { if (!finance[type]) finance[type] = { type, count: 0, hours: 0, hourlyHoursEligible: 0, gross: 0, net: 0, settlement: 0, ratioSettlement: 0, oneToOneRatioSettlement: 0, canceled: 0, canceledCount: 0 }; return finance[type]; };
  filtered.forEach(row => {
    const base = attendance(row.attendance, free.has(row.rowKey)); const recognized = recognition.has(row.rowKey) ? { ...base, recognized: recognition.get(row.rowKey), label: recognition.get(row.rowKey) ? '수동 인정' : '수동 제외' } : base;
    const proposed = suggestedRate(row, baselines); const makeup = row.attendanceCode === '보강' && number(row.amount) === 0 && /당일취소|당취/.test(`${row.note} ${row.className}`.replace(/\s+/g, '')); const manualRate = number(rates.get(row.rowKey));
    let effectiveRate = row.rate; let amount = row.amount; let adjusted = false;
    if (recognized.recognized && makeup) { const selected = manualRate || proposed || row.rate; if (selected > 0) { effectiveRate = selected; amount = Math.round(selected * row.hours); adjusted = Math.round(amount) !== Math.round(row.amount); } } else if (manualRate > 0) { effectiveRate = manualRate; amount = Math.round(manualRate * row.hours); adjusted = true; }
    const percentDiscount = discountPercent(row.discount); const discount = Math.round(Math.max(0, amount) * percentDiscount / 100); const net = amount - discount; const hasSettlementOverride = settlements.has(row.rowKey); let settlementPercentApplied = mode === 'ratio' ? ratioPercent : 0;
    if (!days[row.classDateKey]) days[row.classDateKey] = { dateKey: row.classDateKey, label: row.classDateLabel, day: row.day, lessonCount: 0, recognizedHours: 0, pureTeachingHours: 0, grossSales: 0, discount: 0, netSales: 0, settlementAmount: 0, ratioSettlement: 0, oneToOneRatioSettlement: 0, canceledAmount: 0, classTypeMap: {}, classTypeHourMap: {} };
    attendanceTotals[row.attendanceCode] = (attendanceTotals[row.attendanceCode] || 0) + 1;
    if (row.attendanceCode === '당일취소') { days[row.classDateKey].canceledAmount += Math.round(row.amount); canceledTotal += Math.round(row.amount); bucket(row.classType).canceled += Math.round(row.amount); bucket(row.classType).canceledCount += 1; }
    if (recognized.recognized) {
      const day = days[row.classDateKey]; const financial = bucket(row.classType); day.lessonCount += 1; day.recognizedHours += row.hours; day.grossSales += amount; day.discount += discount; day.netSales += net; day.classTypeMap[row.classType] = (day.classTypeMap[row.classType] || 0) + 1; day.classTypeHourMap[row.classType] = (day.classTypeHourMap[row.classType] || 0) + row.hours;
      financial.count += 1; financial.hours += row.hours; financial.gross += amount; financial.net += net; workingDays.add(row.classDateKey); typeTotals[row.classType] = (typeTotals[row.classType] || 0) + 1; recognizedLessons += 1; recognizedHoursTotal += row.hours; grossTotal += amount; discountTotal += discount; netTotal += net;
      const rule = oneToOneRule(settings, row.teacher, ratioPercent); const useOneToOneRatio = mode === 'hourly' && rule.useRatio && isOneToOne(row.classType); const basePercent = mode === 'ratio' ? ratioPercent : (useOneToOneRatio ? rule.ratioPercent : 0); settlementPercentApplied = hasSettlementOverride ? clamp(settlements.get(row.rowKey), 0, 200, basePercent) : basePercent;
      if (mode === 'hourly') { if (hasSettlementOverride || useOneToOneRatio) { const settlement = net * settlementPercentApplied / 100; day.oneToOneRatioSettlement += settlement; financial.oneToOneRatioSettlement += settlement; financial.settlement += settlement; oneToOnePay += settlement; } else financial.hourlyHoursEligible += row.hours; } else { const settlement = net * settlementPercentApplied / 100; day.ratioSettlement += settlement; financial.ratioSettlement += settlement; financial.settlement += settlement; ratioPay += settlement; }
      if (!useOneToOneRatio && !hasSettlementOverride && row.startMinutes != null && row.endMinutes > row.startMinutes) intervals[row.classDateKey] = [...(intervals[row.classDateKey] || []), [row.startMinutes, row.endMinutes]];
    }
    detail.push({ ...row, rate: effectiveRate, baseRate: row.rate, amount: Math.round(amount), originalAmount: row.amount, discount: Math.round(discount), discountPercent: percentDiscount, discountRaw: row.discount, netAmount: net, isFreeEligible: base.freeEligible, freeIncluded: base.freeEligible && free.has(row.rowKey), baseRecognized: base.recognized, recognized: recognized.recognized, isManuallyOverridden: recognition.has(row.rowKey), recognitionLabel: recognized.label, recognizedHours: recognized.recognized ? row.hours : 0, recognizedNet: recognized.recognized ? net : 0, oneToOneRatioRuleApplied: mode === 'hourly' && isOneToOne(row.classType) ? oneToOneRule(settings, row.teacher, ratioPercent).useRatio : false, settlementPercentApplied: round(settlementPercentApplied, 2), settlementPercentOverridden: hasSettlementOverride, suspectedRateMismatch: Boolean(suspicions[row.rowKey]), suspectedRateReason: suspicions[row.rowKey] || '', autoRepriceEligible: makeup, autoRepriced: makeup && adjusted, suggestedRate: proposed > 0 ? proposed : 0, rateManuallyAdjusted: manualRate > 0 });
  });
  let pureHours = 0; Object.entries(intervals).forEach(([key, value]) => { const hours = intervalHours(value); days[key].pureTeachingHours = hours; pureHours += hours; });
  Object.values(days).forEach(day => { day.settlementAmount = Math.round(mode === 'hourly' ? day.pureTeachingHours * hourlyRate + day.oneToOneRatioSettlement : day.ratioSettlement); day.ratioSettlement = Math.round(day.ratioSettlement); day.oneToOneRatioSettlement = Math.round(day.oneToOneRatioSettlement); });
  Object.values(finance).forEach(item => { item.hours = round(item.hours, 2); item.hourlyHoursEligible = round(item.hourlyHoursEligible, 2); ['gross', 'net', 'canceled', 'canceledCount', 'ratioSettlement', 'oneToOneRatioSettlement'].forEach(key => { item[key] = Math.round(number(item[key])); }); item.settlement = Math.round(mode === 'hourly' ? item.hourlyHoursEligible * hourlyRate + item.oneToOneRatioSettlement : item.ratioSettlement); });
  const estimatedPay = mode === 'hourly' ? pureHours * hourlyRate + oneToOnePay : ratioPay;
  return {
    kpi: { totalLessons: filtered.length, recognizedLessons, recognizedHours: round(recognizedHoursTotal, 2), pureTeachingHours: round(pureHours, 2), grossSales: Math.round(grossTotal), discount: Math.round(discountTotal), netSales: Math.round(netTotal), canceledAmount: Math.round(canceledTotal), oneToOneRatioSettlement: Math.round(oneToOnePay), workingDays: workingDays.size, estimatedPay: Math.round(estimatedPay), ratioPay: Math.round(ratioPay), hourlyPay: Math.round(pureHours * hourlyRate + oneToOnePay) },
    classTypeSummary: Object.entries(typeTotals).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    classTypeFinanceSummary: Object.values(finance).sort((a, b) => b.net - a.net),
    attendanceSummary: Object.entries(attendanceTotals).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count),
    calendar: calendar(monthMeta, days),
    chart: { labels: Array.from({ length: monthMeta.daysInMonth }, (_, index) => String(index + 1)), grossSales: Array.from({ length: monthMeta.daysInMonth }, (_, index) => Math.round(number(days[`${monthMeta.year}-${String(monthMeta.month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`]?.grossSales))), netSales: Array.from({ length: monthMeta.daysInMonth }, (_, index) => Math.round(number(days[`${monthMeta.year}-${String(monthMeta.month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`]?.netSales))), recognizedHours: Array.from({ length: monthMeta.daysInMonth }, (_, index) => round(days[`${monthMeta.year}-${String(monthMeta.month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`]?.recognizedHours, 2)), pureTeachingHours: Array.from({ length: monthMeta.daysInMonth }, (_, index) => round(days[`${monthMeta.year}-${String(monthMeta.month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`]?.pureTeachingHours, 2)) },
    rows: detail,
    ...teacherOptions(rows)
  };
}

export function payrollOptions(payload, settings, overrides) {
  return { subjectFilter: text(payload?.subjectFilter), teacherName: text(payload?.teacherName), classTypeFilter: text(payload?.classTypeFilter), salaryMode: salaryMode(payload?.salaryMode), ratioPercent: clamp(payload?.ratioPercent, 0, 100, 50), hourlyRate: Math.max(0, number(payload?.hourlyRate)), teacherSettings: settings, effectiveOverrides: overrides };
}
