import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayrollAccess } from '../src/payroll/access.js';

const secret = 'a-production-length-secret-with-32-chars';

test('payroll access issues a short-lived token bound to the staff account', () => {
  let clock = 1_000_000;
  const access = createPayrollAccess({ pin: '030606', secret, ttlSeconds: 60, now: () => clock });
  assert.equal(access.verifyPin('staff-1', '030606').ok, true);
  const issued = access.issue('staff-1');
  assert.equal(access.verify('staff-1', issued.token), true);
  assert.equal(access.verify('staff-2', issued.token), false);
  clock += 61_000;
  assert.equal(access.verify('staff-1', issued.token), false);
});

test('payroll access locks repeated incorrect PIN attempts', () => {
  const access = createPayrollAccess({ pin: '030606', secret, now: () => 1_000_000 });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert.deepEqual(access.verifyPin('staff-1', '999999'), { ok: false, lockedUntil: 0 });
  }
  const locked = access.verifyPin('staff-1', '999999');
  assert.equal(locked.ok, false);
  assert.ok(locked.lockedUntil > 1_000_000);
  assert.equal(access.verifyPin('staff-1', '030606').ok, false);
});

test('payroll access rejects invalid configuration', () => {
  assert.throws(() => createPayrollAccess({ pin: '123', secret }), /6 digits/);
  assert.throws(() => createPayrollAccess({ pin: '030606', secret: 'short' }), /32 characters/);
});
