// Payroll-only transfer of an already billed cancellation to its replacement lesson.
// This never changes intranet billing or writes source lesson data.
const teacher = value => String(value || '').replace(/\s|T$/g, '');
const span = r => r.endMinutes > r.startMinutes && r.startMinutes != null ? (r.endMinutes-r.startMinutes)/60 : 0;
function mentionedDates(row) {
  const year=Number(row.classDateKey.slice(0,4)), month=Number(row.classDateKey.slice(5,7));
  const dates=[...String(row.note||'').matchAll(/(?:\b(20\d{2})[./-])?(\d{1,2})[./](\d{1,2})(?!\d)/g)].map(m=>`${m[1]||year-(Number(m[2])>month?1:0)}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`).filter(d=>d<=row.classDateKey);
  if(dates.length)return dates;
  return [...String(row.note||'').matchAll(/(\d{1,2})일\s*(?:당취|당일\s*취소)/g)].map(m=>{const day=Number(m[1]);const previous=day>Number(row.classDateKey.slice(8));const d=new Date(Date.UTC(year,month-1-(previous?1:0),day));return d.getUTCDate()===day?d.toISOString().slice(0,10):'';}).filter(Boolean);
}
export function priceCancellationMakeups(rows, evidence=rows, links=[]) {
  const result=new Map(),used=new Map();
  const originals=evidence.filter(r=>r.lessonKind==='cancel' && !r.sourcePending && r.amount>0);
  const makeups=[...new Map([...evidence,...rows].filter(r=>r.lessonKind==='cancelMakeup').map(r=>[r.rowKey,r])).values()].sort((a,b)=>a.classDateKey.localeCompare(b.classDateKey)||a.start.localeCompare(b.start)||a.rowKey.localeCompare(b.rowKey));
  for(const row of makeups) {
    const explicit=links.filter(l=>l.studentId===row.studentId&&l.makeupId===row.lessonId);
    const dates=mentionedDates(row);
    // A saved link identifies the two lessons even when their subject labels differ.
    // Without a link, keep subject equality as a requirement for inferred matches.
    let candidates = originals.filter(original =>
      original.studentId === row.studentId &&
      teacher(original.teacher) === teacher(row.teacher) &&
      original.classType === row.classType &&
      original.classDateKey <= row.classDateKey &&
      (explicit.length > 0 || original.subject === row.subject)
    );
    if(explicit.length)candidates=candidates.filter(o=>explicit.some(l=>l.originalId===o.lessonId&&(!l.originalDate||l.originalDate===o.classDateKey)&&(!l.makeupDate||l.makeupDate===row.classDateKey)));
    else if(dates.length)candidates=candidates.filter(o=>dates.includes(o.classDateKey));
    const fail=reason=>result.set(row.rowKey,{...row,sourcePending:true,sourceRecognized:false,sourcePendingReason:reason,amount:0});
    if(candidates.length!==1){fail(candidates.length?'당취보충 원수업 후보가 여러 건 · 인트라넷 보충 연결 확인':'당취보충 원수업·단가 연결 확인 필요');continue;}
    const original=candidates[0],baseHours=original.billingHours||span(original);
    const recoveredLegacy=row.legacyZeroMakeup&&span(row)>0;
    const hours=recoveredLegacy?span(row):row.hours, payHours=recoveredLegacy?hours:row.payHours;
    // intranetRows sets singleIndividual only after validating the booked time against the lesson.
    const verifiedSingle = row.singleIndividual === true;
    if(!baseHours||!hours||payHours==null||payHours<0||(payHours>hours&&!verifiedSingle)||row.sourcePending){fail('당취보충 실제 수업시간·강사 인정시간 확인 필요');continue;}
    const already=used.get(original.rowKey)||0;
    const consumedHours = verifiedSingle ? Math.max(hours, payHours) : hours;
    if(already+consumedHours>baseHours+1e-8){fail('원수업 시간을 초과하는 보충 · 중복 연결 확인 필요');continue;}
    used.set(original.rowKey,already+consumedHours);
    const amount=Math.round(original.amount*payHours/baseHours);
    const explanation=`당취보충 자동 산출 · 원수업 ${original.classDateKey} · ${original.amount.toLocaleString('ko-KR')}원 / ${baseHours}h × 인정 ${payHours}h · 학생 추가 청구 0원`;
    // Keep a linked but unclassified replacement in the original subject's payroll filter.
    const subject = explicit.length && row.subject === '기타' ? original.subject : row.subject;
    result.set(row.rowKey,{...row,subject,hours,payHours,rate:hours>0?amount/hours:0,amount,discount:original.discount,discountReason:original.discountReason,sourcePending:false,sourceRecognized:payHours>0,sourcePendingReason:'',makeupAutoPriced:true,makeupOriginalId:original.lessonId,makeupOriginalDate:original.classDateKey,makeupPricingReason:explanation,billingAmount:0,note:[row.note,explanation].filter(Boolean).join(' / ')});
  }
  return rows.map(r=>result.get(r.rowKey)||r);
}
