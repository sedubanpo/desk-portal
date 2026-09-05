import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayrollStore } from '../src/payroll/store.js';

function fakeFirestore() {
  const documents = new Map();
  const refFor = (collection, id) => ({ collection, id, key: `${collection}/${id}` });
  const snapshotFor = ref => ({
    exists: documents.has(ref.key),
    data: () => structuredClone(documents.get(ref.key))
  });
  return {
    collection: collection => ({ doc: id => refFor(collection, id) }),
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        get: async ref => snapshotFor(ref),
        getAll: async (...refs) => Promise.all(refs.map(snapshotFor)),
        set: (ref, value) => writes.push([ref, structuredClone(value)])
      };
      const result = await callback(transaction);
      writes.forEach(([ref, value]) => documents.set(ref.key, value));
      return result;
    },
    documents
  };
}

const identity = { uid: 'staff-1', name: '급여 담당자' };

test('payroll write receipts are isolated by method and staff identity', async () => {
  const firestore = fakeFirestore();
  const store = createPayrollStore(firestore);
  const requestId = 'shared-browser-request';

  const settings = await store.saveSettings({
    requestId,
    payload: { updates: [] },
    identity,
    nowIso: '2026-09-05T00:00:00.000Z',
    mutate: current => ({ ...current, '김강사': { salaryMode: 'hourly', hourlyRate: 50000 } })
  });
  const overrides = await store.saveOverrides({
    requestId,
    monthName: '26-09',
    overrides: { amountOverrides: [{ rowKey: '26-09:2:row', amount: 25000 }] },
    identity,
    nowIso: '2026-09-05T00:00:01.000Z'
  });
  const otherStaff = await store.saveOverrides({
    requestId,
    monthName: '26-10',
    overrides: { amountOverrides: [{ rowKey: '26-10:2:row', amount: 30000 }] },
    identity: { uid: 'staff-2', name: '다른 담당자' },
    nowIso: '2026-09-05T00:00:02.000Z'
  });
  const replay = await store.saveSettings({
    requestId,
    payload: { updates: [] },
    identity,
    nowIso: '2026-09-05T00:00:03.000Z',
    mutate: () => ({ changed: true })
  });

  assert.equal(settings.duplicate, undefined);
  assert.equal(overrides.duplicate, undefined);
  assert.equal(otherStaff.duplicate, undefined);
  assert.deepEqual(overrides.overrides.amountOverrides, [{ rowKey: '26-09:2:row', amount: 25000 }]);
  assert.deepEqual(otherStaff.overrides.amountOverrides, [{ rowKey: '26-10:2:row', amount: 30000 }]);
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.settings, settings.settings);
  assert.equal(firestore.documents.size, 6);
});
