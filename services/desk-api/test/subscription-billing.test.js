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

test('only Firebase exposes a linked billing mode', async () => {
  const billing = createSubscriptionBilling({ table: 'billing-project.data.table', firebaseProjectIds: ['one'], auth: fakeAuth({}) });
  const capabilities = billing.capabilities();
  assert.equal(capabilities.firebase.configured, true);
  for (const id of ['google', 'chatgpt', 'supabase', 'notion', 'baemin']) assert.equal(capabilities[id].mode, 'manual');
  await assert.rejects(billing.sync({ serviceId: 'baemin', month: '2026-09' }), /수동 입력/);
});
