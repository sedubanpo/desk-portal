import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Cloud Run runtime can verify revoked Firebase ID tokens', async () => {
  const deployScript = await readFile(new URL('../scripts/deploy.sh', import.meta.url), 'utf8');

  assert.match(deployScript, /identitytoolkit\.googleapis\.com/);
  assert.match(deployScript, /roles\/firebaseauth\.viewer/);
  assert.match(deployScript, /CHECK_REVOKED_TOKENS=true/);
});
