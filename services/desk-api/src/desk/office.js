import {createHash} from 'node:crypto';
import {canonicalWorker, dailyMemo, scheduleEntry, workerKey} from './normalizers.js';
const ROOT='desk_portal/daily_journal';
export const OFFICE_SEATS=['main-1','main-2','main-3','main-director','annex-2','annex-3'];
export const officeToday=stamp=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(stamp));
export const validOfficeDate=s=>/^20\d{2}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const previousDate=date=>new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10);
const keyFor=name=>createHash('sha256').update(workerKey(name)).digest('hex').slice(0,24);
const fail=message=>({success:false,message});
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
  return [...new Set(Object.values(month?.entries||month||{}).map(s=>scheduleEntry(s)).filter(s=>s.date===date&&!s.unavailable).map(s=>s.worker))].flatMap(name=>{
   const matches=active.filter(s=>workerKey(s.name)===workerKey(name));
   return matches.length===1?[{key:keyFor(name),name:canonicalWorker(name),uid:matches[0].uid,position:matches[0].staffPosition||''}]:[];
  });
 }
 async function snapshot(date){
  if(!validOfficeDate(date))return fail('날짜를 확인해 주세요.');
  const previous=previousDate(date);
  const [people,office,prior]=await Promise.all([roster(date),store.get(ROOT+'/'+date+'/office'),store.get(ROOT+'/'+previous+'/office/workers')]);
  return {success:true,previousDate:previous,previousPending:Object.values(prior||{}).filter(w=>w.task),dateKey:date,today:officeToday(now()),people,workers:office?.workers||{},updatedAt:office?.updatedAt||'',serverTime:now()};
 }
 async function history({dateKey:date,workerKey:key,before=''}={}){
  if(!validOfficeDate(date)||!/^\w{24}$/.test(key||'')||typeof before!=='string'||before.length>120)return fail('조회 정보를 확인해 주세요.');
  const office=await store.get(ROOT+'/'+date+'/office')||{};
  const events=Object.entries(office.operations||{}).filter(([,e])=>e.workerKey===key&&['start','edit','complete','cancel'].includes(e.action)).map(([id,e])=>({id,cursor:e.at+'|'+id,action:e.action,at:e.at,by:e.by,before:e.before||'',after:e.after||''})).sort((a,b)=>a.cursor<b.cursor?1:a.cursor>b.cursor?-1:0);
  const rows=events.filter(e=>!before||e.cursor<before),page=rows.slice(0,50);
  return {success:true,dateKey:date,events:page,nextCursor:rows.length>50?page.at(-1).cursor:'',total:events.length};
 }
 async function mutate(p={},actor={}){
  if(!['ADMIN','STAFF','DESK'].includes(actor.role))return fail('데스크 근무자 권한이 필요합니다.');
  const date=p.dateKey;
  if(!validOfficeDate(date)||!['seat','start','edit','complete','cancel'].includes(p.action))return fail('작업 정보를 확인해 주세요.');
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(p.operationId||'')||!Number.isSafeInteger(p.version)||p.version<0)return fail('저장 정보를 다시 불러와 주세요.');
  if(typeof p.workerKey!=='string'||!/^\w{24}$/.test(p.workerKey))return fail('근무자를 선택해 주세요.');
  if((p.action==='seat'||(p.action==='start'&&p.seat!==undefined))&&p.seat!==''&&!OFFICE_SEATS.includes(p.seat))return fail('자리를 선택해 주세요.');
  if((['start','edit'].includes(p.action)||(p.action==='complete'&&p.text!==undefined))&&(typeof p.text!=='string'||!p.text.trim()||p.text.length>500))return fail('업무 내용을 500자 이내로 입력해 주세요.');
  const fingerprint=createHash('sha256').update(JSON.stringify([p.action,p.workerKey,p.version,p.seat||'',p.text||'',actor.uid])).digest('hex');
  directoryCache=null;
  const stamp=now(),people=await roster(date),person=people.find(s=>s.key===p.workerKey);
  if(date!==officeToday(stamp)&&!['complete','cancel'].includes(p.action))return fail('이전 날짜에는 미완료 업무만 종료할 수 있습니다.');
  let result;
  await store.transaction(ROOT+'/'+date,current=>{
   const day=structuredClone(current||{}),office=day.office||{workers:{},operations:{}},before=office.workers?.[p.workerKey];
   const target=person||before;
   const reject=message=>{result=fail(message);return current??null;};
   if(!target)return reject('당일 근무표에 등록된 근무자만 사용할 수 있습니다.');
   if(actor.role!=='ADMIN'&&target.uid!==actor.uid)return reject('본인의 업무만 변경할 수 있습니다.');
   if(office.operations?.[p.operationId]){if(office.operations[p.operationId].fingerprint!==fingerprint)return reject('같은 요청으로 다른 내용을 저장할 수 없습니다.');result={success:true,replayed:true};return current;}
   if((before?.version||0)!==p.version)return reject('다른 화면에서 변경되었습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.');
   if(!person&&!['complete','cancel'].includes(p.action)&&!(p.action==='seat'&&p.seat===''))return reject('현재 근무표에 없는 근무자입니다.');
   const next={...(before||{}),...target,version:p.version+1,updatedAt:stamp,updatedBy:actor.name||actor.nickname||'근무자',updatedByUid:actor.uid};
   if(p.action==='seat'||(p.action==='start'&&p.seat!==undefined)){
    if(p.seat&&Object.entries(office.workers||{}).some(([key,w])=>key!==p.workerKey&&w.seat===p.seat))return reject('다른 근무자가 먼저 선택한 자리입니다.');
    next.seat=p.seat;next.seatDate=date;
   }
   if(p.action==='start'){
    if(before?.task)return reject('진행 중인 업무를 먼저 완료하거나 취소해 주세요.');
    next.task={id:p.operationId,text:p.text.trim(),startedAt:stamp,startedBy:actor.name||'근무자',startedByUid:actor.uid};
   }else if(p.action!=='seat'){
    if(!before?.task)return reject('진행 중인 업무가 없습니다.');
    if(p.action==='edit')next.task={...before.task,text:p.text.trim()};
    else{
     if(p.action==='complete'){
      const task={...before.task,text:p.text===undefined?before.task.text:p.text.trim()},id='office-'+task.id;
      day.memos||={};
      // The office state and journal record commit in the same day transaction.
      if(!day.memos[id])day.memos[id]={...dailyMemo({id,worker:target.name,text:task.text,createdAt:task.startedAt,updatedAt:stamp,durationMinutes:Math.max(0,Math.floor((Date.parse(stamp)-Date.parse(task.startedAt))/60000)),mode:'record'},id,date,stamp),source:'mini-office',startedAt:task.startedAt,completedAt:stamp,completedBy:actor.name||'근무자',completedByUid:actor.uid};
      next.lastCompletedAt=stamp;
     }
     next.task=null;
    }
   }
   office.workers||={};office.workers[p.workerKey]=next;office.updatedAt=stamp;
   office.operations||={};office.operations[p.operationId]={fingerprint,action:p.action,workerKey:p.workerKey,at:stamp,by:actor.name||'근무자',uid:actor.uid,before:before?.task?.text||'',after:p.action==='complete'?(p.text===undefined?before.task.text:p.text.trim()):(next.task?.text||''),seat:next.seat||''};
   day.office=office;result={success:true};return day;
  });
  return result||fail('저장 결과를 확인하지 못했습니다.');
 }
 function watch(date,onChange,onError){
  const stops=[];
  try { for(const path of [ROOT+'/'+previousDate(date)+'/office',ROOT+'/'+date+'/office','desk_portal/monthly_schedule/'+date.slice(0,7)])stops.push(store.subscribe(path,onChange,onError)); }
  catch(error){stops.forEach(fn=>fn());throw error;}
  return ()=>stops.forEach(fn=>fn());
 }
 return {snapshot,history,mutate,watch};
}
