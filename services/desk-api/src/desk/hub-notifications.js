// Summary only. Does not acknowledge tasks, punch attendance, or approve corrections.
export function buildHubNotifications(identity,tasks,attendance,now=new Date().toISOString()){
 const uid=String(identity.uid||''),name=String(identity.name||'').trim(),items=[];
 if(!uid)throw new Error('Authenticated recipient required');
 const add=(id,kind,title,summary,at,resolved=false)=>{if(Number.isFinite(Date.parse(at)))items.push({id,recipientUid:uid,kind,title,summary,createdAt:at,resolved});};
 for(const task of tasks){
  if(!task.id||task.deleted||task.hiddenFromWorkerBand)continue;
  const addressed=task.assignedUid?task.assignedUid===uid:name&&(task.worker===name||(task.targetWorkers||[]).includes(name));
  if(!addressed)continue;
  add('task:'+task.id,'desk-task',String(task.title||'업무 확인').slice(0,120),[task.progressStatus,task.updatedByName?task.updatedByName+' 업데이트':''].filter(Boolean).join(' · '),task.updatedAt||task.createdAt,!!task.completed);
 }
 for(const row of attendance.records||[]){
  if(row.uid!==uid)continue;
  for(const [key,label] of [['clockIn','출근'],['clockOut','퇴근']])if(row[key])add('attendance:'+row.dateKey+':'+key,'attendance',label+' 기록이 등록되었습니다',row.dateKey+(row.corrected?' · 정정 반영':''),row[key],true);
 }
 for(const row of attendance.requests||[]){
  if(row.uid!==uid)continue;
  add('correction:'+row.id,'attendance','출퇴근 정정 '+({PENDING:'요청',APPROVED:'승인',REJECTED:'반려'}[row.status]||'확인'),row.dateKey,row.updatedAt||row.createdAt,row.status!=='PENDING');
 }
 return {recipientUid:uid,items:items.filter(item=>Date.parse(item.createdAt)<=Date.parse(now)+300000).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,60),window:'업무 최근 8일 · 출퇴근 이번 달',pendingKinds:[]};
}
