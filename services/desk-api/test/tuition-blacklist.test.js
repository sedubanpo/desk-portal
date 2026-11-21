import test from 'node:test';
import assert from 'node:assert/strict';
import build from '../../../docs/tuition-blacklist.js';

function history(counts) {
  return counts.map(([month, count]) => ({sourceMonth: month, studentName: '학생', contactCount: count}));
}

test('third contact registers immediately, three recorded closed months release, then re-entry', () => {
  const rows = history([['26-10s',2],['26-11s',3],['26-12s',2],['27-01s',0],['27-02s',1],['27-03s',4]]);
  const status = (selected, current) => build(rows, selected, current).get('학생');
  assert.equal(status('26-10s','27-03s'), undefined);
  assert.equal(status('26-11s','26-11s').stable, 0);
  assert.equal(status('27-02s','27-02s').stable, 2);
  assert.equal(status('27-02s','27-03s'), undefined);
  assert.equal(status('27-03s','27-03s').stable, 0);
});

test('missing months break stability and months with repeated guidance reset it', () => {
  const rows = history([['26-06s',4],['26-07s',1],['26-09s',0],['26-10s',1],['26-11s',3]]);
  assert.equal(build(rows,'26-10s','26-11s').get('학생').stable, 2);
  assert.equal(build(rows,'26-11s','26-11s').get('학생').stable, 0);
  assert.equal(build(rows,'26-12s','26-11s').get('학생').stable, 0);
  assert.equal(build(history([['26-10s',2],['26-11s',2]]),'26-11s','26-11s').size,0);
});
