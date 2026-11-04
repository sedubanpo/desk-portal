// Follow the student detail view: start with published sessions, overlay their
// saved revisions, then apply the student's monthly fee and discount rules.
import { publishedView, savedBillingLessons, savedFeeView, projectMonthlyLessons, estimatedCharge } from './lesson-sales-projection.js';

export function studentLessonSales({month, current, history, drafts, periods, decisions, linked}) {
  const byStudent = rows => new Map(rows.filter(row=>row.month===month).map(row=>[row.studentId,row]));
  const published = byStudent(current), imported = byStudent(history), edits = new Map();
  for (const draft of drafts) {
    if (draft.lesson?.date?.slice(0,7)!==month) continue;
    const id = draft.lesson.studentId;
    if (!edits.has(id)) edits.set(id,[]);
    edits.get(id).push(draft);
  }
  const teachers = new Map();
  for (const id of new Set([...published.keys(),...imported.keys()])) {
    const period = published.get(id), past = imported.get(id);
    const visible = publishedView(period,past?.lessons).map(row=>({...row,studentId:id}));
    const saved = savedBillingLessons(period,past,edits.get(id)||[],id,month,{includeDeleted:true});
    const lessons = projectMonthlyLessons(savedFeeView(visible,saved),id,month,periods[id]||{assignments:[],merges:[]},decisions,linked.has(id));
    for (const lesson of lessons) {
      if (lesson.deletedAt || lesson.date?.slice(0,7)!==month) continue;
      const amount = estimatedCharge(lesson);
      if (amount===0 && ['absence','cancelMakeup','study'].includes(lesson.kind)) continue;
      const name = lesson.teacher || '강사 미입력';
      if (!teachers.has(name)) teachers.set(name,{name,count:0,gross:0,discount:0,net:0,pendingCount:0});
      const teacher = teachers.get(name);
      if (amount===null) { teacher.pendingCount++; continue; }
      const gross = lesson.studentDiscount?.base ?? amount;
      teacher.count++;
      teacher.gross+=gross;
      teacher.net+=amount;
      teacher.discount+=gross-amount;
    }
  }
  return [...teachers.values()].sort((a,b)=>b.net-a.net||a.name.localeCompare(b.name,'ko'));
}
