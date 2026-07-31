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
