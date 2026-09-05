import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const frontendPath = new URL('../../../docs/index.html', import.meta.url);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} was not found in docs/index.html`);
  return extractFunctionAt(source, start);
}

function extractFunctionAt(source, start) {
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('function has an unbalanced body');
}

function loadFunction(source, name, globals) {
  const context = vm.createContext({
    Promise,
    Error,
    JSON,
    String,
    RegExp,
    Object,
    ...globals
  });
  return vm.runInContext(`(${extractFunction(source, name)})`, context);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function nextTurn() {
  await Promise.resolve();
  await Promise.resolve();
}

test('tuition refresh clears a visible spinner when a newer silent refresh supersedes it', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const first = deferred();
  const second = deferred();
  const loading = [];
  const state = {
    tuition: {
      selectedMonth: '26-09s',
      summaryRequestVersion: 0,
      months: []
    }
  };
  let call = 0;
  const refreshTuitionSummary = loadFunction(source, 'refreshTuitionSummary', {
    state,
    setLoading: (visible) => loading.push(visible),
    renderTuitionOpsStatus_: () => {},
    runServer: () => (call += 1) === 1 ? first.promise : second.promise,
    renderTuitionMonthOptions: () => {},
    renderTuitionSummary: () => {},
    alert: () => {},
    console: { warn: () => {} }
  });

  const visibleRequest = refreshTuitionSummary(false);
  const silentRequest = refreshTuitionSummary(false, { silent: true });
  first.resolve({ success: true, selectedMonth: '26-09s' });
  second.resolve({ success: true, selectedMonth: '26-09s' });
  await Promise.all([visibleRequest, silentRequest]);

  assert.equal(loading[0], true, 'the initial visible request should show the spinner');
  assert.equal(loading.at(-1), false, 'the spinner must clear after the current silent request completes');
});

test('a stale payroll-summary failure cannot alert or hide a newer request', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const first = deferred();
  const second = deferred();
  const messages = [];
  const loading = [];
  const state = { requestSeq: 0 };
  let call = 0;
  const refreshSummary = loadFunction(source, 'refreshSummary', {
    state,
    Promise,
    setLoading: (visible) => loading.push(visible),
    ensureTeacherSettingsLoaded_: () => Promise.resolve(),
    buildPayload: () => ({}),
    runServer: () => (call += 1) === 1 ? first.promise : second.promise,
    showClientMessage: (message) => messages.push(message)
  });

  const staleRequest = refreshSummary(false);
  const currentRequest = refreshSummary(false);
  await nextTurn();
  first.reject(new Error('old request failed'));
  await staleRequest;

  assert.deepEqual(messages, [], 'only the active request may surface an error');
  assert.deepEqual(loading, [true, true], 'a stale request may not hide the newer loading state');

  second.resolve({ success: true, months: [], selectedMonth: '' });
  await currentRequest;
});

test('a malformed HTTP 200 Cloud API response rejects instead of masquerading as an empty success', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const state = {
    cloudApiReady: true,
    firebaseUser: { getIdToken: () => Promise.resolve('test-token') },
    payroll: {}
  };
  const runDeskCloudApi = loadFunction(source, 'runDeskCloudApi_', {
    state,
    DESK_CLOUD_METHODS: { getDeskPortalConfig: true },
    DESK_CLOUD_API_BASE: 'https://offline.invalid',
    canUseDeskCloudApi_: () => true,
    isPayrollCloudMethod_: () => false,
    isRunServerWriteApi_: () => false,
    fetch: () => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('invalid JSON'))
    })
  });

  await assert.rejects(
    runDeskCloudApi('getDeskPortalConfig', {}),
    /invalid JSON|응답|JSON/i
  );
});

test('a valid JSON null Cloud API response remains compatible with the empty-object result shape', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const state = {
    cloudApiReady: true,
    firebaseUser: { getIdToken: () => Promise.resolve('test-token') },
    payroll: {}
  };
  const runDeskCloudApi = loadFunction(source, 'runDeskCloudApi_', {
    state,
    DESK_CLOUD_METHODS: { getDeskPortalConfig: true },
    DESK_CLOUD_API_BASE: 'https://offline.invalid',
    canUseDeskCloudApi_: () => true,
    isPayrollCloudMethod_: () => false,
    isRunServerWriteApi_: () => false,
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null) })
  });

  const result = await runDeskCloudApi('getDeskPortalConfig', {});
  assert.equal(result && Object.keys(result).length, 0);
});

test('read-only 4xx failures are terminal and do not schedule a retry', async () => {
  const source = await readFile(frontendPath, 'utf8');
  let attempts = 0;
  const delays = [];
  const runServer = loadFunction(source, 'runServer', {
    runServerReadInFlight_: {},
    RUN_SERVER_READ_RETRY_ATTEMPTS: 2,
    RUN_SERVER_READ_RETRY_BASE_DELAY_MS: 1,
    shouldRetryRunServer_: () => true,
    getRunServerTimeoutMs_: () => 10,
    runServerAttempt_: () => {
      attempts += 1;
      const error = new Error('missing');
      error.status = 404;
      return Promise.reject(error);
    },
    isRunServerTimeoutError_: () => false,
    delay_: (ms) => {
      delays.push(ms);
      return Promise.resolve();
    }
  });

  await assert.rejects(runServer('getDeskPortalConfig', {}), /missing/);
  assert.equal(attempts, 1);
  assert.deepEqual(delays, []);
});

test('a timed-out server attempt aborts its in-flight fetch and marks the error non-retryable', async () => {
  const source = await readFile(frontendPath, 'utf8');
  let aborted = false;
  const runServerAttempt = loadFunction(source, 'runServerAttempt_', {
    DESK_CLOUD_METHODS: { getDeskPortalConfig: true },
    AbortController,
    setTimeout,
    clearTimeout,
    isRunServerWriteApi_: () => false,
    runDeskCloudApi_: (_fnName, _payload, signal) => new Promise(() => {
      signal.addEventListener('abort', () => { aborted = true; }, { once: true });
    })
  });

  await assert.rejects(
    runServerAttempt('getDeskPortalConfig', {}, 5),
    (error) => error.nonRetryable === true && /초과/.test(error.message)
  );
  assert.equal(aborted, true);
});

test('a late unpaid-month response cannot replace the month selected by a newer request', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const first = deferred();
  const second = deferred();
  const renders = [];
  let call = 0;
  const loadAndRenderTuitionUnpaidMonth = loadFunction(source, 'loadAndRenderTuitionUnpaidMonth_', {
    state: { tuition: {} },
    tuitionUnpaidSummaryEl: { textContent: '' },
    tuitionUnpaidListEl: { innerHTML: '' },
    runServer: () => (call += 1) === 1 ? first.promise : second.promise,
    formatTuitionMonthLabel_: (month) => month,
    toNumber: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    formatStudentName: (name) => String(name || ''),
    renderTuitionUnpaidMonth_: (month, payload) => renders.push({ month, payload }),
    escapeHtml: (value) => String(value)
  });

  loadAndRenderTuitionUnpaidMonth('26-08s');
  loadAndRenderTuitionUnpaidMonth('26-09s');
  second.resolve({ success: true, rows: [{ studentName: 'B', unpaidStatus: '안내이전', outstandingAmount: 20 }] });
  await nextTurn();
  first.resolve({ success: true, rows: [{ studentName: 'A', unpaidStatus: '안내이전', outstandingAmount: 10 }] });
  await nextTurn();

  assert.equal(renders.length, 1, 'only the current month may render');
  assert.equal(renders[0].month, '26-09s');
  assert.equal(renders[0].payload.rows[0].studentName, 'B');
});

test('closing the unpaid modal invalidates its still-running request', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const pending = deferred();
  const renders = [];
  const state = { tuition: {} };
  const loadAndRenderTuitionUnpaidMonth = loadFunction(source, 'loadAndRenderTuitionUnpaidMonth_', {
    state,
    tuitionUnpaidSummaryEl: { textContent: '' },
    tuitionUnpaidListEl: { innerHTML: '' },
    runServer: () => pending.promise,
    formatTuitionMonthLabel_: (month) => month,
    toNumber: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    formatStudentName: (name) => String(name || ''),
    renderTuitionUnpaidMonth_: (month) => renders.push(month),
    escapeHtml: (value) => String(value)
  });
  const closeTuitionUnpaidModal = loadFunction(source, 'closeTuitionUnpaidModal_', {
    state,
    tuitionUnpaidModalEl: { style: {} }
  });

  loadAndRenderTuitionUnpaidMonth('26-09s');
  closeTuitionUnpaidModal();
  pending.resolve({ success: true, rows: [] });
  await nextTurn();

  assert.deepEqual(renders, []);
});

function historyHarness(source) {
  const mainA = deferred();
  const mainB = deferred();
  const renders = [];
  const summary = { textContent: '' };
  const list = { innerHTML: '' };
  const state = { tuition: {} };
  const openTuitionStudentHistoryModal = loadFunction(source, 'openTuitionStudentHistoryModal_', {
    state,
    formatStudentName: (name) => String(name || '').trim(),
    tuitionStudentHistorySummaryEl: summary,
    tuitionStudentHistoryListEl: list,
    tuitionStudentHistoryModalEl: { style: {} },
    renderTuitionStudentMemoPanel_: () => {},
    setTuitionStudentHistoryTab_: () => {},
    renderTuitionStudentHistory_: (name, rows) => renders.push({ name, rows }),
    updateTuitionStudentMemoWarning_: () => {},
    escapeHtml: (value) => String(value),
    runServer: (method, payload) => {
      if (method === 'getTuitionStudentMonthlyHistory') {
        return payload.studentName === 'A' ? mainA.promise : mainB.promise;
      }
      if (method === 'getTuitionStudentMemoNotes') return Promise.resolve({ success: true, memos: [] });
      throw new Error(`unexpected method ${method}`);
    }
  });
  return { state, mainA, mainB, renders, summary, list, openTuitionStudentHistoryModal };
}

test('a late student-history success cannot overwrite the most recently opened student', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const harness = historyHarness(source);

  harness.openTuitionStudentHistoryModal('A');
  harness.openTuitionStudentHistoryModal('B');
  harness.mainB.resolve({ success: true, rows: [{ monthName: '26-09s' }], overview: {} });
  await nextTurn();
  harness.mainA.resolve({ success: true, rows: [{ monthName: '26-08s' }], overview: {} });
  await nextTurn();

  assert.deepEqual(harness.renders.map((item) => item.name), ['B']);
});

test('a late student-history failure cannot replace the current student with an error state', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const harness = historyHarness(source);

  harness.openTuitionStudentHistoryModal('A');
  harness.openTuitionStudentHistoryModal('B');
  harness.mainB.resolve({ success: true, rows: [], overview: {} });
  await nextTurn();
  harness.mainA.reject(new Error('A unavailable'));
  await nextTurn();

  assert.equal(harness.summary.textContent.includes('A · 조회 실패'), false);
  assert.equal(harness.list.innerHTML.includes('A unavailable'), false);
  assert.deepEqual(harness.renders.map((item) => item.name), ['B']);
});

test('closing student history invalidates its still-running history response', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const harness = historyHarness(source);
  const closeTuitionStudentHistoryModal = loadFunction(source, 'closeTuitionStudentHistoryModal_', {
    state: harness.state,
    tuitionStudentHistoryModalEl: { style: {} }
  });

  harness.openTuitionStudentHistoryModal('A');
  closeTuitionStudentHistoryModal();
  harness.mainA.resolve({ success: true, rows: [], overview: {} });
  await nextTurn();

  assert.deepEqual(harness.renders, []);
});

test('an optimistic supplies apply leaves the server-synced baseline untouched', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const baseline = { consumables: [{ id: 'paper', quantity: 1 }], assets: [] };
  const state = { desk: { supplies: { syncedSnapshot: baseline } } };
  const applyDeskSuppliesData = loadFunction(source, 'applyDeskSuppliesData_', {
    state,
    JSON,
    normalizeDeskSuppliesSnapshot_: (data) => ({
      consumables: data.consumables || [],
      assets: data.assets || [],
      purchaseSelections: {},
      purchaseCustomRequests: {},
      purchaseRequestTarget: '',
      purchaseRequestNote: ''
    }),
    cloneDeskSuppliesSnapshot_: (data) => JSON.parse(JSON.stringify(data)),
    ensureDeskSupplySelections_: () => {}
  });

  applyDeskSuppliesData({ consumables: [{ id: 'paper', quantity: 2 }], assets: [] });
  assert.equal(JSON.stringify(state.desk.supplies.syncedSnapshot), JSON.stringify(baseline));
  assert.equal(state.desk.supplies.consumables[0].quantity, 2);
});

test('a supplies snapshot write sends the old baseline and retains it after rejection', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const baseline = { consumables: [{ id: 'paper', quantity: 1 }] };
  const payload = { consumables: [{ id: 'paper', quantity: 2 }] };
  const request = deferred();
  const calls = [];
  const state = {
    activeModule: 'other',
    desk: { activeTab: 'other', supplies: { syncedSnapshot: baseline } }
  };
  const persistDeskSuppliesRealtime = loadFunction(source, 'persistDeskSuppliesRealtime_', {
    state,
    JSON,
    buildDeskSuppliesPayload_: () => payload,
    setDeskSuppliesSyncStatus_: () => {},
    canUseDeskCloudApi_: () => true,
    runServer: (...args) => {
      calls.push(args);
      return request.promise;
    },
    markDeskSuppliesSynced_: () => {},
    cloneDeskSuppliesSnapshot_: (data) => JSON.parse(JSON.stringify(data)),
    showClientMessage: () => {},
    renderDeskSupplies_: () => {}
  });

  const write = persistDeskSuppliesRealtime(false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'saveDeskSuppliesSnapshot');
  assert.equal(calls[0][1].data, payload);
  assert.equal(calls[0][1].expectedData, baseline);
  request.reject(new Error('conflict'));
  await assert.rejects(write, /conflict/);
  assert.equal(JSON.stringify(state.desk.supplies.syncedSnapshot), JSON.stringify(baseline));
  assert.equal(state.desk.supplies.unsavedChanges, true);
});

test('loading portal config deep-copies its compare-and-swap baseline', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const value = { sections: [{ title: 'original', options: { enabled: true } }] };
  const state = { desk: {} };
  const loadDeskPortalConfig = loadFunction(source, 'loadDeskPortalConfig_', {
    state,
    JSON,
    runServer: () => Promise.resolve({ success: true, value })
  });

  const returned = await loadDeskPortalConfig('tuition', 'templates');
  returned.sections[0].options.enabled = false;
  value.sections[0].title = 'mutated after load';
  const snapshotKey = JSON.stringify(['tuition', 'templates']);

  assert.equal(state.desk.portalConfigSnapshots[snapshotKey].sections[0].title, 'original');
  assert.equal(state.desk.portalConfigSnapshots[snapshotKey].sections[0].options.enabled, true);
});

test('saving portal config transmits its loaded expectedValue and preserves it after rejection', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const snapshotKey = JSON.stringify(['tuition', 'templates']);
  const baseline = { sections: [{ title: 'before' }] };
  const nextValue = { sections: [{ title: 'after' }] };
  const pending = deferred();
  const calls = [];
  const state = { desk: { portalConfigSnapshots: { [snapshotKey]: baseline } } };
  const saveDeskPortalConfig = loadFunction(source, 'saveDeskPortalConfig_', {
    state,
    Promise,
    JSON,
    runServer: (...args) => {
      calls.push(args);
      return pending.promise;
    },
    showClientMessage: () => {}
  });

  const save = saveDeskPortalConfig('tuition', 'templates', nextValue);
  await nextTurn();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'saveDeskPortalConfig');
  assert.equal(calls[0][1].value, nextValue);
  assert.equal(calls[0][1].expectedValue, baseline);
  pending.reject(new Error('conflict'));
  await assert.rejects(save, /conflict/);
  assert.equal(JSON.stringify(state.desk.portalConfigSnapshots[snapshotKey]), JSON.stringify(baseline));
});

test('saving portal config without a loaded baseline blocks transport and shows a user error', async () => {
  const source = await readFile(frontendPath, 'utf8');
  let requests = 0;
  const messages = [];
  const saveDeskPortalConfig = loadFunction(source, 'saveDeskPortalConfig_', {
    state: { desk: { portalConfigSnapshots: {} } },
    Promise,
    Object,
    runServer: () => {
      requests += 1;
      return Promise.resolve({ success: true });
    },
    showClientMessage: (message) => messages.push(message)
  });

  await assert.rejects(
    saveDeskPortalConfig('tuition', 'templates', { sections: [] }),
    /최신 내용을 불러온 뒤/
  );
  assert.equal(requests, 0);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /최신 내용을 불러온 뒤/);
});

test('a loaded portal-config parent supplies the expected baseline for an existing child save', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const state = { desk: {} };
  const calls = [];
  const runServer = (method, payload) => {
    calls.push({ method, payload });
    if (method === 'getDeskPortalConfig') {
      return Promise.resolve({ success: true, value: { entryA: { text: 'before', nested: { version: 1 } } } });
    }
    return Promise.resolve({ success: true, value: payload.value });
  };
  const loadDeskPortalConfig = loadFunction(source, 'loadDeskPortalConfig_', { state, JSON, runServer });
  const saveDeskPortalConfig = loadFunction(source, 'saveDeskPortalConfig_', {
    state, Promise, JSON, Object, runServer, showClientMessage: () => {}
  });

  await loadDeskPortalConfig('desk', 'responseLogs');
  await saveDeskPortalConfig('desk', 'responseLogs/entryA', { text: 'after' });
  const write = calls.at(-1);

  assert.equal(write.method, 'saveDeskPortalConfig');
  assert.equal(JSON.stringify(write.payload.expectedValue), JSON.stringify({ text: 'before', nested: { version: 1 } }));
});

test('a loaded portal-config parent derives null expectedValue for a new child', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const state = { desk: {} };
  const calls = [];
  const runServer = (method, payload) => {
    calls.push({ method, payload });
    if (method === 'getDeskPortalConfig') return Promise.resolve({ success: true, value: { existing: { text: 'kept' } } });
    return Promise.resolve({ success: true, value: payload.value });
  };
  const loadDeskPortalConfig = loadFunction(source, 'loadDeskPortalConfig_', { state, JSON, runServer });
  const saveDeskPortalConfig = loadFunction(source, 'saveDeskPortalConfig_', {
    state, Promise, JSON, Object, runServer, showClientMessage: () => {}
  });

  await loadDeskPortalConfig('desk', 'responseLogs');
  await saveDeskPortalConfig('desk', 'responseLogs/newEntry', { text: 'new' });

  assert.equal(calls.at(-1).payload.expectedValue, null);
});

test('reloading a portal-config parent invalidates cached child baselines', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const state = { desk: {} };
  const parentValues = [{ entryA: { text: 'old' } }, { entryA: { text: 'reloaded' } }];
  const runServer = (method, payload) => {
    if (method === 'getDeskPortalConfig') return Promise.resolve({ success: true, value: parentValues.shift() });
    return Promise.resolve({ success: true, value: payload.value });
  };
  const loadDeskPortalConfig = loadFunction(source, 'loadDeskPortalConfig_', { state, JSON, Object, runServer });
  const saveDeskPortalConfig = loadFunction(source, 'saveDeskPortalConfig_', {
    state, Promise, JSON, Object, runServer, showClientMessage: () => {}
  });
  const childKey = JSON.stringify(['desk', 'responseLogs/entryA']);

  await loadDeskPortalConfig('desk', 'responseLogs');
  await saveDeskPortalConfig('desk', 'responseLogs/entryA', { text: 'saved child' });
  assert.equal(Object.prototype.hasOwnProperty.call(state.desk.portalConfigSnapshots, childKey), true);
  await loadDeskPortalConfig('desk', 'responseLogs');

  assert.equal(Object.prototype.hasOwnProperty.call(state.desk.portalConfigSnapshots, childKey), false);
  assert.equal(
    JSON.stringify(state.desk.portalConfigSnapshots[JSON.stringify(['desk', 'responseLogs'])]),
    JSON.stringify({ entryA: { text: 'reloaded' } })
  );
});

test('supplies unsaved status is idle only with no dirty flag, debounce, or quantity adjustment', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const supplies = { unsavedChanges: false, saveTimer: null, adjustingItems: {} };
  const hasUnsavedDeskSupplies = loadFunction(source, 'hasUnsavedDeskSupplies_', {
    state: { desk: { supplies } },
    Object
  });

  assert.equal(hasUnsavedDeskSupplies(), false);
  supplies.unsavedChanges = true;
  assert.equal(hasUnsavedDeskSupplies(), true, 'optimistic local changes must warn');
  supplies.unsavedChanges = false;
  supplies.saveTimer = 17;
  assert.equal(hasUnsavedDeskSupplies(), true, 'a pending purchase debounce must warn');
  supplies.saveTimer = null;
  supplies.adjustingItems = { 'paper:main': true };
  assert.equal(hasUnsavedDeskSupplies(), true, 'an in-flight quantity adjustment must warn');
});

test('the beforeunload callback warns only when supplies are unsaved', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const listenerStart = source.indexOf('window.addEventListener("beforeunload", function(event)');
  assert.notEqual(listenerStart, -1, 'beforeunload guard was not found');
  const handlerStart = source.indexOf('function(event)', listenerStart);
  const idleHandler = vm.runInNewContext(`(${extractFunctionAt(source, handlerStart)})`, {
    hasUnsavedDeskSupplies_: () => false
  });
  const idleEvent = { prevented: false, preventDefault() { this.prevented = true; } };
  idleHandler(idleEvent);
  assert.equal(idleEvent.prevented, false);
  assert.equal(idleEvent.returnValue, undefined);

  const dirtyHandler = vm.runInNewContext(`(${extractFunctionAt(source, handlerStart)})`, {
    hasUnsavedDeskSupplies_: () => true
  });
  const dirtyEvent = { prevented: false, preventDefault() { this.prevented = true; } };
  dirtyHandler(dirtyEvent);
  assert.equal(dirtyEvent.prevented, true);
  assert.equal(dirtyEvent.returnValue, '');
});

test('a pending purchase debounce marks supplies dirty before its delayed save begins', async () => {
  const source = await readFile(frontendPath, 'utf8');
  let scheduled;
  const state = { desk: { supplies: { unsavedChanges: false, saveTimer: null } } };
  const scheduleDeskSuppliesPurchaseSave = loadFunction(source, 'scheduleDeskSuppliesPurchaseSave_', {
    state,
    setTimeout: (callback, delay) => {
      scheduled = { callback, delay };
      return 42;
    },
    clearTimeout: () => {},
    syncDeskSuppliesAfterLocalChange_: () => Promise.resolve(),
    showClientMessage: () => {}
  });

  scheduleDeskSuppliesPurchaseSave();
  assert.equal(state.desk.supplies.unsavedChanges, true);
  assert.equal(state.desk.supplies.saveTimer, 42);
  assert.equal(scheduled.delay, 300);
});

test('supplies save clears dirty state only when the current payload still matches what was saved', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const sentPayload = { consumables: [{ id: 'paper', quantity: 2 }] };
  let currentPayload = sentPayload;
  const state = {
    activeModule: 'other',
    desk: { activeTab: 'other', supplies: { syncedSnapshot: { consumables: [] }, unsavedChanges: true } }
  };
  const persistDeskSuppliesRealtime = loadFunction(source, 'persistDeskSuppliesRealtime_', {
    state,
    JSON,
    buildDeskSuppliesPayload_: () => currentPayload,
    setDeskSuppliesSyncStatus_: () => {},
    canUseDeskCloudApi_: () => true,
    runServer: () => Promise.resolve({ success: true, data: sentPayload }),
    markDeskSuppliesSynced_: () => {},
    cloneDeskSuppliesSnapshot_: (data) => JSON.parse(JSON.stringify(data)),
    showClientMessage: () => {},
    renderDeskSupplies_: () => {}
  });

  currentPayload = { consumables: [{ id: 'paper', quantity: 3 }] };
  await persistDeskSuppliesRealtime(false);
  assert.equal(state.desk.supplies.unsavedChanges, false, 'the saved payload is the current payload in this write');

  state.desk.supplies.unsavedChanges = true;
  currentPayload = sentPayload;
  const pending = deferred();
  const mismatchedPersist = loadFunction(source, 'persistDeskSuppliesRealtime_', {
    state,
    JSON,
    buildDeskSuppliesPayload_: () => currentPayload,
    setDeskSuppliesSyncStatus_: () => {},
    canUseDeskCloudApi_: () => true,
    runServer: () => pending.promise,
    markDeskSuppliesSynced_: () => {},
    cloneDeskSuppliesSnapshot_: (data) => JSON.parse(JSON.stringify(data)),
    showClientMessage: () => {},
    renderDeskSupplies_: () => {}
  });
  const write = mismatchedPersist(false);
  currentPayload = { consumables: [{ id: 'paper', quantity: 4 }] };
  pending.resolve({ success: true, data: sentPayload });
  await write;
  assert.equal(state.desk.supplies.unsavedChanges, true, 'a newer local payload remains dirty after an older save succeeds');
});

test('tuition orders oldest previous payment across statuses and missing history last', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const compare = loadFunction(source, 'compareTuitionPreviousPayment_', {});
  const rows = [{studentName:'미기록'}, {studentName:'늦음',previousPaymentDate:'2026-08-20',status:'안내이전'}, {studentName:'빠름',previousPaymentDate:'2026-08-01',status:'납부완료'}];
  assert.deepEqual(rows.slice().sort(compare).map(r=>r.studentName), ['빠름','늦음','미기록']);
});

test('tuition receipt defaults to unpaid remainder and preserves collection sign', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const toNumber = (v,f) => Number.isFinite(Number(v)) ? Number(v) : f;
  const format = loadFunction(source, 'formatSignedAmountInput', {});
  const amount = loadFunction(source, 'getTuitionPaymentDefaultAmount_', {toNumber,formatSignedAmountInput:format});
  for (const [guideAmount,collectedAmount,expected] of [[500000,200000,'-300,000'],[500000,0,'-500,000'],[500000,500000,'0'],[500000,600000,'0'],[500000,-100000,'-500,000'],[0,0,'']]) assert.equal(amount({guideAmount,collectedAmount}), expected);
  assert.equal(amount(null), '');
});

test('tuition captions validate dates and include weekdays', async () => {
  const format = loadFunction(await readFile(frontendPath, 'utf8'), 'formatTuitionInputDate_', {});
  assert.equal(format('26-09-05'), '2026년 9월 5일 (토)');
  assert.equal(format('2024-02-29'), '2024년 2월 29일 (목)');
  assert.equal(format('2026-12-31'), '2026년 12월 31일 (목)');
  assert.equal(format('2026-02-29'), '날짜를 확인해 주세요.');
});

test('tuition status groups put unguided first and order dates within each group', async () => {
  const source = await readFile(frontendPath, 'utf8');
  const compare = loadFunction(source, 'compareTuitionPreviousPayment_', {});
  const group = loadFunction(source, 'groupTuitionRowsByStatus_', {compareTuitionPreviousPayment_:compare});
  const rows = [
    {studentName:'완료', unpaidStatus:'납부완료', previousPaymentDate:'2026-08-01'},
    {studentName:'늦음', unpaidStatus:'안내이전', previousPaymentDate:'2026-08-20'},
    {studentName:'기록없음', unpaidStatus:'안내이전'},
    {studentName:'빠름', unpaidStatus:'안내이전', previousPaymentDate:'2026-08-03'},
    {studentName:'안내함', unpaidStatus:'안내완료', previousPaymentDate:'2026-08-02'},
  ];
  const result = group(rows);
  assert.equal(JSON.stringify(result.map(r=>r.__group ? `${r.status}:${r.count}` : r.studentName)), JSON.stringify(['안내이전:3','빠름','늦음','기록없음','안내완료:1','안내함','납부완료:1','완료']));
  assert.equal(rows[0].studentName,'완료');
  assert.equal(group([]).length,0);
  const unknown = group([{studentName:'새상태',unpaidStatus:'새상태'}, {studentName:'기본'}]);
  assert.equal(unknown[0].status,'안내이전');
  assert.equal(unknown[2].status,'새상태');
});
