import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeskStore } from '../src/desk/store.js';

test('root multipath updates use the database root reference', async () => {
  const calls = [];
  const rootRef = {
    update: async value => calls.push({ path: null, value })
  };
  const database = {
    ref(path) {
      if (arguments.length && path === '') throw new Error('empty child path');
      if (typeof path === 'undefined') return rootRef;
      return { update: async value => calls.push({ path, value }) };
    }
  };
  const store = createDeskStore(database);
  const updates = {
    'desk_portal/monthly_schedule/2026-08/entries/first': null,
    'desk_portal/monthly_schedule_history/2026-08/2026-08-01/version': { id: 'version' }
  };

  await store.update('', updates);

  assert.deepEqual(calls, [{ path: null, value: updates }]);
});

test('timed out reads reconnect to Realtime Database and retry once', async () => {
  let attempts = 0;
  let offlineCalls = 0;
  let onlineCalls = 0;
  const snapshot = {
    exists: () => true,
    val: () => ({ tasks: [{ id: 'shared-task' }] })
  };
  const database = {
    ref() {
      return {
        get() {
          attempts += 1;
          return attempts === 1 ? new Promise(() => {}) : Promise.resolve(snapshot);
        }
      };
    },
    goOffline() {
      offlineCalls += 1;
    },
    goOnline() {
      onlineCalls += 1;
    }
  };
  const store = createDeskStore(database, { readTimeoutMs: 5 });

  const result = await store.get('desk_portal/daily_journal/2026-08-08');

  assert.deepEqual(result, { tasks: [{ id: 'shared-task' }] });
  assert.equal(attempts, 2);
  assert.equal(offlineCalls, 1);
  assert.equal(onlineCalls, 1);
});
