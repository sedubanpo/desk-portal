import { randomUUID } from 'node:crypto';

export const TUITION_STATUSES = Object.freeze([
  '납부완료', '이월금', '일부완료', '안내이전',
  '안내완료', '연락두절', '확인필요', '납부예정'
]);

export const TUITION_CONTACT_CHANNELS = Object.freeze(['카톡', '전화', '문자', '구두(대화)']);

export function text(value, max = 0) {
  const result = String(value ?? '').trim();
  return max > 0 ? result.slice(0, max) : result;
}

export function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clientRequestId(value) {
  return text(value).replace(/[^\w:.-]/g, '').slice(0, 120);
}

export function studentName(value) {
  return text(value).replace(/^\//, '').trim();
}

export function monthName(value) {
  const match = text(value).match(/^(\d{2,4})-(\d{1,2})s?$/i);
  if (!match) return '';
  const month = Number(match[2]);
  if (month < 1 || month > 12) return '';
  const year = match[1].length === 4 ? match[1].slice(2) : match[1];
  return `${year}-${String(month).padStart(2, '0')}s`;
}

export function sortMonths(values) {
  return [...new Set((values || []).map(monthName).filter(Boolean))].sort((a, b) => b.localeCompare(a));
}

export function unpaidStatus(value) {
  const status = text(value);
  return TUITION_STATUSES.includes(status) ? status : '안내이전';
}

export function contactChannel(value) {
  const channel = text(value);
  return TUITION_CONTACT_CHANNELS.includes(channel) ? channel : '';
}

export function followup(source = {}) {
  source = source && typeof source === 'object' ? source : {};
  const month = monthName(source.monthName || source.month);
  const student = studentName(source.studentName || source.name);
  if (!month || !student) return null;
  return {
    monthName: month,
    studentName: student,
    guideAmount: Math.max(0, Math.round(number(source.guideAmount))),
    unpaidStatus: unpaidStatus(source.unpaidStatus),
    lastContactAt: text(source.lastContactAt),
    lastContactMemo: text(source.lastContactMemo, 1200),
    contactChannel: contactChannel(source.contactChannel),
    contactCount: Math.max(0, Math.trunc(number(source.contactCount))),
    lastUpdatedAt: text(source.lastUpdatedAt)
  };
}

export function payment(source = {}) {
  source = source && typeof source === 'object' ? source : {};
  const student = studentName(source.studentName || source.name);
  if (!student) return null;
  const amount = number(source.amount);
  const paidAt = text(source.paidAt);
  const business = text(source.business);
  const paymentType = text(source.paymentType);
  const approvalNo = text(source.approvalNo);
  const inputAt = text(source.inputAt);
  const issueMemo = text(source.issueMemo || source.memo, 1200);
  if (!amount && !paidAt && !business && !paymentType && !approvalNo && !inputAt && !issueMemo) return null;
  const dueDate = text(source.dueDate);
  const originMonth = monthName(source.originMonth || source.sourceMonth);
  const sourceMonth = monthName(source.sourceMonth || originMonth || monthFromDueDate(dueDate));
  const sourceDueMonth = monthName(source.sourceDueMonth || originMonth || monthFromDueDate(dueDate));
  const isAdjustment = source.countsAsPayment === false || text(source.entryKind) === 'adjustment' ||
    text(source.source) === 'desk_portal_adjustment' ||
    (paymentType === '수강료 정정' && approvalNo === 'PORTAL-ADJ');
  return {
    rowNumber: Math.max(0, Math.trunc(number(source.rowNumber))),
    dueDate,
    studentName: student,
    itemName: text(source.itemName || '납부금액'),
    amount,
    paidAt,
    business,
    paymentType,
    approvalNo,
    inputAt,
    issueMemo,
    originMonth,
    sourceMonth,
    sourceDueMonth,
    requestId: clientRequestId(source.requestId || source.clientRequestId),
    entryKind: isAdjustment ? 'adjustment' : 'payment',
    countsAsPayment: !isAdjustment,
    adjustmentForRequestId: clientRequestId(source.adjustmentForRequestId),
    adjustmentForPaymentKey: text(source.adjustmentForPaymentKey, 500),
    createdAt: text(source.createdAt),
    updatedAt: text(source.updatedAt),
    source: text(source.source)
  };
}

export function memo(source = {}, fallbackId = '', now = () => new Date().toISOString()) {
  source = source && typeof source === 'object' ? source : {};
  const body = text(source.memo || source.text, 1200);
  if (!body) return null;
  return {
    id: text(source.id || fallbackId) || `memo_${randomUUID().replaceAll('-', '')}`,
    createdAt: text(source.createdAt || source.date) || now(),
    memo: body,
    author: text(source.author || '예스영어학원 관리자', 80) || '예스영어학원 관리자'
  };
}

export function memoList(source, now) {
  return Object.entries(source && typeof source === 'object' ? source : {})
    .map(([id, value]) => memo(value, id, now))
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function memoWarning(memos) {
  const list = Array.isArray(memos) ? memos : [];
  const latest = list[0];
  return latest ? {
    hasWarning: true,
    count: list.length,
    latestMemo: latest.memo,
    latestAt: latest.createdAt,
    latestAuthor: latest.author
  } : { hasWarning: false, count: 0, latestMemo: '', latestAt: '', latestAuthor: '' };
}

export function base64Id(prefix, value, limit = 120) {
  return prefix + Buffer.from(String(value), 'utf8').toString('base64url').slice(0, limit);
}

export function snapshotId(month) { return `tm_${monthName(month).replace(/[^\w-]/g, '_')}`; }
export function monthIndexId(month) { return `tmi_${monthName(month).replace(/[^\w-]/g, '_')}`; }
export function followupId(month, student) { return base64Id('tf_', `${monthName(month)}|${studentName(student)}`); }
export function studentMemoId(student) { return base64Id('tsm_', studentName(student)); }
export function paymentId(row) {
  const normalized = payment(row) || {};
  if (normalized.requestId) return `tp_${normalized.requestId}`;
  return base64Id('tp_', [
    normalized.sourceDueMonth || normalized.sourceMonth || normalized.originMonth || '',
    normalized.dueDate || '', normalized.studentName || '', normalized.amount || 0,
    normalized.paidAt || '', normalized.paymentType || '', normalized.approvalNo || '',
    normalized.inputAt || '', normalized.rowNumber || 0
  ].join('|'));
}

export function paymentKey(row) {
  const normalized = payment(row);
  if (!normalized) return '';
  return normalized.requestId ? `request:${normalized.requestId}` : [
    normalized.sourceDueMonth, normalized.dueDate, normalized.studentName, normalized.amount,
    normalized.paidAt, normalized.paymentType, normalized.approvalNo, normalized.inputAt,
    normalized.rowNumber
  ].join('|');
}

export function comparePaymentsDesc(a, b) {
  return paymentSortKey(b) - paymentSortKey(a) || paymentKey(b).localeCompare(paymentKey(a));
}

export function mergePayments(...groups) {
  const merged = new Map();
  groups.flat().map(payment).filter(Boolean).forEach(row => merged.set(paymentKey(row), row));
  return [...merged.values()].sort(comparePaymentsDesc);
}

export function paidDateKey(row) {
  const normalized = payment(row);
  if (!normalized) return '';
  const base = parseMonth(normalized.sourceDueMonth || normalized.sourceMonth || normalized.originMonth);
  if (!base) return '';
  const raw = normalized.paidAt || normalized.inputAt;
  let match = text(raw).match(/^(\d{1,2})[\/.\-](\d{1,2})/);
  if (match) return `${base.year}-${String(Number(match[1])).padStart(2, '0')}-${String(Number(match[2])).padStart(2, '0')}`;
  match = text(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

export function paymentMonths(row) {
  const normalized = payment(row) || {};
  return sortMonths([normalized.sourceDueMonth, normalized.sourceMonth, normalized.originMonth, monthFromDueDate(normalized.dueDate)]);
}

export function formatInputAt(date, timeZone = 'Asia/Seoul') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatPaidAt(date, timeZone = 'Asia/Seoul') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric', day: 'numeric' })
    .formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.month}/${parts.day}`;
}

export function formatDateKey(date, timeZone = 'Asia/Seoul') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function summaryStats(rows, payments = []) {
  const labels = [...TUITION_STATUSES];
  const counts = Object.fromEntries(labels.map(label => [label, 0]));
  const kpi = { totalStudents: rows.length, paidStudents: 0, unpaidStudents: 0, expectedAmount: 0, collectedAmount: 0, outstandingAmount: 0 };
  rows.forEach(row => {
    kpi.expectedAmount += Math.max(0, number(row.guideAmount));
    kpi.collectedAmount += Math.max(0, number(row.collectedAmount));
    kpi.outstandingAmount += Math.max(0, number(row.outstandingAmount));
    const status = unpaidStatus(row.unpaidStatus);
    counts[status] += 1;
    if (status === '납부완료' || status === '이월금') kpi.paidStudents += 1;
    else kpi.unpaidStudents += 1;
  });
  Object.keys(kpi).forEach(key => { kpi[key] = Math.round(kpi[key]); });
  return { kpi, chart: { labels, values: labels.map(label => counts[label]) }, payments: mergePayments(payments) };
}

export function resolveStatus(previous, guideAmount, collectedAmount) {
  const guide = Math.max(0, number(guideAmount));
  const collected = Math.max(0, number(collectedAmount));
  if (unpaidStatus(previous) === '이월금') return '이월금';
  if ((guide > 0 && collected >= guide) || (guide <= 0 && collected > 0)) return '납부완료';
  if (guide > 0 && collected > 0) return '일부완료';
  return unpaidStatus(previous);
}

function parseMonth(value) {
  const normalized = monthName(value);
  if (!normalized) return null;
  const [yy, mm] = normalized.replace(/s$/i, '').split('-').map(Number);
  return { year: 2000 + yy, month: mm };
}

function monthFromDueDate(value) {
  const match = text(value).match(/^(\d{2,4})-(\d{1,2})/);
  return match ? monthName(`${match[1]}-${match[2]}s`) : '';
}

function paymentSortKey(row) {
  const date = paidDateKey(row);
  const timestamp = date ? Date.parse(`${date}T00:00:00Z`) : 0;
  return timestamp + Math.max(0, number(row?.rowNumber));
}
