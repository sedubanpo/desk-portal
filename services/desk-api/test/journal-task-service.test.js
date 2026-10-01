import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createJournalTaskMethods} from '../src/desk/task-service.js';
const staff={role:'STAFF',uid:'staff-1',name:'테스트 근무자'}, other={role:'DESK',uid:'staff-2',name:'다른 근무자'}, admin={role:'ADMIN',uid:'admin-1',name:'관리자'};
const dateKey='2026-10-01';
function fixture(seed={}) {
 let root=structuredClone(seed),failIndex=false,retry=null,stamp=0;
 const read=path=>String(path).split('/').filter(Boolean).reduce((v,k)=>v?.[k],root);
 const write=(path,value)=>{const keys=path.split('/').filter(Boolean);let target=root;for(const k of keys.slice(0,-1))target=target[k]??={};if(value===null)delete target[keys.at(-1)];else target[keys.at(-1)]=structuredClone(value);};
 const store={get:async p=>structuredClone(read(p)),transaction:async(p,fn)=>{if(retry){const {cb,cached}=retry;retry=null;assert.notEqual(fn(cached),undefined,"cold/stale callback must wait for server rather than abort");cb(root);}const next=fn(structuredClone(read(p)));if(next!==undefined)write(p,next);},update:async(p,values)=>{if(failIndex){failIndex=false;throw Error('index unavailable');}for(const[k,v]of Object.entries(values))write(k,v);}};
 const api=createJournalTaskMethods({store,now:()=>new Date(Date.UTC(2026,9,1,0,0,++stamp)).toISOString(),journalPath:'journal',pendingPath:'pending'});
 const save=(task,actor=staff)=>api.saveDeskDailyJournalTask({dateKey,task},actor);
 const history=(id,actor=staff,more={})=>api.getDeskDailyJournalTaskHistory({dateKey,id,...more},actor);
 return {api,save,history,dump:()=>structuredClone(root),failIndex:()=>{failIndex=true;},retry:(cb,cached=null)=>{retry={cb,cached};}};
}
test('staff creates own work and server owns identity, version, source and audit attribution',async()=>{
 const f=fixture(),res=await f.save({id:'self',worker:staff.name,title:'자료 준비',createdByUid:'forged',createdByName:'위조',version:999,selfCreated:false});
 assert.equal(res.success,true);assert.equal(res.task.selfCreated,true);assert.equal(res.task.version,1);assert.equal(res.task.createdByUid,staff.uid);
 const audit=await f.history('self');assert.equal(audit.history[0].action,'CREATED');assert.equal(audit.history[0].actorUid,staff.uid);assert.equal(audit.history[0].before,null);assert.equal(f.dump().pending.self.version,1);
});
test('missing or unknown role cannot mutate or inspect journal history',async()=>{
 for(const role of [undefined,'STUDENT','TEACHER']){const f=fixture();const who={name:staff.name,role};assert.equal((await f.save({id:'x',worker:staff.name,title:'x'},who)).success,false);assert.equal((await f.history('x',who)).success,false);assert.equal((await f.api.deleteDeskDailyJournalTask({dateKey,id:'x'},who)).success,false);assert.deepEqual(f.dump(),{});}
});
test('staff cannot assign other workers, routines, or edit somebody else; histories are private',async()=>{
 const f=fixture();for(const task of [{id:'x',worker:other.name,title:'x'},{id:'x',worker:staff.name,title:'x',targetWorkers:[other.name]},{id:'x',dateKey:'2099-12-31',worker:staff.name,title:'x'}])assert.equal((await f.save(task)).success,false);
 const assigned=await f.save({id:'assigned',worker:other.name,title:'배정'},admin),baseline=f.dump();assert.equal((await f.save({...assigned.task,completed:true})).success,false);assert.equal((await f.history('assigned')).success,false);assert.deepEqual(f.dump(),baseline);assert.equal((await f.history('assigned',other)).success,true);
});
test('waiting, in progress, follow-up, completed and reopen keep exact timeline across clients',async()=>{
 const f=fixture();let res=await f.save({id:'flow',worker:staff.name,title:'자기 업무'});const creator=res.task.createdAt;
 for(const status of ['진행 중','확인 필요','완료','진행 중']){res=await f.save({...res.task,completed:status==='완료',progressStatus:status,unresolvedReason:'진행 기록',nextAction:'강사 확인'});assert.equal(res.success,true);assert.equal(res.task.progressStatus,status);assert.equal(res.task.createdAt,creator);if(status==='완료')assert.equal(f.dump().pending.flow,undefined);else assert.equal(f.dump().pending.flow.progressStatus,status);}
 const audit=await f.history('flow');assert.deepEqual(audit.history.map(e=>e.version),[5,4,3,2,1]);assert.equal(audit.history[0].before.progressStatus,'완료');assert.equal(audit.history[0].after.progressStatus,'진행 중');assert.equal(audit.history[2].after.nextAction,'강사 확인');assert.equal(res.task.completedAt,'');
});
test('retry does not duplicate timeline; stale client cannot overwrite newer change',async()=>{
 const f=fixture(),first=await f.save({id:'cas',worker:staff.name,title:'업무'}),payload={...first.task,progressStatus:'진행 중'};
 const changed=await f.save(payload);assert.equal(changed.success,true);assert.equal((await f.save(payload)).success,true);assert.equal((await f.history('cas')).history.length,2);
 const before=f.dump(),stale=await f.save({...first.task,progressStatus:'확인 필요',nextAction:'누락될 변경'});assert.equal(stale.success,false);assert.match(stale.message,/다른 변경/);assert.deepEqual(f.dump(),before);
});
test('canonical task and audit survive index failure; same retry repairs index without another event',async()=>{
 const f=fixture();f.failIndex();const input={id:'repair',worker:staff.name,title:'업무'};await assert.rejects(()=>f.save(input),/index unavailable/);assert.equal(f.dump().journal[dateKey].tasks.repair.version,1);assert.equal((await f.history('repair')).history.length,1);assert.equal((await f.save(input)).success,true);assert.equal(f.dump().pending.repair.version,1);assert.equal((await f.history('repair')).history.length,1);
});
test('transaction retries check actual server owner and version',async()=>{
 const f=fixture(),first=await f.save({id:'retry',worker:staff.name,title:'업무'});
 f.retry(root=>{root.journal[dateKey].tasks.retry={...first.task,worker:other.name,version:2};});const before=f.dump();const res=await f.save({...first.task,progressStatus:'진행 중'});assert.equal(res.success,false);assert.equal(f.dump().journal[dateKey].tasks.retry.worker,other.name);assert.deepEqual(f.dump().journal[dateKey].taskHistory,before.journal[dateKey].taskHistory);
});
test('self owner may edit own title but cannot tamper with creator, assignment, or history',async()=>{
 const f=fixture(),first=await f.save({id:'owner',worker:staff.name,title:'전'});const edited=await f.save({...first.task,title:'후',createdByUid:'forged',selfCreated:false,taskHistory:{fake:{}}});assert.equal(edited.success,true);assert.equal(edited.task.createdByUid,staff.uid);assert.equal(edited.task.selfCreated,true);assert.equal((await f.history('owner')).history.length,2);
 const assigned=await f.save({id:'admin-assigned',worker:staff.name,title:'관리자 배정'},admin);assert.equal((await f.save({...assigned.task,title:'변경'})).success,false);assert.equal((await f.save({...edited.task,worker:other.name})).success,false);
});
test('deleted work stays deleted and deletion history remains readable; staff deletion denied',async()=>{
 const f=fixture(),first=await f.save({id:'delete',worker:staff.name,title:'업무'});assert.equal((await f.api.deleteDeskDailyJournalTask({dateKey,id:'delete'},staff)).success,false);assert.equal((await f.api.deleteDeskDailyJournalTask({dateKey,id:'delete',version:first.task.version},admin)).success,true);assert.equal((await f.history('delete')).history[0].action,'DELETED');assert.equal((await f.save(first.task)).success,false);assert.equal(f.dump().pending.delete,undefined);
});
test('history pagination has stable version cursor and labels existing unaudited records honestly',async()=>{
 const f=fixture({journal:{[dateKey]:{tasks:{legacy:{id:'legacy',worker:staff.name,title:'이전 업무'}}}}});assert.equal((await f.history('legacy')).legacy,true);let res=await f.save({id:'many',worker:staff.name,title:'여러 기록'});for(let i=0;i<34;i++)res=await f.save({...res.task,unresolvedReason:String(i)});
 const first=await f.history('many'),second=await f.history('many',staff,{beforeVersion:first.nextBeforeVersion});assert.equal(first.history.length,30);assert.equal(second.history.length,5);assert.equal(second.nextBeforeVersion,null);assert.equal(new Set([...first.history,...second.history].map(e=>e.version)).size,35);
});


test('cold transaction cache cannot falsely reject deletion of an existing task', async () => {
 const f=fixture();await f.save({id:'cold-delete',worker:staff.name,title:'기존'});
 f.retry(()=>{});
 assert.equal((await f.api.deleteDeskDailyJournalTask({dateKey,id:'cold-delete'},admin)).success,true);
 assert.equal((await f.history('cold-delete')).history[0].action,'DELETED');
});
test('cached no-op still checks live state and cannot repair index with an obsolete record', async () => {
 const f=fixture(),first=await f.save({id:'no-op',worker:staff.name,title:'기존'});
 f.retry(root=>{root.journal[dateKey].tasks['no-op']={...first.task,version:2,progressStatus:'진행 중'};},first.task?{tasks:{'no-op':first.task}}:null);
 const res=await f.save(first.task);assert.equal(res.success,false);assert.equal(f.dump().journal[dateKey].tasks['no-op'].progressStatus,'진행 중');assert.equal((await f.history('no-op')).history.length,1);
});


test('save endpoint cannot bypass administrator deletion by setting deleted in task payload', async () => {
 const f=fixture(),first=await f.save({id:'delete-bypass',worker:staff.name,title:'업무'}),before=f.dump();
 assert.equal((await f.save({...first.task,deleted:true})).success,false);
 assert.equal((await f.save({id:'hidden-create',worker:staff.name,title:'숨겨진 업무',deleted:true})).success,false);
 assert.deepEqual(f.dump(),before);
});
