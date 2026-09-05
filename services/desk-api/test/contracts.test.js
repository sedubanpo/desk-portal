import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LEGACY_API_METHODS } from '../src/contracts.js';

test('Cloud API preserves the retired Apps Script method contract', async () => {
  const fixturePath = fileURLToPath(new URL('./fixtures/retired-apps-script-methods.json', import.meta.url));
  const retiredMethods = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.deepEqual([...LEGACY_API_METHODS].sort(), retiredMethods);
});
