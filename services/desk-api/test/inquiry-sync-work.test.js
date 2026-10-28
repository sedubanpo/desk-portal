import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSyncWork } from '../src/inquiries/sync-work.js';
import { createNotionClient } from '../src/inquiries/notion-client.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('bounded worker pool drains all writes, max eight in flight',async()=>{
 let active=0,max=0,done=0;await mapSyncWork(Array.from({length:64}),async()=>{max=Math.max(max,++active);await delay(2);active--;done++;});assert.equal(max,8);assert.equal(done,64);assert.equal(active,0);
});
test('failure stops new writes and waits for already started writes',async()=>{
 let active=0,started=0;await assert.rejects(mapSyncWork([0,1,2,3,4,5],async n=>{started++;active++;try{if(n===0)throw Error('fail');await delay(10);}finally{active--; }},()=>{},2),/fail/);assert.equal(active,0);assert.equal(started,2);
});
test('abort while queued does not break serialized Notion lane',async()=>{
 let release,calls=0;const gate=new Promise(r=>release=r);const notion=createNotionClient({token:'fixture',sleep:async()=>{},fetchImpl:async()=>{calls++;if(calls===1)await gate;return {ok:true,json:async()=>({})};}});
 const first=notion('/first');await delay(0);const controller=new AbortController();const context={signal:controller.signal,check(){controller.signal.throwIfAborted();}};
 const second=notion('/second','GET',undefined,context);controller.abort(Error('budget'));await assert.rejects(second,/budget/);const third=notion('/third');assert.equal(calls,1);release();await Promise.all([first,third]);assert.equal(calls,2);
});
test('429 retry wait is aborted and next caller can use lane',async()=>{
 let calls=0;const controller=new AbortController();const notion=createNotionClient({token:'fixture',sleep:async ms=>{if(ms>=1000){controller.abort(Error('budget'));await delay(5);}},fetchImpl:async()=>++calls===1?{status:429,headers:{get:()=>1}}:{ok:true,json:async()=>({})}});
 const context={signal:controller.signal,check(){controller.signal.throwIfAborted();}};await assert.rejects(notion('/limited','GET',undefined,context),/budget/);await notion('/next');assert.equal(calls,2);
});
