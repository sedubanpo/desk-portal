import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LEGACY_API_METHODS } from '../src/contracts.js';

test('migration contract exactly mirrors the Apps Script API allowlist', async () => {
  const codePath = fileURLToPath(new URL('../../../apps-script/payroll/Code.gs', import.meta.url));
  const code = await readFile(codePath, 'utf8');
  const allowlistBlock = code.match(/const PAYROLL_API_ALLOWED_METHODS = \{([\s\S]*?)\n\};/);
  assert.ok(allowlistBlock, 'PAYROLL_API_ALLOWED_METHODS was not found');

  const appsScriptMethods = [...allowlistBlock[1].matchAll(/^\s*([A-Za-z0-9_]+): true,?$/gm)]
    .map(match => match[1])
    .sort();
  const contractMethods = [...LEGACY_API_METHODS].sort();

  assert.deepEqual(contractMethods, appsScriptMethods);
});
