import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { paidDateKey, mergePayments } from '../tuition/normalizers.js';

const names=['매출현황보고','보고_신규양식','직원급여','전체결산','카드납부','현금납부','운영비_상세내역'];
const money='#,##0;[Red]-#,##0';
const numeric=v=>Number.isFinite(Number(v))?Number(v):0;
const student=v=>'/'+String(v||'').replace(/^\/+/, '');
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v))?new Date(v+'T00:00:00Z'):null;
const formula=(cell,expression,result)=>{cell.value={formula:expression,result};};
const put=(s,cell,value)=>{s.getCell(cell).value=value;};
function row(s,n,values,styleRow=2){
  values.forEach((value,i)=>{const c=s.getCell(n,i+1);if(n!==styleRow)c.style=structuredClone(s.getCell(styleRow,i+1).style);c.value=value===''?null:value;});
  s.getRow(n).height=s.getRow(styleRow).height||16;
}
export function paymentKind(p){
  const method=String(p.paymentType||''),company=String(p.cardCompany||'');
  if(/현금|현영|무통장|계좌|서울페이|제로페이/.test(method+' '+company))return 'cash';
  if(/카드|card|결제링크/i.test(method)||company)return 'card';
  return 'unknown';
}
export function selectExportPayments(payments,month){
  return mergePayments(payments).filter(p=>p.countsAsPayment!==false&&p.entryKind!=='adjustment'&&paidDateKey(p).startsWith(month+'-')).sort((a,b)=>paidDateKey(a).localeCompare(paidDateKey(b))||a.studentName.localeCompare(b.studentName,'ko'));
}
export async function buildMonthlyWorkbook({month,summary,teachers,previousTeachers=[],payments=[],workers=[],warnings=[]}){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('정산 월이 올바르지 않습니다.');
  const wb=new ExcelJS.Workbook();
  await wb.xlsx.load(await readFile(new URL('./monthly-template.xlsx',import.meta.url)));
  wb.creator='에스에듀';wb.lastModifiedBy='에스에듀';wb.created=new Date();wb.modified=new Date();wb.calcProperties.fullCalcOnLoad=true;
  // Only static labels and styles ship in this template; strip leftover shared formulas defensively.
  for(const s of wb.worksheets){s.eachRow(r=>r.eachCell(c=>{if(c.type===ExcelJS.ValueType.Formula||typeof c.value==='number'||c.value==='')c.value=null;}));s.views=[{state:'frozen',ySplit:s.name==='전체결산'?1:0}];s.pageSetup.orientation='landscape';s.pageSetup.paperSize=9;s.pageSetup.fitToPage=true;s.pageSetup.fitToWidth=1;s.pageSetup.fitToHeight=0;}
  const [report,teacher,staff,ledger,card,cash,expense]=names.map(n=>wb.getWorksheet(n));
  const year=Number(month.slice(0,4)),m=Number(month.slice(5)),days=new Date(Date.UTC(year,m,0)).getUTCDate();
  const prior=new Map(previousTeachers.map(t=>[t.name,t]));
  const sourceRows=[...(summary.rows||[])].sort((a,b)=>a.classDateKey.localeCompare(b.classDateKey)||numeric(a.startMinutes)-numeric(b.startMinutes)||a.name.localeCompare(b.name,'ko'));
  let netTotal=0,grossTotal=0;
  sourceRows.forEach((r,i)=>{
    const n=i+2,absent=r.attendanceCode==='결석예고',pending=!!r.sourcePending&&!absent;
    const hours=numeric(r.hours),gross=absent?0:numeric(r.amount),factor=1-numeric(r.discountPercent)/100;
    // Per-class prices and manual amounts are converted without rounding the unit price.
    const rate=hours>0?gross/hours:0;
    const net=r.recognized&&!absent&&!pending?numeric(r.netAmount):0;
    const notes=[r.note,pending?r.sourcePendingReason:'',!r.recognized?'정산 제외':'',r.discountReason,(!pending&&hours>0&&Math.abs(rate-numeric(r.rate))>.01)?'시간당: 회당 금액을 수업시간으로 환산':''].filter(Boolean).join(' · ');
    row(ledger,n,[student(r.name),date(r.classDateKey),r.className,r.attendanceCode||r.attendance,r.room||'반포',r.teacher,r.startMinutes==null?null:r.startMinutes/1440,r.endMinutes==null?null:r.endMinutes/1440,hours,pending?null:rate,null,notes,factor,pending?null:gross]);
    ledger.getCell(n,2).numFmt=`m/d"(${['일','월','화','수','목','금','토'][date(r.classDateKey).getUTCDay()]})"`;ledger.getCell(n,7).numFmt=ledger.getCell(n,8).numFmt='h:mm:ss AM/PM';ledger.getCell(n,9).numFmt='0.0';
    for(const c of [10,11,14])ledger.getCell(n,c).numFmt=money;
    if(pending)ledger.getCell(n,11).value='확인 필요';
    else if(net===0&&!r.recognized)ledger.getCell(n,11).value=0;
    else if(hours>0)formula(ledger.getCell(n,11),`ROUND(I${n}*J${n}*M${n},0)`,net);
    else ledger.getCell(n,11).value=net;
    if(!pending){netTotal+=net;grossTotal+=gross;}
  });
  const end=Math.max(2,sourceRows.length+1);
  ledger.autoFilter=`A1:N${end}`;ledger.pageSetup.printTitlesRow='1:1';ledger.pageSetup.printArea=`A1:N${end}`;
  put(ledger,'P2','반포관');put(ledger,'P3','Total');formula(ledger.getCell('Q2'),`SUM(K2:K${end})`,netTotal);formula(ledger.getCell('R2'),`SUM(N2:N${end})`,grossTotal);formula(ledger.getCell('Q3'),'Q2',netTotal);formula(ledger.getCell('R3'),'R2',grossTotal);
  ledger.getColumn('L').width=42;ledger.getColumn('C').width=30;for(const c of ['G','H'])ledger.getColumn(c).width=16;
  put(ledger,'P5','금액: 할인 후 강사 정산 대상 매출');put(ledger,'P6','할인제외 총매출: 할인 전 청구액(당일취소 포함)');put(ledger,'P7','결석예고: 금액 0 · 정산 제외');
  put(teacher,'D3',`${m}월 매출`);put(teacher,'E3',`${m}월 매출`);put(teacher,'G3',`${m===1?12:m-1}월 매출`);put(teacher,'H3',`${m===1?12:m-1}월 매출`);put(teacher,'F4','전월 대비');
  teachers.forEach((t,i)=>{
    const n=i+5,p=prior.get(t.name),own=sourceRows.filter(r=>r.teacher===t.name),g=own.filter(r=>!r.sourcePending).reduce((s,r)=>s+numeric(r.amount),0);
    const config=t.settings;const net=numeric(t.kpi.netSales);const pay=config?numeric(t.kpi.estimatedPay):null;
    row(teacher,n,[null,t.name,t.subject,null,null,null,p?.kpi.netSales??null,p?.gross??null,config?(config.salaryMode==='hourly'?'시급':'비율'):'직접 입력 필요',config?(config.salaryMode==='hourly'?config.hourlyRate:config.ratioPercent/100):null,config?.salaryMode==='hourly'?`순수 ${t.kpi.pureTeachingHours}시간 · 중복 제외`:null,pay,null,t.pending?'확인 필요 수업 제외 · 잠정액':config?'저장된 급여 조건 기준 · 별도 조정 직접 입력':'급여 조건 직접 입력'],5);
    formula(teacher.getCell(n,4),`SUMIF('전체결산'!F2:F${end},B${n},'전체결산'!K2:K${end})`,net);
    formula(teacher.getCell(n,5),`SUMIF('전체결산'!F2:F${end},B${n},'전체결산'!N2:N${end})`,g);
    formula(teacher.getCell(n,6),`IF(OR(G${n}="",G${n}=0),"",(D${n}-G${n})/G${n})`,p?.kpi.netSales?(net-p.kpi.netSales)/p.kpi.netSales:'');
    formula(teacher.getCell(n,13),`IF(L${n}="","",ROUND(L${n}*0.967,0))`,pay==null?'':Math.round(pay*.967));
    teacher.getCell(n,6).numFmt='0.0%';teacher.getCell(n,10).numFmt=config?.salaryMode==='hourly'?money:'0%';
    for(const c of [4,5,7,8,12,13])teacher.getCell(n,c).numFmt=money;
  });
  teacher.getColumn('K').width=28;teacher.getColumn('N').width=48;teacher.pageSetup.printArea=`B2:N${Math.max(5,teachers.length+4)}`;
  put(staff,'B2',`${year}년 ${m}월 · 사무보조(파트타임)`);
  workers.forEach((w,i)=>{const n=i+4;row(staff,n,[null,w.workerName,'사무보조','시급',null,w.unresolved?null:w.totalMinutes/60,null,null,null,w.unresolved?'근무시간 확인 필요':'시급·지급액은 저장하지 않음 · 직접 계산'],4);staff.getCell(n,6).numFmt='0.00';});
  put(staff,`B${Math.max(10,workers.length+6)}`,'시급·지급액·계좌는 자동 입력하지 않습니다. 근무시간 상세는 운영비_상세내역에서 확인하세요.');staff.getColumn('J').width=48;
  const selected=selectExportPayments(payments,month),cards=[],cashRows=[];
  for(const p of selected){const method=[p.paymentType,p.cardCompany].filter(Boolean).join(' ');(paymentKind(p)==='card'?cards:cashRows).push(p);}
  for(const [sheet,items,isCard] of [[card,cards,true],[cash,cashRows,false]]){
    items.forEach((p,i)=>{const rawDue=String(p.dueDate||'');const dueMatch=rawDue.match(/^(\d{2}|\d{4})-(\d{2})-(\d{2})$/);const d=dueMatch?date(`${dueMatch[1].length===2?'20':''}${dueMatch[1]}-${dueMatch[2]}-${dueMatch[3]}`):null;const method=paymentKind(p)==='unknown'?'미분류 · 결제수단 확인 필요':[p.paymentType,p.cardCompany].filter(Boolean).join(' ');const vals=[d||(rawDue?'입력 확인: '+rawDue:''),student(p.studentName),...(isCard?[p.itemName||'납부금액']:[]),numeric(p.amount),date(paidDateKey(p)),p.business||'반포',method,p.approvalNo,p.inputAt];row(sheet,i+2,vals);sheet.getCell(i+2,isCard?4:3).numFmt=money;sheet.getCell(i+2,1).numFmt=d?'yyyy-mm-dd':'@';sheet.getCell(i+2,isCard?5:4).numFmt='yyyy-mm-dd';});
    sheet.autoFilter=`A1:${isCard?'I':'H'}${Math.max(2,items.length+1)}`;sheet.getColumn('B').width=16;sheet.getColumn(isCard?'G':'F').width=25;sheet.getColumn(isCard?'I':'H').width=24;
  }
  for(let day=1;day<=days;day++){const n=day+5;put(expense,`B${n}`,date(`${month}-${String(day).padStart(2,'0')}`));expense.getCell(`B${n}`).numFmt='mm"월 "dd"일"';put(expense,`C${n}`,['일요일','월요일','화요일','수요일','목요일','금요일','토요일'][new Date(Date.UTC(year,m-1,day)).getUTCDay()]);}
  put(expense,'D4','식비 · 직접 입력');put(expense,'E4','기타 운영비 · 직접 입력');
  formula(expense.getCell('D37'),'IF(COUNT(D6:D36)=0,"",SUM(D6:D36))','');formula(expense.getCell('E37'),'IF(COUNT(E6:E36)=0,"",SUM(E6:E36))','');put(expense,'B37','TOTAL');
  workers.forEach((w,i)=>{const c=7+i*3;expense.getCell(5,c).value=w.workerName;expense.getCell(6,c).value='날짜';expense.getCell(6,c+1).value='인정 근무시간';(w.rows||[]).forEach((r,j)=>{expense.getCell(j+7,c).value=date(r.date);expense.getCell(j+7,c).numFmt='m/d';expense.getCell(j+7,c+1).value=r.issue?'확인 필요':r.paidMinutes/60;expense.getCell(j+7,c+1).numFmt='0.00';expense.getCell(j+7,c+1).note=`${r.start}~${r.end} · 휴게 ${r.breakMinutes}분 · ${r.source}${r.issue?' · '+r.issue:''}`;});expense.getColumn(c+1).width=18;});
  put(expense,'B42','별도 급여 조정·카드 사용 내역: 직접 입력 필요');
  put(report,'E3',`${year}년 ${m}월`);formula(report.getCell('E10'),"'전체결산'!Q2",netTotal);formula(report.getCell('F10'),"'전체결산'!R2",grossTotal);formula(report.getCell('E11'),'E10',netTotal);formula(report.getCell('F11'),'F10',grossTotal);
  const cardTotal=-cards.reduce((s,p)=>s+numeric(p.amount),0),cashTotal=-cashRows.filter(p=>paymentKind(p)==='cash').reduce((s,p)=>s+numeric(p.amount),0),unknownTotal=-cashRows.filter(p=>paymentKind(p)==='unknown').reduce((s,p)=>s+numeric(p.amount),0);
  formula(report.getCell('E15'),`-SUM('카드납부'!D2:D${Math.max(2,cards.length+1)})`,cardTotal);formula(report.getCell('E16'),`-SUMIF('현금납부'!F2:F${Math.max(2,cashRows.length+1)},"<>미분류 · 결제수단 확인 필요",'현금납부'!C2:C${Math.max(2,cashRows.length+1)})`,cashTotal);formula(report.getCell('E17'),'E15+E16+E18',cardTotal+cashTotal+unknownTotal);put(report,'D18','미분류 수납');formula(report.getCell('E18'),`-SUMIF('현금납부'!F2:F${Math.max(2,cashRows.length+1)},"미분류 · 결제수단 확인 필요",'현금납부'!C2:C${Math.max(2,cashRows.length+1)})`,unknownTotal);put(report,'F18','현금납부 시트에서 수단 확인');
  put(report,'F15','납부일 기준 · 환불 차감');put(report,'F16','납부일 기준 · 비카드 수납');
  formula(report.getCell('E21'),'IF(\'운영비_상세내역\'!D37="","",\'운영비_상세내역\'!D37)','');formula(report.getCell('E22'),'IF(\'운영비_상세내역\'!E37="","",\'운영비_상세내역\'!E37)','');formula(report.getCell('E23'),'IF(COUNT(E21:E22)=0,"",SUM(E21:E22))','');put(report,'F21','운영비_상세내역에 직접 입력');
  for(const n of [25,26,27]){report.mergeCells(`D${n}:H${n}`);report.getCell(`D${n}`).alignment={wrapText:true,vertical:'middle'};report.getRow(n).height=n===27?42:24;}
  put(report,'D25',`${month} 전체 강사 · 현재 조회 자료`);put(report,'D26','미연결 운영비·별도 급여 조정은 직접 입력 필요');put(report,'D27',warnings.join(' / ')||'수업·수납·근무시간 조회 완료');
  for(const s of wb.worksheets){s.eachRow(r=>r.eachCell(c=>{if(typeof c.value==='number'&&!c.numFmt)c.numFmt=money;}));}
  return {buffer:await wb.xlsx.writeBuffer(),stats:{lessons:sourceRows.length,netTotal,grossTotal,payments:selected.length,cardTotal,cashTotal,unknownTotal,workers:workers.length},warnings};
}
