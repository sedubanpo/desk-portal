import {createHash} from 'node:crypto';
import {canonicalWorker, dailyMemo, scheduleEntry, workerKey} from './normalizers.js';
const ROOT='desk_portal/daily_journal';
export const OFFICE_SEATS=['main-1','main-2','main-3','main-director','main-classroom','annex-2','annex-3'];
export const officeToday=stamp=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(stamp));
export const validOfficeDate=s=>/^20\d{2}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const previousDate=date=>new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10);
const keyFor=name=>createHash('sha256').update(workerKey(name)).digest('hex').slice(0,24);
const fail=message=>({success:false,message});
const attendancePath=date=>'desk_portal/staff_attendance/'+date.slice(0,7)+'/'+date;
// Checkout releases only the seat. Tasks and their audit history remain intact.
function visibleWorkers(workers={},attendance={}){
 return Object.fromEntries(Object.entries(workers).map(([key,w])=>{
  const out=attendance?.[w.uid]?.clockOut;
  const released=Number.isFinite(Date.parse(out))&&!(Date.parse(w.seatSelectedAt)>Date.parse(out));
  return [key,released?{...w,seat:'',checkedOut:true}:w];
 }));
}
export function createOffice({store,loadStaffDirectory,now=()=>new Date().toISOString()}){
 let directoryCache=null,directoryAt=0,directoryPromise;
 async function directory(){
  if(directoryCache&&Date.now()-directoryAt<5000)return directoryCache;
  if(!directoryPromise)directoryPromise=loadStaffDirectory().then(rows=>{directoryCache=rows;directoryAt=Date.now();return rows;}).finally(()=>{directoryPromise=null;});
  return directoryPromise;
 }
 async function roster(date){
  const [month,staff]=await Promise.all([store.get('desk_portal/monthly_schedule/'+date.slice(0,7)),directory()]);
  const active=staff.filter(s=>s.status==='ACTIVE');
  return [...new Set([...Object.values(month?.entries||month||{}).map(s=>scheduleEntry(s)).filter(s=>s.date===date&&!s.unavailable).map(s=>s.worker),'김용찬','홍성우'])].flatMap(name=>{
   const matches=active.filter(s=>workerKey(s.name)===workerKey(name));
   return matches.length===1?[{key:keyFor(name),name:canonicalWorker(name),uid:matches[0].uid,position:matches[0].staffPosition||''}]:[];
  });
 }
 async function managementUids(){
  const active=(await directory()).filter(s=>s.status==='ACTIVE');
  return ['홍성우','안종성'].flatMap(name=>{const matches=active.filter(s=>workerKey(s.name)===workerKey(name));return matches.length===1?[matches[0].uid]:[];});
 }
 async function snapshot(date){
  if(!validOfficeDate(date))return fail('날짜를 확인해 주세요.');
  const previous=previousDate(date);
  const [people,office,prior,attendance]=await Promise.all([roster(date),store.get(ROOT+'/'+date+'/office'),store.get(ROOT+'/'+previous+'/office/workers'),store.get(attendancePath(date))]);
  return {success:true,managementUids:await managementUids(),previousDate:previous,previousPending:Object.values(prior||{}).filter(w=>w.task),dateKey:date,today:officeToday(now()),people,workers:visibleWorkers(office?.workers,attendance),updatedAt:office?.updatedAt||'',serverTime:now()};
 }
 async function history({dateKey:date,workerKey:key,before=''}={}){
  if(!validOfficeDate(date)||!/^\w{24}$/.test(key||'')||typeof before!=='string'||before.length>120)return fail('조회 정보를 확인해 주세요.');
  const office=await store.get(ROOT+'/'+date+'/office')||{};
  const events=Object.entries(office.operations||{}).filter(([,e])=>e.workerKey===key&&['start','edit','select','complete','cancel'].includes(e.action)).map(([id,e])=>({id,cursor:e.at+'|'+id,action:e.action,at:e.at,by:e.by,progress:e.progress??null,before:e.before||'',after:e.after||''})).sort((a,b)=>a.cursor<b.cursor?1:a.cursor>b.cursor?-1:0);
  const rows=events.filter(e=>!before||e.cursor<before),page=rows.slice(0,50);
  return {success:true,dateKey:date,events:page,nextCursor:rows.length>50?page.at(-1).cursor:'',total:events.length};
 }
 async function mutate(p={},actor={}){
  if(!['ADMIN','STAFF','DESK'].includes(actor.role))return fail('데스크 근무자 권한이 필요합니다.');
  const date=p.dateKey;
  if(!validOfficeDate(date)||!['seat','start','edit','select','complete','cancel'].includes(p.action))return fail('작업 정보를 확인해 주세요.');
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(p.operationId||'')||!Number.isSafeInteger(p.version)||p.version<0)return fail('저장 정보를 다시 불러와 주세요.');
  if(typeof p.workerKey!=='string'||!/^\w{24}$/.test(p.workerKey))return fail('근무자를 선택해 주세요.');
  if((p.action==='seat'||(p.action==='start'&&p.seat!==undefined))&&p.seat!==''&&!OFFICE_SEATS.includes(p.seat))return fail('자리를 선택해 주세요.');
  if((['start','edit'].includes(p.action)||(p.action==='complete'&&p.text!==undefined))&&(typeof p.text!=='string'||!p.text.trim()||p.text.length>500))return fail('업무 내용을 500자 이내로 입력해 주세요.');
  if(p.progress!==undefined&&(!Number.isInteger(p.progress)||p.progress<0||p.progress>100))return fail('진행률은 0~100 사이로 입력해 주세요.');
  if(p.classroom!==undefined&&(typeof p.classroom!=='string'||p.classroom.length>30))return fail('강의실은 30자 이내로 입력해 주세요.');
  if(p.taskId!==undefined&&(typeof p.taskId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(p.taskId)))return fail('업무를 다시 선택해 주세요.');
  const fingerprint=createHash('sha256').update(JSON.stringify([p.action,p.workerKey,p.version,p.seat||'',p.text||'',p.taskId||'',p.progress??null,p.classroom??null,actor.uid])).digest('hex');
  directoryCache=null;
  const stamp=now(),people=await roster(date),person=people.find(s=>s.key===p.workerKey);
  if(date!==officeToday(stamp)&&!['complete','cancel'].includes(p.action))return fail('이전 날짜에는 미완료 업무만 종료할 수 있습니다.');
  const canManage=actor.role==='ADMIN'||(await managementUids()).includes(actor.uid);
  const attendance=await store.get(attendancePath(date));
  let result;
  await store.transaction(ROOT+'/'+date,current=>{
   const day=structuredClone(current||{}),office=day.office||{workers:{},operations:{}},before=office.workers?.[p.workerKey];
   const target=person||before;
   const reject=message=>{result=fail(message);return current??null;};
   if(!target)return reject('당일 근무표에 등록된 근무자만 사용할 수 있습니다.');
   if(!canManage&&target.uid!==actor.uid)return reject('본인의 업무만 변경할 수 있습니다.');
   if(office.operations?.[p.operationId]){if(office.operations[p.operationId].fingerprint!==fingerprint)return reject('같은 요청으로 다른 내용을 저장할 수 없습니다.');result={success:true,replayed:true};return current;}
   if((before?.version||0)!==p.version)return reject('다른 화면에서 변경되었습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.');
   if(!person&&!['complete','cancel'].includes(p.action)&&!(p.action==='seat'&&p.seat===''))return reject('현재 근무표에 없는 근무자입니다.');
   const next={...(before||{}),...target,version:p.version+1,updatedAt:stamp,updatedBy:actor.name||actor.nickname||'근무자',updatedByUid:actor.uid};
   if(p.action==='seat'||(p.action==='start'&&p.seat!==undefined)){
    if(p.seat&&Object.entries(visibleWorkers(office.workers,attendance)).some(([key,w])=>key!==p.workerKey&&w.seat===p.seat))return reject('다른 근무자가 먼저 선택한 자리입니다.');
    if(p.seat&&Date.parse(attendance?.[target.uid]?.clockOut)&&target.uid!==actor.uid)return reject('퇴근 후 연장 근무 자리는 본인이 선택해 주세요.');
    if(p.classroom!==undefined)next.classroom=p.classroom.trim();
    next.seat=p.seat;next.seatDate=date;next.seatSelectedAt=stamp;
   }
   const tasks={...(before?.tasks||(before?.task?{[before.task.id]:before.task}:{}))};
   const taskId=p.taskId||before?.task?.id,task=tasks[taskId];
   if(p.action==='start'){
    if(Object.keys(tasks).length>=20)return reject('진행 업무는 최대 20개입니다. 마친 업무를 완료해 주세요.');
    tasks[p.operationId]={id:p.operationId,text:p.text.trim(),progress:p.progress??0,startedAt:stamp,startedBy:actor.name||'근무자',startedByUid:actor.uid};
    next.selectedTaskId=p.operationId;
   }else if(p.action!=='seat'){
    if(!task)return reject('진행 중인 업무가 없습니다. 최신 내용을 확인해 주세요.');
    if(p.action==='select')next.selectedTaskId=taskId;
    else if(p.action==='edit')tasks[taskId]={...task,text:p.text.trim(),progress:p.progress??task.progress??0};
    else{
     if(p.action==='complete'){
      const text=p.text===undefined?task.text:p.text.trim(),id='office-'+task.id;
      day.memos||={};
      // Commit the completed task and its journal record atomically.
      if(!day.memos[id])day.memos[id]={...dailyMemo({id,worker:target.name,text,createdAt:task.startedAt,updatedAt:stamp,durationMinutes:Math.max(0,Math.floor((Date.parse(stamp)-Date.parse(task.startedAt))/60000)),mode:'record'},id,date,stamp),source:'mini-office',startedAt:task.startedAt,completedAt:stamp,completedBy:actor.name||'근무자',completedByUid:actor.uid};
      next.lastCompletedAt=stamp;
     }
     delete tasks[taskId];
    }
   }
   next.tasks=tasks;
   next.selectedTaskId=tasks[next.selectedTaskId||before?.task?.id]?.id||Object.keys(tasks)[0]||'';
   // Keep the single-task projection for existing clients and speech bubbles.
   next.task=tasks[next.selectedTaskId]||null;
   office.workers||={};office.workers[p.workerKey]=next;office.updatedAt=stamp;
   office.operations||={};office.operations[p.operationId]={fingerprint,action:p.action,workerKey:p.workerKey,at:stamp,by:actor.name||'근무자',uid:actor.uid,taskId:p.action==='start'?p.operationId:taskId||'',progress:p.action==='complete'?100:p.progress??task?.progress??0,before:task?.text||'',after:p.action==='complete'?(p.text===undefined?task.text:p.text.trim()):(tasks[p.action==='start'?p.operationId:taskId]?.text||next.task?.text||''),seat:next.seat||''};
   day.office=office;result={success:true};return day;
  });
  return result||fail('저장 결과를 확인하지 못했습니다.');
 }
 function watch(date,onChange,onError){
  const stops=[];
  try { for(const path of [ROOT+'/'+previousDate(date)+'/office',ROOT+'/'+date+'/office','desk_portal/monthly_schedule/'+date.slice(0,7),attendancePath(date)])stops.push(store.subscribe(path,onChange,onError)); }
  catch(error){stops.forEach(fn=>fn());throw error;}
  return ()=>stops.forEach(fn=>fn());
 }
 return {snapshot,history,mutate,watch};
}
