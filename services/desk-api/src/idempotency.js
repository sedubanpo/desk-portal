import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from './http.js';

const PROCESSING_LEASE_MS = 2 * 60 * 1000;

export function createIdempotencyExecutor(firestore, now = () => Date.now()) {
  if (!firestore) throw new TypeError('firestore is required.');

  return async function runIdempotent({ uid, method, key, requestFingerprint = '' }, operation) {
    const safeKey = String(key || '').trim();
    if (!safeKey || safeKey.length > 160) {
      throw new ApiError(400, 'idempotency_key_required', '쓰기 요청에는 유효한 x-idempotency-key가 필요합니다.');
    }
    const id = createHash('sha256').update(`${uid}\n${method}\n${safeKey}`).digest('hex');
    const ref = firestore.collection('deskApiIdempotency').doc(id);
    const startedAt = now();
    const attemptId = randomUUID();
    const fingerprint = String(requestFingerprint || '');
    const state = await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.exists ? snapshot.data() : null;
      if (fingerprint && data?.requestFingerprint && data.requestFingerprint !== fingerprint) {
        throw new ApiError(409, 'idempotency_key_reused', '같은 x-idempotency-key를 다른 저장 요청에 사용할 수 없습니다.');
      }
      if (data?.status === 'complete') return { replay: true, response: data.response };
      if (data?.status === 'processing' && startedAt - Number(data.startedAt || 0) < PROCESSING_LEASE_MS) {
        throw new ApiError(409, 'request_in_progress', '동일한 저장 요청이 처리 중입니다. 잠시 후 새로고침해 결과를 확인해 주세요.');
      }
      transaction.set(ref, {
        uid,
        method,
        key: safeKey,
        requestFingerprint: fingerprint,
        attemptId,
        status: 'processing',
        startedAt,
        updatedAt: startedAt
      });
      return { replay: false };
    });
    if (state.replay) return state.response;

    let response;
    try {
      response = await operation();
    } catch (error) {
      await firestore.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const data = snapshot.exists ? snapshot.data() : null;
        if (data?.attemptId === attemptId) {
          transaction.set(ref, { ...data, status: 'failed', failedAt: now(), updatedAt: now() });
        }
      }).catch(() => {});
      throw error;
    }

    const completed = await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.exists ? snapshot.data() : null;
      if (data?.attemptId === attemptId) {
        const result = { ...data, status: 'complete', response, completedAt: now(), updatedAt: now() };
        transaction.set(ref, result);
        return { response };
      }
      if (data?.status === 'complete') return { response: data.response };
      throw new ApiError(409, 'request_in_progress', '동일한 저장 요청이 처리 중입니다. 잠시 후 새로고침해 결과를 확인해 주세요.');
    });
    return completed.response;
  };
}
