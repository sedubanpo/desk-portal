/* Payroll work-time editor. Part-time compensation is ephemeral and never sent to APIs. */
(function(){
  'use strict';
  const host=document.getElementById('moduleTeacher');if(!host)return;
  const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>Math.round(n).toLocaleString('ko-KR')+'원',hours=n=>`${Math.floor(n/60)}시간 ${n%60}분`;
  let staff=null,summary=null,request=0,dirty=false,busy=false;
  const actions=host.querySelector('.payroll-page-actions');
  actions.insertAdjacentHTML('beforeend','<button type="button" class="ps-review" id="payrollReviewBtn" disabled>확인 대상 조회 중</button><button type="button" class="payroll-analysis-btn" id="payrollFinalizeBtn">정산 확정·저장</button><button type="button" class="payroll-analysis-btn" id="payrollHistoryBtn">확정 기록</button>');
  const field=document.createElement('div');field.className='field ps-worker';field.innerHTML='<label for="payrollStaffSelect">실무자 · 사무보조(파트타임)</label><select id="payrollStaffSelect"><option value="">실무자 선택</option></select>';
  $('teacherSelect').closest('.field').after(field);
  const panel=document.createElement('section');panel.id='staffPayrollPanel';panel.hidden=true;host.querySelector('.payroll-filterbar').after(panel);
  const dialog=document.createElement('dialog');dialog.className='ps-dialog';dialog.innerHTML='<div class="ps-dialog-head"><h2 id="psDialogTitle"></h2><button type="button" aria-label="닫기">닫기</button></div><div id="psDialogBody"></div>';dialog.setAttribute('aria-labelledby','psDialogTitle');document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();
  function show(title,html){$('psDialogTitle').textContent=title;$('psDialogBody').innerHTML=html;if(!dialog.open)dialog.showModal();}
  async function api(method,payload){const r=await runServer(method,payload);if(!r?.success)throw Error(r?.message||'요청을 처리하지 못했습니다.');return r;}
  const month=()=>summary?.selectedMonth||state.selectedMonth||$('monthSelect').value;
  const payload=()=>({monthName:month(),workerName:$('payrollStaffSelect').value});
  const admin=()=>state.cloudIdentity?.role==='ADMIN';
  const id=()=>window.crypto.randomUUID();
  function message(text){const el=$('psMessage');if(el)el.textContent=text;}
  function wipe(){const wage=$('psWage');if(wage)wage.value='';const pay=$('psPay');if(pay)pay.textContent='시급 입력 후 계산';}
  window.addEventListener('pagehide',wipe);
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  document.addEventListener('payroll-locked',()=>{request++;wipe();staff=null;summary=null;dirty=false;panel.replaceChildren();if(dialog.open)dialog.close();});
  function leave(){if(busy)return false;if(dirty&&!confirm('저장하지 않은 근무시간 변경을 버릴까요?'))return false;dirty=false;wipe();return true;}
  function staffMode(enabled){host.classList.toggle('staff-payroll-active',enabled);panel.hidden=!enabled;$('payrollFinalizeBtn').disabled=enabled||!admin();$('payrollHistoryBtn').disabled=enabled;}
  function draftRows(){return [...panel.querySelectorAll('tr[data-date]')].map(tr=>({date:tr.dataset.date,start:tr.querySelector('[data-start]').value,end:tr.querySelector('[data-end]').value,breakMinutes:Number(tr.querySelector('[data-break]').value)}));}
  function compute(){
    let total=0,invalid=false;for(const row of draftRows()){const parts=t=>/^\d{2}:\d{2}$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;const a=parts(row.start),b=parts(row.end),rest=row.breakMinutes;const valid=Number.isFinite(a)&&Number.isFinite(b)&&b>a&&Number.isInteger(rest)&&rest>=0&&rest<=b-a;const unresolved=staff?.rows.find(r=>r.date===row.date)?.issue;const paid=valid&&(!unresolved||dirty)?b-a-rest:null;const td=panel.querySelector(`tr[data-date="${row.date}"] [data-paid]`);if(td)td.textContent=paid===null?'확인 필요':hours(paid);total+=paid||0;if(paid===null)invalid=true;}
    $('psHours').textContent=invalid?'시간 입력 확인 필요':hours(total);
    const wage=Number($('psWage').value);$('psPay').textContent=!invalid&&$('psWage').value!==''&&Number.isFinite(wage)&&wage>=0?money(total/60*wage):'시급 입력 후 계산';
    $('psSave').disabled=busy||!staff?.canEdit||invalid||!staff.rows.length;$('psConfirm').disabled=busy||!staff?.canEdit||dirty||staff?.unresolved>0||!staff?.rows.length;
  }
  function renderStaff(){
    const s=staff;panel.innerHTML=`<div class="ps-staff-head"><div><span class="ps-eyebrow">사무보조 · 파트타임</span><h2>${esc(s.workerName)} <small>${esc(s.month)}</small></h2><p>등록 근무표와 출퇴근 기록 기준 · 휴게시간을 제외한 시간을 계산합니다.</p></div><button type="button" id="psBack">강사 정산으로</button></div><div class="ps-stats"><div><span>총 근무시간</span><strong id="psHours">${hours(s.totalMinutes)}</strong><small>${s.rows.length}일 · ${s.unresolved}일 확인 필요</small></div><div><label for="psWage">계산용 시급</label><div class="ps-wage"><input id="psWage" type="number" min="0" step="1" autocomplete="off" placeholder="시급 입력"><span>원 / 시간</span></div><small>시급과 지급액은 저장하지 않습니다.</small></div><div><span>계산 지급액</span><strong id="psPay">시급 입력 후 계산</strong><small>화면을 닫거나 근무자를 바꾸면 초기화됩니다.</small></div></div><p class="ps-guidance">휴게시간 기본 30분 · 14:00–22:30 → 8시간. 자정을 넘는 근무는 일자를 나눠 근무표에 등록해 주세요. ‘등록 근무표’는 예정 시간입니다. 실제 시간과 대조한 뒤 확정해 주세요.</p><div class="ps-table-wrap"><table><thead><tr><th>근무일</th><th>기록 기준</th><th>출근</th><th>퇴근</th><th>휴게(분)</th><th>인정 시간</th></tr></thead><tbody>${s.rows.map(r=>`<tr data-date="${esc(r.date)}"><th>${esc(r.date.slice(5))}${r.issue?'<small class="ps-error">'+esc(r.issue)+'</small>':''}</th><td>${esc(r.source)}</td><td><input aria-label="${esc(r.date)} 출근" type="time" data-start value="${esc(r.start)}" ${s.canEdit?'':'disabled'}></td><td><input aria-label="${esc(r.date)} 퇴근" type="time" data-end value="${esc(r.end)}" ${s.canEdit?'':'disabled'}></td><td><input aria-label="${esc(r.date)} 휴게시간 분" type="number" min="0" max="1440" step="1" data-break value="${r.breakMinutes}" ${s.canEdit?'':'disabled'}></td><td data-paid>${r.paidMinutes===null?'확인 필요':hours(r.paidMinutes)}</td></tr>`).join('')||'<tr><td colspan="6">이 달에 등록된 근무시간이 없습니다. 월별 근무표에 먼저 등록해 주세요.</td></tr>'}</tbody></table></div><div class="ps-toolbar"><label for="psReason">실제 근무시간 확인·수정 사유<input id="psReason" maxlength="300" placeholder="예: 9월 출퇴근 기록 대조 완료" ${s.canEdit?'':'disabled'}></label><button id="psSave" type="button">근무시간 저장</button><button id="psConfirm" type="button">근무시간 정산 확정</button><button id="psPrint" type="button">출력</button></div><p id="psMessage" role="status">${s.canEdit?'근무시간 확정본에는 시급·지급액이 포함되지 않습니다.':'관리자만 실제 근무시간을 수정하고 확정할 수 있습니다.'}</p><details class="ps-history"><summary>서버에 저장된 확정 기록 ${s.finalizations.length}건</summary>${s.finalizations.map((f,i)=>`<button type="button" data-snapshot="${i}">${esc(new Date(f.createdAt).toLocaleString('ko-KR'))} · ${hours(f.totalMinutes)} · ${esc(f.actor?.name||'관리자')}</button>`).join('')||'<p>확정 기록이 없습니다.</p>'}</details>`;
    $('psBack').onclick=()=>{if(!leave())return;$('payrollStaffSelect').value='';staffMode(false);};
    panel.querySelectorAll('[data-start],[data-end],[data-break]').forEach(el=>el.oninput=()=>{dirty=true;compute();message('변경한 근무시간을 저장해 주세요.');});$('psWage').oninput=compute;
    $('psSave').onclick=()=>write(false);$('psConfirm').onclick=()=>write(true);$('psPrint').onclick=printStaff;
    panel.querySelectorAll('[data-snapshot]').forEach(b=>b.onclick=()=>{const f=s.finalizations[Number(b.dataset.snapshot)];show(`${s.workerName} · ${f.month} 확정 근무시간`,snapshotTable(f));});compute();
  }
  function snapshotTable(f,printed=false){return `<p>${printed?'출력 시각':'확정 시각'} ${esc(new Date(f.createdAt).toLocaleString('ko-KR'))} · 총 ${hours(f.totalMinutes)}</p><div class="ps-table-wrap"><table><thead><tr><th>날짜</th><th>출퇴근</th><th>휴게</th><th>인정 시간</th></tr></thead><tbody>${f.rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.start)}–${esc(r.end)}</td><td>${r.breakMinutes}분</td><td>${hours(r.paidMinutes)}</td></tr>`).join('')}</tbody></table></div><p>시급과 지급액은 저장하지 않았습니다.</p>`;}
  async function loadStaff(){
    const seq=++request,selected=$('payrollStaffSelect').value;staffMode(!!selected);
    if(selected)panel.innerHTML='<p role="status">근무 기록을 확인하고 있습니다…</p>';
    try{const data=await api('getPayrollStaffMonth',payload());if(seq!==request)return;
      $('payrollStaffSelect').innerHTML='<option value="">실무자 선택</option>'+data.workers.map(w=>`<option value="${esc(w.name)}">${esc(w.name)}</option>`).join('');$('payrollStaffSelect').value=selected;
      if(selected){staff=data;dirty=false;renderStaff();}
    }catch(e){if(seq!==request)return;if(selected){panel.innerHTML='<p role="alert">'+esc(e.message)+'</p><button id="psRetry" type="button">다시 조회</button>';$('psRetry').onclick=loadStaff;}else $('payrollStaffSelect').innerHTML='<option value="">실무자 조회 실패 · 새로고침</option>';}
  }
  async function write(finalize){
    if(busy)return;if(finalize&&!confirm(`${staff.workerName} · ${staff.month}\n총 ${hours(staff.totalMinutes)}를 확정하시겠습니까?\n시급과 지급액은 서버에 저장하지 않습니다.`))return;
    const reason=$('psReason').value.trim();if(!finalize&&!reason){message('확인·수정 사유를 입력해 주세요.');$('psReason').focus();return;}
    const p={...payload(),expectedVersion:staff.version,clientRequestId:id()};if(!finalize)p.rows=draftRows().map(r=>({...r,reason}));
    busy=true;panel.querySelectorAll('input').forEach(el=>el.disabled=true);$('payrollStaffSelect').disabled=true;compute();try{await api(finalize?'savePayrollStaffFinalization':'savePayrollStaffTimes',p);dirty=false;await loadStaff();message(finalize?'근무시간 확정본을 서버에 저장했습니다.':'실제 근무시간을 저장했습니다.');}catch(e){message(e.message);}finally{busy=false;$('payrollStaffSelect').disabled=false;panel.querySelectorAll('input').forEach(el=>el.disabled=!staff?.canEdit&&el.id!=='psWage');if($('psSave'))compute();}
  }
  function printStaff(){
    if(dirty){message('근무시간을 저장한 뒤 출력해 주세요.');return;}
    if(staff.unresolved){message('확인 필요한 근무시간을 수정한 뒤 출력해 주세요.');return;}
    const w=window.open('','_blank');if(!w){message('출력 창을 열 수 없습니다. 팝업 허용을 확인해 주세요.');return;}
    const wage=$('psWage').value,pay=$('psPay').textContent;
    w.document.write('<!doctype html><html lang="ko"><meta charset="utf-8"><title>근무시간 정산</title><style>body{font:14px sans-serif;padding:30px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}</style><h1>'+esc(staff.workerName)+' · '+esc(staff.month)+'</h1>'+snapshotTable({...staff,createdAt:new Date().toISOString()},true)+(wage!==''?'<p>계산용 시급 '+esc(money(Number(wage)))+' · 지급액 '+esc(pay)+'</p>':'')+'</html>');w.document.close();w.focus();w.print();
  }
  ['monthSelect','teacherSelect','subjectSelect'].forEach(key=>$(key).addEventListener('change',e=>{
    if((dirty||busy)&&!leave()){e.stopImmediatePropagation();if(key==='monthSelect')$(key).value=month();if(key==='teacherSelect')$(key).value=state.selectedTeacher||'';if(key==='subjectSelect')$(key).value=state.selectedSubject||'';}
  },true));
  $('refreshBtn').addEventListener('click',e=>{if((dirty||busy)&&!leave()){e.preventDefault();e.stopImmediatePropagation();}},true);
  new MutationObserver(()=>{if(host.style.display==='none'||host.hidden)wipe();}).observe(host,{attributes:true,attributeFilter:['style','hidden']});
  $('payrollStaffSelect').onchange=()=>{const next=$('payrollStaffSelect').value;if(!leave()){$('payrollStaffSelect').value=staff?.workerName||'';return;}$('payrollStaffSelect').value=next;loadStaff();};
  $('teacherSelect').addEventListener('change',()=>{if(!leave())return;$('payrollStaffSelect').value='';staffMode(false);});
  $('monthSelect').addEventListener('change',()=>{request++;wipe();dirty=false;staff=null;});
  $('payrollReviewBtn').onclick=()=>{
    const rows=summary?.sourcePendingRows||[];
    show('확인 필요한 출석·수업 기록',`<p>결석예고는 매출·강사 정산과 확인 대상에서 제외합니다. 아래 수업을 인트라넷의 <b>학생별 내역</b>에서 수정한 뒤 데스크 포털을 새로고침해 주세요.</p><a class="ps-intranet" href="https://sedubanpo.github.io/sso/workspace/?app=intranet" target="_blank" rel="noopener">인트라넷에서 수정하기 ↗</a><div class="ps-table-wrap"><table><thead><tr><th>학생</th><th>수업일</th><th>강사</th><th>시간</th><th>확인 내용</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${esc(r.name)}</th><td>${esc(r.classDateKey)}</td><td>${esc(r.teacher)}</td><td>${esc(r.start)}–${esc(r.end)}</td><td>${esc(r.attendanceCode)} · ${esc(r.sourcePendingReason)}</td></tr>`).join('')||'<tr><td colspan="5">확인 필요한 기록이 없습니다.</td></tr>'}</tbody></table></div>`);
  };
  $('payrollFinalizeBtn').onclick=async()=>{
    if(!summary||busy)return;if(state.selectedSubject){show('정산 범위 확인','<p>과목군을 전체로 바꾼 뒤 강사 정산을 확정해 주세요.</p>');return;}
    if(!confirm(`${month()} · ${state.selectedTeacher||'전체 강사'} 정산을 서버에 확정 저장하시겠습니까?\n서버에 저장된 급여 조건으로 다시 계산합니다. 강사별 급여 조건을 확인한 뒤 진행해 주세요.`))return;
    busy=true;$('payrollFinalizeBtn').disabled=true;
    try{const r=await api('savePayrollFinalization',{monthName:month(),teacherName:state.selectedTeacher||'',expectedSourceVersion:summary.cache?.sheetVersion,expectedOverrideSignature:summary.overrideSignature,expectedFinalizationVersion:summary.finalizationVersion,clientRequestId:id()});show('강사 정산 확정','<p>정산 확정본을 서버에 저장했습니다. 확정 기록에서 다시 확인할 수 있습니다.</p>');}catch(e){show('정산 확정 실패','<p role="alert">'+esc(e.message)+'</p>');}finally{busy=false;$('payrollFinalizeBtn').disabled=!admin();}
  };
  $('payrollHistoryBtn').onclick=async()=>{show('강사 정산 확정 기록','<p>조회 중…</p>');try{const r=await api('getPayrollFinalizations',{monthName:month()});show('강사 정산 확정 기록',r.records.map(f=>`<details class="ps-history"><summary>${esc(f.teacherName||'전체 강사')} · ${esc(new Date(f.createdAt).toLocaleString('ko-KR'))} · ${esc(money(f.kpi.estimatedPay))}</summary><p>확정자 ${esc(f.actor?.name)} · 순매출 ${esc(money(f.kpi.netSales))} · 인정 ${esc(f.kpi.recognizedHours)}시간</p><div class="ps-table-wrap"><table><thead><tr><th>날짜</th><th>학생·강사</th><th>원금액</th><th>할인</th><th>순금액</th><th>인정</th></tr></thead><tbody>${f.rows.map(row=>`<tr><td>${esc(row.classDateKey)}</td><td>${esc(row.name)} · ${esc(row.teacher)}</td><td>${esc(money(row.amount))}</td><td>${esc(money(row.discount))}</td><td>${esc(money(row.netAmount))}</td><td>${row.recognized?'인정':'제외'}</td></tr>`).join('')}</tbody></table></div></details>`).join('')||'<p>확정 기록이 없습니다.</p>');}catch(e){show('확정 기록 조회 실패','<p role="alert">'+esc(e.message)+'</p>');}};
  window.PayrollSettlement={update(data){summary=data;const rows=data.sourcePendingRows||[],regular=rows.filter(r=>r.attendanceCode==='출석').length;$('payrollReviewBtn').textContent=rows.length?`확인 필요 ${rows.length}건${regular?' · 출석 '+regular+'건':''}`:'확인 필요 없음';$('payrollReviewBtn').disabled=!rows.length;$('payrollFinalizeBtn').disabled=!admin()||!!$('payrollStaffSelect').value;if(!dirty&&!busy)loadStaff();}};
  if(state.currentSummary)window.PayrollSettlement.update(state.currentSummary);
})();
