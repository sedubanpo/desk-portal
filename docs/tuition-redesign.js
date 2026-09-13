/* Tuition workspace composition. Existing ledger commands remain the only write owners. */
(function () {
  'use strict';
  var root = document.getElementById('moduleTuition');
  if (!root) return;
  var $ = function (s, p) { return (p || root).querySelector(s); };
  var esc = escapeHtml;
  var selectionMonth = '';
  var ui = { filters: {}, page: 1, size: 50, selected: new Set(), onlySelected: false, view: 0, contacts: [] };
  function button(text, attrs) { return '<button type="button" ' + (attrs || '') + '>' + text + '</button>'; }
  var shell = $('.tuition-shell');
  var tablePanel = $('.table-panel');
  var top = $('.tuition-topbar');
  root.classList.add('tuition-redesigned');
  $('.tuition-page-sub').textContent = '월별 수강료 수납 현황과 미납·연락 대상자를 한눈에 확인하고 정산합니다.';
  $('.tuition-sync-note').innerHTML = '<span id="tuitionUpdatedLabel">선택 월의 조회 데이터 기준</span><span class="tr-sync">새로고침으로 갱신</span>';
  // One row for year/month/search; actions below it.
  var monthBrowser = $('.tuition-month-browser');
  monthBrowser.appendChild($('.tuition-month-search'));
  var filterAnchor = document.createElement('div'); filterAnchor.className = 'tr-filter-anchor';
  filterAnchor.innerHTML = button('☷ 상세 필터', 'id="tuitionDetailFilterBtn" aria-expanded="false" aria-controls="tuitionDetailFilter"') +
    '<form id="tuitionDetailFilter" class="tr-popover" hidden><div class="tr-popover-title"><strong>상세 필터</strong>' + button('초기화','data-reset') + '</div><div class="tr-filter-grid">' +
    '<label>학교<select name="school" aria-label="학교"></select></label><label>학년<select name="grade" aria-label="학년"></select></label>' +
    '<label>상태<select name="status" aria-label="상세 상태"></select></label><label>수업 유형 <small>준비 중</small><select disabled aria-label="수업 유형 준비 중"><option>준비 중</option></select></label>' +
    '<label class="tr-span">담당 강사 <small>준비 중</small><select disabled aria-label="담당 강사 준비 중"><option>준비 중</option></select></label>' +
    '<label>미납액 최소<input name="min" type="number" min="0" step="1" placeholder="최소 금액"></label><label>미납액 최대<input name="max" type="number" min="0" step="1" placeholder="최대 금액"></label></div>' +
    '<p class="tr-filter-error" role="alert"></p><footer>' + button('취소','data-cancel') + '<button type="submit" class="tr-primary">적용</button></footer></form>';
  monthBrowser.appendChild(filterAnchor);
  var form = $('#tuitionDetailFilter');
  function closeFilter() { form.hidden = true; $('#tuitionDetailFilterBtn').setAttribute('aria-expanded','false'); }
  function fillOptions(el, values, value) { el.innerHTML = '<option value="">전체</option>' + Array.from(new Set(values)).filter(Boolean).sort(function(a,b){return a.localeCompare(b,'ko',{numeric:true});}).map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join(''); el.value=value || ''; }
  $('#tuitionDetailFilterBtn').onclick = function () {
    if (!form.hidden) { closeFilter(); return; }
    fillOptions(form.elements.school,(state.tuition.allRows || []).map(function(r){return String(r.school || '');}),ui.filters.school);
    fillOptions(form.elements.grade,(state.tuition.allRows || []).map(function(r){return String(r.grade || '');}),ui.filters.grade);
    form.elements.status.innerHTML = $('#tuitionStatusFilter').innerHTML;
    form.elements.status.value = state.tuition.statusFilter || '';
    form.elements.min.value=ui.filters.min || ''; form.elements.max.value=ui.filters.max || '';
    form.hidden=false; this.setAttribute('aria-expanded','true'); form.elements.school.focus();
  };
  $('[data-cancel]',form).onclick=closeFilter;
  $('[data-reset]',form).onclick=function(){form.reset(); $('.tr-filter-error',form).textContent='';};
  form.onsubmit=function(e){e.preventDefault(); var min=form.elements.min.value,max=form.elements.max.value;
    if(min!=='' && max!=='' && Number(min)>Number(max)){ $('.tr-filter-error',form).textContent='최대 금액은 최소 금액보다 커야 합니다.';return; }
    ui.filters={school:form.elements.school.value,grade:form.elements.grade.value,min:min,max:max};
    state.tuition.statusFilter=form.elements.status.value; $('#tuitionStatusFilter').value=state.tuition.statusFilter;
    ui.page=1;closeFilter();applyTuitionLocalFilters_();$('#tuitionDetailFilterBtn').focus();
  };
  document.addEventListener('click',function(e){if(!filterAnchor.contains(e.target))closeFilter();});
  form.addEventListener('keydown',function(e){if(e.key==='Escape'){closeFilter();$('#tuitionDetailFilterBtn').focus();}});
  // Flatten existing metric wrappers without replacing their data IDs.
  var cards=$('.tuition-cards'), metrics=Array.from(cards.querySelectorAll('.tuition-metric-card'));
  metrics.forEach(function(el){cards.appendChild(el);});
  cards.querySelectorAll('.tuition-metric-group').forEach(function(el){el.remove();});
  var rate=document.createElement('button');rate.type='button';rate.className='tr-rate';rate.innerHTML='<div><small>수납률</small><strong>—</strong></div>';cards.appendChild(rate);
  var report=document.createElement('dialog');report.className='tr-collection-report';report.setAttribute('aria-labelledby','trReportTitle');document.body.appendChild(report);
  rate.onclick=function(){
    var k=state.tuition.kpi||{},expected=Number(k.expectedAmount)||0,collected=Number(k.collectedAmount)||0,outstanding=Number(k.outstandingAmount)||0;
    var pct=expected>0?collected/expected*100:null;
    var fill=Math.max(0,Math.min(100,pct||0));
    report.innerHTML='<header><div><p>에스에듀 · 반포관</p><h2 id="trReportTitle">'+esc(formatTuitionMonthLabel_(state.tuition.selectedMonth))+' 수납 보고서</h2><small>'+esc($('#tuitionUpdatedLabel').textContent)+'</small></div>'+button('×','data-close-report aria-label="보고서 닫기"')+'</header>'+
      '<div class="tr-report-body"><div class="tr-report-ring" style="--report-rate:'+fill+'%" role="img" aria-label="안내 금액 대비 수납률 '+(pct===null?'산정 불가':pct.toFixed(1)+'%')+'"><div><span>안내 금액 대비 수납률</span><strong>'+(pct===null?'—':pct.toFixed(1)+'<small>%</small>')+'</strong><span>순수납액 기준</span></div></div><div class="tr-report-numbers">'+
      [['안내 금액 합계',expected,'+','tr-money-in'],['순수납액',collected,'-','tr-money-out'],['미납액',outstanding,'+','tr-money-in']].map(function(v){return '<section class="'+v[3]+'"><span>'+v[0]+'</span><strong>'+v[2]+formatWon(Math.abs(v[1]))+'</strong></section>';}).join('')+'</div></div>'+
      '<footer><div><strong>전체 '+(k.totalStudents||0)+'명</strong><span>납부완료 '+(k.paidStudents||0)+'명</span><span>미납 '+(k.unpaidStudents||0)+'명</span></div><p>수납률 = 순수납액 ÷ 안내 금액 합계 × 100</p><p>미납액은 학생별 미납액의 합계로, 안내 합계와 순수납액의 차이와 다를 수 있습니다.</p>'+(pct===null?'<p>안내 금액이 없어 수납률을 산정할 수 없습니다.</p>':pct>100?'<p>수납률이 100%를 초과하여 원형 그래프는 전체 채움으로 표시합니다.</p>':collected<0?'<p>순수납액이 음수여서 원형 그래프는 채움 없이 표시합니다.</p>':'')+'</footer>';
    report.querySelector('[data-close-report]').onclick=function(){report.close();};report.showModal();
  };
  report.addEventListener('close',function(){rate.focus();});
  var oldLayout=$('.tuition-layout');
  var overview=document.createElement('section');overview.className='tr-overview';cards.before(overview);overview.appendChild(cards);var recent=document.getElementById('tuitionPaymentBody').closest('article');recent.classList.add('tr-recent-panel');overview.appendChild(recent);
  var archive=document.createElement('details'); archive.className='tr-support'; archive.innerHTML='<summary>수납 현황·우선순위 보기</summary>';archive.appendChild(oldLayout);shell.appendChild(archive);
  var brief=document.createElement('button');brief.type='button';brief.textContent='일일 수납 브리핑';brief.onclick=openTuitionBriefPopup_;$('.tuition-topbar-actions').appendChild(brief);
  monthBrowser.appendChild($('#tuitionMonthCreateBtn'));
  var searchRow=document.createElement('div');searchRow.className='tr-search-row';searchRow.appendChild($('.tuition-month-search'));searchRow.appendChild(filterAnchor);monthBrowser.after(searchRow);searchRow.appendChild($('.tuition-topbar>.field'));searchRow.appendChild($('.tuition-topbar-actions'));
  var selectedControl=document.createElement('label');selectedControl.className='tr-selected-control';selectedControl.innerHTML='<input type="checkbox" id="tuitionSelectedOnly"> 선택한 학생만 <span>0명</span>';$('.meta-bar',tablePanel).appendChild(selectedControl);
  $('#tuitionSelectedOnly').onchange=function(){ui.onlySelected=this.checked;applyTuitionLocalFilters_();};
  $('.tuition-table th').insertAdjacentHTML('afterbegin','<input type="checkbox" id="tuitionSelectPage" aria-label="현재 페이지 학생 모두 선택"> ');
  $('#tuitionSelectPage').onchange=function(){var checked=this.checked;tuitionStudentBodyEl.querySelectorAll('[data-tr-select]').forEach(function(el){el.checked=checked;if(checked)ui.selected.add(el.dataset.trSelect);else ui.selected.delete(el.dataset.trSelect);});if(ui.onlySelected)applyTuitionLocalFilters_();else TuitionRedesign.afterRows();};
  var toolbar=document.createElement('div');toolbar.className='tr-table-tools';toolbar.innerHTML=
    '<details class="tr-columns"><summary>⚙ 표시 항목 설정</summary><div>'+[ ['school','학교 / 학년'],['contact','마지막 연락'],['count','연락 횟수'] ].map(function(c){return '<label><input type="checkbox" data-column="'+c[0]+'" checked> '+c[1]+'</label>';}).join('')+'</div></details>' +
    '<select aria-label="상태 그룹 내 정렬" id="tuitionStudentSort"><option value="name">정렬: 이름순</option><option value="outstanding">정렬: 미납액순</option><option value="previous">정렬: 전월 납부일순</option></select>'+
    '<select aria-label="페이지당 학생 수" id="tuitionStudentPageSize"><option value="25">25명씩 보기</option><option value="50" selected>50명씩 보기</option><option value="100">100명씩 보기</option></select>';
  $('.table-head',tablePanel).appendChild(toolbar);
  var counts=document.createElement('div');counts.className='tr-list-summary';counts.setAttribute('aria-live','polite');$('.tuition-table-wrap').before(counts);
  var pager=document.createElement('nav');pager.className='tr-student-pagination';pager.setAttribute('aria-label','학생 목록 페이지');tablePanel.appendChild(pager);
  $('#tuitionStudentSort').onchange=function(){state.tuition.studentSort=this.value;ui.page=1;renderTuitionStudentRows();};
  $('#tuitionStudentPageSize').onchange=function(){ui.size=Number(this.value);ui.page=1;renderTuitionStudentRows();};
  toolbar.addEventListener('change',function(e){var c=e.target.dataset.column;if(c)tablePanel.classList.toggle('tr-hide-'+c,!e.target.checked);});
  // Existing analytics become the content of five real tabs.
  var tabs=$('.tuition-action-frame'), tabButtons=Array.from(tabs.children);
  var labels=['학생별 수납 현황','일자별 학생 납부 내역','수강료 미납·연락 대상자','월별 안내 대시보드','월별 매출 현황'];
  var icons=['users','calendar-days','bell-ring','clipboard-list','chart-column'];
  var reportIds=['','tuitionCalendarModal','tuitionUnpaidModal','tuitionGuideDashboardModal','tuitionMonthlyModal'];
  var openers=[null,openTuitionCalendarPopup_,openTuitionUnpaidModal_,openTuitionGuideDashboardPopup_,openTuitionMonthlyPopup_];
  var reports=document.createElement('div');reports.className='tr-reports';tabs.after(reports);
  reportIds.slice(1).forEach(function(id){var el=document.getElementById(id);el.classList.add('tr-inline-report');reports.appendChild(el);el.querySelectorAll('.tuition-wide-close').forEach(function(b){b.addEventListener('click',function(){selectView(0);});});});
  tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','수강료 정산 보기');
  tablePanel.id='tuitionStudentListPanel';tablePanel.setAttribute('role','tabpanel');
  function selectView(index) {
    ui.view=index; reports.hidden=index===0; tablePanel.hidden=index!==0;archive.hidden=index!==0;
    tabButtons.forEach(function(b,i){b.classList.toggle('primary',i===index);b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});
    reportIds.slice(1).forEach(function(id,i){var el=document.getElementById(id);el.hidden=i+1!==index; if(i+1!==index)el.style.display='none';});
    if(index)openers[index]();
  }
  tabButtons.forEach(function(b,i){b.innerHTML='<i data-lucide="'+icons[i]+'" aria-hidden="true"></i>'+labels[i];b.id='tuitionViewTab'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls',reportIds[i] || tablePanel.id);
    var panel=document.getElementById(reportIds[i] || tablePanel.id);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);
    b.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();selectView(i);},true);
    b.addEventListener('keydown',function(e){var n=e.key==='ArrowRight'?(i+1)%5:e.key==='ArrowLeft'?(i+4)%5:e.key==='Home'?0:e.key==='End'?4:-1;if(n>=0){e.preventDefault();selectView(n);tabButtons[n].focus();}});
  });
  document.getElementById('openTuitionUnpaidListBtn').addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();selectView(2);},true);
  var recallButton=document.createElement('button');recallButton.type='button';recallButton.className='tuition-wide-close';recallButton.textContent='재연락 대상자';recallButton.onclick=openTuitionRecallPopup_;document.querySelector('#tuitionUnpaidModal .tuition-wide-top').appendChild(recallButton);
  selectView(0);
  // Reuse durable history/memo owners inside a right-hand inspector.
  var drawer=document.getElementById('tuitionStudentHistoryModal');drawer.classList.add('tr-drawer');
  var drawerBox=$('.tuition-wide-modal',drawer);drawerBox.setAttribute('role','dialog');drawerBox.setAttribute('aria-modal','true');drawerBox.setAttribute('aria-label','학생 상세 정보');
  var drawerTabs=$('.tuition-history-tabs',drawer);
  drawerTabs.insertAdjacentHTML('afterbegin',button('수납 현황','class="tuition-history-tab" data-tr-tab="receipts" role="tab"')+button('연락 기록','class="tuition-history-tab" data-tr-tab="contacts" role="tab"'));
  drawerTabs.insertAdjacentHTML('beforeend','<button type="button" class="tuition-history-tab" disabled title="수업 데이터 연결 준비 중">수업 내역 · 준비 중</button>');
  var receiptPanel=document.createElement('div');receiptPanel.id='tuitionDrawerReceipts';receiptPanel.setAttribute('role','tabpanel');drawerTabs.after(receiptPanel);
  var contactPanel=document.createElement('div');contactPanel.id='tuitionDrawerContacts';contactPanel.setAttribute('role','tabpanel');receiptPanel.after(contactPanel);
  var baseSetTab=setTuitionStudentHistoryTab_;
  setTuitionStudentHistoryTab_=function(tab){baseSetTab(tab);var extra=tab==='receipts'||tab==='contacts';
    receiptPanel.hidden=tab!=='receipts';contactPanel.hidden=tab!=='contacts';if(extra){tuitionStudentHistoryPanelEl.hidden=true;tuitionStudentMemoPanelEl.hidden=true;}
    drawerTabs.querySelectorAll('[role=tab]').forEach(function(b){var active=(b.dataset.trTab||b.dataset.tuitionHistoryTab)===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
  };
  drawerTabs.querySelectorAll('[data-tr-tab]').forEach(function(b){b.onclick=function(){setTuitionStudentHistoryTab_(b.dataset.trTab);};});
  function headerStudent(name){var row=(state.tuition.allRows||[]).find(function(r){return r.studentName===name;})||{};
    $('.tuition-wide-title',drawer).innerHTML=renderStudentIdentityHtml_(name);
    tuitionStudentHistorySummaryEl.innerHTML=StudentGenderIcons.school(row.school||'학교 미입력',row.grade||'')+' '+buildTuitionStatusBadge(row.unpaidStatus||'안내이전');
  }
  function renderReceipts(name){var row=(state.tuition.allRows||[]).find(function(r){return r.studentName===name;})||{};
    var list=buildTuitionEffectivePaymentRows_(state.tuition.monthPayments||[]).filter(function(p){return p.studentName===name&&!isTuitionAdjustmentPayment_(p);}).sort(compareTuitionPaymentRowsDesc_);
    receiptPanel.innerHTML='<p class="tr-muted">'+esc(formatTuitionMonthLabel_(state.tuition.selectedMonth))+' 기준</p><div class="tr-drawer-kpis">'+[['안내금액',row.guideAmount],['순수납액',row.collectedAmount],['미납액',row.outstandingAmount]].map(function(k){return '<div class="'+(k[0]==='순수납액'?'tr-money-out':'tr-money-in')+'"><small>'+k[0]+'</small><strong>'+(k[0]==='순수납액'?'-':'+')+formatWon(Math.abs(k[1]||0))+'</strong></div>';}).join('')+'</div><div class="tr-section-heading"><strong>최근 수납 내역</strong>'+button('+ 수납 입력','data-drawer-pay')+'</div>'+
      (list.length?'<div class="tr-receipts">'+list.map(function(p){return '<article><div><strong>'+formatWon(Math.abs(p.amount))+'</strong><small>'+esc(p.paidAt||'-')+' · '+esc(p.paymentType||'-')+' · '+(p.amount<0?'수납':'환불')+'</small><small>승인 '+esc(p.approvalNo||'-')+' · 귀속 '+esc((p.sourceDueMonth||state.tuition.selectedMonth).replace(/s$/,''))+'</small></div>'+button('관리','data-receipt-key="'+esc(getTuitionPaymentClientMergeKey_(p))+'"')+'</article>';}).join('')+'</div>':'<p class="tr-empty">이 월의 수납 내역이 없습니다.</p>');
    $('[data-drawer-pay]',receiptPanel).onclick=function(){drawer.style.display='none';openTuitionPaymentModal(name);};
    receiptPanel.querySelectorAll('[data-receipt-key]').forEach(function(b){b.onclick=function(){drawer.style.display='none';openTuitionPaymentEditModal_(b.dataset.receiptKey);};});
  }
  function renderContacts(name,contacts,truncated){contactPanel.innerHTML='<div class="tr-section-heading"><strong>안내/연락 기록</strong>'+button('+ 새 기록','data-new-contact')+'</div>'+(truncated?'<p>최대 5,000건을 표시합니다.</p>':'')+
    (contacts.length?contacts.map(function(c){return '<article class="tr-contact-entry"><time>'+esc(c.contactAt?new Date(c.contactAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'-')+'</time><span class="tr-channel">'+esc(c.contactChannel||'기록')+'</span><p>'+esc(c.memo||'메모 없음')+'</p><small><span class="tr-actor" aria-hidden="true">'+esc((c.actorName||'?').slice(0,1))+'</span>'+esc(c.actorName||'입력자 미기록')+' · '+esc((c.monthName||'').replace(/s$/,''))+'</small></article>';}).join(''):'<p class="tr-empty">저장된 연락 기록이 없습니다.</p>');
    $('[data-new-contact]',contactPanel).onclick=function(){drawer.style.display='none';openTuitionContactModal(name);};
  }
  var baseRenderHistory=renderTuitionStudentHistory_;
  renderTuitionStudentHistory_=function(name,rows,overview,contacts,truncated){baseRenderHistory(name,rows,overview);headerStudent(name);renderContacts(name,contacts||[],truncated);};
  function openStudent(name,tab){openTuitionStudentHistoryModal_(name);headerStudent(name);renderReceipts(name);contactPanel.innerHTML='<p class="tr-empty" role="status">연락 기록을 불러오는 중입니다.</p>';setTuitionStudentHistoryTab_(tab||'receipts');}
  // Compact contact composer retains its optional assistant.
  var assistant=document.querySelector('#tuitionContactModal .tuition-assistant');
  var assistDetails=document.createElement('details');assistDetails.className='tr-assistant-details';assistDetails.innerHTML='<summary>학부모 응대 도우미</summary>';assistant.before(assistDetails);assistDetails.appendChild(assistant);
  // Focus containment and Escape apply to the existing custom tuition dialogs.
  var modalIds=['tuitionStudentHistoryModal','tuitionContactModal','tuitionPaymentModal','tuitionAmountAdjustModal'];
  modalIds.forEach(function(id){var modal=document.getElementById(id);var focusBefore=null;var wasOpen=false;
    var box=modal.firstElementChild;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');if(!box.getAttribute('aria-label'))box.setAttribute('aria-label',box.querySelector('h3').textContent);
    new MutationObserver(function(){var open=getComputedStyle(modal).display!=='none';root.inert=modalIds.some(function(id){return getComputedStyle(document.getElementById(id)).display!=='none';});if(open&&!wasOpen){focusBefore=document.activeElement;var b=modal.querySelector('button:not([disabled]),input:not([type=hidden])');if(b)b.focus();}if(!open&&wasOpen&&focusBefore&&focusBefore.isConnected)focusBefore.focus();wasOpen=open;}).observe(modal,{attributes:true,attributeFilter:['style']});
    modal.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(id==='tuitionPaymentModal')closeTuitionPaymentModal_();else if(id==='tuitionAmountAdjustModal')closeTuitionAmountAdjustModal_();else if(id!=='tuitionContactModal'||!state.tuition.savingContact)modal.style.display='none';}
      if(e.key==='Tab'){var list=Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')).filter(function(el){return el.getClientRects().length;});var first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    });
  });
  var toastStack=document.createElement('div');toastStack.className='tr-toasts';toastStack.setAttribute('aria-live','polite');document.body.appendChild(toastStack);
  window.TuitionRedesign={
    toast:function(text,error){var el=document.createElement('div');el.className='tr-toast'+(error?' is-error':'');el.setAttribute('role',error?'alert':'status');var label=document.createElement('span');label.textContent=text;el.appendChild(label);var close=document.createElement('button');close.type='button';close.setAttribute('aria-label','알림 닫기');close.textContent='×';close.onclick=function(){el.remove();};el.appendChild(close);toastStack.appendChild(el);setTimeout(function(){el.remove();},8000);},
    matches:function(r){var f=ui.filters;return (!f.school||String(r.school||'')===f.school)&&(!f.grade||String(r.grade||'')===f.grade)&&(f.min==null||f.min===''||Number(r.outstandingAmount||0)>=Number(f.min))&&(f.max==null||f.max===''||Number(r.outstandingAmount||0)<=Number(f.max))&&(!ui.onlySelected||ui.selected.has(r.studentName));},
    pageRows:function(grouped){var rows=grouped.filter(function(r){return !r.__group;});var pages=Math.max(1,Math.ceil(rows.length/ui.size));ui.page=Math.min(ui.page,pages);var start=(ui.page-1)*ui.size;
      counts.innerHTML='<strong>전체 '+rows.length+'명</strong><span>납부완료 '+rows.filter(function(r){return isTuitionPaidStatus_(r.unpaidStatus);}).length+'명</span><span>미납 '+rows.filter(function(r){return !isTuitionPaidStatus_(r.unpaidStatus);}).length+'명</span><span>안내이전 → 안내완료 → 확인필요 → 나머지</span>';
      var numbers=[];for(var n=Math.max(1,ui.page-2);n<=Math.min(pages,ui.page+2);n++)numbers.push(n);
      pager.innerHTML=button('‹ 이전','data-page="'+(ui.page-1)+'"'+(ui.page===1?' disabled':''))+numbers.map(function(n){return button(n,'data-page="'+n+'"'+(ui.page===n?' aria-current="page"':''));}).join('')+button('다음 ›','data-page="'+(ui.page+1)+'"'+(ui.page===pages?' disabled':''))+'<span>'+ui.page+' / '+pages+'페이지</span>';
      pager.querySelectorAll('[data-page]').forEach(function(b){b.onclick=function(){ui.page=Number(b.dataset.page);renderTuitionStudentRows();};});
      return rows.slice(start,start+ui.size);
    },
    afterRows:function(){
      if(selectionMonth!==state.tuition.selectedMonth){selectionMonth=state.tuition.selectedMonth;ui.selected.clear();ui.onlySelected=false;$('#tuitionSelectedOnly').checked=false;}
      tuitionStudentBodyEl.querySelectorAll('tr').forEach(function(row){var name=row.querySelector('[data-student-history]');if(!name||row.querySelector('[data-tr-select]'))return;var cb=document.createElement('input');cb.type='checkbox';cb.dataset.trSelect=name.dataset.studentHistory;cb.setAttribute('aria-label',name.dataset.studentHistory+' 선택');cb.checked=ui.selected.has(cb.dataset.trSelect);row.cells[0].prepend(cb);cb.onchange=function(){if(cb.checked)ui.selected.add(cb.dataset.trSelect);else ui.selected.delete(cb.dataset.trSelect);if(ui.onlySelected)applyTuitionLocalFilters_();else TuitionRedesign.afterRows();};});
      $('span',selectedControl).textContent=ui.selected.size+'명';var checks=Array.from(tuitionStudentBodyEl.querySelectorAll('[data-tr-select]'));var selected=checks.filter(function(c){return c.checked;}).length;$('#tuitionSelectPage').checked=checks.length>0&&selected===checks.length;$('#tuitionSelectPage').indeterminate=selected>0&&selected<checks.length;
      var k=state.tuition.kpi||{},pct=k.expectedAmount>0?100*(k.collectedAmount||0)/k.expectedAmount:null;rate.style.setProperty('--rate',Math.max(0,Math.min(100,pct||0))+'%');$('strong',rate).textContent=pct==null?'—':pct.toFixed(1)+'%';rate.setAttribute('aria-label','안내 금액 대비 수납률 '+(pct==null?'산정 불가':pct.toFixed(1)+'%'));
      tuitionRowsPillEl.textContent=(state.tuition.rows||[]).length+'명';
      if(!(state.tuition.rows||[]).length){counts.textContent='표시할 학생이 없습니다. 필터나 검색어를 확인해 주세요.';pager.innerHTML='';}
    },
    historyError:function(message){contactPanel.innerHTML='<p class="tr-empty" role="alert">'+esc(message)+' · 패널을 다시 열어 재시도해 주세요.</p>';},
    openStudent:openStudent,
    openContacts:function(name){openStudent(name,'contacts');}
  };
  // Hook refresh timestamp only when data has actually arrived.
  var baseSummary=renderTuitionSummary;
  renderTuitionSummary=function(data){if(selectionMonth!==state.tuition.selectedMonth){ui.selected.clear();ui.onlySelected=false;$('#tuitionSelectedOnly').checked=false;}baseSummary(data);ui.page=1;$('#tuitionUpdatedLabel').textContent='조회 시각 '+new Date().toLocaleString('ko-KR',{hour12:false});TuitionRedesign.afterRows();};
  var baseFilters=applyTuitionLocalFilters_;
  applyTuitionLocalFilters_=function(){ui.page=1;baseFilters();TuitionRedesign.afterRows();};
  refreshLucideIcons_();
  if(state.tuition.rows)renderTuitionStudentRows();
})();

/* Settings-center links only resolve presentation identity; they never move ledger entries. */
(function(){
  var settings=document.getElementById('settingsModal');if(!settings)return;
  var launch=document.createElement('button');launch.type='button';launch.className='modal-action';launch.textContent='학생 아이콘 연결';settings.querySelector('.modal-head').appendChild(launch);
  var dialog=document.createElement('dialog');dialog.className='tr-identity-dialog';dialog.setAttribute('aria-labelledby','trIdentityTitle');document.body.appendChild(dialog);
  var links=[],loading=false;
  function render(message){
    var names=Array.from(new Set((state.tuition.allRows||[]).map(function(r){return r.studentName;}))).sort(function(a,b){return a.localeCompare(b,'ko');});
    var options=StudentGenderIcons.candidates().sort(function(a,b){return a.name.localeCompare(b.name,'ko');});
    dialog.innerHTML='<header><div><h2 id="trIdentityTitle">학생 아이콘 연결</h2><p>데스크 학생을 계정 관리의 대표 학생에 연결합니다. 수납 기록은 바뀌지 않습니다.</p></div><button type="button" data-close aria-label="학생 연결 닫기">×</button></header><label>학생 찾기<input type="search" data-find placeholder="데스크 학생명 검색"></label><p role="status" data-message>'+escapeHtml(message||'자동 연결은 대표 학생 문서만 사용합니다. 성별 미등록은 계정 관리에서 지정하세요.')+'</p><div class="tr-identity-list">'+(names.length?names.map(function(name){var c=StudentGenderIcons.connection(name);return '<article data-name="'+escapeHtml(name)+'"><div><strong>'+StudentGenderIcons.render(name)+'</strong><small>'+escapeHtml(c.label)+'</small></div><select aria-label="'+escapeHtml(name)+' 연결 학생"><option value="">자동 연결 사용</option>'+options.filter(function(o){return c.manual && c.studentId===o.id;}).map(function(o){return '<option value="'+escapeHtml(o.id)+'"'+(c.manual&&c.studentId===o.id?' selected':'')+'>'+escapeHtml(o.name+' · '+o.school+' '+o.grade+' · '+(o.gender==='male'?'남':o.gender==='female'?'여':'성별 미등록')+' · '+o.id)+'</option>';}).join('')+'</select><button type="button" data-save>저장</button></article>';}).join(''):'<p>수강료 정산에서 월별 학생 목록을 먼저 불러오세요.</p>')+'</div>';
    if(message && message.indexOf('불러오는 중')>=0){dialog.querySelector('[data-find]').disabled=true;dialog.querySelectorAll('[data-save]').forEach(function(b){b.disabled=true;});}
    dialog.querySelector('[data-close]').onclick=function(){dialog.close();};
    dialog.querySelector('[data-find]').oninput=function(){var q=this.value.trim();dialog.querySelectorAll('[data-name]').forEach(function(a){a.hidden=q&&!a.dataset.name.includes(q);});};
    dialog.querySelectorAll('article select').forEach(function(select){select.onfocus=function(){if(this.dataset.loaded)return;var value=this.value;this.innerHTML='<option value="">자동 연결 사용</option>'+options.map(function(o){return '<option value="'+escapeHtml(o.id)+'">'+escapeHtml(o.name+' · '+o.school+' '+o.grade+' · '+(o.gender==='male'?'남':o.gender==='female'?'여':'성별 미등록')+' · '+o.id)+'</option>';}).join('');this.value=value;this.dataset.loaded='true';};});
    dialog.querySelectorAll('[data-save]').forEach(function(btn){btn.onclick=async function(){if(loading)return;var row=btn.closest('[data-name]'),id=row.querySelector('select').value;loading=true;btn.disabled=true;var msg=dialog.querySelector('[data-message]');msg.textContent='연결 저장 중…';try{var result=await runServerWriteWithRetry_('saveTuitionIdentityLink',{studentName:row.dataset.name,studentId:id});if(!result.success)throw Error(result.message||'연결 저장 실패');links=links.filter(function(l){return l.studentName!==row.dataset.name;}).concat([result.link]);StudentGenderIcons.setLinks(links);row.querySelector('small').textContent=StudentGenderIcons.connection(row.dataset.name).label;msg.textContent='저장했습니다. 아이콘 연결이 갱신되었습니다.';}catch(e){msg.textContent=e.message||'저장하지 못했습니다. 다시 시도해 주세요.';}finally{loading=false;btn.disabled=false;}};});
  }
  launch.onclick=async function(){render('연결 정보를 불러오는 중…');dialog.showModal();try{var result=await runServer('getTuitionIdentityLinks',{});if(!result.success)throw Error(result.message);links=result.links||[];StudentGenderIcons.setLinks(links);render();}catch(e){render('연결 정보를 불러오지 못했습니다. 창을 닫고 다시 시도하세요.');dialog.querySelectorAll('[data-save]').forEach(function(b){b.disabled=true;});}};
  dialog.addEventListener('close',function(){launch.focus();});
})();
