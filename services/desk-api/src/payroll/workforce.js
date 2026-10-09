import { createHash } from 'node:crypto';
import { parsePayrollMonthName } from './normalizers.js';

export const WORKFORCE_METHODS = ['getPayrollStaffMonth', 'savePayrollStaffTimes', 'savePayrollStaffFinalization'];
export const WORKFORCE_WRITES = WORKFORCE_METHODS.slice(1);
export const STAFF_PAYROLL_EXCLUDED = new Set(['김용찬','안준성','홍성우','이성진','안종성','권민정','이민현','전소희']);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = message => { throw new Error(message); };
export function staffMonth(value) {
  const m = parsePayrollMonthName(value);
  if (!m) fail('정산 월을 선택해 주세요.');
  return `${m.year}-${String(m.month).padStart(2,'0')}`;
}
export function paidWorkMinutes(start, end, breakMinutes = 30) {
  const minutes = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t)) ? Number(t.slice(0,2))*60+Number(t.slice(3)) : null;
  const a=minutes(start), b=minutes(end), rest=Number(breakMinutes);
  if (a===null || b===null || b<=a) fail('출퇴근 시간은 같은 날의 시작·종료 시간으로 입력해 주세요.');
  if (!Number.isInteger(rest) || rest<0 || rest>b-a) fail('휴게시간은 근무 구간 이내의 분 단위로 입력해 주세요.');
  return b-a-rest;
}
const clock = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date) : '';
};
export function staffWorkRows({month, name, uid, schedule, attendance, corrections = {}}) {
  const entries=Object.values(schedule?.entries||schedule||{}).filter(e=>e.worker===name && e.date?.startsWith(month+'-') && !e.resident && !e.unavailable);
  const grouped=new Map();
  for(const entry of entries) grouped.set(entry.date,[...(grouped.get(entry.date)||[]),entry]);
  for(const [day, records] of Object.entries(attendance||{})) if(day.startsWith(month+'-') && Object.values(records||{}).some(r=>uid?r.uid===uid:r.name===name)) if(!grouped.has(day))grouped.set(day,[]);
  return [...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([date, plans])=>{
    const punches=Object.values(attendance?.[date]||{}).filter(r=>uid?r.uid===uid:r.name===name);
    const punch=punches.length===1?punches[0]:null;
    const actual=!!(punch?.clockIn&&punch?.clockOut);
    const override=corrections[date];
    let source=override?'관리자 수정':actual?'출퇴근 기록':'등록 근무표';
    const start=override?.start ?? (actual?clock(punch.clockIn):plans.length===1?plans[0].start:''),end=override?.end ?? (actual?clock(punch.clockOut):plans.length===1?plans[0].end:'');
    const breakMinutes=override?.breakMinutes ?? 30;
    let issue='', paidMinutes=null;
    try {paidMinutes=paidWorkMinutes(start,end,breakMinutes);} catch(error){issue=error.message;}
    if (!override && (plans.length>1||punches.length>1)) issue='같은 날짜에 여러 기록이 있습니다. 실제 근무시간을 확인해 주세요.';
    if (!override && punch && !actual) issue='출퇴근 기록이 미완료입니다. 실제 근무시간을 확인해 주세요.';
    if (actual && !override) {
      const day=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
      if (!Number.isFinite(Date.parse(punch.clockIn))||!Number.isFinite(Date.parse(punch.clockOut))||new Date(punch.clockOut)<=new Date(punch.clockIn)) issue='출퇴근 기록의 시간 순서를 확인해 주세요.';
      else if(day(punch.clockIn)!==date||day(punch.clockOut)!==date)issue='일자를 넘는 출퇴근 기록입니다. 일자별 실제 근무시간을 확인해 주세요.';
    }
    return {date,start,end,breakMinutes,paidMinutes:issue?null:paidMinutes,source,issue,reason:override?.reason||''};
  });
}
export function createWorkforceHandlers({firestore, deskStore, loadStaffDirectory, now=()=>new Date()}) {
  const ref=(kind,id)=>firestore.collection(kind).doc(id);
  const key=(month,name)=>`${month}_${digest(name).slice(0,32)}`;
  const read=async r=>{const s=await r.get();return s.exists?s.data():{};};
  async function load(payload,identity) {
    const month=staffMonth(payload.monthName);
    const [schedule,attendance,directory]=await Promise.all([deskStore.get(`desk_portal/monthly_schedule/${month}`),deskStore.get(`desk_portal/staff_attendance/${month}`),loadStaffDirectory()]);
    const names=new Set([...directory.map(p=>p.name),...Object.values(schedule?.entries||schedule||{}).map(p=>p.worker)].filter(n=>typeof n==='string' && n.trim() && !STAFF_PAYROLL_EXCLUDED.has(n.trim())).map(n=>n.trim()));
    const workers=[...names].sort((a,b)=>a.localeCompare(b,'ko')).map(name=>({name}));
    if(!payload.workerName)return {success:true,month,workers,canEdit:identity.role==='ADMIN'};
    const name=String(payload.workerName);
    if(!names.has(name))fail('사무보조(파트타임) 대상 근무자가 아닙니다.');
    const matches=directory.filter(p=>p.name===name);if(matches.length>1)fail('동명이인 계정이 있습니다. 근무 기록 연결을 확인해 주세요.');
    const document=await read(ref('payrollStaffTimes',key(month,name)));
    const rows=staffWorkRows({month,name,uid:matches[0]?.uid,schedule,attendance,corrections:document.corrections});
    const version=digest({schedule,attendance,corrections:document.corrections||{},name,uid:matches[0]?.uid||''});
    const snapshots=await ref('payrollStaffFinalizations',key(month,name)).collection('versions').orderBy('createdAt','desc').limit(12).get();
    return {success:true,month,workers,workerName:name,rows,totalMinutes:rows.reduce((n,r)=>n+(r.paidMinutes||0),0),unresolved:rows.filter(r=>r.issue).length,version,revision:document.revision||0,canEdit:identity.role==='ADMIN',finalizations:snapshots.docs.map(d=>({id:d.id,...d.data()}))};
  }
  const admin=identity=>{if(identity.role!=='ADMIN')fail('관리자만 근무시간 수정 및 정산 확정을 할 수 있습니다.');};
  const privacy=payload=>{const allowed=['monthName','workerName','expectedVersion','clientRequestId','rows'];if(Object.keys(payload).some(k=>!allowed.includes(k)))fail('근무시간 이외의 정보는 저장할 수 없습니다.');};
  async function save(payload,identity,finalize) {
    admin(identity);privacy(payload);
    if(!/^[\w:.-]{8,120}$/.test(payload.clientRequestId||''))fail('저장 요청 식별자가 필요합니다.');
    const current=await load(payload,identity);
    if(!current.workerName)fail('근무자를 선택해 주세요.');
    if(!payload.expectedVersion||current.version!==payload.expectedVersion)fail('근무 기록이 변경되었습니다. 다시 조회한 뒤 저장해 주세요.');
    const corrections={};
    if(!finalize){
      if(!Array.isArray(payload.rows)||payload.rows.length!==current.rows.length)fail('월별 근무 행이 일치하지 않습니다. 다시 조회해 주세요.');
      const days=new Set(current.rows.map(r=>r.date));
      for(const row of payload.rows){
        if(!days.delete(row.date)||Object.keys(row).some(k=>!['date','start','end','breakMinutes','reason'].includes(k)))fail('근무시간 입력 형식을 확인해 주세요.');
        paidWorkMinutes(row.start,row.end,row.breakMinutes);
        const reason=String(row.reason||'').trim().slice(0,300);if(!reason)fail('실제 근무시간 확인·수정 사유를 입력해 주세요.');
        corrections[row.date]={start:row.start,end:row.end,breakMinutes:Number(row.breakMinutes),reason};
      }
    }else if(current.unresolved||!current.rows.length)fail('확인 필요한 근무시간을 수정한 뒤 확정해 주세요.');
    const documentId=key(current.month,current.workerName),target=ref('payrollStaffTimes',documentId);
    const audit=ref('payrollStaffWriteAudits',digest([identity.uid,payload.clientRequestId,finalize]));
    return firestore.runTransaction(async tx=>{
      const [a,s]=await tx.getAll(audit,target);if(a.exists)return {...a.data().result,duplicate:true};
      if((s.data()?.revision||0)!==current.revision)fail('다른 관리자가 수정했습니다. 다시 조회해 주세요.');
      const createdAt=now().toISOString(), actor={uid:identity.uid||'',name:identity.name||''};
      let result;
      if(finalize){
        const id=digest([identity.uid,payload.clientRequestId]).slice(0,40);
        // Explicit time-only snapshot. Never copy client objects or compensation values.
        const snapshot={month:current.month,workerName:current.workerName,totalMinutes:current.totalMinutes,rows:current.rows.map(({date,start,end,breakMinutes,paidMinutes,source,reason})=>({date,start,end,breakMinutes,paidMinutes,source,reason})),sourceVersion:current.version,createdAt,actor};
        tx.create(ref('payrollStaffFinalizations',documentId).collection('versions').doc(id),snapshot);
        result={success:true,id,createdAt};
      }else{
        tx.set(target,{month:current.month,workerName:current.workerName,corrections,revision:current.revision+1,updatedAt:createdAt,actor});result={success:true};
      }
      tx.create(audit,{createdAt,actor,month:current.month,workerName:current.workerName,kind:finalize?'finalize':'times',...(finalize?{}:{before:s.data()?.corrections||{},after:corrections}),result});return result;
    });
  }
  const wrap=fn=>async(payload={},identity={})=>{try{return await fn(payload,identity);}catch(e){return {success:false,message:e.message};}};
  return {getPayrollStaffMonth:wrap(load),savePayrollStaffTimes:wrap((p,i)=>save(p,i,false)),savePayrollStaffFinalization:wrap((p,i)=>save(p,i,true))};
}
