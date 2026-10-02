import { ApiError } from '../http.js';

// Attribution is server-owned. Existing records without attribution stay explicitly unknown.
export function prepareResponseLog(value, current, identity, now, id) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'invalid_question', '질문 내용을 확인해 주세요.');
  const text = String(value.text || '').trim();
  if (!text || text.length > 5000) throw new ApiError(400, 'invalid_question', '질문은 1~5,000자로 입력해 주세요.');
  const answerText = Object.hasOwn(value, 'answerText') ? String(value.answerText || '').trim() : String(current?.answerText || '');
  if (answerText.length > 20000) throw new ApiError(400, 'invalid_answer', '답변은 20,000자 이내로 입력해 주세요.');
  const changed = answerText !== String(current?.answerText || '');
  if (changed && identity.role !== 'ADMIN') throw new ApiError(403, 'answer_admin_required', '맞춤 답변은 관리자만 저장할 수 있습니다.');
  const stamp = now();
  return {
    ...value, id, text: current ? String(current.text || current.query || text) : text,
    createdAt: current ? String(current.createdAt || '') : stamp,
    createdByName: current ? String(current.createdByName || '') : String(identity.name || ''),
    createdByUid: current ? String(current.createdByUid || '') : String(identity.uid || ''),
    answerText,
    answeredAt: changed ? stamp : String(current?.answeredAt || ''),
    answeredByName: changed ? String(identity.name || '') : String(current?.answeredByName || ''),
    answeredByUid: changed ? String(identity.uid || '') : String(current?.answeredByUid || '')
  };
}
