import { createHash } from 'node:crypto';
import { parsePayrollRows, parsePayrollMonthName } from './normalizers.js';
import { applyFees, estimatedCharge, inheritFees, recoverIssueFees, changed } from './intranet-projection.js';

export const isIntranetMonth = name => { const m = parsePayrollMonthName(name); return m && m.year * 100 + m.month >= 202609; };
export function payrollMonths(legacy, now = new Date()) {
  const current = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul', year:'numeric', month:'2-digit'}).format(now);
  const months = new Set(legacy.filter(m => !isIntranetMonth(m)));
  for (let y = 2026, m = 9; `${y}-${String(m).padStart(2,'0')}` <= current; m > 11 ? (y++, m=1) : m++) months.add(`${String(y).slice(-2)}-${String(m).padStart(2,'0')}`);
  return [...months].sort((a,b) => { const x=parsePayrollMonthName(a),y=parsePayrollMonthName(b); return (y.year*12+y.month)-(x.year*12+x.month); });
}

// Same precedence as intranet GET /daily, including deletion tombstones.
export function combineLessons(current, past, drafts) {
  const rows = new Map(), publishedAt = new Map();
  // Published deletions remain authoritative even after draft cleanup/re-import.
  const deleted = new Set(current.flatMap(p => (p.publishedDeletedIds || []).map(id => `${p.studentId}|${id}`)));
  for (const p of [...past, ...current]) for (const l of p.lessons || []) rows.set(`${p.studentId}|${l.id}`, {...l,studentId:p.studentId});
  for (const p of current) for (const l of p.lessons || []) publishedAt.set(`${p.studentId}|${l.id}`,p.updatedAt?.toMillis?.() || 0);
  for (const d of drafts) {
    const l=d.lesson; if (!l) continue;
    const key=`${l.studentId}|${l.id}`, old=rows.get(key);
    const newer= !l.deletedAt && old && !changed(old,l) && !['teacher-portal-history','access-history'].includes(l.source) && (publishedAt.get(key)||0)>Date.parse(d.updatedAt);
    rows.set(key,newer?old:l);
  }
  return [...rows.values()].filter(l=>!l.deletedAt && !deleted.has(`${l.studentId}|${l.id}`));
}

export function intranetRows(lessons, students, meta) {
  const month=`${meta.year}-${String(meta.month).padStart(2,'0')}`;
  return lessons.filter(l=>l.date?.startsWith(month+'-') && l.kind!=='study').map((l,index)=>{
    const student=students.get(l.studentId) || {};
    const amount=estimatedCharge(l), payValid=Number.isInteger(l.payMinutes)&&l.payMinutes>=0&&l.payMinutes<=l.sourceMinutes;
    const pending=amount===null || !payValid;
    const code={regular:'출석',late:'지각',cancel:'당일취소',absence:'결석예고',absenceMakeup:'결석보강',cancelMakeup:'보강',lateMakeup:'보강',free:'프리'}[l.kind] || l.status;
    const day=Number(l.date.slice(8));
    const source={values:[[student.name||student.studentName||l.studentName||'이름 확인 필요',`${meta.month}/${day}`,l.className,code,'반포',l.teacher,l.start,l.end,l.sourceMinutes/60,l.rateUnit==='perClass'?0:l.rate,amount??0,l.note,0]]};
    const row=parsePayrollRows(source,meta)[0];
    return {...row,rateUnit:l.rateUnit || 'perHour',absenceRate:l.absenceRate ?? l.rate,absenceRateUnit:l.absenceRateUnit || l.rateUnit || 'perHour',rowNumber:index+2,rowKey:'intranet:'+createHash('sha256').update(`${l.studentId}|${l.id}`).digest('hex'),source:'intranet',studentId:l.studentId,lessonId:l.id,hours:l.sourceMinutes/60,payHours:(payValid?l.payMinutes:0)/60,sourcePending:pending,sourceRecognized:!pending&&l.payMinutes>0,sourcePendingReason:pending?'인트라넷 금액·시수 확인 필요':'',amount:amount??0};
  });
}

export function createIntranetPayrollReader(db) {
  const read=async(name,month,limit=5000)=>{
    let query=db.collection(name); if(month) query=query.where('month','==',month);
    const snap=await query.limit(limit+1).get();
    if(snap.size>limit) throw new Error('인트라넷 조회 한도를 초과했습니다. 일부 자료로 정산하지 않습니다.');
    return snap.docs.map(d=>({...d.data(),_documentId:d.id}));
  };
  return {async readMonth(name) {
    const meta=parsePayrollMonthName(name), month=`${meta.year}-${String(meta.month).padStart(2,'0')}`;
    const [current,past,drafts,fees,baselines,issues,roster]=await Promise.all([
      read('intranetStudentPeriods',month),read('intranetLegacyPeriods',month),read('intranetLessonDrafts',month),read('intranetStudentFees',month),read('intranetFeeBaselines'),read('intranetIssues'),read('students')
    ]);
    let lessons=combineLessons(current,past,drafts);
    for(const id of new Set(lessons.map(l=>l.studentId))) {
      const saved=fees.find(p=>p.studentId===id)||{};
      const period=inheritFees({...saved,assignments:[...(saved.assignments||[])]},baselines.find(p=>p._documentId===id),month);
      period.assignments.push(...recoverIssueFees(issues.filter(i=>i.studentId===id).map(i=>({...i,id:i._documentId})),month,period));
      const hypothetical=applyFees({lessons:lessons.map(l=>l.kind==='absence'?{...l,kind:'regular',billMinutes:l.sourceMinutes}:l)},id,month,period.assignments,period.merges||[]).lessons;
      const absentRates=new Map(hypothetical.filter(l=>l.studentId===id).map(l=>[l.id,l]));
      lessons=applyFees({lessons},id,month,period.assignments,period.merges||[]).lessons.map(l=>l.studentId===id && l.kind==='absence'?{...l,absenceRate:absentRates.get(l.id)?.rate,absenceRateUnit:absentRates.get(l.id)?.rateUnit}:l);
    }
    const rows=intranetRows(lessons,new Map(roster.map(s=>[s._documentId,s])),meta);
    return {rows,version:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
  }};
}
