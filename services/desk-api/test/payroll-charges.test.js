import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeLessonCharges,buildPayrollSummary,parsePayrollMonthName} from '../src/payroll/normalizers.js';
const base={source:'intranet',amount:100000,billingAmount:100000,discount:.1,attendanceCode:'출석',sourceRecognized:true,payHours:2,hours:2,classDateKey:'2026-09-01',teacher:'T',classType:'개별',rowKey:'a'};
test('monthly charges include discounted cancellation and exclude duplicate makeup and absence',()=>{
 const s=summarizeLessonCharges([base,{...base,attendanceCode:'당일취소',sourceRecognized:false},{...base,lessonKind:'cancelMakeup',billingAmount:0,makeupAutoPriced:true},{...base,attendanceCode:'결석예고'},{...base,sourcePending:true}]);
 assert.deepEqual(s.total,{count:2,gross:200000,discount:20000,net:180000});assert.equal(s.canceled.net,90000);assert.equal(s.pendingCount,1);
});
test('student charges use source data independently of teacher overrides and filters',()=>{
 const s=buildPayrollSummary([base,{...base,rowKey:'b',teacher:'other'}],parsePayrollMonthName('26-09'),{teacherName:'T',effectiveOverrides:{amountOverrides:[{rowKey:'a',amount:200000}]}});
 assert.equal(s.kpi.lessonCharges.total.net,90000);assert.equal(s.kpi.netSales,180000);
});
test('zero charges and whole-won discount rounding reconcile',()=>{
 const s=summarizeLessonCharges([{...base,amount:87501,billingAmount:87501},{...base,amount:0,billingAmount:0}]);
 assert.equal(s.total.net,78751);assert.equal(s.total.gross-s.total.discount,s.total.net);
});

test('type hours and amounts reconcile without counting makeup, absence or pending lessons', () => {
 const s = summarizeLessonCharges([base, {...base, classType:'1:1', hours:1.5}, {...base,classType:'개별정규',hours:3,attendanceCode:'당일취소'}, {...base,lessonKind:'cancelMakeup'}, {...base,attendanceCode:'결석예고'}, {...base,sourcePending:true}]);
 assert.equal(s.types.length,3);
 assert.equal(s.types.reduce((sum,r)=>sum+r.hours,0),6.5);
 assert.equal(s.types.find(r=>r.type==='개별정규').category,'당일취소');
 for (const key of ['count','gross','discount','net']) assert.equal(s.types.reduce((sum,r)=>sum+r[key],0),s.total[key]);
});
