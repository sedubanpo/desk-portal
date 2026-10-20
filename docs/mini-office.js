(function(){
'use strict';
const seats=[['main-1','본관 1번'],['main-2','본관 2번'],['main-3','본관 3번'],['main-director','본관 원장실'],['main-classroom','본관 강의실'],['annex-2','2관'],['annex-3','3관']];
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=v=>v?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'';
const dateNow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
let root,bridge,data,contextKey='',dataContextKey='',controller,retry,timer,dialog,generation=0,lastSeen='',connected=false,collapsed=false,currentRoom='main',errorDelay=1000,saving=false;
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
function people(){const map=new Map((data?.people||[]).map(p=>[p.key,{...p,...data.workers[p.key]}]));for(const [key,w]of Object.entries(data?.workers||{}))if(!map.has(key))map.set(key,{...w,key,offSchedule:true});return [...map.values()];}
function canManage(){const identity=bridge.context().identity;return identity?.role==='ADMIN'||(data?.managementUids||[]).includes(identity?.uid);}
function allowed(p){return canManage()||bridge.context().identity?.uid===p.uid;}
function taskIcon(text=''){
 const types=[[/상담|학부모|전화|연락|응대/,'☎','상담·연락'],[/수납|수강료|결제|정산|급여|환불/,'₩','수납·정산'],[/시간표|스케줄|일정|배정/,'▦','시간표·일정'],[/출결|출석|등원|하원/,'✓','출결 확인'],[/청소|정리|점검|교재|물품/,'✦','환경·물품'],[/수업|강의|지도|학습|보강/,'▤','수업·학습'],[/블로그|홍보|게시|작성|보고/,'✎','작성·홍보']];
 const match=types.find(([pattern])=>pattern.test(text));return match?{symbol:match[1],label:match[2]}:{symbol:'▤',label:'일반 업무'};
}
function monitor(task){const icon=taskIcon(task?.text);return task?`<span class="mo-task-icon" title="${icon.label}" data-task-icon="${icon.label}">${icon.symbol}</span>`:'<b></b><b></b><b></b>';}
function seatMarkup(id){
 const p=people().find(w=>w.seat===id),task=p?.task;
 return `<div class="mo-seat ${p?(task?'working':'occupied'):'empty'}"><button class="mo-bubble" ${p?`data-history="${escape(p.key)}" aria-label="${escape(p.name)} 업무 히스토리 보기"`:'data-worker=""'} data-seat="${id}" ${!p?'aria-label="'+seats.find(s=>s[0]===id)[1]+' 자리 선택"':''}>${p?`<span>${task?'진행 중 · '+clock(task.startedAt):p.lastCompletedAt?'완료 · '+clock(p.lastCompletedAt):'업무 대기'}</span><strong>${escape(task?.text||'다음 업무를 준비하고 있어요')}</strong>${task?`<span class="mo-progress" role="progressbar" aria-label="업무 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(task.progress)||0}"><i style="width:${Number(task.progress)||0}%"></i></span><span class="mo-progress-caption">${Number(task.progress)||0}% · ${Object.keys(p.tasks||{[task.id]:task}).length}개 업무</span>`:''}<em>업무 히스토리 ↗</em>`:'<span>빈자리</span><strong>이 자리에 앉기 ＋</strong>'}</button><div class="mo-furniture" aria-hidden="true"><div class="mo-monitor">${monitor(task)}</div><div class="mo-mug"></div><div class="mo-desk"></div>${p?character(p.name):'<div class="mo-chair"></div>'}</div><button class="mo-name" data-worker="${escape(p?.key||'')}" data-seat="${id}">${p?badge(p.name):'<span>'+seats.find(s=>s[0]===id)[1]+'</span>'}${p?.offSchedule?'<small>근무표 변경됨</small>':''}</button>${p&&allowed(p)?`<button class="mo-seat-manage" data-worker="${escape(p.key)}">＋ 업무 관리</button>`:''}</div>`;
}
let classroomOpen=false;
let noticeSignature='';
function paintBoard(){
 const board=root.querySelector('.mo-board'),items=bridge.context().active?(bridge.notices?.()||[]):[];
 const signature=JSON.stringify(items);if(signature===noticeSignature&&board.children.length)return;noticeSignature=signature;
 const opened=new Set([...board.querySelectorAll('details[open]')].map(el=>el.dataset.notice));
 board.innerHTML=`<header><div><span>본관 · 2관 · 3관 함께 확인</span><h4>우리의 공용 칠판</h4></div><span class="mo-board-count">전체 공지 ${items.length}건</span></header><div class="mo-board-notices">${items.length?items.map((item,i)=>`<details data-notice="${escape(item.id)}" ${opened.has(String(item.id))?'open':''}><summary><span class="mo-board-number">${String(i+1).padStart(2,'0')}</span><strong>${escape(item.text)}</strong><span class="mo-board-expand" aria-hidden="true">＋</span></summary><div class="mo-board-detail"><p>${escape(item.note||'별도 상세 내용이 없습니다.')}</p><small>기록 ${badge(item.author)}${item.updatedAt?`<time>${escape(String(item.updatedAt).slice(0,10))}</time>`:''}</small></div></details>`).join(''):'<p class="mo-board-empty">등록된 전체 공지사항이 없습니다.</p>'}</div><div class="mo-board-ledge" aria-hidden="true"><i></i><b></b></div>`;
}
function paint(){if(!data)return;
 const list=people();
 const picker=document.querySelector('.journal-worker-picker'),focused=picker?.contains(document.activeElement)?document.activeElement:null;
 if(picker)picker.remove();
 root.querySelector('.mo-scene').innerHTML=`<div class="mo-room mo-main ${currentRoom==='main'?'mobile-active':''}" data-room="main"><div class="mo-wall"><span class="mo-window"></span><h4>본관 <small>함께 일하는 데스크</small></h4><span class="mo-plant" aria-hidden="true">♣</span></div><div class="mo-desks">${seats.slice(0,3).map(s=>seatMarkup(s[0])).join('')}</div><div class="mo-side-rooms"><section class="mo-classroom ${classroomOpen?'':'is-collapsed'}" aria-label="본관 강의실 1석"><button class="mo-classroom-toggle" data-classroom-toggle aria-expanded="${classroomOpen}">강의실 <small>${escape(list.find(p=>p.seat==='main-classroom')?.classroom||'필요할 때 펼치기')}</small><span>${classroomOpen?'−':'＋'}</span></button><div ${classroomOpen?'':'hidden'}>${seatMarkup('main-classroom')}</div></section><section class="mo-director" aria-label="본관 원장실 1석"><h5>원장실 <small>1석</small></h5>${seatMarkup('main-director')}</section></div></div>${[2,3].map(n=>`<div class="mo-room ${currentRoom==='annex-'+n?'mobile-active':''}" data-room="annex-${n}"><div class="mo-wall"><h4>${n}관 <small>작은 사무실</small></h4><span class="mo-window"></span></div><div class="mo-desks">${seatMarkup('annex-'+n)}</div></div>`).join('')}`;
 if(picker){if(collapsed)root.querySelector('.mo-content').before(picker);else root.querySelector('.mo-scene').append(picker);if(focused)focused.focus({preventScroll:true});}
 root.querySelector('.mo-unseated').innerHTML=`<span>미배치 근무자</span>${list.filter(p=>!p.seat).map(p=>`<button data-worker="${escape(p.key)}">${character(p.name)}${badge(p.name)}<small>${p.task?'업무 진행 중':p.offSchedule?'근무표 변경됨':'자리 선택 전'}</small></button>`).join('')||'<small>모든 근무자가 자리를 선택했습니다.</small>'}`;
 root.querySelector('.mo-previous').innerHTML=(data.previousPending||[]).length?'<span>전날 마치지 않은 업무</span>'+data.previousPending.map(p=>`<button data-previous="${escape(p.key)}">${badge(p.name)} · ${escape(p.task.text)}</button>`).join(''):'';
 root.querySelector('.mo-sub').textContent=`${data.dateKey} · 근무자 ${data.people.length}명 · 진행 중 ${list.filter(p=>p.task).length}명`;
 root.querySelector('.mo-date-note').textContent=data.dateKey===dateNow()?'퇴근 기록이 있으면 자리가 비워집니다. 연장 근무는 내 자리·업무에서 다시 선택해 주세요.':'이전 날짜의 기록입니다. 미완료 업무는 상세 화면에서 종료할 수 있습니다.';
 root.querySelector('[data-my]').disabled=!list.some(allowed);
 if(!list.length)root.querySelector('.mo-unseated').innerHTML='<span>오늘의 근무자가 없습니다.</span><small>월별 근무표에 등록된 활성 근무자가 표시됩니다.</small>';
}
function status(text){root.querySelector('.mo-sync').textContent=text;root.dataset.connected=String(connected);}
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
    const changed=data?.updatedAt!==next.updatedAt;data=next;lastSeen=new Date().toISOString();connected=true;errorDelay=1000;paint();status('실시간 연결 · '+clock(lastSeen));if(changed)bridge.refreshJournal(next.dateKey);
   }
  }
  if(tokenGeneration===generation){connected=false;status('연결 갱신 중 · 마지막 갱신 '+clock(lastSeen));retry=setTimeout(connect,250);}
 }catch(e){if(tokenGeneration!==generation)return;connected=false;status('재연결 대기 · '+(lastSeen?'마지막 갱신 '+clock(lastSeen):'연결을 확인해 주세요'));retry=setTimeout(connect,errorDelay);errorDelay=Math.min(errorDelay*2,15000);}
 finally{clearTimeout(watchdog);}
}
function sync(){
 if(!root)return;
 paintBoard();
 const c=bridge.context(),identityKey=c.active&&c.identity?c.identity.uid+':'+c.dateKey+':'+dateNow():'',key=identityKey&&!document.hidden&&navigator.onLine?identityKey:'';
 if(key===contextKey&&identityKey===dataContextKey)return;
 stop();contextKey=key;
 if(identityKey!==dataContextKey){
  dataContextKey=identityKey;data=null;lastSeen='';
  if(dialog.open&&!saving)dialog.close();
  root.querySelectorAll('.mo-scene > :not(.journal-worker-picker)').forEach(node=>node.remove());root.querySelector('.mo-unseated').innerHTML='';root.querySelector('.mo-previous').innerHTML='';
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
 const labels={select:'말풍선 업무 선택',start:'업무 시작',edit:'내용 수정',complete:'완료 · 일지 기록',cancel:'업무 취소'};
 let date=recordDate||data.dateKey,cursor='',rows=[];
 dialog.setAttribute('aria-label','업무 히스토리');
 dialog.innerHTML=`<header><div><p>업무 히스토리</p><h3>${badge(person.name)}</h3></div><button type="button" data-close aria-label="닫기">✕</button></header><div class="mo-form-body mo-history-body"><div class="mo-history-tools"><label>조회 날짜<input type="date" value="${escape(date)}" aria-label="업무 히스토리 날짜"></label><button type="button" data-reload>새로고침</button></div><p class="mo-history-message" role="status"></p><div class="mo-history-list"></div><button type="button" data-more hidden>이전 기록 더 보기</button></div><footer><button type="button" class="mo-primary" data-current>현재 자리·업무 ${allowed(person)?'관리':'보기'}</button></footer>`;
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
 dialog.querySelector('[data-reload]').onclick=()=>load();more.onclick=()=>load(true);
 if(!dialog.open)dialog.showModal();load();
}
function listPerson(key){return people().find(p=>p.key===key);}
function init(b){bridge=b;root=document.getElementById('deskMiniOffice');if(!root)return;root.className='mini-office';root.innerHTML=`<header class="mo-head"><div><div class="mo-eyebrow">OUR LITTLE OFFICE</div><h3>오늘의 사무실</h3><p class="mo-sub">근무자와 업무를 연결합니다.</p></div><div class="mo-head-tools"><span class="mo-sync" role="status"></span><button data-my>내 자리·업무</button><button data-collapse aria-expanded="true">접기</button></div></header><div class="mo-content"><section class="mo-board" aria-label="전체 관 공용 칠판"></section><nav class="mo-room-tabs" aria-label="사무실 선택">${[['main','본관'],['annex-2','2관'],['annex-3','3관']].map(([id,label])=>`<button data-room-tab="${id}" aria-pressed="${id===currentRoom}">${label}</button>`).join('')}</nav><div class="mo-scene"></div><div class="mo-unseated"></div><div class="mo-previous"></div><p class="mo-date-note"></p></div><p class="mo-notice" role="status"></p>`;
 const picker=document.querySelector('.journal-worker-picker');if(picker){root.querySelector('.mo-scene').append(picker);const old=document.querySelector('.journal-context-grid');if(old)old.style.display='none';}
 dialog=document.createElement('dialog');dialog.className='mo-dialog';dialog.setAttribute('aria-label','자리와 진행 업무');document.body.append(dialog);
 root.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-classroom-toggle')){classroomOpen=!classroomOpen;paint();root.querySelector('[data-classroom-toggle]').focus();return;}if(b.hasAttribute('data-collapse')){collapsed=!collapsed;const picker=root.querySelector('.journal-worker-picker');if(picker){if(collapsed)root.querySelector('.mo-content').before(picker);else root.querySelector('.mo-scene').append(picker);}root.querySelector('.mo-content').hidden=collapsed;b.textContent=collapsed?'펼치기':'접기';b.setAttribute('aria-expanded',String(!collapsed));return;}if(b.dataset.roomTab){currentRoom=b.dataset.roomTab;root.querySelectorAll('[data-room-tab]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));paint();return;}if(b.dataset.previous){const p=data.previousPending.find(p=>p.key===b.dataset.previous);if(p)show(p,null,null,data.previousDate);return;}if(b.dataset.history){const p=listPerson(b.dataset.history);if(p)showHistory(p);return;}if(b.hasAttribute('data-my')){const p=people().find(p=>p.uid===bridge.context().identity.uid)||people().find(allowed);if(p)openPerson(p.key);return;}if(b.hasAttribute('data-worker'))openPerson(b.dataset.worker,b.dataset.seat);};
 document.addEventListener('visibilitychange',sync);window.addEventListener('offline',sync);window.addEventListener('online',sync);timer=setInterval(sync,1000);sync();
}
window.DeskMiniOffice={init,sync};
})();
