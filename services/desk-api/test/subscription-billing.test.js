import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSubscriptionBilling } from '../src/desk/subscription-billing.js';

function fakeAuth(data, requests = []) {
  return { getClient: async () => ({ request: async options => { requests.push(options); return { data }; } }) };
}

test('Firebase billing export uses invoice month and configured project scope', async () => {
  const requests = [];
  const billing = createSubscriptionBilling({
    table: 'billing-project.billing_dataset.gcp_billing_export_v1_ABC',
    firebaseProjectIds: ['fir-lms-prod', 'fir-lms-prod'],
    auth: fakeAuth({ jobComplete: true, schema: { fields: [{ name: 'currency' }, { name: 'amount' }, { name: 'latest_export' }] }, rows: [{ f: [{ v: 'KRW' }, { v: '12345.4' }, { v: '2026-09-24T00:00:00Z' }] }] }, requests),
    now: () => '2026-09-24T12:00:00.000Z'
  });
  const result = await billing.sync({ serviceId: 'firebase', month: '2026-09' });
  assert.equal(result.payment.amount, 12345);
  assert.equal(result.payment.quality, 'estimate');
  assert.equal(requests[0].data.queryParameters[0].parameterValue.value, '202609');
  assert.deepEqual(requests[0].data.queryParameters[1].parameterValue.arrayValues, [{ value: 'fir-lms-prod' }]);
  assert.match(requests[0].data.query, /project\.id IN UNNEST\(@projectIds\)/);
});

test('billing export keeps currencies separate and never turns missing data into zero', async () => {
  const mixed = createSubscriptionBilling({ table: 'billing-project.data.table', firebaseProjectIds: ['one'], auth: fakeAuth({ jobComplete: true, schema: { fields: [{ name: 'currency' }, { name: 'amount' }] }, rows: [{ f: [{ v: 'KRW' }, { v: '1' }] }, { f: [{ v: 'USD' }, { v: '2' }] }] }) });
  await assert.rejects(mixed.sync({ serviceId: 'firebase', month: '2026-09' }), /여러 통화/);
  const empty = createSubscriptionBilling({ table: 'billing-project.data.table', firebaseProjectIds: ['one'], auth: fakeAuth({ jobComplete: true, schema: { fields: [] }, rows: [] }) });
  await assert.rejects(empty.sync({ serviceId: 'firebase', month: '2026-09' }), /0원으로 처리하지 않았습니다/);
});

test('Firebase and configured Supabase expose linked estimate modes', async () => {
  const requests = [];
  const responses = new Map([
    ['/v1/organizations/example-org', { id: 'org', name: 'Example Org', plan: 'pro' }],
    ['/v1/organizations/example-org/projects', { projects: [
      { ref: 'one', name: 'One', status: 'ACTIVE_HEALTHY', databases: [{ infra_compute_size: 'nano' }] },
      { ref: 'two', name: 'Two', status: 'ACTIVE_HEALTHY', databases: [{ infra_compute_size: 'micro' }] },
      { ref: 'paused', name: 'Paused', status: 'INACTIVE', databases: [{ infra_compute_size: 'nano' }] }
    ] }],
    ['/v1/projects/one/billing/addons', { selected_addons: [] }],
    ['/v1/projects/two/billing/addons', { selected_addons: [] }]
  ]);
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname;
    requests.push({ path, options });
    return { ok: responses.has(path), status: responses.has(path) ? 200 : 404, json: async () => responses.get(path) };
  };
  const billing = createSubscriptionBilling({ table: 'billing-project.data.table', firebaseProjectIds: ['one'], auth: fakeAuth({}) });
  const capabilities = billing.capabilities();
  assert.equal(capabilities.firebase.configured, true);
  assert.equal(capabilities.supabase.configured, false);
  for (const id of ['google', 'chatgpt', 'notion', 'baemin']) assert.equal(capabilities[id].mode, 'manual');
  await assert.rejects(billing.sync({ serviceId: 'baemin', month: '2026-09' }), /수동 입력/);

  const supabase = createSubscriptionBilling({
    supabaseToken: 'secret-token',
    supabaseOrgSlugs: ['example-org'],
    fetchImpl,
    now: () => '2026-09-25T00:00:00.000Z'
  });
  assert.equal(supabase.capabilities().supabase.configured, true);
  const result = await supabase.sync({ serviceId: 'supabase', month: '2026-09' });
  assert.equal(result.payment.amount, 35);
  assert.equal(result.payment.currency, 'USD');
  assert.equal(result.payment.source, 'supabase-management-estimate');
  assert.match(result.payment.note, /Pro \$25.*2개 \$20.*크레딧 \$10/);
  assert.equal(requests.length, 4);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer secret-token');
});

test('Supabase estimate refuses unknown plans, compute sizes, and paid add-ons', async () => {
  const factory = ({ plan = 'pro', size = 'nano', addons = [] } = {}) => createSubscriptionBilling({
    supabaseToken: 'token',
    supabaseOrgSlugs: ['org'],
    fetchImpl: async url => {
      const path = new URL(url).pathname;
      const data = path === '/v1/organizations/org'
        ? { name: 'Org', plan }
        : path === '/v1/organizations/org/projects'
          ? { projects: [{ ref: 'project', name: 'Project', status: 'ACTIVE_HEALTHY', databases: [{ infra_compute_size: size }] }] }
          : { selected_addons: addons };
      return { ok: true, status: 200, json: async () => data };
    }
  });
  await assert.rejects(factory({ plan: 'team' }).sync({ serviceId: 'supabase', month: '2026-09' }), /지원하지 않는 Supabase 요금제/);
  await assert.rejects(factory({ size: 'small' }).sync({ serviceId: 'supabase', month: '2026-09' }), /자동 계산할 수 없습니다/);
  await assert.rejects(factory({ addons: [{ type: 'ipv4' }] }).sync({ serviceId: 'supabase', month: '2026-09' }), /유료 애드온/);
});
