import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const legacyRoot = new URL('../../../apps-script/payroll/', import.meta.url);
const code = await readFile(new URL('Code.gs', legacyRoot), 'utf8');
function endpoint() {
  const context = vm.createContext({
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(body) { return { body, setMimeType(type) { this.type = type; return this; } }; }
    },
    HtmlService: {
      createHtmlOutputFromFile(file) { return { file, setTitle(title) { this.title = title; return this; } }; }
    }
  });
  vm.runInContext(code, context);
  return context;
}

test('old API routes cannot execute reads or writes even with supplied legacy keys', () => {
  const app = endpoint();
  for (const fn of ['getPayrollDashboard', 'saveDeskPortalConfig', 'deleteTuitionPayment', 'unknown']) {
    const response = app.doGet({ parameter: {
      mode: 'api', fn, portalKey: 'synthetic', privilegedKey: 'synthetic',
      payload: '{"value":"synthetic"}', callback: 'alert(document.cookie)'
    } });
    assert.equal(response.type, 'application/json');
    const body = JSON.parse(response.body);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'legacy_retired');
    assert.ok(!response.body.includes('synthetic'));
    assert.ok(!response.body.includes('document.cookie'));
  }
  assert.equal(JSON.parse(app.doPost({ postData: { contents: '{}' } }).body).error, 'legacy_retired');
  assert.equal(typeof app.hasPayrollPortalAccess_, 'undefined');
  assert.equal(typeof app.hasPayrollPrivilegedAccess_, 'undefined');
});

test('bookmarked document URLs show the migration notice without accessing services', () => {
  const app = endpoint();
  for (const event of [undefined, {}, { parameter: { view: 'legacy' } }]) {
    assert.equal(app.doGet(event).file, 'payroll_portal');
  }
});

test('both legacy HTML copies are static notices with no credentials or request code', async () => {
  const [first, second] = await Promise.all(['Index.html', 'payroll_portal.html'].map(file => readFile(new URL(file, legacyRoot), 'utf8')));
  assert.equal(first, second);
  assert.match(first, /https:\/\/sedubanpo\.github\.io\/desk-portal\//);
  assert.doesNotMatch(first, /<script|DESK_RTDB_AUTH|portalKey|privilegedKey|firebaseio|\son\w+\s*=/i);
  assert.doesNotMatch(code, /UrlFetchApp|SpreadsheetApp|PropertiesService|ScriptApp|CalendarApp|firebaseio|hasPayrollPortalAccess_|hasPayrollPrivilegedAccess_/);
});
