import { ApiError } from '../http.js';

export function createNotionClient({ token, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  let lane = Promise.resolve();
  return async function notion(path, method = 'GET', body) {
    if (!token) throw new ApiError(503, 'notion_not_configured', '노션 연결 설정이 필요합니다.');
    // Serialize calls in this instance; 429 also covers shared integration traffic.
    const previous = lane;
    let release;
    lane = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        let response;
        try {
          response = await fetchImpl(`https://api.notion.com/v1${path}`, {
            method, headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
            ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000)
          });
        } catch {
          throw new ApiError(503, 'notion_unavailable', '노션 응답을 확인하지 못했습니다. 같은 요청을 다시 시도해 주세요.');
        }
        if (response.status === 429 && attempt < 3) {
          await sleep(Math.min(30000, Math.max(1000, Number(response.headers.get('retry-after') || 1) * 1000)));
          continue;
        }
        if (!response.ok) {
          const status = response.status;
          throw new ApiError(status === 404 || status === 403 ? 503 : status === 400 ? 400 : 503,
            status === 404 || status === 403 ? 'notion_access_required' : 'notion_request_failed',
            status === 404 || status === 403 ? '노션 DB 연결 권한을 확인해 주세요. 신규문의 DB에 sedu catch 연결이 필요합니다.' : status === 400 ? '노션 속성 형식이 변경되었습니다. 새로고침 후 다시 시도해 주세요.' : '노션 저장을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
        return await response.json();
      }
    } finally { await sleep(350); release(); }
  };
}
