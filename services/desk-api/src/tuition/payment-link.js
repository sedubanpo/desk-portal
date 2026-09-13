import { createHash } from 'node:crypto';
import { paidDateKey, text } from './normalizers.js';

export function paymentLinkKey(row) {
  return createHash('sha256').update([row.approvalNo, paidDateKey(row), row.amount].join('|')).digest('hex');
}

export function paymentLinkDuplicate(row, candidates) {
  return candidates.find(other => {
    if (other.countsAsPayment === false || other.entryKind === 'adjustment') return false;
    if (paidDateKey(other) !== paidDateKey(row) || Number(other.amount) !== Number(row.amount)) return false;
    const approval = text(other.approvalNo).replace(/\s/g, '');
    if (approval && approval === row.approvalNo) return true;
    // A manual receipt without an approval number cannot safely be distinguished.
    return !approval && other.studentName === row.studentName;
  });
}

export function validatePaymentLink(payload) {
  if (payload.status !== '결제' || payload.cancelledAt) return '취소 건은 원결제와 환불 내역을 확인한 후 수납 관리에서 처리해 주세요.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.paidAt || '') || !Number.isFinite(Date.parse(payload.paidAt)) || new Date(payload.paidAt).toISOString().slice(0, 10) !== payload.paidAt) return '결제일이 올바르지 않습니다.';
  if (!Number.isSafeInteger(payload.amount) || payload.amount >= 0) return '결제금액이 올바르지 않습니다.';
  if (!/^[A-Za-z0-9-]{4,40}$/.test(payload.approvalNo || '')) return '승인번호를 확인해 주세요.';
  return '';
}
