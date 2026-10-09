import assert from 'node:assert/strict';
import {test} from 'node:test';
import ExcelJS from 'exceljs';
import {buildMonthlyWorkbook,selectExportPayments,paymentKind} from '../src/payroll/workbook.js';
import {createPayrollExportHandler} from '../src/payroll/export-handler.js';
const base={name:'/테스트학생',classDateKey:'2026-09-30',className:'수학-1:1',attendanceCode:'출석',teacher:'테스트강사',startMinutes:22*60,endMinutes:1440,hours:2,rate:150000,amount:300000,netAmount:270000,discountPercent:10,recognized:true};
const payments=[{studentName:'납부학생',sourceMonth:'26-08',paidAt:'2026-09-03',amount:-50000,paymentType:'카드',approvalNo:'00123'},{studentName:'환불학생',sourceMonth:'26-09',paidAt:'2026-09-04',amount:10000,paymentType:'현금'},{studentName:'제외학생',sourceMonth:'26-09',paidAt:'2026-10-01',amount:-99999,paymentType:'현금'},{studentName:'정정학생',sourceMonth:'26-09',paidAt:'2026-09-01',amount:-99999,countsAsPayment:false}];
test('seven-sheet legacy export preserves names, dates, discount, 24:00 and excludes unrecognized sales',async()=>{
 const rows=[base,{...base,name:'결석학생',attendanceCode:'결석예고',recognized:false,amount:0,netAmount:0},{...base,name:'당취학생',attendanceCode:'당일취소',recognized:false},{...base,name:'미확인학생',sourcePending:true,sourcePendingReason:'단가 없음',recognized:false,amount:0}];
 const result=await buildMonthlyWorkbook({month:'2026-09',summary:{rows},teachers:[{name:'테스트강사',subject:'수학',settings:{salaryMode:'hourly',hourlyRate:70000},kpi:{netSales:270000,pureTeachingHours:2,estimatedPay:140000},pending:true}],payments,workers:[{workerName:'근무자',totalMinutes:480,unresolved:0,rows:[{date:'2026-09-01',start:'14:00',end:'22:30',breakMinutes:30,paidMinutes:480,source:'등록 근무표'}]}]});
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(result.buffer);
 assert.deepEqual(wb.worksheets.map(s=>s.name),['매출현황보고','보고_신규양식','직원급여','전체결산','카드납부','현금납부','운영비_상세내역']);
 const ledger=wb.getWorksheet('전체결산');const list=Array.from({length:4},(_,i)=>ledger.getRow(i+2));const attend=list.find(r=>r.getCell(1).value==='/테스트학생');
 assert.equal(attend.getCell(13).value,.9);assert.equal(attend.getCell(11).result,270000);assert.equal(attend.getCell(8).value.toISOString(),'1899-12-31T00:00:00.000Z');assert.ok(attend.getCell(2).value instanceof Date);
 assert.equal(ledger.getCell('Q2').result,270000);assert.equal(ledger.getCell('R2').result,600000);
 assert.equal(list.find(r=>r.getCell(1).value==='/결석학생').getCell(11).value,0);
 assert.equal(list.find(r=>r.getCell(1).value==='/미확인학생').getCell(11).value,'확인 필요');
 assert.equal(wb.getWorksheet('보고_신규양식').getCell('L5').value,140000);
 const staff=wb.getWorksheet('직원급여');assert.equal(staff.getCell('F4').value,8);for(const c of ['E4','G4','H4','I4'])assert.equal(staff.getCell(c).value,null);
 assert.equal(wb.getWorksheet('카드납부').getCell('H2').value,'00123');assert.equal(result.stats.cardTotal,50000);assert.equal(result.stats.cashTotal,-10000);
 const values=wb.worksheets.flatMap(s=>{const v=[];s.eachRow(r=>r.eachCell(c=>v.push(c.text)));return v;}).join(' ');
 assert.doesNotMatch(values,/김유민|정보면|김동현|750602|169828677/);
});
test('payments use actual payment month, preserve refunds and exclude adjustments',()=>{assert.equal(selectExportPayments(payments,'2026-09').length,2);});
test('export rejects truncated payment reads instead of silently exporting partial totals',async()=>{
 const handler=createPayrollExportHandler({payroll:{readExportMonth:async()=>({summary:{rows:[]},teachers:[]})},workforce:{getPayrollStaffMonth:async()=>({success:true,workers:[]})},tuitionStore:{list:async()=>Array(20001).fill({})}});
 await assert.rejects(()=>handler({monthName:'26-09',teacherName:'ignored'}),/조회 한도/);
});
test('export uses saved full-month data and reports unavailable previous month',async()=>{
 const called=[];const handler=createPayrollExportHandler({payroll:{readExportMonth:async m=>{called.push(m);if(m==='26-08')throw Error('missing');return {summary:{rows:[base]},teachers:[]};}},workforce:{getPayrollStaffMonth:async()=>({success:true,workers:[]})},tuitionStore:{list:async()=>[]}});
 const result=await handler({monthName:'26-09',teacherName:'filter',amountOverrides:[{}]});assert.deepEqual(called,['26-09','26-08']);assert.equal(result.success,true);assert.match(result.warnings.join(),/전월 매출 미조회/);assert.equal(result.stats.netTotal,270000);
});

test('abbreviated card brands and unclassified refunds are not counted as cash',()=>{
 assert.equal(paymentKind({paymentType:'결제링크',cardCompany:'비씨카'}),'card');
 assert.equal(paymentKind({paymentType:'기타',cardCompany:'신한'}),'card');
 assert.equal(paymentKind({paymentType:'계좌이체',cardCompany:'현금영수증'}),'cash');
 assert.equal(paymentKind({}),'unknown');
});
