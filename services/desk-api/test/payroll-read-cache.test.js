import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReadCache } from '../src/payroll/read-cache.js';

test('read cache shares concurrent work, isolates values and expires', async () => {
  let time=100,reads=0;
  const cache=createReadCache({ttlMs:30,maxEntries:2,clock:()=>time});
  const load=async()=>({rows:[{amount:++reads}]});
  const [a,b]=await Promise.all([cache.read('a',load),cache.read('a',load)]);
  assert.equal(reads,1);assert.equal(b.hit,true);
  a.value.rows[0].amount=99;
  assert.equal((await cache.read('a',load)).value.rows[0].amount,1);
  time+=31;assert.equal((await cache.read('a',load)).hit,false);assert.equal(reads,2);
});
test('forced fresh read supersedes older in-flight cache and failures can retry', async () => {
  const cache=createReadCache({ttlMs:1000,maxEntries:2});let finish;
  const old=cache.read('a',()=>new Promise(resolve=>finish=resolve));
  await Promise.resolve();
  assert.equal((await cache.read('a',async()=>2,{forceRefresh:true})).value,2);
  finish(1);await old;
  assert.equal((await cache.read('a',async()=>3)).value,2);
  await assert.rejects(cache.read('b',async()=>{throw Error('failure')}));
  assert.equal((await cache.read('b',async()=>4)).value,4);
});
test('read cache bounds retained month sources', async()=>{
 const cache=createReadCache({ttlMs:1000,maxEntries:1});
 await cache.read('a',async()=>1);await cache.read('b',async()=>2);
 assert.equal((await cache.read('a',async()=>3)).hit,false);
});
