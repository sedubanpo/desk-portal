import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {officeStream} from '../src/desk/office-stream.js';
const wait=()=>new Promise(r=>setTimeout(r,90));
function fixture(snapshot=async date=>({success:true,dateKey:date})){
 let reads=0,watches=0,stops=0;const callbacks=new Map(),responses=[];
 const handler=officeStream({snapshot:async d=>{reads++;return snapshot(d);},watch(d,change,error){watches++;callbacks.set(d,{change,error});for(let i=0;i<4;i++)change();return ()=>{stops++;callbacks.delete(d);};}});
 function connect(date='2026-10-28'){
  const res=new EventEmitter();Object.assign(res,{events:[],closed:false,set(){},flushHeaders(){},write(e){this.events.push(e);return true;},end(){if(!this.closed){this.closed=true;this.emit('close');}}});responses.push(res);handler({query:{dateKey:date}},res);return res;
 }
 return {connect,callbacks,stats:()=>({reads,watches,stops}),close:()=>responses.forEach(r=>r.end())};
}
test('same-date clients share initial notifications and reads, final close releases subscriptions',async t=>{
 const f=fixture();t.after(f.close);const a=f.connect(),b=f.connect();await wait();
 assert.deepEqual(f.stats(),{reads:1,watches:1,stops:0});assert.equal(a.events.length,1);assert.deepEqual(a.events,b.events);
 for(let i=0;i<5;i++)f.callbacks.get('2026-10-28').change();await wait();assert.equal(f.stats().reads,2);
 a.end();assert.equal(f.stats().stops,0);b.end();assert.equal(f.stats().stops,1);
 f.connect();await wait();assert.deepEqual(f.stats(),{reads:3,watches:2,stops:1});
});
test('dates are isolated and new clients receive a fresh snapshot',async t=>{
 let revision=0;const f=fixture(async date=>({date,revision:++revision}));t.after(f.close);
 const a=f.connect(),b=f.connect('2026-10-29');await wait();assert.equal(f.stats().reads,2);
 assert.match(a.events[0],/2026-10-28/);assert.match(b.events[0],/2026-10-29/);
 const c=f.connect();await wait();assert.equal(f.stats().reads,3);assert.equal(c.events.length,1);assert.equal(a.events.at(-1),c.events[0]);
});
test('updates during a read trigger a trailing read',async t=>{
 let release;const f=fixture(()=>new Promise(r=>{release=r;}));t.after(f.close);const a=f.connect();await wait();
 f.callbacks.get('2026-10-28').change();f.callbacks.get('2026-10-28').change();assert.equal(f.stats().reads,1);
 release({revision:1});await wait();assert.equal(f.stats().reads,2);release({revision:2});await wait();assert.match(a.events.at(-1),/revision.*2/);
});
test('closing cancels scheduled reads and suppresses late results',async()=>{
 const f=fixture();f.connect().end();await wait();assert.deepEqual(f.stats(),{reads:0,watches:1,stops:1});
 let release;const g=fixture(()=>new Promise(r=>{release=r;}));const a=g.connect();await wait();a.end();release({success:true});await wait();assert.equal(a.events.length,0);assert.equal(g.stats().stops,1);
});
test('snapshot and listener errors release channels; reconnect recovers',async t=>{
 let broken=true;const f=fixture(async()=>{if(broken)throw Error('offline');return {success:true};});t.after(f.close);
 const a=f.connect();await wait();assert.ok(a.closed);assert.match(a.events[0],/unavailable/);assert.equal(f.stats().stops,1);
 broken=false;const b=f.connect();await wait();assert.ok(!b.closed);f.callbacks.get('2026-10-28').error();assert.ok(b.closed);assert.equal(f.stats().stops,2);
});
test('slow clients disconnect without stopping healthy peers',async t=>{
 const f=fixture();t.after(f.close);const slow=f.connect(),healthy=f.connect();slow.write=()=>false;await wait();assert.ok(slow.closed);assert.ok(!healthy.closed);assert.equal(healthy.events.length,1);assert.equal(f.stats().stops,0);
});
