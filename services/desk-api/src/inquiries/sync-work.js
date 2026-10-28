import { ApiError } from '../http.js';

export const SYNC_BUDGET_MS = 90000;
export const SYNC_CONCURRENCY = 8;

// Stop scheduling on failure, but drain started transactions before releasing the lease.
export async function mapSyncWork(values, work, check = () => {}, concurrency = SYNC_CONCURRENCY) {
  let next = 0, failure;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (!failure && next < values.length) {
      const index = next++;
      try { check(); await work(values[index]); } catch (error) { failure ||= error; }
    }
  }));
  if (failure) throw failure;
}

export function syncTimeout() {
  return new ApiError(503, 'inquiry_sync_timeout', '문의 동기화 실행 시간을 초과했습니다. 다음 실행에서 다시 시도합니다.');
}
