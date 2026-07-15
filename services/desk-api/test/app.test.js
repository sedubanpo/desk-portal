import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

const config = {
  environment: 'test',
  allowedOrigins: ['https://sedubanpo.github.io']
};

function testApp(overrides = {}) {
  return createApp({
    config,
    verifyIdToken: async token => ({
      uid: 'staff-1',
      email: 'staff@example.com',
      name: '테스트 근무자',
      token
    }),
    loadAccount: async () => ({
      account: { role: 'STAFF', status: 'ACTIVE', name: '테스트 근무자' },
      access: {
        apps: { deskPortal: true, sLms: true },
        permissions: { canManageSchedules: true, canManageAccounts: false }
      }
    }),
    ...overrides
  });
}

test('health endpoint is public and does not expose framework headers', async () => {
  const response = await request(testApp()).get('/health').expect(200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service, 'desk-portal-api');
  assert.equal(response.headers['x-powered-by'], undefined);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(response.headers['x-request-id']);
});

test('allowed origin receives CORS headers and preflight succeeds', async () => {
  const response = await request(testApp())
    .options('/v1/me')
    .set('origin', 'https://sedubanpo.github.io')
    .expect(204);
  assert.equal(response.headers['access-control-allow-origin'], 'https://sedubanpo.github.io');
  assert.match(response.headers['access-control-allow-headers'], /authorization/);
});

test('unknown browser origin is rejected', async () => {
  const response = await request(testApp())
    .get('/health')
    .set('origin', 'https://example.com')
    .expect(403);
  assert.equal(response.body.error.code, 'origin_not_allowed');
});

test('me requires a Firebase bearer token', async () => {
  const response = await request(testApp()).get('/v1/me').expect(401);
  assert.equal(response.body.error.code, 'authentication_required');
});

test('me returns the normalized staff identity', async () => {
  const response = await request(testApp())
    .get('/v1/me')
    .set('authorization', 'Bearer valid-token')
    .expect(200);
  assert.deepEqual(response.body.user, {
    uid: 'staff-1',
    email: 'staff@example.com',
    name: '테스트 근무자',
    role: 'STAFF',
    status: 'ACTIVE',
    apps: { deskPortal: true, sLms: true },
    permissions: { canManageSchedules: true, canManageAccounts: false }
  });
});

test('invalid tokens are rejected without leaking verifier errors', async () => {
  const app = testApp({ verifyIdToken: async () => { throw new Error('private verifier detail'); } });
  const response = await request(app)
    .get('/v1/me')
    .set('authorization', 'Bearer invalid-token')
    .expect(401);
  assert.equal(response.body.error.code, 'invalid_id_token');
  assert.doesNotMatch(JSON.stringify(response.body), /private verifier detail/);
});

test('missing, inactive, and non-staff accounts are denied', async t => {
  const cases = [
    [null, 'account_not_registered'],
    [{ role: 'STAFF', status: 'DISABLED' }, 'account_inactive'],
    [{ role: 'STUDENT', status: 'ACTIVE' }, 'staff_access_required']
  ];

  for (const [account, expectedCode] of cases) {
    await t.test(expectedCode, async () => {
      const app = testApp({ loadAccount: async () => ({ account, access: null }) });
      const response = await request(app)
        .get('/v1/me')
        .set('authorization', 'Bearer valid-token')
        .expect(403);
      assert.equal(response.body.error.code, expectedCode);
    });
  }
});

test('an active instructor without deskPortal app access is denied', async () => {
  const app = testApp({
    loadAccount: async () => ({
      account: { role: 'INSTRUCTOR', status: 'ACTIVE' },
      access: { apps: { deskPortal: false, teacherPortal: true } }
    })
  });
  const response = await request(app)
    .get('/v1/me')
    .set('authorization', 'Bearer valid-token')
    .expect(403);
  assert.equal(response.body.error.code, 'desk_portal_access_required');
});

test('account lookup failures become a generic service error', async () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const app = testApp({ loadAccount: async () => { throw new Error('database internals'); } });
    const response = await request(app)
      .get('/v1/me')
      .set('authorization', 'Bearer valid-token')
      .expect(503);
    assert.equal(response.body.error.code, 'account_lookup_unavailable');
    assert.doesNotMatch(JSON.stringify(response.body), /database internals/);
  } finally {
    console.error = originalConsoleError;
  }
});

test('migration contract reports Turn 4 handlers without switching production traffic', async () => {
  const response = await request(testApp())
    .get('/v1/migration')
    .set('authorization', 'Bearer valid-token')
    .expect(200);
  assert.equal(response.body.migration.phase, 4);
  assert.equal(response.body.migration.migratedBusinessMethods, 39);
  assert.deepEqual(response.body.migration.migratedDomains, ['schedule', 'dailyJournal', 'supplies', 'recruiting', 'tuition', 'payroll', 'googleWorkspace']);
  assert.equal(response.body.migration.productionTrafficSwitched, false);
  assert.ok(response.body.migration.legacyMethods > 0);
});

test('desk route authenticates, dispatches reads, and carries write idempotency context', async () => {
  const contexts = [];
  const app = testApp({
    deskHandlers: {
      getDeskSuppliesData: async () => ({ success: true, data: { consumables: [] } }),
      saveDeskSupplyPurchaseState: async payload => ({ success: true, payload })
    },
    runIdempotent: async (context, operation) => {
      contexts.push(context);
      return operation();
    }
  });
  const read = await request(app).post('/v1/desk/getDeskSuppliesData').set('authorization', 'Bearer valid-token').send({ payload: {} }).expect(200);
  assert.equal(read.body.success, true);
  assert.equal(contexts.length, 0);

  const write = await request(app).post('/v1/desk/saveDeskSupplyPurchaseState')
    .set('authorization', 'Bearer valid-token').set('x-idempotency-key', 'write-1')
    .send({ payload: { purchaseRequestNote: 'test' } }).expect(200);
  assert.equal(write.body.payload.purchaseRequestNote, 'test');
  assert.deepEqual(contexts[0], { uid: 'staff-1', method: 'saveDeskSupplyPurchaseState', key: 'write-1' });
});

test('unmigrated maintenance methods are rejected before dispatch', async () => {
  const response = await request(testApp())
    .post('/v1/desk/backfillTuitionMonthSnapshots')
    .set('authorization', 'Bearer valid-token')
    .send({ payload: { dateKey: '2026-07-15' } })
    .expect(404);
  assert.equal(response.body.error.code, 'desk_method_not_found');
});

test('payroll methods require admin or explicit payroll permission', async () => {
  const denied = testApp({ deskHandlers: { getPayrollSettings: async () => ({ success: true }) } });
  const deniedResponse = await request(denied).post('/v1/desk/getPayrollSettings')
    .set('authorization', 'Bearer valid-token').send({ payload: {} }).expect(403);
  assert.equal(deniedResponse.body.error.code, 'payroll_access_required');

  const allowed = testApp({
    loadAccount: async () => ({
      account: { role: 'STAFF', status: 'ACTIVE', name: '급여 담당자' },
      access: { apps: { deskPortal: true }, permissions: { canManagePayroll: true } }
    }),
    deskHandlers: { getPayrollSettings: async (_payload, identity) => ({ success: true, role: identity.role }) }
  });
  const allowedResponse = await request(allowed).post('/v1/desk/getPayrollSettings')
    .set('authorization', 'Bearer valid-token').send({ payload: {} }).expect(200);
  assert.equal(allowedResponse.body.success, true);
  assert.equal(allowedResponse.body.role, 'STAFF');
});

test('tuition writes dispatch with staff identity and idempotency context', async () => {
  const contexts = [];
  const identities = [];
  const app = testApp({
    deskHandlers: {
      appendTuitionPaymentEntry: async (payload, identity) => {
        identities.push(identity);
        return { success: true, payload };
      }
    },
    runIdempotent: async (context, operation) => {
      contexts.push(context);
      return operation();
    }
  });
  const response = await request(app).post('/v1/desk/appendTuitionPaymentEntry')
    .set('authorization', 'Bearer valid-token').set('x-idempotency-key', 'append:request-1')
    .send({ payload: { clientRequestId: 'request-1', studentName: '김재희' } }).expect(200);
  assert.equal(response.body.success, true);
  assert.equal(identities[0].uid, 'staff-1');
  assert.deepEqual(contexts[0], { uid: 'staff-1', method: 'appendTuitionPaymentEntry', key: 'append:request-1' });
});
