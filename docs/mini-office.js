(function(){
'use strict';
const seats=[['main-1','본관 1번'],['main-2','본관 2번'],['main-3','본관 3번'],['main-director','본관 원장실'],['main-classroom','본관 강의실'],['annex-2','2관'],['annex-3','3관']];
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=v=>v?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'';
const dateNow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
let renderSignature='';
let toolbar,drag=null,serverOffset=0,lastShiftMinute='',root,bridge,data,contextKey='',dataContextKey='',controller,retry,timer,dialog,generation=0,lastSeen='',connected=false,collapsed=false,currentRoom='main',errorDelay=1000,saving=false;
const api=async(p)=>{const r=await bridge.save(p);if(!r?.success)throw Error(r?.message||'저장하지 못했습니다.');return r;};
function badge(name){
 const person=data?.people?.find(p=>p.name===name);
 const leader=name==='김용찬'?'대표':name==='홍성우'?'부원장':'';
 const position=leader||person?.position||'';
 const crown='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 5 4 4-7 4 7 5-4-2 12H5Z" fill="currentColor"/><path d="M6 22h12" stroke="currentColor" stroke-width="2"/></svg>';
 return `<span class="mo-person-label ${leader?'mo-leader '+(name==='김용찬'?'mo-principal':'mo-deputy'):''}">${leader?`<span class="mo-rank-icon">${crown}</span><span class="mo-person-name">${escape(name)}</span>`:bridge.badge(name)}${position?`<span class="mo-position">${escape(position)}</span>`:''}</span>`;
}
function character(name){
 const hash=[...name].reduce((n,c)=>n+c.charCodeAt(0),0),shirts=['#508c80','#83709b','#bd7959','#6386a3','#9a985d'],hair=['#504136','#493d47','#6c513a'];
 return `<svg class="mo-character" viewBox="0 0 32 42" shape-rendering="crispEdges" aria-hidden="true"><path fill="#3f4f44" d="M8 32h7v8H7v-3h1m10-5h7v8h-8v-3h1"/><path fill="${shirts[hash%5]}" d="M7 21h18v14H7z"/><path fill="#eee5cd" d="M13 21h6v5h-6z"/><path fill="#efc69f" d="M7 8h18v13H7zM4 24h4v9H4zm20 0h4v9h-4z"/><path fill="${hair[hash%3]}" d="M7 4h18v7H7zM4 8h5v8H4zm19 0h5v8h-5z"/><path fill="#34453d" d="M10 14h3v3h-3zm9 0h3v3h-3z"/><path fill="#c0856e" d="M14 19h5v2h-5z"/>${hash%2?'<path fill="#dbb766" d="M20 5h6v3h-6z"/>':''}</svg>`;
}
function people(){const map=new Map((data?.people||[]).map(p=>[p.key,{...p,...data.workers[p.key],shifts:p.shifts}]));for(const [key,w]of Object.entries(data?.workers||{}))if(!map.has(key))map.set(key,{...w,key,offSchedule:true});return [...map.values()];}
function canManage(){const identity=bridge.context().identity;return identity?.role==='ADMIN'||(data?.managementUids||[]).includes(identity?.uid);}
function allowed(p){return canManage()||bridge.context().identity?.uid===p.uid;}
function taskIcon(text=''){
 const types=[[/상담|학부모|전화|연락|응대/,'☎','상담·연락'],[/수납|수강료|결제|정산|급여|환불/,'₩','수납·정산'],[/시간표|스케줄|일정|배정/,'▦','시간표·일정'],[/출결|출석|등원|하원/,'✓','출결 확인'],[/청소|정리|점검|교재|물품/,'✦','환경·물품'],[/수업|강의|지도|학습|보강/,'▤','수업·학습'],[/블로그|홍보|게시|작성|보고/,'✎','작성·홍보']];
 const match=types.find(([pattern])=>pattern.test(text));return match?{symbol:match[1],label:match[2]}:{symbol:'▤',label:'일반 업무'};
}
function monitor(task){const icon=taskIcon(task?.text);return task?`<span class="mo-task-icon" title="${icon.label}" data-task-icon="${icon.label}">${icon.symbol}</span>`:'<b></b><b></b><b></b>';}
function shiftMarkup(p){
 const now=Date.now()+serverOffset;
 const intervals=(p.shifts||[]).flatMap(s=>{
  if(!/^\d{2}:\d{2}$/.test(s.start)||!/^\d{2}:\d{2}$/.test(s.end))return [];
  const start=Date.parse(data.dateKey+'T'+s.start+':00+09:00');let end=Date.parse(data.dateKey+'T'+s.end+':00+09:00');if(end<=start)end+=86400000;
  return Number.isFinite(start)&&Number.isFinite(end)?[{start,end}]:[];
 }).sort((a,b)=>a.start-b.start);
 // Merge overlapping shifts so the remaining time is never counted twice.
 const merged=[];for(const span of intervals){const last=merged.at(-1);if(last&&span.start<=last.end)last.end=Math.max(last.end,span.end);else merged.push({...span});}
 const total=merged.reduce((n,s)=>n+s.end-s.start,0),left=merged.reduce((n,s)=>n+Math.max(0,s.end-Math.max(now,s.start)),0);
 const minutes=Math.ceil(left/60000),label=!total?'일정 없음':now<merged[0].start?'시작 전':minutes?`${Math.floor(minutes/60)}시간 ${minutes%60}분 남음`:'근무 종료';
 const percent=total?Math.max(0,Math.min(100,Math.round(left/total*100))):0;
 return `<span class="mo-shift" title="근무표 기준 · ${escape(label)}" aria-label="${escape(p.name)} 근무표 기준 ${escape(label)}"><span class="mo-shift-track"><i style="height:${percent}%"></i></span><small>${escape(label)}</small></span>`;
}
function seatMarkup(id){
 const p=people().find(w=>w.seat===id),task=p?.task,editable=p&&allowed(p)&&data.dateKey===dateNow();
 return `<div data-seat-id="${id}" class="mo-seat ${p?(task?'working':'occupied'):'empty'}"><div class="mo-bubble"><button class="mo-bubble-content" ${p?`data-history="${escape(p.key)}" aria-label="${escape(p.name)} 업무 히스토리 보기"`:'data-worker=""'} data-seat="${id}" ${!p?'aria-label="'+seats.find(s=>s[0]===id)[1]+' 자리 선택"':''}>${p?`<span>${task?'진행 중 · '+clock(task.startedAt):p.lastCompletedAt?'완료 · '+clock(p.lastCompletedAt):'업무 대기'}</span><strong>${escape(task?.text||'다음 업무를 준비하고 있어요')}</strong>`:'<span>빈자리</span><strong>이 자리에 앉기 ＋</strong>'}</button>${task?`<button class="mo-progress-control" data-progress="${escape(p.key)}" aria-label="${escape(p.name)} 업무 진행률 ${Number(task.progress)||0}% 조절" ${!editable?'disabled':''}><span class="mo-progress" role="progressbar" aria-label="업무 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(task.progress)||0}"><i style="width:${Number(task.progress)||0}%"></i></span><span class="mo-progress-caption">${Number(task.progress)||0}% · ${Object.keys(p.tasks||{[task.id]:task}).length}개 업무</span></button>`:''}${p?`<button class="mo-history-link" data-history="${escape(p.key)}">업무 히스토리 ↗</button>`:''}</div><div class="mo-furniture"><div class="mo-monitor" aria-hidden="true">${monitor(task)}</div><div class="mo-mug" aria-hidden="true"></div><div class="mo-desk" aria-hidden="true"></div>${p?`<button class="mo-drag-character" data-drag-worker="${escape(p.key)}" aria-label="${escape(p.name)} 자리 이동" ${!editable?'disabled':''}>${character(p.name)}</button><span data-shift-worker="${escape(p.key)}">${shiftMarkup(p)}</span>`:'<div class="mo-chair" aria-hidden="true"></div>'}</div><button class="mo-name" data-worker="${escape(p?.key||'')}" data-seat="${id}">${p?badge(p.name):'<span>'+seats.find(s=>s[0]===id)[1]+'</span>'}${p?.offSchedule?'<small>근무표 변경됨</small>':''}</button>${p&&allowed(p)?`<button class="mo-seat-manage" data-worker="${escape(p.key)}">＋ 업무 관리</button>`:''}</div>`;
}
let noticeSignature='';
function paintBoard(){
 const board=root.querySelector('.mo-board'),items=bridge.context().active?(bridge.notices?.()||[]):[];
 const signature=JSON.stringify([items,bridge.readerName?.()]);if(signature===noticeSignature&&board.children.length)return;noticeSignature=signature;
 const opened=new Set([...board.querySelectorAll('details[open]')].map(el=>el.dataset.notice));
 const check='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
 board.innerHTML=`<header><h4>우리의 공용 칠판</h4><span class="mo-board-count">전체 공지 ${items.length}건</span></header><div class="mo-board-notices">${items.length?items.map(item=>{
  const readers=item.ackWorkers||[],read=readers.includes(bridge.readerName?.());
  return `<details data-notice="${escape(item.id)}" ${opened.has(String(item.id))?'open':''}><summary><strong>${escape(item.text)}</strong><span class="mo-read-count" aria-label="${readers.length}명 읽음">${check}${readers.length}</span><span class="mo-board-expand" aria-hidden="true">＋</span></summary><div class="mo-board-detail"><div class="mo-notice-copy"><p>${escape(item.note||'별도 상세 내용이 없습니다.')}</p><small>기록 · ${escape(item.author)}${item.updatedAt?`<time>${escape(String(item.updatedAt).slice(0,10))}</time>`:''}</small></div><aside class="mo-signatures" aria-label="읽은 근무자"><span>읽고 확인했어요</span><div>${readers.length?readers.map(name=>`<span class="mo-signature">${escape(name)}</span>`).join(''):'<span class="mo-signature-empty">첫 서명을 남겨 주세요</span>'}</div>${bridge.readerName?.()?`<button data-notice-ack="${escape(item.id)}" aria-pressed="${read}" ${item.saving?'disabled':''}>${check}${item.saving?'저장 중…':read?'서명 취소':'읽음 서명'}</button>`:''}</aside></div></details>`;
 }).join(''):'<p class="mo-board-empty">등록된 전체 공지사항이 없습니다.</p>'}</div><div class="mo-board-ledge" aria-hidden="true"><i></i><b></b></div>`;
}
function paint(){if(!data||drag)return;
 const list=people();
 const routinePanel=root.querySelector('.mo-routines');if(routinePanel)routinePanel.remove();
 const picker=document.querySelector('.journal-worker-picker'),focused=picker?.contains(document.activeElement)?document.activeElement:null;
 if(picker)picker.remove();
 root.querySelector('.mo-scene').innerHTML=`<div class="mo-room mo-main ${currentRoom==='main'?'mobile-active':''}" data-room="main"><div class="mo-wall"><span class="mo-window"></span><h4>본관 <small>함께 일하는 데스크</small></h4><span class="mo-plant" aria-hidden="true">♣</span></div><div class="mo-main-floor">${seats.slice(0,5).map(([id,label],i)=>`<section class="mo-station ${id==='main-director'?'mo-director':id==='main-classroom'?'mo-classroom':''}" aria-label="${label} 1석"><h5>${i<3?'데스크 '+(i+1):id==='main-director'?'원장실':'강의실'}</h5>${seatMarkup(id)}</section>`).join('')}</div></div>${[2,3].map(n=>`<div class="mo-room ${currentRoom==='annex-'+n?'mobile-active':''}" data-room="annex-${n}"><div class="mo-wall"><h4>${n}관 <small>작은 사무실</small></h4><span class="mo-window"></span></div><div class="mo-desks"><section class="mo-station"><h5>데스크</h5>${seatMarkup('annex-'+n)}</section></div></div>`).join('')}`;
 if(routinePanel)root.querySelector('.mo-scene').append(routinePanel);
 if(picker){if(collapsed)root.querySelector('.mo-content').before(picker);else root.querySelector('.mo-scene').append(picker);if(focused)focused.focus({preventScroll:true});}
 root.querySelector('.mo-unseated').innerHTML=`<span>미배치 근무자</span>${list.filter(p=>!p.seat).map(p=>`<button data-worker="${escape(p.key)}">${character(p.name)}${badge(p.name)}<small>${p.task?'업무 진행 중':p.offSchedule?'근무표 변경됨':'자리 선택 전'}</small></button>`).join('')||'<small>모든 근무자가 자리를 선택했습니다.</small>'}`;
 root.querySelector('.mo-previous').innerHTML=(data.previousPending||[]).length?'<span>전날 마치지 않은 업무</span>'+data.previousPending.map(p=>`<button data-previous="${escape(p.key)}">${badge(p.name)} · ${escape(p.task.text)}</button>`).join(''):'';

 root.querySelector('.mo-date-note').textContent=data.dateKey===dateNow()?'퇴근 기록이 있거나 근무 시간이 끝나면 자리가 비워집니다. 연장 근무는 내 자리·업무에서 다시 선택해 주세요.':'이전 날짜의 기록입니다. 미완료 업무는 상세 화면에서 종료할 수 있습니다.';
 toolbar.querySelector('[data-my]').disabled=!list.some(allowed);
 if(!list.length)root.querySelector('.mo-unseated').innerHTML='<span>오늘의 근무자가 없습니다.</span><small>월별 근무표에 등록된 활성 근무자가 표시됩니다.</small>';
}
let routinePanel,routineKey='',routineData=null,routineFetchedAt=0,routineLoading=false,routineEpoch=0,routineError='';
const routineSelected=new Set();
let routineAssigning=false,routineResponsible='',routineAssistant='',routineMessage='';
let routineStatusDialog,routineStatusSaving=false,routineStatusMessage='';
const routineContextMatches=key=>{const c=bridge.context();return c.active&&c.identity&&c.identity.uid+':'+c.dateKey===key;};
const canChangeRoutine=t=>!!t&&t.status!=='excluded'&&(routineData?.canManage===true||[t.responsible,t.assistant].includes(bridge.context().identity?.uid));
function routineView(){
 const date=bridge.context().dateKey,dayItems=routineData?.day?.items||{};
 const due=(routineData?.templates||[]).filter(t=>t.active&&!t.deletedAt&&(t.weekdays||[]).includes(new Date(date+'T12:00:00+09:00').getDay()));
 const items=[...Object.values(dayItems).filter(t=>t.status!=='excluded'),...due.filter(t=>!dayItems[t.id]).map(t=>({...t,status:'registered',responsible:'',assistant:''}))].sort((a,b)=>('SABC'.indexOf(a.grade)-'SABC'.indexOf(b.grade))||a.title.localeCompare(b.title,'ko'));
 const staff=routineData?.staff||[],schedule=routineData?.schedule||{};
 const working=new Set(Object.values(schedule.entries||schedule).filter(e=>e.date===date&&!e.unavailable).map(e=>e.worker));
 const targets=staff.filter(s=>working.has(s.name)).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
 const assignedIds=new Set(items.flatMap(t=>[t.responsible,t.assistant]).filter(Boolean));
 const workers=[...targets,...staff.filter(s=>assignedIds.has(s.uid)&&!working.has(s.name))];
 for(const uid of assignedIds)if(!workers.some(s=>s.uid===uid))workers.push({uid,name:'이전 근무자',offSchedule:true});
 return {date,items,staff,due,working,targets,workers,pending:items.filter(t=>!t.responsible||!t.assistant)};
}
const routineStatus=t=>({registered:'배정 전',waiting:'대기',doing:'진행 중',done:'완료'})[t.status]||'확인 필요';
function renderRoutines(){
 if(!routinePanel)return;
 const {date,items,staff,due,working,targets,workers,pending}=routineView();
 for(const id of routineSelected)if(!pending.some(t=>t.id===id))routineSelected.delete(id);
 const name=id=>staff.find(p=>p.uid===id)?.name||(id?'이전 근무자':'미배정');
 const count=status=>items.filter(t=>t.status===status).length;
 const counts={registered:count('registered'),waiting:count('waiting'),doing:count('doing'),done:count('done')};
 const scrolls=[...routinePanel.querySelectorAll('[data-routine-scroll]')].map(n=>[n.dataset.routineScroll,n.scrollTop]);
 const focused=document.activeElement?.closest('[data-routine-select]')?.dataset.routineSelect;
 const options=selected=>'<option value="">변경 안 함</option>'+targets.map(s=>`<option value="${escape(s.uid)}" ${selected===s.uid?'selected':''}>${escape(s.name)}${s.uid===bridge.context().identity?.uid?' · 나':''}</option>`).join('');
 const disabled=routineAssigning||routineLoading||routineStatusSaving;
 routinePanel.innerHTML=`<header><div><h4>${date===dateNow()?'오늘':'선택일'} 루틴 현황</h4><p>${escape(date||'')} · ${items.length}개 업무 · 책임 미배정 ${items.filter(t=>!t.responsible).length}개</p></div><button data-routine-open>업무 분배 열기 <span aria-hidden="true">↗</span></button></header>${routineError?`<p class="mo-routine-error" role="alert">${escape(routineError)} <button data-routine-refresh>다시 불러오기</button></p>`:!routineData?'<p class="mo-routine-empty" role="status">오늘 루틴을 불러오는 중입니다…</p>':`<div class="mo-routine-overview"><div class="mo-routine-counts">${[...(counts.registered?[['registered','배정 전']]:[]),['waiting','대기'],['doing','진행 중'],['done','완료']].map(([key,label])=>`<span><i class="mo-state-dot ${key}" aria-hidden="true"></i>${label} <b>${counts[key]}</b></span>`).join('')}<button data-routine-refresh aria-label="루틴 현황 새로고침" ${disabled?'disabled':''}>${routineLoading?'갱신 중…':'새로고침'}</button></div></div>
 <div class="mo-routine-workers" aria-label="근무자별 루틴 진행 현황">${workers.map(s=>{
  const tasks=items.filter(t=>t.responsible===s.uid||t.assistant===s.uid),done=tasks.filter(t=>t.status==='done').length,percent=tasks.length?Math.round(done/tasks.length*100):0;
  return `<section class="mo-routine-person" aria-label="${escape(s.name)} 루틴 현황"><header><h5>${escape(s.name)}${s.uid===bridge.context().identity?.uid?'<small>나</small>':''}</h5><span>${tasks.length?`완료율 <b>${percent}%</b>`:'배정 없음'}</span></header><div class="mo-person-progress"><progress max="${tasks.length||1}" value="${done}" aria-label="${escape(s.name)} 루틴 완료율 ${percent}%"></progress><small>${done}/${tasks.length} 완료</small></div><p>책임 ${tasks.filter(t=>t.responsible===s.uid).length} · 보조 ${tasks.filter(t=>t.assistant===s.uid).length} · 진행 ${tasks.filter(t=>t.status==='doing').length}${!working.has(s.name)?' · 근무표 외 기존 배정':''}</p><ul data-routine-scroll="${escape(s.uid)}">${tasks.map(t=>`<li><button type="button" class="mo-routine-task" data-routine-status="${escape(t.id)}" data-routine-worker="${escape(s.uid)}" aria-label="${escape(t.title)} 상태 변경" aria-haspopup="dialog" ${disabled?'disabled':''}><span class="mo-role-label">${t.responsible===s.uid?'책임':'보조'}</span><span>${escape(t.title)}</span><small class="mo-routine-status ${escape(t.status)}">${routineStatus(t)} <span aria-hidden="true">›</span></small></button></li>`).join('')||'<li class="mo-routine-person-empty">아직 맡은 루틴이 없습니다.</li>'}</ul></section>`;
 }).join('')||'<p class="mo-routine-empty">이 날짜에 등록된 근무자가 없습니다. 월별 근무표를 확인해 주세요.</p>'}</div>
 <p class="mo-routine-progress-note">업무를 눌러 상태 변경 · 책임·보조 담당자 또는 관리자만 변경할 수 있습니다.<br>완료율 = 완료 업무 ÷ 맡은 업무 · 책임·보조 중복 제외</p><p class="mo-routine-status-message" role="status">${escape(routineStatusMessage)}</p>
 <section class="mo-routine-allocation" aria-label="미배정 루틴 바로 지정"><div class="mo-routine-pool-heading"><h5>담당 배정 필요 <span>${pending.length}</span></h5><label><input type="checkbox" data-routine-all ${pending.length&&routineSelected.size===pending.length?'checked':''} ${disabled||!pending.length?'disabled':''}>전체 선택</label></div><div class="mo-routine-assign-grid"><div class="mo-routine-list" data-routine-scroll="pool" tabindex="0" aria-label="미배정 루틴 업무">${pending.map(t=>`<article><label class="mo-routine-pick"><input type="checkbox" data-routine-select="${escape(t.id)}" aria-label="${escape(t.title)} 배정 선택" ${routineSelected.has(t.id)?'checked':''} ${disabled?'disabled':''}><span class="mo-routine-grade grade-${escape(t.grade)}">${escape(t.grade)}</span><span><strong>${escape(t.title)}</strong><small>책임 ${escape(name(t.responsible))} · 보조 ${escape(name(t.assistant))}</small></span></label><span class="mo-routine-status ${escape(t.status)}">${routineStatus(t)}</span></article>`).join('')||'<p class="mo-routine-empty">모든 업무의 책임·보조가 배정됐습니다.</p>'}</div>
 <form class="mo-routine-assign-form" aria-label="선택 루틴 담당 지정"><div class="mo-routine-selection"><strong>${routineSelected.size}개 선택</strong><button type="button" data-routine-clear ${disabled||!routineSelected.size?'disabled':''}>선택 해제</button></div><p>선택한 업무의 빈 역할만 채웁니다.<br>이미 지정된 담당자는 유지됩니다.</p>${[['responsible','책임',routineResponsible],['assistant','보조',routineAssistant]].map(([role,label,value])=>`<div class="mo-routine-role-field"><label>${label}<select data-routine-role="${role}" aria-label="루틴 ${label} 근무자" ${disabled||!routineSelected.size?'disabled':''}>${options(value)}</select></label><button type="button" data-routine-me="${role}" ${disabled||!routineSelected.size||!targets.some(s=>s.uid===bridge.context().identity?.uid)?'disabled':''}>나에게</button></div>`).join('')}<button type="submit" class="mo-routine-save" ${disabled||!routineSelected.size||!targets.length?'disabled':''}>${routineAssigning?'배정 저장 중…':'선택 업무에 지정'}</button>${!targets.length?'<small>근무표에 등록된 근무자가 없습니다.</small>':''}<p class="mo-routine-message" role="status">${escape(routineMessage)}</p></form></div></section>
 <footer>보관함 사용 중 ${(routineData.templates||[]).filter(t=>t.active&&!t.deletedAt).length}개 · 당일 반복 ${due.length}개 <span>오늘 제외 업무는 집계하지 않습니다.</span></footer>`}`;
 for(const [key,top]of scrolls){const el=[...routinePanel.querySelectorAll('[data-routine-scroll]')].find(n=>n.dataset.routineScroll===key);if(el)el.scrollTop=top;}
 const all=routinePanel.querySelector('[data-routine-all]');if(all)all.indeterminate=routineSelected.size>0&&routineSelected.size<pending.length;
 if(focused)[...routinePanel.querySelectorAll('[data-routine-select]')].find(n=>n.dataset.routineSelect===focused)?.focus({preventScroll:true});
}
async function syncRoutines(force=false){
 if(!routinePanel||!bridge.routines)return;
 const c=bridge.context(),key=c.active&&c.identity?c.identity.uid+':'+c.dateKey:'';
 if(key!==routineKey){routineKey=key;routineEpoch++;routineData=null;routineError='';routineFetchedAt=0;routineLoading=false;routineSelected.clear();routineResponsible='';routineAssistant='';routineMessage='';routineStatusMessage='';if(routineStatusDialog?.open)routineStatusDialog.close();renderRoutines();}
 if(!key||document.hidden||routineLoading||routineAssigning||routineStatusSaving||(!force&&(routineStatusDialog?.open||routineSelected.size||Date.now()-routineFetchedAt<60000)))return;
 const epoch=++routineEpoch;routineLoading=true;renderRoutines();
 try{const result=await bridge.routines(c.dateKey);if(epoch!==routineEpoch)return;if(!result?.success)throw Error(result?.message||'루틴을 불러오지 못했습니다.');routineData=result;routineError='';}
 catch(e){if(epoch!==routineEpoch)return;routineError=e.message||'루틴을 불러오지 못했습니다.';}
 finally{if(epoch===routineEpoch){routineLoading=false;routineFetchedAt=Date.now();renderRoutines();}}
}
async function assignRoutineSelection(){
 if(routineAssigning||routineLoading||routineStatusSaving||!routineSelected.size)return;
 const {date,targets}=routineView(),ids=[...routineSelected],responsible=routineResponsible,assistant=routineAssistant,key=routineKey;
 const tell=message=>{routineMessage=message;renderRoutines();};
 if(!responsible&&!assistant){tell('책임 또는 보조 근무자를 선택해 주세요.');return;}
 if(responsible&&responsible===assistant){tell('책임과 보조는 서로 다른 근무자를 선택해 주세요.');return;}
 if([responsible,assistant].some(uid=>uid&&!targets.some(s=>s.uid===uid))){tell('선택한 날짜의 근무자를 선택해 주세요.');return;}
 routineAssigning=true;tell('담당자를 저장하고 있습니다…');let saved=0,skipped=0;
 try{
  const fresh=await bridge.routines(date);if(!fresh?.success)throw Error(fresh?.message||'최신 배정을 확인하지 못했습니다.');if(key!==routineKey)return;
  routineData=fresh;
  if([responsible,assistant].some(uid=>uid&&!routineView().targets.some(s=>s.uid===uid)))throw Error('근무표가 변경됐습니다. 담당자를 다시 선택해 주세요.');
  if(ids.some(id=>!routineData.day?.items?.[id])){
   const prepared=await bridge.prepareRoutines(date);if(!prepared?.success)throw Error(prepared?.message||'오늘 배정을 준비하지 못했습니다.');if(key!==routineKey)return;routineData.day=prepared.day;
  }
  // Only fill empty roles in the latest day; never replace somebody else's assignment.
  const changes=ids.map(id=>{
   const t=routineData.day?.items?.[id];if(!t||t.status==='excluded')return null;
   return {t,responsible:t.responsible||responsible,assistant:t.assistant||assistant};
  });
  if(changes.some(v=>v&&v.responsible&&v.responsible===v.assistant))throw Error('기존 담당자와 역할이 겹칩니다. 책임과 보조를 서로 다른 근무자로 선택해 주세요.');
  for(let n=0;n<ids.length;n++){
   if(key!==routineKey)break;
   const v=changes[n];
   if(!v||(v.responsible===(v.t.responsible||'')&&v.assistant===(v.t.assistant||''))){skipped++;routineSelected.delete(ids[n]);continue;}
   const result=await bridge.assignRoutine({date,id:ids[n],version:routineData.day.version,action:'assign',responsible:v.responsible,assistant:v.assistant});
   if(!result?.success)throw Error(result?.message||'다른 근무자의 변경과 겹쳤습니다. 새로고침 후 다시 선택해 주세요.');
   saved++;if(key!==routineKey)break;routineData.day=result.day;routineSelected.delete(ids[n]);
  }
  if(key===routineKey){routineMessage=`${saved}개 업무에 담당자를 지정했습니다.${skipped?` 이미 배정됐거나 제외된 ${skipped}개는 유지했습니다.`:''}`;routineResponsible='';routineAssistant='';}
 }catch(e){if(key===routineKey)routineMessage=`${saved?`${saved}개 저장 완료. `:''}${e.message||'저장하지 못했습니다. 다시 시도해 주세요.'}`;}
 finally{
  routineAssigning=false;
  if(key===routineKey){routineFetchedAt=0;await syncRoutines(true);renderRoutines();}
 }
}
function showRoutineStatus(id,worker,error=''){
 const task=routineData?.day?.items?.[id];if(!task||task.status==='excluded'||routineStatusSaving||!routineContextMatches(routineKey))return;
 const key=routineKey,date=bridge.context().dateKey,version=routineData.day.version;
 const editable=canChangeRoutine(task),name=uid=>routineData.staff.find(s=>s.uid===uid)?.name||(uid?'이전 근무자':'미배정');
 routineStatusDialog.setAttribute('aria-label','루틴 진행 상태');
 routineStatusDialog.innerHTML=`<header><div><p>${escape(date)} · 루틴 업무</p><h3>${escape(task.title)}</h3></div><button type="button" data-close aria-label="닫기">✕</button></header><div class="mo-form-body"><p class="mo-routine-state-owners">책임 ${escape(name(task.responsible))} · 보조 ${escape(name(task.assistant))}</p><p class="mo-help">${editable?'상태를 선택하면 바로 저장됩니다.':'책임·보조 담당자 또는 관리자만 상태를 변경할 수 있습니다.'}</p><div class="mo-routine-state-options" aria-label="루틴 상태 선택">${[['waiting','대기'],['doing','진행 중'],['done','완료']].map(([value,label])=>`<button type="button" data-status-value="${value}" aria-pressed="${task.status===value}" ${!editable?'disabled':''}><i class="mo-state-dot ${value}" aria-hidden="true"></i>${label}${task.status===value?'<span aria-hidden="true">✓</span>':''}</button>`).join('')}</div><p class="mo-routine-state-feedback" role="alert">${escape(error)}</p></div>`;
 routineStatusDialog.oncancel=e=>{if(routineStatusSaving)e.preventDefault();};
 routineStatusDialog.querySelector('[data-close]').onclick=()=>routineStatusDialog.close();
 routineStatusDialog.querySelectorAll('[data-status-value]').forEach(button=>button.onclick=async()=>{
  if(routineStatusSaving||routineAssigning||!editable||!routineContextMatches(key))return;
  const next=button.dataset.statusValue;if(next===task.status){routineStatusDialog.close();return;}
  routineStatusSaving=true;routineStatusDialog.querySelectorAll('button').forEach(el=>el.disabled=true);
  routineStatusDialog.querySelector('.mo-routine-state-feedback').textContent='상태를 저장하고 있습니다…';renderRoutines();
  let failure='';
  try{
   const result=await bridge.updateRoutineStatus({date,id,version,action:'status',status:next});
   if(!result?.success)throw Error(result?.message||'상태를 저장하지 못했습니다. 다시 시도해 주세요.');
   if(!routineContextMatches(key))return;
   if(!routineData)return;
   if(result.day.version>=routineData.day.version)routineData.day=result.day;routineFetchedAt=Date.now();routineStatusMessage=`${task.title} · 상태를 ${routineStatus({status:next})}로 저장했습니다.`;
   window.dispatchEvent(new CustomEvent('desk:routine-day-changed',{detail:{date,uid:bridge.context().identity.uid,day:result.day}}));
   routineStatusDialog.close();
  }catch(e){failure=e.message||'상태를 저장하지 못했습니다. 다시 시도해 주세요.';}
  finally{
   routineStatusSaving=false;
   if(routineContextMatches(key)){
    if(failure){await syncRoutines(true);if(!routineContextMatches(key)){routineStatusDialog.close();return;}const latest=routineData?.day?.items?.[id];if(latest&&latest.status!=='excluded')showRoutineStatus(id,worker,failure);else{routineStatusDialog.close();routineStatusMessage=failure;}}
    renderRoutines();
    if(!routineStatusDialog.open)[...routinePanel.querySelectorAll('[data-routine-status]')].find(el=>el.dataset.routineStatus===id&&el.dataset.routineWorker===worker)?.focus({preventScroll:true});
   }else routineStatusDialog.close();
  }
 });
 if(!routineStatusDialog.open)routineStatusDialog.showModal();
}
function routineChange(e){
 const target=e.target;if(routineAssigning)return;
 if(target.hasAttribute('data-routine-select')){target.checked?routineSelected.add(target.dataset.routineSelect):routineSelected.delete(target.dataset.routineSelect);routineMessage='';renderRoutines();}
 else if(target.hasAttribute('data-routine-all')){routineSelected.clear();if(target.checked)routineView().pending.forEach(t=>routineSelected.add(t.id));routineMessage='';renderRoutines();}
 else if(target.dataset.routineRole){routineMessage='';const message=routinePanel.querySelector('.mo-routine-message');if(message)message.textContent='';if(target.dataset.routineRole==='responsible')routineResponsible=target.value;else routineAssistant=target.value;}
}
function status(text){toolbar.querySelector('.mo-sync').textContent=text;root.dataset.connected=String(connected);}
function stop(){generation++;controller?.abort();controller=null;clearTimeout(retry);connected=false;}
async function connect(){
 const c=bridge.context();if(!c.active||!c.identity||document.hidden||!navigator.onLine)return;
 const tokenGeneration=generation,abort=new AbortController();controller=abort;
 let watchdog=setTimeout(()=>abort.abort(),15000);
 try{
  status(lastSeen?'다시 연결 중 · 마지막 갱신 '+clock(lastSeen):'사무실 연결 중…');
  const token=await bridge.token();if(tokenGeneration!==generation)return;
  const response=await fetch(bridge.base+'/v1/office/stream?dateKey='+encodeURIComponent(c.dateKey),{headers:{Authorization:'Bearer '+token},signal:abort.signal});
  if(!response.ok||!response.body)throw Error('연결 실패');
  let buffer='';const reader=response.body.getReader(),decoder=new TextDecoder();
  while(true){const {value,done}=await reader.read();if(done)break;clearTimeout(watchdog);watchdog=setTimeout(()=>abort.abort(),15000);buffer+=decoder.decode(value,{stream:true});let index;
   while((index=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,index);buffer=buffer.slice(index+2);if(event.includes('event: unavailable'))throw Error('조회 실패');const line=event.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;
    const next=JSON.parse(line.slice(6));if(!next.success)throw Error(next.message);if(tokenGeneration!==generation)return;
    // Reconnects may repeat the same snapshot with a new server clock. Keep focused controls attached.
    const changed=data?.updatedAt!==next.updatedAt;const signature=JSON.stringify({...next,serverTime:undefined});const needsPaint=signature!==renderSignature;renderSignature=signature;data=next;serverOffset=Date.parse(next.serverTime)-Date.now();lastSeen=new Date().toISOString();connected=true;errorDelay=1000;if(needsPaint)paint();status('실시간 연결 · '+clock(lastSeen));if(changed)bridge.refreshJournal(next.dateKey);
   }
  }
  if(tokenGeneration===generation){connected=false;status('연결 갱신 중 · 마지막 갱신 '+clock(lastSeen));retry=setTimeout(connect,250);}
 }catch(e){if(tokenGeneration!==generation)return;connected=false;status('재연결 대기 · '+(lastSeen?'마지막 갱신 '+clock(lastSeen):'연결을 확인해 주세요'));retry=setTimeout(connect,errorDelay);errorDelay=Math.min(errorDelay*2,15000);}
 finally{clearTimeout(watchdog);}
}
function sync(){
 if(!root)return;
 paintBoard();
 syncRoutines();
 const c=bridge.context(),identityKey=c.active&&c.identity?c.identity.uid+':'+c.dateKey+':'+dateNow():'',key=identityKey&&!document.hidden&&navigator.onLine?identityKey:'';
 if(key===contextKey&&identityKey===dataContextKey)return;
 stop();contextKey=key;
 if(identityKey!==dataContextKey){
  dataContextKey=identityKey;data=null;renderSignature='';lastSeen='';
  if(dialog.open&&!saving)dialog.close();
  root.querySelectorAll('.mo-scene > :not(.journal-worker-picker):not(.mo-routines)').forEach(node=>node.remove());root.querySelector('.mo-unseated').innerHTML='';root.querySelector('.mo-previous').innerHTML='';
 }
 if(key)connect();else status((navigator.onLine?'연결 일시 중지':'오프라인')+(lastSeen?' · 마지막 갱신 '+clock(lastSeen):' · 연결을 기다립니다.'));
}

function openPerson(key,seat){
 if(!data||!connected)return;const list=people(),person=list.find(p=>p.key===key);
 if(!person){const choices=list.filter(allowed);if(!choices.length)return;show(choices[0],seat,choices);return;}
 show(person,seat);
}
function show(person,preferredSeat,choices,recordDate,editingId){
 const tasks=Object.values(person.tasks||(person.task?{[person.task.id]:person.task}:{}));
 const selectedId=person.task?.id;
 person={...person,task:editingId===null?null:tasks.find(t=>t.id===(editingId||selectedId))};
 const editable=allowed(person),date=recordDate||data.dateKey,isToday=date===dateNow();
 let originalVersion=person.version||0;
 dialog.setAttribute('aria-label','자리와 진행 업무');
 dialog.innerHTML=`<form><header><div><p>${escape(date)} · ${person.offSchedule?'근무표 변경됨':'미니 사무실'}</p><h3>${badge(person.name)}</h3></div><button type="button" data-close aria-label="닫기">✕</button></header><div class="mo-form-body">${choices?.length>1?`<label>배치할 근무자<select data-person>${choices.map(p=>`<option value="${escape(p.key)}" ${p.key===person.key?'selected':''}>${escape(p.name)}</option>`).join('')}</select></label>`:''}${editable&&canManage()&&person.uid!==bridge.context().identity.uid?'<p class="mo-proxy">대리 처리 · 실제 처리자도 함께 기록됩니다.</p>':''}${person.checkedOut?'<p class="mo-help">퇴근으로 자리가 비워졌습니다. 연장 근무를 하려면 본인이 자리를 다시 선택해 주세요.</p>':''}<label>오늘의 자리<select name="seat" ${!editable||!isToday?'disabled':''}><option value="">미배치</option>${seats.map(([id,label])=>{const occupied=people().find(p=>p.seat===id&&p.key!==person.key);return `<option value="${id}" ${id===(preferredSeat||person.seat)?'selected':''} ${occupied?'disabled':''}>${label}${occupied?' · '+escape(occupied.name):''}</option>`;}).join('')}</select></label><label data-classroom-field>강의실 번호·이름<input name="classroom" maxlength="30" placeholder="예: 301호" value="${escape(person.classroom||'')}" ${!editable||!isToday?'disabled':''}></label>${editable&&isToday?'<button type="button" data-action="seat">자리 저장</button>':''}<hr><div class="mo-task-list" aria-label="진행 업무 목록">${tasks.map(t=>`<button type="button" data-task="${escape(t.id)}" aria-pressed="${t.id===person.task?.id}"><span>${escape(t.text)}</span><small>${Number(t.progress)||0}%${t.id===selectedId?' · 말풍선 표시 중':''}</small></button>`).join('')}</div>${editable&&isToday?'<button type="button" data-new-task>＋ 새로운 업무</button>':''}<label>${person.task?'진행 중인 업무':'새로운 업무'}<textarea name="text" maxlength="500" rows="3" placeholder="지금 하고 있는 업무를 알려주세요" ${!editable||!isToday?'readonly':''}>${escape(person.task?.text||'')}</textarea></label>${person.task?`<p class="mo-task-time">시작 ${escape(person.task.startedAt.slice(0,10))} ${clock(person.task.startedAt)} · ${escape(person.task.startedBy)}</p><p class="mo-help">완료하면 수정한 최종 내용과 시작·완료 시각이 해당 업무일의 일지에 기록됩니다.</p>`:'<p class="mo-help">업무 시작을 누르면 선택한 자리와 업무가 함께 저장되어 동료들에게 공유됩니다.</p>'}<label class="mo-progress-editor">진행률 <output>${Number(person.task?.progress)||0}%</output><input name="progress" type="range" min="0" max="100" step="5" value="${Number(person.task?.progress)||0}" ${!editable||!isToday?'disabled':''}></label><p class="mo-icon-preview" aria-live="polite"></p><p class="mo-form-error" role="alert"></p></div><footer><button type="button" data-open-history>업무 히스토리</button>${editable?person.task?`${isToday?'<button type="button" data-action="select">말풍선에 표시</button><button type="button" data-action="edit">내용·진행률 저장</button>':''}<button type="button" data-action="cancel">업무 취소</button><button type="button" class="mo-primary" data-action="complete">✓ 완료하고 일지 기록</button>`:isToday?'<button type="button" class="mo-primary" data-action="start">업무 시작</button>':'':'<span>업무 내용 보기 · 본인과 업무 관리 권한자만 수정할 수 있습니다.</span>'}</footer></form>`;
 const form=dialog.querySelector('form');
 const roomField=form.querySelector('[data-classroom-field]');const toggleRoom=()=>{roomField.hidden=form.elements.seat.value!=='main-classroom';};form.elements.seat.onchange=toggleRoom;toggleRoom();
 form.elements.progress.oninput=()=>form.querySelector('output').textContent=form.elements.progress.value+'%';
 form.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>show(person,preferredSeat,choices,recordDate,b.dataset.task));
 const add=form.querySelector('[data-new-task]');if(add)add.onclick=()=>show(person,preferredSeat,choices,recordDate,null);
 const preview=()=>{const icon=taskIcon(form.elements.text.value);form.querySelector('.mo-icon-preview').textContent=form.elements.text.value.trim()?icon.symbol+' 모니터 아이콘 · '+icon.label:'업무 내용에 맞는 아이콘이 모니터에 표시됩니다.';};form.elements.text.addEventListener('input',preview);preview();form.onsubmit=e=>e.preventDefault();dialog.querySelector('[data-close]').onclick=()=>dialog.close();
 dialog.querySelector('[data-open-history]').onclick=()=>showHistory(person,date);
 const picker=dialog.querySelector('[data-person]');if(picker)picker.onchange=()=>show(listPerson(picker.value),preferredSeat,choices);
 let pending=null;
 form.onclick=async e=>{const b=e.target.closest('[data-action]');if(!b||saving)return;
  const action=b.dataset.action;
  if(action==='cancel'&&!b.dataset.confirmed){b.dataset.confirmed='yes';b.textContent='일지 없이 취소 확인';return;}
  const payload={dateKey:date,workerKey:person.key,version:originalVersion,action,seat:form.elements.seat.value,text:form.elements.text.value,progress:Number(form.elements.progress.value),classroom:form.elements.classroom.value,...(person.task?{taskId:person.task.id}:{})};
  const signature=JSON.stringify(payload);if(!pending||pending.signature!==signature)pending={signature,id:crypto.randomUUID()};payload.operationId=pending.id;
  if(!connected){form.querySelector('.mo-form-error').textContent='연결을 복구한 뒤 다시 시도해 주세요.';return;}
  saving=true;dialog.oncancel=e=>e.preventDefault();form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
  try{await api(payload);if(action==='seat'){originalVersion++;pending=null;form.querySelector('.mo-form-error').textContent='';form.querySelector('.mo-help').textContent='자리를 저장했습니다. 작성 중인 업무를 이어서 저장하세요.';}else dialog.close();bridge.refreshJournal(date);root.querySelector('.mo-notice').textContent=action==='complete'?'완료했습니다. 일일 업무일지에 기록했습니다.':action==='cancel'?'업무를 취소했습니다. 일지에는 기록하지 않았습니다.':'저장했습니다.';}
  catch(err){form.querySelector('.mo-form-error').textContent=err.message;}
  finally{saving=false;dialog.oncancel=null;form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);if(!editable||!isToday)form.elements.seat.disabled=true;}
 };
 if(!dialog.open)dialog.showModal();
}
let historyRequest=0;
function showHistory(person,recordDate){
 const labels={progress:'진행률 변경',select:'말풍선 업무 선택',start:'업무 시작',edit:'내용 수정',complete:'완료 · 일지 기록',cancel:'업무 취소'};
 let date=recordDate||data.dateKey,cursor='',rows=[];
 dialog.setAttribute('aria-label','업무 히스토리');
 dialog.innerHTML=`<header><div><p>업무 히스토리</p><h3>${badge(person.name)}</h3></div><button type="button" data-close aria-label="닫기">✕</button></header><div class="mo-form-body mo-history-body"><div class="mo-history-tools"><label>조회 날짜<input type="date" value="${escape(date)}" aria-label="업무 히스토리 날짜"></label><button type="button" data-reload>새로고침</button></div><p class="mo-history-message" role="status"></p><div class="mo-history-list"></div><button type="button" data-more hidden>이전 기록 더 보기</button></div><footer><button type="button" class="mo-primary" data-current>현재 자리·업무 ${allowed(person)?'관리':'보기'}</button>${allowed(person)&&data.dateKey===dateNow()?'<form class="mo-history-quick"><input name="quickTask" aria-label="새로운 업무 바로 입력" maxlength="500" placeholder="새로운 업무 입력" required><button type="submit">업무 추가</button><span role="status"></span></form>':''}</footer>`;
 const container=dialog.querySelector('.mo-history-list'),message=dialog.querySelector('.mo-history-message'),more=dialog.querySelector('[data-more]');
 async function load(append=false){
  const ticket=++historyRequest,account=bridge.context().identity?.uid;
  if(!append){cursor='';rows=[];container.innerHTML='';}more.hidden=true;message.textContent='업무 기록을 불러오고 있습니다…';
  try{
   const response=await bridge.history({dateKey:date,workerKey:person.key,before:cursor});
   if(ticket!==historyRequest||!dialog.open||!container.isConnected||bridge.context().identity?.uid!==account)return;
   if(!response?.success)throw Error(response?.message||'기록을 불러오지 못했습니다.');
   rows=append?rows.concat(response.events):response.events;cursor=response.nextCursor;
   message.textContent=`${date} · 기록 ${response.total}건`;more.hidden=!cursor;
   container.innerHTML=rows.length?rows.map(e=>`<article class="mo-history-event ${e.action}"><div class="mo-history-meta"><span>${labels[e.action]||'업무 변경'}</span><time>${clock(e.at)}</time></div><p>${escape(e.after||e.before||'내용 없음')}</p>${e.progress!==null&&e.progress!==undefined?`<p class="mo-task-time">진행률 ${Number(e.progress)}%</p>`:''}${(e.action==='edit'||(e.action==='complete'&&e.after&&e.before!==e.after))?`<details><summary>수정 전 내용</summary><p>${escape(e.before)}</p></details>`:''}<small>처리 ${badge(e.by)}</small></article>`).join(''):'<div class="mo-history-empty">이 날짜에 기록된 업무가 없습니다.<br><small>다른 날짜를 선택해 이전 업무를 확인하세요.</small></div>';
  }catch(e){if(ticket===historyRequest&&container.isConnected){message.textContent=e.message+' 새로고침으로 다시 시도해 주세요.';more.hidden=!cursor;}}
 }
 dialog.querySelector('[data-close]').onclick=()=>{historyRequest++;dialog.close();};
 dialog.querySelector('[data-current]').onclick=()=>{historyRequest++;const latest=listPerson(person.key);if(latest)show(latest);};
 dialog.querySelector('input').onchange=e=>{if(e.target.value){date=e.target.value;load();}};
 const quick=dialog.querySelector('.mo-history-quick');
 if(quick){let pending=null;quick.onsubmit=async e=>{e.preventDefault();if(saving)return;const latest=listPerson(person.key),text=quick.elements.quickTask.value.trim();if(!text)return;
 const payload={dateKey:data.dateKey,workerKey:person.key,version:latest?.version||0,action:'start',text};
 const signature=JSON.stringify(payload);if(!pending||pending.signature!==signature)pending={signature,id:crypto.randomUUID()};
 saving=true;quick.querySelector('button').disabled=true;
 try{if(!connected)throw Error('연결을 확인한 뒤 다시 시도해 주세요.');await api({...payload,operationId:pending.id});pending=null;quick.reset();quick.querySelector('[role=status]').textContent='업무를 추가했습니다.';if(date===data.dateKey)await load();}
 catch(err){quick.querySelector('[role=status]').textContent=err.message;}finally{saving=false;quick.querySelector('button').disabled=false;}};}
 dialog.querySelector('[data-reload]').onclick=()=>load();more.onclick=()=>load(true);
 if(!dialog.open)dialog.showModal();load();
}
function showProgress(person){
 if(!allowed(person)||!person.task||data.dateKey!==dateNow())return;
 const task=person.task,date=data.dateKey,version=person.version||0;
 dialog.setAttribute('aria-label','업무 진행률 조절');
 dialog.innerHTML=`<form><header><h3>업무 진행률</h3><button type="button" data-close aria-label="닫기">✕</button></header><div class="mo-form-body"><p>${escape(task.text)}</p><label class="mo-progress-editor">진행률 <output>${Number(task.progress)||0}%</output><input name="progress" aria-label="업무 진행률" type="range" min="0" max="100" step="1" value="${Number(task.progress)||0}"></label><div class="mo-progress-presets">${[0,25,50,75,100].map(n=>`<button type="button" data-percent="${n}">${n}%</button>`).join('')}</div><p class="mo-form-error" role="alert"></p></div><footer><button class="mo-primary" type="submit">진행률 저장</button></footer></form>`;
 const form=dialog.querySelector('form'),input=form.elements.progress;let pending=null;
 input.oninput=()=>form.querySelector('output').textContent=input.value+'%';
 form.querySelectorAll('[data-percent]').forEach(b=>b.onclick=()=>{input.value=b.dataset.percent;input.oninput();});
 form.querySelector('[data-close]').onclick=()=>dialog.close();
 form.onsubmit=async e=>{e.preventDefault();if(saving)return;const progress=Number(input.value);if(!pending||pending.progress!==progress)pending={progress,id:crypto.randomUUID()};saving=true;form.querySelectorAll('button,input').forEach(el=>el.disabled=true);dialog.oncancel=e=>e.preventDefault();
 try{if(!connected)throw Error('연결을 확인한 뒤 다시 시도해 주세요.');await api({dateKey:date,workerKey:person.key,version,action:'progress',taskId:task.id,progress,operationId:pending.id});dialog.close();}
 catch(err){form.querySelector('.mo-form-error').textContent=err.message;}finally{saving=false;dialog.oncancel=null;form.querySelectorAll('button,input').forEach(el=>el.disabled=false);}};
 if(!dialog.open)dialog.showModal();input.focus();
}
let suppressClickUntil=0;
function installDrag(){
 root.addEventListener('pointerdown',e=>{
  const button=e.target.closest('[data-drag-worker]');if(!button||button.disabled||!connected||saving||e.button!==0)return;
  const person=listPerson(button.dataset.dragWorker);if(!person||!allowed(person))return;
  drag={person:{...person},x:e.clientX,y:e.clientY,pointer:e.pointerId,button,moved:false,target:null};root.setPointerCapture(e.pointerId);
 });
 root.addEventListener('pointermove',e=>{
  if(!drag||drag.pointer!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<6)return;
  drag.moved=true;drag.button.classList.add('is-dragging');drag.button.style.transform=`translate(${dx}px,${dy}px)`;
  root.querySelectorAll('.mo-drop-target').forEach(el=>el.classList.remove('mo-drop-target'));
  drag.target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-seat-id]');
  if(drag.target&&root.contains(drag.target))drag.target.classList.add('mo-drop-target');else drag.target=null;
 });
 async function finish(e,cancel=false){
  if(!drag||drag.pointer!==e.pointerId)return;const current=drag;drag=null;
  if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);
  current.button.style.transform='';current.button.classList.remove('is-dragging');root.querySelectorAll('.mo-drop-target').forEach(el=>el.classList.remove('mo-drop-target'));
  if(!current.moved){paint();if(!cancel)openPerson(current.person.key);suppressClickUntil=Date.now()+400;return;}
  suppressClickUntil=Date.now()+400;
  const seat=current.target?.dataset.seatId;if(cancel||!seat||seat===current.person.seat){paint();return;}
  const other=people().find(p=>p.seat===seat&&p.key!==current.person.key);
  if(other&&!allowed(other)){root.querySelector('.mo-notice').textContent='다른 근무자와의 자리 교환은 관리 권한이 필요합니다.';paint();return;}
  saving=true;
  try{if(!connected)throw Error('연결을 확인한 뒤 다시 시도해 주세요.');await api({dateKey:data.dateKey,workerKey:current.person.key,version:current.person.version||0,action:'move',seat,targetKey:other?.key||'',targetVersion:other?.version||0,operationId:crypto.randomUUID()});root.querySelector('.mo-notice').textContent=other?'두 근무자의 자리를 바꿨습니다.':'자리를 옮겼습니다.';}
  catch(err){root.querySelector('.mo-notice').textContent=err.message;}finally{saving=false;paint();}
 }
 root.addEventListener('pointerup',e=>finish(e));root.addEventListener('pointercancel',e=>finish(e,true));
}
function listPerson(key){return people().find(p=>p.key===key);}
function init(b){bridge=b;root=document.getElementById('deskMiniOffice');if(!root)return;root.className='mini-office';root.innerHTML=`<div class="mo-head-tools"><span class="mo-sync" role="status"></span><button data-my>내 자리·업무</button><button data-collapse aria-expanded="true">접기</button></div><div class="mo-content"><section class="mo-board" aria-label="전체 관 공용 칠판"></section><nav class="mo-room-tabs" aria-label="사무실 선택">${[['main','본관'],['annex-2','2관'],['annex-3','3관']].map(([id,label])=>`<button data-room-tab="${id}" aria-pressed="${id===currentRoom}">${label}</button>`).join('')}</nav><div class="mo-scene"></div><div class="mo-unseated"></div><div class="mo-previous"></div><p class="mo-date-note"></p></div><p class="mo-notice" role="status"></p>`;
 routinePanel=document.createElement('section');routinePanel.className='mo-routines';routinePanel.setAttribute('aria-label','오늘 루틴 현황');root.querySelector('.mo-scene').append(routinePanel);
 toolbar=root.querySelector('.mo-head-tools');const nav=document.querySelector('.desk-journal-date-nav');if(nav)nav.before(toolbar);
 const picker=document.querySelector('.journal-worker-picker');if(picker){root.querySelector('.mo-scene').append(picker);const old=document.querySelector('.journal-context-grid');if(old)old.style.display='none';}
 routineStatusDialog=document.createElement('dialog');routineStatusDialog.className='mo-dialog mo-routine-state-dialog';document.body.append(routineStatusDialog);
 dialog=document.createElement('dialog');dialog.className='mo-dialog';dialog.setAttribute('aria-label','자리와 진행 업무');document.body.append(dialog);
 const handleClick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.routineStatus){showRoutineStatus(b.dataset.routineStatus,b.dataset.routineWorker);return;}if(b.hasAttribute('data-routine-clear')){if(!routineAssigning){routineSelected.clear();routineMessage='';renderRoutines();}return;}if(b.dataset.routineMe){if(!routineAssigning){routineMessage='';if(b.dataset.routineMe==='responsible')routineResponsible=bridge.context().identity.uid;else routineAssistant=bridge.context().identity.uid;renderRoutines();}return;}if(b.hasAttribute('data-routine-open')){bridge.openRoutines?.();return;}if(b.hasAttribute('data-routine-refresh')){routineFetchedAt=0;syncRoutines(true);return;}if(b.dataset.noticeAck){b.disabled=true;Promise.resolve(bridge.acknowledge?.(b.dataset.noticeAck)).then(r=>{if(!r?.success)alert('읽음 기록을 저장하지 못했습니다. 다시 시도해 주세요.');}).catch(()=>alert('읽음 기록을 저장하지 못했습니다. 다시 시도해 주세요.')).finally(()=>{noticeSignature='';paintBoard();});return;}if(b.dataset.progress){const p=listPerson(b.dataset.progress);if(p)showProgress(p);return;}if(b.dataset.dragWorker){if(Date.now()<suppressClickUntil)return;openPerson(b.dataset.dragWorker);return;}if(b.hasAttribute('data-collapse')){collapsed=!collapsed;const picker=root.querySelector('.journal-worker-picker');if(picker){if(collapsed)root.querySelector('.mo-content').before(picker);else root.querySelector('.mo-scene').append(picker);}root.querySelector('.mo-content').hidden=collapsed;b.textContent=collapsed?'펼치기':'접기';b.setAttribute('aria-expanded',String(!collapsed));return;}if(b.dataset.roomTab){currentRoom=b.dataset.roomTab;root.querySelectorAll('[data-room-tab]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));paint();return;}if(b.dataset.previous){const p=data.previousPending.find(p=>p.key===b.dataset.previous);if(p)show(p,null,null,data.previousDate);return;}if(b.dataset.history){const p=listPerson(b.dataset.history);if(p)showHistory(p);return;}if(b.hasAttribute('data-my')){const p=people().find(p=>p.uid===bridge.context().identity.uid)||people().find(allowed);if(p)openPerson(p.key);return;}if(b.hasAttribute('data-worker'))openPerson(b.dataset.worker,b.dataset.seat);};
 routinePanel.addEventListener('change',routineChange);routinePanel.addEventListener('submit',e=>{if(e.target.matches('.mo-routine-assign-form')){e.preventDefault();assignRoutineSelection();}});
 root.onclick=handleClick;toolbar.onclick=e=>{e.stopPropagation();handleClick(e);};installDrag();
 document.addEventListener('visibilitychange',sync);window.addEventListener('offline',sync);window.addEventListener('online',sync);timer=setInterval(()=>{sync();const minute=Math.floor((Date.now()+serverOffset)/60000);if(minute!==lastShiftMinute){lastShiftMinute=minute;root.querySelectorAll('[data-shift-worker]').forEach(el=>{const p=listPerson(el.dataset.shiftWorker);if(p)el.innerHTML=shiftMarkup(p);});}},1000);sync();
}
window.DeskMiniOffice={init,sync};
})();
