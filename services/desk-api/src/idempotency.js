import { createHash } from 'node:crypto';
import { ApiError } from './http.js';

const PROCESSING_LEASE_MS = 2 * 60 * 1000;

export function createIdempotencyExecutor(firestore, now = () => Date.now()) {
  if (!firestore) throw new TypeError('firestore is required.');

  return async function runIdempotent({ uid, method, key }, operation) {
    const safeKey = String(key || '').trim();
    if (!safeKey || safeKey.length > 160) {
      throw new ApiError(400, 'idempotency_key_required', '쓰기 요청에는 유효한 x-idempotency-key가 필요합니다.');
    }
    const id = createHash('sha256').update(`${uid}\n${method}\n${safeKey}`).digest('hex');
    const ref = firestore.collection('deskApiIdempotency').doc(id);
    const startedAt = now();
    const state = await firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.exists ? snapshot.data() : null;
      if (data?.status === 'complete') return { replay: true, response: data.response };
      if (data?.status === 'processing' && startedAt - Number(data.startedAt || 0) < PROCESSING_LEASE_MS) {
        throw new ApiError(409, 'request_in_progress', '동일한 저장 요청이 처리 중입니다. 잠시 후 새로고침해 결과를 확인해 주세요.');
      }
      transaction.set(ref, { uid, method, key: safeKey, status: 'processing', startedAt, updatedAt: startedAt });
      return { replay: false };
    });
    if (state.replay) return state.response;

    try {
      const response = await operation();
      await ref.set({ status: 'complete', response, completedAt: now(), updatedAt: now() }, { merge: true });
      return response;
    } catch (error) {
      await ref.set({ status: 'failed', failedAt: now(), updatedAt: now() }, { merge: true }).catch(() => {});
      throw error;
    }
  };
}
