import test from 'node:test';
import assert from 'node:assert/strict';
import {combineLessons,intranetRows,payrollMonths} from '../src/payroll/intranet.js';
import {applyFees} from '../src/payroll/intranet-projection.js';
import {buildPayrollSummary,parsePayrollMonthName,applyPayrollSettingsUpdates,payrollOverrideSignature} from '../src/payroll/normalizers.js';
import {createPayrollHandlers} from '../src/payroll/handlers.js';
const meta=parsePayrollMonthName('26-09');
const lesson={id:'one',studentId:'student',date:'2026-09-03',teacher:'강사',className:'수학-개별(강사)-2h',start:'14:00',end:'16:00',sourceMinutes:120,payMinutes:120,billMinutes:120,rate:30000,reviewed:true,kind:'regular',warnings:[]};
const rows=ls=>intranetRows(ls,new Map([['student',{name:'학생'}]]),meta);
test('month cutover is KST, includes new month without Sheet tab',()=>{
 assert.deepEqual(payrollMonths(['26-08','26-09'],new Date('2026-08-31T15:00:00Z')),['26-09','26-08']);
 assert.deepEqual(payrollMonths(['26-08'],new Date('2026-09-30T15:00:00Z')),['26-10','26-09','26-08']);
});
test('drafts replace existing lessons, tombstones remove them, student IDs isolate duplicates',()=>{
 const p=[{studentId:'student',lessons:[lesson]}];
 const combined=combineLessons(p,p,[{lesson:{...lesson,rate:40000}},{lesson:{...lesson,id:'deleted',deletedAt:'today'}},{lesson:{...lesson,studentId:'other'}}]);
 assert.equal(combined.length,2);assert.equal(combined[0].rate,40000);
 const a=rows([lesson])[0],b=rows([{...lesson,rate:50000,start:'15:00',className:'변경'}])[0];assert.equal(a.rowKey,b.rowKey);assert.notEqual(a.rowKey,rows([{...lesson,studentId:'other'}])[0].rowKey);
});
test('intranet fee assignments and per-class overrides match intranet amounts',()=>{
 const projected=applyFees({lessons:[lesson]},'student','2026-09',[{kind:'lesson',target:'one',amount:87500,rateUnit:'perClass'}]);
 assert.equal(rows(projected.lessons)[0].amount,87500);
 const access={...lesson,source:'access-history',access:{billingAuthoritative:true,amount:59063},rate:0};
 assert.equal(rows([access])[0].amount,59063);
 const corrected=applyFees({lessons:[access]},'student','2026-09',[{kind:'lesson',target:'one',amount:70000,rateUnit:'perClass',sourceType:'bulk-fee-override'}]);assert.equal(rows(corrected.lessons)[0].amount,70000);
});
test('cancel, makeup, pending and payroll settings have explicit source semantics',()=>{
 const input=rows([lesson,{...lesson,id:'cancel',kind:'cancel',payMinutes:0},{...lesson,id:'makeup',kind:'cancelMakeup',billMinutes:0,rate:0,note:'당일취소 보강'},{...lesson,id:'unknown',rate:null}]);
 const s=buildPayrollSummary(input,meta,{teacherSettings:{'강사':{salaryMode:'ratio',ratioPercent:70}},ratioPercent:50,hourlyRate:30000});
 assert.equal(s.kpi.netSales,60000);assert.equal(s.kpi.estimatedPay,42000);assert.equal(s.kpi.recognizedLessons,2);assert.equal(s.kpi.canceledAmount,60000);assert.equal(s.rows.find(r=>r.lessonId==='unknown').sourcePending,true);assert.equal(s.rows.find(r=>r.lessonId==='makeup').amount,0);
});
test('saved settings preserve bank/payment fields when top controls update',()=>{
 const s=applyPayrollSettingsUpdates({'강사':{salaryMode:'ratio',hourlyRate:30000,bankName:'은행',paidByMonth:{'26-09':true}}},{monthName:'26-09',updates:[{teacher:'강사',hourlyRate:45000,ratioPercent:65}]},'today');
 assert.equal(s['강사'].bankName,'은행');assert.equal(s['강사'].paidByMonth['26-09'],true);assert.equal(s['강사'].ratioPercent,65);assert.equal(s['강사'].hourlyRate,45000);
 assert.equal(payrollOverrideSignature({}),payrollOverrideSignature({updatedAt:'today'}));
});
test('September summary and monthly analysis never read September Sheet',async()=>{
 const read=[]; const store={getSettings:async()=>({}),getOverrides:async()=>({})};
 const h=createPayrollHandlers({store,sheets:{listPayrollMonths:async()=>['26-09','26-08'],readPayrollMonth:async m=>{read.push(m);return {values:[]};}},intranet:{readMonth:async()=>({rows:rows([lesson]),version:'v1'})},now:()=>new Date('2026-09-16')});
 const s=await h.getPayrollMonthSummary({monthName:'26-09'});assert.equal(s.success,true);assert.equal(s.cache.source,'intranet');assert.equal(s.rows.length,1);
 await h.getPayrollMonthSummary({monthName:'26-08'});await h.getPayrollMonthlyAnalysis();assert.deepEqual(read,['26-08','26-08']);
});

test('actual duration remains visible while teacher pay minutes control recognized hours',()=>{
 const input=rows([{...lesson,payMinutes:60},{...lesson,id:'cancel',kind:'cancel',payMinutes:0}]);
 const s=buildPayrollSummary(input,meta,{teacherSettings:{'강사':{salaryMode:'hourly',hourlyRate:30000}}});
 assert.equal(s.rows[0].hours,2);assert.equal(s.rows[0].recognizedHours,1);assert.equal(s.rows[1].hours,2);assert.equal(s.rows[1].recognizedHours,0);assert.equal(s.kpi.pureTeachingHours,1);assert.equal(s.kpi.estimatedPay,30000);
});

test('published deletion survives draft cleanup and stale history/re-import without hiding another student',()=>{
 const old=[{studentId:'student',lessons:[lesson]},{studentId:'other',lessons:[{...lesson,studentId:'other'}]}];
 const current=[{studentId:'student',lessons:[],publishedDeletedIds:['one']}];
 assert.equal(combineLessons(current,old,[]).length,1);
 assert.equal(combineLessons(current,old,[{lesson}])[0].studentId,'other');
});

test('successive reads reflect edits, fee changes, new lessons and published deletions in totals',async()=>{
 const {createIntranetPayrollReader}=await import('../src/payroll/intranet.js');
 const data={students:[{_id:'student',name:'학생'}],intranetLegacyPeriods:[{studentId:'student',month:'2026-09',lessons:[lesson]}]};
 const db={collection(name){return {where(_field,_op,month){return {...this,month};},limit(){return this;},async get(){const all=(data[name]||[]).filter(r=>!this.month||r.month===this.month);return {size:all.length,docs:all.map((r,i)=>({id:r._id||String(i),data:()=>structuredClone(r)}))};}};}};
 const reader=createIntranetPayrollReader(db);
 const summarize=async(overrides={})=>{const source=await reader.readMonth('26-09');return {source,...buildPayrollSummary(source.rows,meta,{ratioPercent:50,effectiveOverrides:overrides})};};
 const initial=await summarize();assert.equal(initial.kpi.netSales,60000);
 data.intranetLessonDrafts=[{month:'2026-09',lesson:{...lesson,end:'17:00',sourceMinutes:180,payMinutes:180,billMinutes:180}}];
 const edited=await summarize();assert.equal(edited.kpi.netSales,90000);assert.equal(edited.kpi.recognizedHours,3);assert.notEqual(initial.source.version,edited.source.version);assert.equal(initial.rows[0].rowKey,edited.rows[0].rowKey);
 data.intranetStudentFees=[{studentId:'student',month:'2026-09',assignments:[{kind:'lesson',target:'one',amount:100000,rateUnit:'perClass'}]}];
 assert.equal((await summarize()).kpi.netSales,100000);
 const manual={amountOverrides:[{rowKey:edited.rows[0].rowKey,amount:75000}]};
 const corrected=await summarize(manual);assert.equal(corrected.kpi.netSales,75000);assert.equal(corrected.rows[0].originalAmount,100000);
 data.intranetLessonDrafts.push({month:'2026-09',lesson:{...lesson,id:'new'}});
 assert.equal((await summarize()).rows.length,2);
 data.intranetStudentPeriods=[{studentId:'student',month:'2026-09',lessons:[],publishedDeletedIds:['one']}];
 const removed=await summarize(manual);assert.equal(removed.rows.length,1);assert.equal(removed.kpi.netSales,60000);assert.equal(removed.kpi.estimatedPay,30000);
 data.intranetLessonDrafts=[{month:'2026-09',lesson:{...lesson,id:'new',deletedAt:'today'}}];
 assert.equal((await summarize()).rows.length,0);
});
