import { createReadCache } from './read-cache.js';
import { priceCancellationMakeups } from './makeup.js';
import { createHash } from 'node:crypto';
import { parsePayrollRows, parsePayrollMonthName } from './normalizers.js';
import { validSingleIndividual, projectedFeeRows, readCarriedFees, discountPolicyFor, estimatedCharge, inheritFees, recoverIssueFees, changed } from './intranet-projection.js';

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

// Reuse the intranet reader against a bounded read-only snapshot instead of
// repeating historical queries for every student in the payroll month.
export function snapshotDatabase(collections) {
  const document = row => ({id:row?._documentId, data:()=>row});
  const indexes = new Map();
  const lookup = (name, field, value) => {
    const key = JSON.stringify([name, field]);
    if (!indexes.has(key)) {
      const index = new Map();
      for (const row of collections[name] || []) {
        const bucket = index.get(row[field]) || [];
        bucket.push(row);
        index.set(row[field], bucket);
      }
      indexes.set(key, index);
    }
    return indexes.get(key).get(value) || [];
  };
  const query = (name, selected = null) => ({
    where(field, operator, value) {
      if (operator !== '==') throw new Error('Unsupported payroll snapshot query');
      return query(name, selected === null ? lookup(name, field, value) : selected.filter(row => row[field] === value));
    },
    limit(count) { return query(name, (selected || collections[name] || []).slice(0, count)); },
    async get() { const rows = selected || collections[name] || []; return {size:rows.length, docs:rows.map(document)}; }
  });
  return {
    doc(path) { const [name,id] = path.split('/'); return {get:async()=>document(lookup(name,'_documentId',id)[0])}; },
    collection: name => query(name)
  };
}
function pendingReason(lesson, amount, payValid) {
  const reasons=[];
  if(!payValid)reasons.push('강사 인정시간 미입력 또는 수업시간 초과');
  if(amount===null) {
    if(lesson.scopedFee?.review)reasons.push('약정 적용 범위와 변경된 수업 확인 필요');
    else if(lesson.automaticFeeConflict)reasons.push('적용 가능한 수강료 단가가 서로 다름');
    else if(lesson.billMinutes==null)reasons.push('수강료 청구시간 미입력');
    else if(lesson.rate==null)reasons.push('수업유형·강사·시간이 일치하는 단가 없음 · 인트라넷에서 해당 수업 단가 확인');
    else reasons.push('단가는 있으나 출결·비고 또는 청구 기준 확인 필요');
  }
  return reasons.join(' · ');
}
export function intranetRows(lessons, students, meta) {
  const month=`${meta.year}-${String(meta.month).padStart(2,'0')}`;
  return lessons.filter(l=>l.date?.startsWith(month+'-') && l.kind!=='study').map((l,index)=>{
    const student=students.get(l.studentId) || {};
    const net=estimatedCharge(l), amount=net === null ? null : (l.studentDiscount?.base ?? net), payValid=Number.isInteger(l.payMinutes)&&l.payMinutes>=0&&(l.payMinutes<=l.sourceMinutes||validSingleIndividual(l));
    const absent=l.kind==='absence';
    const pending=!absent && (amount===null || !payValid);
    const discount=l.studentDiscount?.percent ?? 0;
    const code={regular:'출석',late:'지각',cancel:'당일취소',absence:'결석예고',absenceMakeup:'결석보강',cancelMakeup:'보강',lateMakeup:'보강',free:'프리'}[l.kind] || l.status;
    const day=Number(l.date.slice(8));
    const source={values:[[student.name||student.studentName||l.studentName||'이름 확인 필요',`${meta.month}/${day}`,l.className,code,'반포',l.teacher,l.start,l.end,l.sourceMinutes/60,l.rateUnit==='perClass'?0:l.rate,amount??0,l.note,discount/100]]};
    const row=parsePayrollRows(source,meta)[0];
    return {...row,lessonKind:l.kind,billingAmount:absent?0:(amount??0),billingHours:l.billMinutes/60,legacyZeroMakeup:l.kind==='cancelMakeup'&&l.source==='access-history'&&l.sourceMinutes===0&&l.payMinutes===0,rateUnit:l.rateUnit || 'perHour',absenceRate:l.absenceRate ?? l.rate,absenceRateUnit:l.absenceRateUnit || l.rateUnit || 'perHour',rowNumber:index+2,rowKey:'intranet:'+createHash('sha256').update(`${l.studentId}|${l.id}`).digest('hex'),source:'intranet',discountReason:l.studentDiscount?.reason || '',studentSpecialRate:!!l.studentDiscount?.special,studentId:l.studentId,lessonId:l.id,hours:l.sourceMinutes/60,payHours:(!absent&&payValid?l.payMinutes:0)/60,sourcePending:pending,sourceRecognized:!absent&&!pending&&l.payMinutes>0,sourcePendingReason:pending?pendingReason(l,amount,payValid):'',amount:absent?0:(amount??0)};
  });
}

// Fee/session evidence is scoped to the normalized student. Partition before
// invoking the shared intranet calculator so each student's pass scans only
// their lessons, rather than every lesson in the academy.
export function projectedPayrollFeeRows(lessons, students, data, month, decisions = {}) {
  const ids=new Set();
  for(const lesson of lessons) {
    // Preserve legacy behavior for malformed/duplicate IDs instead of changing
    // how the shared calculator's replacement maps resolve them.
    if(ids.has(lesson.id)) return projectedFeeRows(lessons,students,data,month,decisions);
    ids.add(lesson.id);
  }
  const studentIndex=new Map();
  for(const student of students) for(const id of [student.id,student.canonicalId]) if(id&&!studentIndex.has(id)) studentIndex.set(id,student);
  const groups=new Map();
  for(const lesson of lessons) {
    const id=studentIndex.get(lesson.studentId)?.id || lesson.studentId;
    if(!groups.has(id)) groups.set(id,[]);
    groups.get(id).push(lesson);
  }
  const results=new Map();
  for(const rows of groups.values()) for(const row of projectedFeeRows(rows,students,data,month,decisions)) results.set(row.lesson.id,row);
  return lessons.flatMap(lesson=>results.has(lesson.id)?[results.get(lesson.id)]:[]);
}

export function createIntranetPayrollReader(db) {
  const pendingReads = new Map();
  // Keys include every freshly read source document. This caches computation,
  // never the database read, including on explicit refresh and finalization.
  const calculations = createReadCache({ttlMs: 30 * 60 * 1000, maxEntries: 4});
  const load=async(name,month,limit=5000)=>{
    let query=db.collection(name); if(month) query=query.where('month','==',month);
    const snap=await query.limit(limit+1).get();
    if(snap.size>limit) throw new Error('인트라넷 조회 한도를 초과했습니다. 일부 자료로 정산하지 않습니다.');
    return snap;
  };
  // Concurrent month/teacher requests share only in-flight collection reads.
  // Settled snapshots are not retained, so explicit refresh still reaches Firestore.
  const sharedRead = async (name, month, limit = 5000) => {
    const key = JSON.stringify([name, month, limit]);
    if (!pendingReads.has(key)) {
      pendingReads.set(key, load(name, month, limit).finally(() => pendingReads.delete(key)));
    }
    const snap = await pendingReads.get(key);
    return snap.docs.map(d => ({ ...d.data(), _documentId: d.id }));
  };
  return {async readMonth(name, { forceRefresh = false } = {}) {
    const started=performance.now();
    const read = forceRefresh ? async (collection, month, limit = 5000) => {
      const snap = await load(collection, month, limit);
      return snap.docs.map(d => ({ ...d.data(), _documentId: d.id }));
    } : sharedRead;
    const meta=parsePayrollMonthName(name), month=`${meta.year}-${String(meta.month).padStart(2,'0')}`;
    const [current,past,drafts,fees,baselines,issues,roster,discounts,sessionDocs,applications,makeupLinks]=await Promise.all([
      read('intranetStudentPeriods'),read('intranetLegacyPeriods'),read('intranetLessonDrafts'),read('intranetStudentFees'),read('intranetFeeBaselines'),read('intranetIssues'),read('students'),read('intranetStudentDiscounts'),read('intranetLessonSessionDecisions',null),read('intranetFeeApplications'),read('intranetMakeupLinks')
    ]);
    const readMs=Math.round(performance.now()-started);
    const fingerprint=createHash('sha256').update(JSON.stringify([month,current,past,drafts,fees,baselines,issues,roster,discounts,sessionDocs,applications,makeupLinks])).digest('hex');
    const calculation=await calculations.read(fingerprint,async()=>{
    let lessons=combineLessons(current.filter(p=>p.month===month),past.filter(p=>p.month===month),drafts.filter(d=>d.month===month||d.lesson?.date?.startsWith(month+'-')));
    const feeDatabase=snapshotDatabase({intranetStudentPeriods:current,intranetLegacyPeriods:past,intranetStudentFees:fees,intranetFeeBaselines:baselines,intranetIssues:issues,intranetFeeApplications:applications});
    const periods={};
    const rosterIndex=new Map();
    for(const student of roster) for(const id of [student._documentId,student.canonicalId]) if(id&&!rosterIndex.has(id)) rosterIndex.set(id,student);
    const canonicalId=id=>{const student=rosterIndex.get(id);return student?.canonicalId||student?._documentId||id;};
    for(const id of new Set(lessons.map(l=>canonicalId(l.studentId)))) {
      const saved=fees.find(p=>p.studentId===id&&p.month===month)||{};
      const period=inheritFees(await readCarriedFees(feeDatabase,id,month,{...saved,assignments:[...(saved.assignments||[])]}),baselines.find(p=>p._documentId===id),month);
      period.assignments.push(...recoverIssueFees(issues.filter(i=>i.studentId===id).map(i=>({...i,id:i._documentId})),month,period));
      periods[id]={...period,discountPolicy:discountPolicyFor(discounts.find(p=>p._documentId===id),month)};
    }
    const students=roster.map(s=>({...s,id:s._documentId}));
    const decisions=Object.fromEntries((sessionDocs.find(s=>s._documentId===month)?.records||[]).map(r=>[r.key,r.decision]));
    const project=rows=>projectedPayrollFeeRows(rows,students,{periods},month,decisions).map(r=>r.lesson);
    const hypothetical=lessons.some(l=>l.kind==='absence') ? project(lessons.map(l=>l.kind==='absence'?{...l,kind:'regular',billMinutes:l.sourceMinutes}:l)) : [];
    const absentRates=new Map(hypothetical.map(l=>[`${l.studentId}|${l.id}`,l]));
    lessons=project(lessons).map(l=>l.kind==='absence'?{...l,absenceRate:absentRates.get(`${l.studentId}|${l.id}`)?.rate,absenceRateUnit:absentRates.get(`${l.studentId}|${l.id}`)?.rateUnit}:l);
    const studentMap=new Map(roster.map(s=>[s._documentId,s]));
    const targets=new Set(lessons.filter(l=>l.kind==='cancelMakeup').map(l=>l.studentId));
    const history=combineLessons(current,past,drafts).filter(l=>targets.has(l.studentId)&&l.date<month+'-01'&&['cancel','cancelMakeup'].includes(l.kind));
    const historicRows=[];
    for(const historicMonth of new Set(history.map(l=>l.date.slice(0,7)))) {
      const historicLessons=history.filter(l=>l.date.startsWith(historicMonth));
      const historicPeriods={};
      for(const id of new Set(historicLessons.map(l=>canonicalId(l.studentId)))) {
        const saved=fees.find(p=>p.studentId===id&&p.month===historicMonth)||{};
        const period=inheritFees(await readCarriedFees(feeDatabase,id,historicMonth,{...saved,assignments:[...(saved.assignments||[])]}),baselines.find(p=>p._documentId===id),historicMonth);
        historicPeriods[id]={...period,discountPolicy:discountPolicyFor(discounts.find(p=>p._documentId===id),historicMonth)};
      }
      const projected=projectedPayrollFeeRows(historicLessons,students,{periods:historicPeriods},historicMonth,{}).map(r=>r.lesson);
      historicRows.push(...intranetRows(projected,studentMap,parsePayrollMonthName(historicMonth.slice(2))));
    }
    const currentRows=intranetRows(lessons,studentMap,meta);
    const links=makeupLinks.flatMap(d=>(d.links||[]).map(l=>({...l,studentId:d.studentId})));
    const rows=priceCancellationMakeups(currentRows,[...historicRows,...currentRows],links);
    const version=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    return {rows,version};
    });
    const {rows,version}=calculation.value;
    const timings={calculationCacheHit:calculation.hit,readMs,calculationMs:Math.round(performance.now()-started-readMs),totalMs:Math.round(performance.now()-started)};
    console.info(JSON.stringify({event:'payroll-source-timing',month,rows:rows.length,...timings}));
    return {rows,version,timings};
  }};
}
