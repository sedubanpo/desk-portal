import {buildMonthlyWorkbook,selectExportPayments,paymentKind} from './workbook.js';
import {parsePayrollMonthName} from './normalizers.js';
export function createPayrollExportHandler({payroll,workforce,tuitionStore}){
  return async(payload={},identity={})=>{
    const meta=parsePayrollMonthName(payload.monthName);if(!meta)return {success:false,message:'정산 월을 선택해 주세요.'};
    const month=`${meta.year}-${String(meta.month).padStart(2,'0')}`,warnings=[];
    // Ignore UI filters and unsaved amounts: a monthly report is always the complete saved month.
    const [current,workerIndex,payments]=await Promise.all([
      payroll.readExportMonth(meta.sheetName),workforce.getPayrollStaffMonth({monthName:meta.sheetName},identity),tuitionStore.list('tuitionPayments',20001)
    ]);
    if(!workerIndex.success)throw new Error(workerIndex.message||'근무자 조회 실패');
    if(payments.length>=20001)throw new Error('수납 자료 조회 한도를 초과했습니다. 전체 자료를 확인한 뒤 다시 출력해 주세요.');
    const workers=[];for(const worker of workerIndex.workers){const data=await workforce.getPayrollStaffMonth({monthName:meta.sheetName,workerName:worker.name},identity);if(!data.success)throw new Error(data.message||'근무시간 조회 실패');workers.push({workerName:data.workerName,rows:data.rows,totalMinutes:data.totalMinutes,unresolved:data.unresolved});}
    let previousTeachers=[];
    const prev=new Date(Date.UTC(meta.year,meta.month-2,1)),previous=`${String(prev.getUTCFullYear()).slice(-2)}-${String(prev.getUTCMonth()+1).padStart(2,'0')}`;
    try {previousTeachers=(await payroll.readExportMonth(previous)).teachers;}catch{warnings.push('전월 매출 미조회 · 전월 비교 직접 입력');}
    const pending=current.summary.rows.filter(r=>r.sourcePending&&r.attendanceCode!=='결석예고').length;
    if(pending)warnings.push(`확인 필요 수업 ${pending}건 제외 · 잠정 결산`);
    if(workers.some(w=>w.unresolved))warnings.push('일부 근무시간 확인 필요');
    const selected=selectExportPayments(payments,month);
    if(selected.some(p=>paymentKind(p)==='unknown'))warnings.push('결제수단 미분류 수납은 별도 합계 · 현금납부 시트에서 확인');
    if(!selected.length)warnings.push('해당 월 납부일의 등록 수납 없음');
    const result=await buildMonthlyWorkbook({month,...current,previousTeachers,payments:selected,workers,warnings});
    return {success:true,fileName:`에스학원-매출결산보고서(반포관)(${meta.year}.${meta.month}).xlsx`,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',base64:Buffer.from(result.buffer).toString('base64'),stats:result.stats,warnings};
  };
}
