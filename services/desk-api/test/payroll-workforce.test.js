import test from 'node:test';
import assert from 'node:assert/strict';
import {paidWorkMinutes,staffWorkRows,createWorkforceHandlers,STAFF_PAYROLL_EXCLUDED} from '../src/payroll/workforce.js';
function fixture(){
 const docs=new Map(),snapshot=k=>({id:k.split('/').at(-1),exists:docs.has(k),data:()=>structuredClone(docs.get(k))});
 function collection(path){return {doc:id=>reference(path+'/'+id),orderBy(){return this},limit(){return this},async get(){return{docs:[...docs.keys()].filter(k=>k.startsWith(path+'/')&&!k.slice(path.length+1).includes('/')).map(snapshot)}}};}
 function reference(path){return {path,get:async()=>snapshot(path),collection:name=>collection(path+'/'+name)};}
 const firestore={collection,async runTransaction(fn){const pending=[];const tx={getAll:async(...refs)=>refs.map(r=>snapshot(r.path)),get:async r=>snapshot(r.path),set:(r,v)=>pending.push([r.path,v]),create:(r,v)=>{assert.equal(docs.has(r.path),false);pending.push([r.path,v]);}};const result=await fn(tx);pending.forEach(([k,v])=>docs.set(k,structuredClone(v)));return result;}};
 const source={schedule:{entries:{a:{date:'2026-09-03',worker:'보조직원',role:'마감 담당',start:'14:00',end:'22:30'},b:{date:'2026-09-03',worker:'안종성',start:'14:00',end:'22:30'}}},attendance:{}};
 const handlers=createWorkforceHandlers({firestore,deskStore:{get:async path=>path.includes('monthly_schedule')?source.schedule:source.attendance},loadStaffDirectory:async()=>[{name:'보조직원',uid:'staff'},{name:'안종성',uid:'excluded'}],now:()=>new Date('2026-10-09T03:00:00Z')});
 return{docs,source,handlers};
}
const admin={uid:'admin',role:'ADMIN',name:'관리자'},payload={monthName:'26-09',workerName:'보조직원'};
test('paid time subtracts configurable breaks and rejects invalid or overnight ranges',()=>{
 assert.equal(paidWorkMinutes('14:00','22:30',30),480);assert.equal(paidWorkMinutes('14:00','22:30',60),450);
 for(const args of [['22:30','02:00',30],['14:00','14:20',30],['24:00','25:00',0],['14:00','22:00',-1],['14:00','22:00',0.5]])assert.throws(()=>paidWorkMinutes(...args));
});
test('complete punches override plans; incomplete and overlapping records need confirmation',()=>{
 const base={month:'2026-09',name:'직원',uid:'u',schedule:{entries:{one:{worker:'직원',date:'2026-09-03',start:'14:00',end:'22:30'}}}};
 const attendance={'2026-09-03':{u:{uid:'u',clockIn:'2026-09-03T06:00:00Z',clockOut:'2026-09-03T13:00:00Z'}}};
 assert.equal(staffWorkRows({...base,attendance})[0].paidMinutes,390);delete attendance['2026-09-03'].u.clockOut;
 assert.equal(staffWorkRows({...base,attendance})[0].paidMinutes,null);
 assert.equal(staffWorkRows({...base,attendance,corrections:{'2026-09-03':{start:'14:00',end:'22:30',breakMinutes:30,reason:'확인'}}})[0].paidMinutes,480);
 base.schedule.entries.two={...base.schedule.entries.one};assert.match(staffWorkRows({...base,attendance:{}})[0].issue,/여러 기록/);
});
test('eligibility excludes the eight people and writes reject staff, stale source and compensation',async()=>{
 const {handlers,docs,source}=fixture();const r=await handlers.getPayrollStaffMonth(payload,admin);assert.deepEqual(r.workers,[{name:'보조직원'}]);assert.equal(STAFF_PAYROLL_EXCLUDED.size,8);
 assert.equal((await handlers.getPayrollStaffMonth({...payload,workerName:'안종성'},admin)).success,false);
 const p={...payload,expectedVersion:r.version,clientRequestId:'request-123',rows:[{date:'2026-09-03',start:'14:00',end:'22:30',breakMinutes:30,reason:'확인'}]};
 assert.equal((await handlers.savePayrollStaffTimes(p,{uid:'staff',role:'STAFF'})).success,false);
 assert.equal((await handlers.savePayrollStaffTimes({...p,hourlyRate:12000},admin)).success,false);
 assert.equal((await handlers.savePayrollStaffTimes({...p,rows:[{...p.rows[0],pay:96000}]},admin)).success,false);
 source.schedule.entries.a.end='22:00';assert.equal((await handlers.savePayrollStaffTimes(p,admin)).success,false);assert.equal(docs.size,0);
});
test('corrections survive reload and immutable finalization contains time only',async()=>{
 const {handlers,docs}=fixture();let r=await handlers.getPayrollStaffMonth(payload,admin);
 assert.equal((await handlers.savePayrollStaffTimes({...payload,expectedVersion:r.version,clientRequestId:'request-123',rows:[{date:'2026-09-03',start:'14:00',end:'22:30',breakMinutes:60,reason:'실제 휴게 확인'}]},admin)).success,true);
 r=await handlers.getPayrollStaffMonth(payload,admin);assert.equal(r.totalMinutes,450);assert.equal(r.rows[0].source,'관리자 수정');
 const p={...payload,expectedVersion:r.version,clientRequestId:'finalize-123'};
 assert.equal((await handlers.savePayrollStaffFinalization(p,admin)).success,true);assert.equal((await handlers.savePayrollStaffFinalization(p,admin)).duplicate,true);
 r=await handlers.getPayrollStaffMonth(payload,admin);assert.equal(r.finalizations.length,1);assert.equal(r.finalizations[0].totalMinutes,450);
 const serialized=JSON.stringify([...docs.values()]);for(const word of ['hourlyRate','wage','salary','payout','estimatedPay'])assert.equal(serialized.includes(word),false);
 assert.equal((await handlers.savePayrollStaffFinalization({...p,clientRequestId:'finalize-456',amount:90000},admin)).success,false);
});
test('incomplete attendance and empty months cannot finalize',async()=>{
 const {handlers,source}=fixture();source.attendance={'2026-09-03':{staff:{uid:'staff',clockIn:'2026-09-03T05:00:00Z'}}};let r=await handlers.getPayrollStaffMonth(payload,admin);assert.equal(r.unresolved,1);
 assert.equal((await handlers.savePayrollStaffFinalization({...payload,expectedVersion:r.version,clientRequestId:'finalize-123'},admin)).success,false);
 source.schedule={};source.attendance={};r=await handlers.getPayrollStaffMonth(payload,admin);assert.equal(r.rows.length,0);assert.equal((await handlers.savePayrollStaffFinalization({...payload,expectedVersion:r.version,clientRequestId:'finalize-456'},admin)).success,false);
});
