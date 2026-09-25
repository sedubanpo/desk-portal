import { GoogleAuth } from 'google-auth-library';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const PROVIDERS = Object.freeze({
  google: { mode: 'manual', label: '수동 입력', reason: 'Google Workspace 일반 고객의 실제 청구 합계를 조회하는 공식 API가 없습니다.', officialUrl: 'https://developers.google.com/workspace/admin/reseller/v1/how-tos/manage_subscriptions' },
  chatgpt: { mode: 'manual', label: '수동 입력', reason: 'ChatGPT 구독 청구와 OpenAI API 사용 비용은 별도이며, ChatGPT 구독 청구 API는 제공되지 않습니다.', officialUrl: 'https://help.openai.com/en/articles/8156167-how-can-i-change-my-invoice-information' },
  firebase: { mode: 'google-cloud-billing-export', label: 'Google Cloud 결제 내보내기', reason: 'Firebase 프로젝트 비용은 Cloud Billing BigQuery 내보내기의 프로젝트별 예상 비용으로 조회합니다.', officialUrl: 'https://cloud.google.com/billing/docs/how-to/export-data-bigquery' },
  supabase: { mode: 'supabase-management-estimate', label: 'Supabase 공식 예상 비용', reason: 'Management API의 요금제·프로젝트·애드온 구성으로 월 예상 비용을 계산합니다. 사용량 초과분·세금·추가 크레딧은 포함되지 않습니다.', officialUrl: 'https://supabase.com/docs/guides/platform/billing-on-supabase' },
  notion: { mode: 'manual', label: '수동 입력', reason: '공식 Notion API는 워크스페이스 콘텐츠용이며 청구 합계를 제공하지 않습니다.', officialUrl: 'https://developers.notion.com/reference/intro' },
  baemin: { mode: 'manual', label: '수동 입력', reason: '배민클럽은 수동 입력만 지원합니다.', officialUrl: '' }
});

function monthKey(value) {
  const key = String(value || '').trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key) ? key : '';
}

function parseTable(value) {
  const match = String(value || '').trim().match(/^([A-Za-z0-9][A-Za-z0-9_-]{4,62})\.([A-Za-z_][A-Za-z0-9_]{0,1023})\.([A-Za-z_][A-Za-z0-9_*]{0,1023})$/);
  return match ? { project: match[1], quoted: `\`${match[1]}.${match[2]}.${match[3]}\`` } : null;
}

function parseRow(schema, row) {
  const names = (schema?.fields || []).map(field => field.name);
  return Object.fromEntries((row?.f || []).map((cell, index) => [names[index], cell?.v ?? null]));
}

export function createSubscriptionBilling({
  table,
  firebaseProjectIds = [],
  supabaseToken = '',
  supabaseOrgSlugs = [],
  auth = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] }),
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString()
} = {}) {
  const parsedTable = parseTable(table);
  const projectIds = [...new Set(firebaseProjectIds.map(value => String(value || '').trim()).filter(Boolean))];
  const firebaseConfigured = Boolean(parsedTable && projectIds.length);
  const organizationSlugs = [...new Set(supabaseOrgSlugs.map(value => String(value || '').trim()).filter(Boolean))];
  const supabaseConfigured = Boolean(String(supabaseToken || '').trim() && organizationSlugs.length && typeof fetchImpl === 'function');
  let clientPromise;

  async function query(month) {
    if (!firebaseConfigured) throw new Error('Cloud Billing 내보내기 테이블과 Firebase 프로젝트 ID 설정이 필요합니다.');
    if (!clientPromise) clientPromise = auth.getClient();
    const client = await clientPromise;
    const response = await client.request({
      url: `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(parsedTable.project)}/queries`,
      method: 'POST',
      data: {
        query: `SELECT currency, ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0)), 2) AS amount, MAX(export_time) AS latest_export FROM ${parsedTable.quoted} WHERE invoice.month = @invoiceMonth AND project.id IN UNNEST(@projectIds) GROUP BY currency`,
        useLegacySql: false,
        timeoutMs: 15000,
        parameterMode: 'NAMED',
        queryParameters: [
          { name: 'invoiceMonth', parameterType: { type: 'STRING' }, parameterValue: { value: month.replace('-', '') } },
          { name: 'projectIds', parameterType: { type: 'ARRAY', arrayType: { type: 'STRING' } }, parameterValue: { arrayValues: projectIds.map(value => ({ value })) } }
        ]
      }
    });
    const data = response.data || {};
    if (!data.jobComplete) throw new Error('Cloud Billing 조회가 제한 시간 안에 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.');
    return (data.rows || []).map(row => parseRow(data.schema, row));
  }

  async function supabaseGet(path) {
    if (!supabaseConfigured) throw new Error('Supabase 조직과 읽기 전용 Management API 토큰 설정이 필요합니다.');
    const response = await fetchImpl(`https://api.supabase.com/v1${path}`, {
      headers: { Authorization: `Bearer ${String(supabaseToken).trim()}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Supabase 공식 API 조회에 실패했습니다. (${response.status})`);
    return response.json();
  }

  async function querySupabaseEstimate(month) {
    let total = 0;
    let projectCount = 0;
    const details = [];
    for (const slug of organizationSlugs) {
      const [organization, projectsResult] = await Promise.all([
        supabaseGet(`/organizations/${encodeURIComponent(slug)}`),
        supabaseGet(`/organizations/${encodeURIComponent(slug)}/projects`)
      ]);
      const plan = String(organization?.plan || '').toLowerCase();
      if (plan !== 'pro') throw new Error(`지원하지 않는 Supabase 요금제(${organization?.plan || '미확인'})입니다. 실제 청구서를 수동 입력해 주세요.`);
      const projects = Array.isArray(projectsResult) ? projectsResult : projectsResult?.projects;
      if (!Array.isArray(projects)) throw new Error('Supabase 프로젝트 목록 형식이 예상과 다릅니다.');
      const activeProjects = projects.filter(project => String(project?.status || '').startsWith('ACTIVE'));
      let organizationCompute = 0;
      for (const project of activeProjects) {
        const size = String(project?.databases?.[0]?.infra_compute_size || '').toLowerCase();
        if (!['nano', 'micro'].includes(size)) throw new Error(`${project?.name || project?.ref || '프로젝트'}의 컴퓨트 크기(${size || '미확인'})는 자동 계산할 수 없습니다.`);
        const addons = await supabaseGet(`/projects/${encodeURIComponent(project.ref)}/billing/addons`);
        if ((addons?.selected_addons || []).length) throw new Error(`${project?.name || project.ref}에 유료 애드온이 있어 자동 합계를 보류했습니다. 실제 청구서를 수동 입력해 주세요.`);
        organizationCompute += 10;
      }
      const planFee = 25;
      const computeCredit = Math.min(10, organizationCompute);
      total += planFee + organizationCompute - computeCredit;
      projectCount += activeProjects.length;
      details.push(`${organization?.name || slug}: Pro $${planFee} + Nano/Micro ${activeProjects.length}개 $${organizationCompute} - 컴퓨트 크레딧 $${computeCredit}`);
    }
    return {
      payment: {
        date: '',
        amount: Math.round(total * 100) / 100,
        currency: 'USD',
        status: 'unknown',
        note: `${details.join(' / ')} · 활성 프로젝트 ${projectCount}개 · 사용량 초과분·세금·추가 크레딧 제외`,
        source: 'supabase-management-estimate',
        quality: 'estimate',
        billingPeriod: month,
        syncedAt: now(),
        latestExportAt: ''
      },
      source: 'supabase-management-estimate',
      sourceUrl: PROVIDERS.supabase.officialUrl
    };
  }

  return {
    capabilities() {
      return Object.fromEntries(Object.entries(PROVIDERS).map(([id, provider]) => [id, {
        ...provider,
        configured: id === 'firebase' ? firebaseConfigured : id === 'supabase' ? supabaseConfigured : false
      }]));
    },
    async sync({ serviceId, month }) {
      const key = monthKey(month);
      if (!key) throw new Error('조회 월이 올바르지 않습니다.');
      if (serviceId === 'supabase') return querySupabaseEstimate(key);
      if (serviceId !== 'firebase') throw new Error(PROVIDERS[serviceId]?.reason || '이 구독은 공식 청구 연동을 지원하지 않습니다.');
      const rows = await query(key);
      if (!rows.length) throw new Error('선택한 월의 Firebase 프로젝트 결제 내보내기 데이터가 아직 없습니다. 0원으로 처리하지 않았습니다.');
      if (rows.length !== 1) throw new Error('여러 통화가 섞여 있어 자동 합계할 수 없습니다. 통화별 금액을 확인해 주세요.');
      const currency = String(rows[0].currency || '').toUpperCase();
      const amount = Number(rows[0].amount);
      if (!['KRW', 'USD'].includes(currency) || !Number.isFinite(amount) || amount < 0) throw new Error('지원하지 않는 통화 또는 금액이 반환되었습니다. 원본 결제 내보내기를 확인해 주세요.');
      return {
        payment: {
          date: '', amount: currency === 'KRW' ? Math.round(amount) : Math.round(amount * 100) / 100,
          currency, status: 'unknown', note: '', source: 'google-cloud-billing-export',
          quality: 'estimate', billingPeriod: key, syncedAt: now(), latestExportAt: String(rows[0].latest_export || '')
        },
        source: 'google-cloud-billing-export',
        sourceUrl: PROVIDERS.firebase.officialUrl
      };
    }
  };
}

export { PROVIDERS as SUBSCRIPTION_BILLING_PROVIDERS };
