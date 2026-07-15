import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createIdempotencyExecutor } from '../src/idempotency.js';

function fakeFirestore() {
  const documents = new Map();
  const refFor = id => ({
    id,
    async set(value, options = {}) {
      documents.set(id, options.merge ? { ...(documents.get(id) || {}), ...structuredClone(value) } : structuredClone(value));
    }
  });
  return {
    collection: () => ({ doc: id => refFor(id) }),
    async runTransaction(callback) {
      const pending = [];
      const result = await callback({
        get: async ref => ({ exists: documents.has(ref.id), data: () => structuredClone(documents.get(ref.id)) }),
        set: (ref, value) => pending.push([ref.id, structuredClone(value)])
      });
      pending.forEach(([id, value]) => documents.set(id, value));
      return result;
    },
    documents
  };
}

test('completed idempotent writes replay the stored response without rerunning work', async () => {
  const firestore = fakeFirestore();
  let operations = 0;
  const execute = createIdempotencyExecutor(firestore, () => 1000);
  const context = { uid: 'staff-1', method: 'saveDeskDailyJournalTask', key: 'task-save-1' };
  const first = await execute(context, async () => { operations += 1; return { success: true, id: 'task-1' }; });
  const second = await execute(context, async () => { operations += 1; return { success: true, id: 'wrong' }; });
  assert.deepEqual(second, first);
  assert.equal(operations, 1);
});

test('writes without an idempotency key fail before running work', async () => {
  const execute = createIdempotencyExecutor(fakeFirestore());
  let ran = false;
  await assert.rejects(
    execute({ uid: 'staff-1', method: 'saveDeskDailyJournalTask', key: '' }, async () => { ran = true; }),
    error => error.code === 'idempotency_key_required' && error.status === 400
  );
  assert.equal(ran, false);
});
