import { createHash } from 'node:crypto';
import { ApiError } from '../http.js';
import { dailyTask, RETIRED_WORKERS } from '../desk/normalizers.js';
import { today } from './model.js';
const digest = value => createHash('sha256').update(value).digest('hex').slice(0,32);
const category = type => ({'학생·학부모 후속':'상담','일정·수업':'학생','수납·환불':'수납','자료·교재':'자료','시설·시스템':'시설','운영·인수인계':'일반'}[type] || '일반');
export function createFollowupJournalSync({store,loadStaffDirectory,now=()=>new Date()}) {
  async function staff() { return (await loadStaffDirectory()).filter(p=>p.status==='ACTIVE'&&!RETIRED_WORKERS.has(p.name)); }
  async function validate(owners) {
    const allowed = new Set((await staff()).map(p=>p.name));
    if (owners.some(name=>!allowed.has(name))) throw new ApiError(400,'invalid_assignee','업무 배정은 현재 근무자 목록에서 선택해 주세요.');
  }
  async function sync(item,actor,{assign=false,statusChanged=false}={}) {
    const linkPath='desk_portal/followup_assignments/'+item.id;
    const existing=await store.get(linkPath);
    if (!assign&&!existing) return {count:0};
    // Persist the date before journal writes so retries across midnight keep the same tasks.
    const link=await store.transaction(linkPath,old=>old||{dateKey:today(now()),owners:[]});
    const desired=assign?item.owners:(link.owners||[]);
    if(assign)await validate(desired);
    const stamp=now().toISOString(),dayPath='desk_portal/daily_journal/'+link.dateKey;
    const all=[...new Set([...(link.owners||[]),...desired])];
    const result=await store.transaction(dayPath,current=>{
      const day={...(current||{})},tasks={...(day.tasks||{})},history={...(day.taskHistory||{})};
      for(const name of all){
        const id='wfu_'+digest(item.id+':'+name),before=tasks[id];
        const removed=!desired.includes(name),completed=item.status==='해결'||item.status==='병합';
        if(!before&&removed)continue;
        const task=dailyTask({...before,id,dateKey:link.dateKey,worker:name,
          title:('['+(item.code||'업무 팔로우')+'] '+item.title).slice(0,500),
          note:('업무 팔로우 · '+(item.rooms||[]).join(', ')+'\n'+item.url+'\n'+(item.situation||'')).slice(0,10000),
          category:category(item.type),nextAction:removed?'담당 변경으로 배정 해제':item.nextAction,
          deleted:removed,completed:statusChanged||!before?completed:before.completed,
          progressStatus:statusChanged?(completed?'완료':'대기'):(before?.progressStatus||'대기'),
          createdAt:before?.createdAt||stamp,createdByUid:before?.createdByUid||actor.uid,
          createdByName:before?.createdByName||actor.name,selfCreated:false,
          updatedAt:stamp,updatedByUid:actor.uid,updatedByName:actor.name,
          completedAt:statusChanged||!before?(completed?(before?.completedAt||stamp):''):(before.completedAt||''),deletedAt:removed?stamp:'',
          deletedByUid:removed?actor.uid:'',deletedByName:removed?actor.name:''},id,link.dateKey,stamp);
        const fields=['title','note','worker','category','nextAction','deleted','completed','progressStatus'];
        if(before&&fields.every(key=>JSON.stringify(before[key])===JSON.stringify(task[key])))continue;
        task.version=(before?.version||0)+1;tasks[id]=task;
        history[id]={...(history[id]||{}),['followup_'+task.version]:{id:'followup_'+task.version,version:task.version,action:removed?'DELETED':before?'UPDATED':'CREATED',createdAt:stamp,actorUid:actor.uid,actorName:actor.name,changes:fields.filter(k=>before?.[k]!==task[k]),before:before||null,after:task}};
      }
      return {...day,tasks,taskHistory:history};
    });
    const updates={};
    for(const name of all){const id='wfu_'+digest(item.id+':'+name),task=result.tasks[id];if(task)updates['desk_portal/daily_pending_tasks/'+id]=task.deleted||task.completed?null:task;}
    updates[linkPath]={...link,owners:desired,sourceVersion:item.version,updatedAt:stamp};
    await store.update('',updates);
    return {count:desired.length,dateKey:link.dateKey};
  }
  return {validate,sync,staff};
}
