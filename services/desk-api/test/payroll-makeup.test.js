import test from 'node:test';
import assert from 'node:assert/strict';
import {priceCancellationMakeups} from '../src/payroll/makeup.js';
import {buildPayrollSummary,parsePayrollMonthName} from '../src/payroll/normalizers.js';
const original={rowKey:'original',lessonId:'original',studentId:'student',teacher:'강사',subject:'영어',classType:'개별',lessonKind:'cancel',classDateKey:'2026-09-03',start:'15:00',startMinutes:900,endMinutes:1080,billingHours:3,hours:3,payHours:0,amount:87500,discount:.1,sourcePending:false};
const makeup={...original,rowKey:'makeup',lessonId:'makeup',lessonKind:'cancelMakeup',classDateKey:'2026-09-05',billingHours:0,payHours:3,amount:0,discount:0,note:'9/3 당취 보충',source:'intranet',attendanceCode:'보강',sourceRecognized:true};
test('makeup transfers discounted original fee, keeping student charge zero',()=>{
 const r=priceCancellationMakeups([makeup],[original,makeup])[0];assert.equal(r.amount,87500);assert.equal(r.discount,.1);assert.equal(r.billingAmount,0);assert.equal(r.makeupOriginalDate,'2026-09-03');assert.equal(r.sourceRecognized,true);
 const s=buildPayrollSummary([r],parsePayrollMonthName('26-09'),{ratioPercent:50});assert.equal(s.kpi.netSales,78750);assert.equal(s.kpi.estimatedPay,39375);
});
test('partial makeup uses original fee per minute and caps total replacement hours',()=>{
 const a={...makeup,hours:1,payHours:1},b={...makeup,rowKey:'b',lessonId:'b',classDateKey:'2026-09-06',hours:2,payHours:2},c={...makeup,rowKey:'c',lessonId:'c',classDateKey:'2026-09-07',hours:1,payHours:1};
 const out=priceCancellationMakeups([a,b,c],[original,a,b,c]);assert.equal(out[0].amount,29167);assert.equal(out[1].amount,58333);assert.equal(out[2].sourcePending,true);assert.match(out[2].sourcePendingReason,/초과/);
});
test('legacy imported zero hours recover from actual clock times; explicit zero pay remains excluded',()=>{
 const legacy={...makeup,hours:0,payHours:0,legacyZeroMakeup:true};const r=priceCancellationMakeups([legacy],[original,legacy])[0];assert.equal(r.hours,3);assert.equal(r.payHours,3);assert.equal(r.amount,87500);
 const zero={...makeup,payHours:0};const z=priceCancellationMakeups([zero],[original,zero])[0];assert.equal(z.payHours,0);assert.equal(z.sourceRecognized,false);assert.equal(z.amount,0);
});
test('ambiguous, mismatched and missing originals require review instead of invented prices',()=>{
 const duplicate={...original,rowKey:'other',lessonId:'other'};
 assert.equal(priceCancellationMakeups([makeup],[original,duplicate,makeup])[0].sourcePending,true);
 assert.equal(priceCancellationMakeups([makeup],[{...original,teacher:'다른 강사'},makeup])[0].sourcePending,true);
 assert.equal(priceCancellationMakeups([makeup],[makeup])[0].sourcePending,true);
 const selected=priceCancellationMakeups([makeup],[original,duplicate,makeup],[{studentId:'student',makeupId:'makeup',originalId:'original'}])[0];assert.equal(selected.amount,87500);
});
test('previous month cancellation and chained zero-charge cancellation resolve original amount only once',()=>{
 const previous={...original,classDateKey:'2026-08-23'},zero={...original,rowKey:'zero',lessonId:'zero',classDateKey:'2026-08-28',amount:0};
 const m={...makeup,note:'8/23 당취=>8/28 보충 당취=> 에 대한 보충'};assert.equal(priceCancellationMakeups([m],[previous,zero,m])[0].amount,87500);
 const priorMakeup={...makeup,rowKey:'prior',lessonId:'prior',classDateKey:'2026-08-25',note:'8/23 당취 보충'};assert.equal(priceCancellationMakeups([m],[previous,priorMakeup,m])[0].sourcePending,true);
});
test('other makeup kinds are not repriced',()=>{const r={...makeup,lessonKind:'absenceMakeup'};assert.deepEqual(priceCancellationMakeups([r],[original,r]),[r]);});

test('day-only cancellation memo resolves the previous month without guessing another date',()=>{const o={...original,classDateKey:'2026-08-29'},other={...original,rowKey:'other',lessonId:'other',classDateKey:'2026-08-22'},m={...makeup,classDateKey:'2026-09-02',note:'29일 당취에 대한 보충'};assert.equal(priceCancellationMakeups([m],[o,other,m])[0].makeupOriginalDate,'2026-08-29');});
test('workbook keeps transferred payroll amount out of billed gross total',async()=>{
 const {buildMonthlyWorkbook}=await import('../src/payroll/workbook.js');const {default:ExcelJS}=await import('exceljs');
 const r=priceCancellationMakeups([{...makeup,name:'학생',className:'영어-개별',rateUnit:'perHour'}],[original,makeup])[0];
 const summary=buildPayrollSummary([r],parsePayrollMonthName('26-09'),{ratioPercent:50});const out=await buildMonthlyWorkbook({month:'2026-09',summary,teachers:[]});
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(out.buffer);assert.equal(wb.getWorksheet('전체결산').getCell('K2').result,78750);assert.equal(wb.getWorksheet('전체결산').getCell('N2').value,0);assert.equal(out.stats.grossTotal,0);
});
