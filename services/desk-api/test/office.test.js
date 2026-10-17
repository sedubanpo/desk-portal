import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOffice} from '../src/desk/office.js';
import {createApp} from '../src/app.js';
import request from 'supertest';
function fixture(){
 let stamp='2026-10-16T05:00:00.000Z';
 const records={'desk_portal/monthly_schedule/2026-10':{entries:{a:{date:'2026-10-16',worker:'안종성'},b:{date:'2026-10-16',worker:'권민정'},c:{date:'2026-10-16',worker:'퇴직자'},d:{date:'2026-10-16',worker:'부재자',unavailable:true}}}};
 const staff=[{uid:'a',name:'안종성',status:'ACTIVE'},{uid:'b',name:'권민정',status:'ACTIVE'},{uid:'c',name:'퇴직자',status:'INACTIVE'},{uid:'d',name:'부재자',status:'ACTIVE'}];
 const store={get:async path=>structuredClone(records[path]??(()=>{const parent=Object.keys(records).filter(k=>path.startsWith(k+'/')).sort((a,b)=>b.length-a.length)[0];return parent?path.slice(parent.length+1).split('/').reduce((v,k)=>v?.[k],records[parent]):null;})()),transaction:async(path,fn)=>{const next=fn(structuredClone(records[path]||null));if(next!==undefined)records[path]=next;},subscribe:()=>()=>{}};
 const office=createOffice({store,loadStaffDirectory:async()=>staff,now:()=>stamp});let seq=0;
 const actor={uid:'a',name:'안종성',role:'STAFF'},admin={uid:'admin',name:'관리자',role:'ADMIN'};
 const mutate=async(p,who=actor)=>office.mutate({dateKey:'2026-10-16',workerKey:(await office.snapshot('2026-10-16')).people[0].key,version:0,operationId:'operation-'+String(++seq).padStart(16,'0'),...p},who);
 return {office,store,records,staff,mutate,actor,admin,tick:s=>stamp=s};
}
test('only active scheduled workers appear; seat collisions and stale changes are rejected',async()=>{const f=fixture(),s=await f.office.snapshot('2026-10-16');assert.equal(s.people.length,2);assert.equal((await f.mutate({action:'seat',seat:'main-1'})).success,true);assert.equal((await f.mutate({action:'seat',seat:'main-1',workerKey:s.people[1].key},f.admin)).success,false);assert.equal((await f.mutate({action:'seat',seat:'main-2',version:0})).success,false);assert.equal((await f.mutate({action:'seat',seat:'main-2',version:1})).success,true);});
test('worker cannot impersonate another; administrator proxy completion atomically creates one memo',async()=>{const f=fixture(),s=await f.office.snapshot('2026-10-16'),other=s.people[1].key;assert.equal((await f.mutate({action:'start',text:'다른 사람'}, {uid:'b',name:'권민정',role:'STAFF'})).success,false);await f.mutate({action:'start',text:'학부모 상담'});f.tick('2026-10-16T05:12:00.000Z');const p={action:'complete',version:1,operationId:'operation-complete-1234'};assert.equal((await f.mutate(p,f.admin)).success,true);assert.equal((await f.mutate(p,f.admin)).replayed,true);const day=f.records['desk_portal/daily_journal/2026-10-16'];assert.equal(Object.values(day.office.workers)[0].task,null);assert.equal(Object.keys(day.memos).length,1);const memo=Object.values(day.memos)[0];assert.equal(memo.durationMinutes,12);assert.equal(memo.worker,'안종성');assert.equal(memo.completedByUid,'admin');assert.equal(memo.createdAt,'2026-10-16T05:00:00.000Z');assert.equal(memo.completedAt,'2026-10-16T05:12:00.000Z');assert.equal((await f.mutate({...p,action:'cancel'},f.admin)).success,false);});
test('edit retains start time, cancellation never adds a memo; existing journal data survives',async()=>{const f=fixture();f.records['desk_portal/daily_journal/2026-10-16']={tasks:{x:{title:'기존 업무'}},memos:{old:{text:'기존 기록'}}};await f.mutate({action:'start',text:'원래 업무'});await f.mutate({action:'edit',text:'수정 업무',version:1});const d=f.records['desk_portal/daily_journal/2026-10-16'];assert.equal(Object.values(d.office.workers)[0].task.startedAt,'2026-10-16T05:00:00.000Z');await f.mutate({action:'cancel',version:2});assert.equal(Object.keys(d.memos).length,1);assert.equal(d.tasks.x.title,'기존 업무');assert.equal((await f.mutate({action:'start',text:'',version:3})).success,false);});
test('past unfinished work can finish, but new work and seats are today-only',async()=>{const f=fixture();await f.mutate({action:'start',text:'어제 업무'});f.tick('2026-10-17T05:00:00.000Z');assert.equal((await f.mutate({action:'seat',seat:'main-1',version:1})).success,false);assert.equal((await f.mutate({action:'complete',version:1})).success,true);});
test('cold transaction callbacks retry and preserve correct versions',async()=>{const f=fixture();await f.mutate({action:'start',text:'업무'});const orig=f.store.transaction;f.store.transaction=async(path,fn)=>{assert.equal(fn(null),null);return orig(path,fn);};assert.equal((await f.mutate({action:'complete',version:1})).success,true);});
test('stream rejects anonymous access and invalid dates',async()=>{const f=fixture();const app=createApp({config:{allowedOrigins:[]},payrollAccess:{},office:f.office,verifyIdToken:async()=>({uid:'a'}),loadAccount:async()=>({account:{role:'STAFF',status:'ACTIVE'},access:{apps:{deskPortal:true}}})});await request(app).get('/v1/office/stream?dateKey=2026-10-16').expect(401);await request(app).get('/v1/office/stream?dateKey=2026-02-30').set('authorization','Bearer test').expect(400);});

test('history isolates workers, excludes seats and preserves edits and actual actor',async()=>{
 const f=fixture(),people=(await f.office.snapshot('2026-10-16')).people,key=people[0].key;
 await f.mutate({action:'seat',seat:'main-1'});
 await f.mutate({action:'start',text:'상담 준비',version:1});
 f.tick('2026-10-16T05:01:00.000Z');await f.mutate({action:'edit',text:'상담 진행',version:2});
 f.tick('2026-10-16T05:02:00.000Z');await f.mutate({action:'complete',version:3},f.admin);
 await f.mutate({action:'start',workerKey:people[1].key,text:'다른 업무'},f.admin);
 const r=await f.office.history({dateKey:'2026-10-16',workerKey:key});
 assert.deepEqual(r.events.map(e=>e.action),['complete','edit','start']);assert.equal(r.events[0].by,'관리자');assert.equal(r.events[1].before,'상담 준비');assert.equal(r.events[1].after,'상담 진행');assert.ok(r.events.every(e=>!('uid' in e)&&!('fingerprint' in e)));
 assert.equal((await f.office.history({dateKey:'2026-02-30',workerKey:key})).success,false);
});
test('history pages without overlap and returns empty dates',async()=>{
 const f=fixture(),key=(await f.office.snapshot('2026-10-16')).people[0].key;
 for(let i=0;i<54;i++)await f.mutate({action:i%2?'cancel':'start',text:'업무 '+i,version:i});
 const first=await f.office.history({dateKey:'2026-10-16',workerKey:key}),second=await f.office.history({dateKey:'2026-10-16',workerKey:key,before:first.nextCursor});
 assert.equal(first.events.length,50);assert.equal(second.events.length,4);assert.equal(new Set([...first.events,...second.events].map(e=>e.id)).size,54);assert.equal(second.nextCursor,'');assert.equal((await f.office.history({dateKey:'2026-10-15',workerKey:key})).events.length,0);
});

test('partial subscription failure releases already registered listeners',()=>{const f=fixture();let calls=0,closed=0;f.store.subscribe=()=>{if(++calls===2)throw Error('connection unavailable');return ()=>closed++;};assert.throws(()=>f.office.watch('2026-10-16',()=>{},()=>{}));assert.equal(closed,1);});

test('completion saves edited content atomically and records both versions',async()=>{
 const f=fixture();await f.mutate({action:'start',text:'원본'});
 const p={action:'complete',text:'수정된 최종 업무',version:1,operationId:'complete-edited-task-123'};
 assert.equal((await f.mutate({...p,text:' '})).success,false);
 assert.equal((await f.mutate(p)).success,true);assert.equal((await f.mutate(p)).replayed,true);
 const day=f.records['desk_portal/daily_journal/2026-10-16'];assert.equal(Object.keys(day.memos).length,1);assert.equal(Object.values(day.memos)[0].text,'수정된 최종 업무');
 const event=day.office.operations[p.operationId];assert.equal(event.before,'원본');assert.equal(event.after,'수정된 최종 업무');
});
test('starting work saves the selected seat and rejects occupied seats without starting work',async()=>{
 const f=fixture(),s=await f.office.snapshot('2026-10-16');await f.mutate({action:'seat',seat:'main-1',workerKey:s.people[1].key},f.admin);
 assert.equal((await f.mutate({action:'start',seat:'main-1',text:'충돌'})).success,false);
 let snapshot=await f.office.snapshot('2026-10-16');assert.equal(snapshot.workers[s.people[0].key],undefined);
 assert.equal((await f.mutate({action:'start',seat:'annex-2',text:'업무'})).success,true);
 snapshot=await f.office.snapshot('2026-10-16');assert.equal(snapshot.workers[s.people[0].key].seat,'annex-2');assert.equal(snapshot.workers[s.people[0].key].task.text,'업무');
});

test('main director office is one reservable seat with normal task and collision rules',async()=>{
 const f=fixture(),s=await f.office.snapshot('2026-10-16');
 assert.equal((await f.mutate({action:'seat',seat:'main-director'})).success,true);
 assert.equal((await f.mutate({action:'seat',seat:'main-director',workerKey:s.people[1].key},f.admin)).success,false);
 assert.equal((await f.mutate({action:'start',seat:'main-director',text:'원장실 상담',version:1})).success,true);
 assert.equal((await f.mutate({action:'complete',version:2})).success,true);
 const day=f.records['desk_portal/daily_journal/2026-10-16'];
 assert.equal(Object.values(day.office.workers)[0].seat,'main-director');
 assert.equal(Object.values(day.memos)[0].text,'원장실 상담');
});


test('leaders can sit without a shift; proxy rights use active directory UIDs rather than claimed names',async()=>{
 const f=fixture();f.staff.push({uid:'director',name:'김용찬',status:'ACTIVE'},{uid:'deputy',name:'홍성우',status:'ACTIVE'});
 const snapshot=await f.office.snapshot('2026-10-16');
 assert.equal(snapshot.people.length,4);assert.deepEqual(snapshot.managementUids,['deputy','a']);
 const director=snapshot.people.find(p=>p.uid==='director'),deputy=snapshot.people.find(p=>p.uid==='deputy');
 assert.equal((await f.mutate({workerKey:director.key,action:'seat',seat:'main-director'},{uid:'director',name:'김용찬',role:'STAFF'})).success,true);
 assert.equal((await f.mutate({workerKey:deputy.key,action:'seat',seat:'annex-2'},{uid:'deputy',name:'홍성우',role:'STAFF'})).success,true);
 assert.equal((await f.mutate({workerKey:director.key,action:'start',text:'대리 입력',version:1},f.actor)).success,true);
 assert.equal((await f.mutate({workerKey:director.key,action:'edit',text:'부원장 수정',version:2},{uid:'deputy',name:'홍성우',role:'STAFF'})).success,true);
 assert.equal((await f.mutate({workerKey:director.key,action:'edit',text:'이름 위조',version:3},{uid:'b',name:'안종성',role:'STAFF'})).success,false);
 f.staff.find(p=>p.uid==='deputy').status='INACTIVE';
 assert.equal((await f.mutate({workerKey:director.key,action:'edit',text:'비활성',version:3},{uid:'deputy',name:'홍성우',role:'STAFF'})).success,false);
});
