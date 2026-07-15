import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const frontendPath = new URL('../../../docs/index.html', import.meta.url);

test('Firebase identity replaces the Apps Script payroll password gate', async () => {
  const source = await readFile(frontendPath, 'utf8');

  assert.match(source, /cloudIdentity:\s*null/);
  assert.match(source, /state\.cloudIdentity = body && body\.user \? body\.user : null/);
  assert.match(source, /identity\.permissions\.canManagePayroll === true/);
  assert.match(source, /state\.privilegedAccessKey = "firebase-role"/);
  assert.match(source, /if \(state\.cloudApiReady && state\.firebaseUser\)/);
  assert.match(source, /autocomplete="current-password"/);
});
