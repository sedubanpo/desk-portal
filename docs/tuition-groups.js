/* Monthly collection drill-down. Read-only; the existing ledger owns all writes. */
function tuitionNoticeAgeHtml_(value) {
  var at = Date.parse(value);
  if (!isFinite(at)) return '<span class="tg-age unknown">안내일 기록 없음</span>';
  function seoulDay(time) { return Math.floor((time + 9 * 3600000) / 86400000); }
  var days = seoulDay(Date.now()) - seoulDay(at);
  if (days < 0) return '<span class="tg-age unknown">안내일 확인 필요</span>';
  var date = new Date(at + 9 * 3600000).toISOString().slice(0,10);
  return '<span class="tg-age' + (days >= 7 ? ' late' : '') + '">D+' + days + '</span><small>최초 안내 ' + date + '</small>';
}
function tuitionSchoolGroup_(row) {
  var school = String(row.school || '').replace(/\s|\([^)]*\)/g, '');
  var level = /초등학교$|초$/.test(school) ? '초등' : /중학교$|중$/.test(school) ? '중등' : /고등학교$|고$/.test(school) ? '고등' : '';
  var grade = Number((String(row.grade || '').match(/\d+/) || [0])[0]);
  return { level: level, grade: grade >= 1 && grade <= (level === '초등' ? 6 : 3) ? grade : 0 };
}
function tuitionGroupStatus_(row) {
  var guide = Math.max(0, Number(row.guideAmount) || 0), paid = Math.max(0, Number(row.collectedAmount) || 0);
  var informed = !!row.firstGuideAt || ['안내완료','납부예정','일부완료','납부완료','연락두절','이월금'].indexOf(row.unpaidStatus) >= 0;
  var payment = ['이월금','납부완료'].indexOf(row.unpaidStatus) >= 0 ? 'paid' : guide > 0 && paid >= guide ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
  return { informed: informed, payment: payment };
}
(function () {
  'use strict';
  var root = document.getElementById('moduleTuition');
  if (!root) return;
  var esc = escapeHtml;
  var menu = root.querySelector('.tuition-action-frame');
  var opener = document.createElement('button');
  opener.type = 'button'; opener.className = 'tuition-action-btn tg-open';
  opener.setAttribute('aria-haspopup','dialog');
  opener.innerHTML = '<i data-lucide="chart-no-axes-combined" aria-hidden="true"></i>그룹별 수납 현황';
  menu.appendChild(opener);
  var dialog = document.createElement('dialog');
  dialog.className = 'tg-dialog'; dialog.setAttribute('aria-labelledby','tgTitle');
  document.body.appendChild(dialog);
  var detailDialog = document.createElement('dialog');
  detailDialog.className = 'tg-dialog tg-detail-dialog'; detailDialog.setAttribute('aria-labelledby','tgDetailTitle');
  document.body.appendChild(detailDialog);
  var detailOpener = null;
  detailDialog.addEventListener('close',function(){if(dialog.open && detailOpener)detailOpener.focus();});
  var rows = [], level = '고등', selection = {grade:3,kind:'due'}, version = 0, month = '';
  var kinds = { due:'수납 확인 필요', informed:'안내 완료', waiting:'안내 전', paid:'납부 완료', partial:'일부 수납', unpaid:'미수납', all:'전체' };
  function matches(row, kind) {
    var s = tuitionGroupStatus_(row);
    return kind === 'all' || (kind === 'due' ? (s.payment === 'partial' || s.payment === 'unpaid') : kind === 'informed' ? s.informed : kind === 'waiting' ? !s.informed : s.payment === kind);
  }
  function groupRows(grade) { return rows.filter(function(row) {var g=tuitionSchoolGroup_(row);return g.level===level && (!grade || g.grade===grade);}); }
  function details() {
    var selected = groupRows(selection.grade).filter(function(row){return matches(row,selection.kind);}).sort(function(a,b){
      var x=Date.parse(a.firstGuideAt),y=Date.parse(b.firstGuideAt);
      if(isFinite(x)!==isFinite(y))return isFinite(x)?-1:1;
      if(isFinite(x)&&x!==y)return x-y;
      return String(a.studentName).localeCompare(String(b.studentName),'ko');
    });
    var target = detailDialog;
    target.innerHTML = '<header class="tg-detail-head"><div><h3 id="tgDetailTitle">'+level+' '+(selection.grade?selection.grade+'학년':'전체')+' · '+kinds[selection.kind]+'</h3><strong>'+selected.length+'명</strong></div><button type="button" data-detail-close aria-label="학생 명단 닫기">닫기</button></header>'+
      '<p class="tg-hint">최초 안내일이 오래된 순 · 학생 이름을 누르면 정산 상세가 열립니다.</p>'+
      (selected.length ? '<div class="tg-student-list">'+selected.map(function(row,i){
        var s=tuitionGroupStatus_(row),out=Math.max(0,Number(row.outstandingAmount)||0);
        return '<article><div><button type="button" data-student="'+i+'">'+esc(row.studentName)+'</button><small>'+esc(row.school||'학교 미입력')+' · '+esc(String(row.grade||'학년 미입력'))+'</small></div><div class="tg-student-state"><span>'+ (s.informed?'안내 완료':'안내 전')+' · '+kinds[s.payment]+'</span>'+tuitionNoticeAgeHtml_(row.firstGuideAt)+'</div><div class="tg-student-money"><small>'+(s.payment==='paid'?'수납 상태':'미납액')+'</small><strong>'+(s.payment==='paid'?'납부 완료':formatWon(out))+'</strong></div></article>';
      }).join('')+'</div>' : '<p class="tg-empty">해당하는 학생이 없습니다. 다른 학년이나 그래프 항목을 선택해 주세요.</p>');
    target.querySelector('[data-detail-close]').onclick=function(){detailDialog.close();};
    if(!detailDialog.open)detailDialog.showModal();
    target.querySelector('[data-detail-close]').focus();
    target.querySelectorAll('[data-student]').forEach(function(btn){btn.onclick=function(){var name=selected[Number(btn.dataset.student)].studentName;detailDialog.close();dialog.close();openTuitionStudentHistoryModal_(name);};});
  }
  function render() {
    var subset=groupRows(0),total=subset.length,paid=subset.filter(function(r){return matches(r,'paid');}).length;
    var informed=subset.filter(function(r){return matches(r,'informed');}).length;
    var unclassified=rows.filter(function(r){var g=tuitionSchoolGroup_(r);return !g.level||!g.grade;}).length;
    dialog.innerHTML='<header class="tg-head"><div><h2 id="tgTitle">그룹별 수납 현황</h2><p>'+esc(formatTuitionMonthLabel_(month))+' · 학년별 안내와 수납 진행을 확인하세요.</p></div><button type="button" data-close aria-label="그룹별 수납 현황 닫기">닫기</button></header>'+
      '<div class="tg-tabs" role="tablist" aria-label="학교급">'+['초등','중등','고등'].map(function(v){return '<button type="button" role="tab" aria-selected="'+(v===level)+'" tabindex="'+(v===level?0:-1)+'" data-level="'+v+'" aria-controls="tgPanel">'+v+'</button>';}).join('')+'</div>'+
      '<section id="tgPanel" role="tabpanel" aria-label="'+level+' 수납 현황"><div class="tg-overview"><div><strong>'+level+' <b>'+total+'</b>명</strong><span>안내 '+informed+'명 · 납부 완료 '+paid+'명</span></div><div><span>학생 기준 수납 완료율</span><strong>'+(total?Math.round(paid/total*100):0)+'<small>%</small></strong></div></div>'+
      (level==='고등'?'<div class="tg-priority"><i data-lucide="alarm-clock" aria-hidden="true"></i><div><strong>고3 수납 우선 확인</strong><span>안내 여부와 남은 수납 대상을 함께 확인하세요.</span></div><button type="button" data-priority>고3 수납 확인 '+groupRows(3).filter(function(r){return matches(r,'due');}).length+'명 보기</button></div>':'')+
      '<div class="tg-chart-head"><h3>학년별 진행 현황</h3><span>막대 또는 범례를 눌러 명단 확인</span></div><div class="tg-grades">'+
      Array.from({length:level==='초등'?6:3},function(_,i){var grade=i+1,list=groupRows(grade),n=list.length;
        function bar(types) {return '<div class="tg-bar-row"><span>'+ (types[0]==='informed'?'안내':'수납')+'</span><div class="tg-bar">'+types.map(function(kind){var count=list.filter(function(r){return matches(r,kind);}).length;return count?'<button type="button" class="'+kind+'" style="flex:'+count+'" data-grade="'+grade+'" data-kind="'+kind+'" aria-label="'+grade+'학년 '+kinds[kind]+' '+count+'명">'+(count/n>=.15?count:'')+'</button>':'';}).join('')+(n?'':'<span class="tg-no-data">학생 없음</span>')+'</div></div>';}
        return '<section class="tg-grade'+(level==='고등'&&grade===3?' priority':'')+'"><header><button type="button" data-grade="'+grade+'" data-kind="all">'+grade+'학년</button><strong>'+n+'명</strong></header>'+bar(['informed','waiting'])+bar(['paid','partial','unpaid'])+'<div class="tg-legend">'+['informed','waiting','paid','partial','unpaid'].map(function(kind){var count=list.filter(function(r){return matches(r,kind);}).length;return '<button type="button" data-grade="'+grade+'" data-kind="'+kind+'"'+(count?'':' disabled')+'><i class="'+kind+'"></i>'+kinds[kind]+' <b>'+count+'</b></button>';}).join('')+'</div></section>';
      }).join('')+'</div><p class="tg-basis">선택 월의 숨김 학생 제외 · 납부 완료는 이월금·납부완료 상태 또는 안내금액 전액 수납한 학생입니다. 일부 수납은 수납액이 있으나 전액 수납 전인 상태입니다. 안내는 안내 기록 또는 등록된 안내 상태 기준입니다.'+(unclassified?' 학교·학년 미분류 '+unclassified+'명은 학년 그래프에서 제외됩니다.':'')+'</p></section>';
    dialog.querySelector('[data-close]').onclick=function(){dialog.close();};
    var tabs=Array.from(dialog.querySelectorAll('[data-level]'));
    tabs.forEach(function(btn,i){btn.onclick=function(){level=btn.dataset.level;selection={grade:level==='고등'?3:1,kind:'all'};render();dialog.querySelector('[data-level="'+level+'"]').focus();};btn.onkeydown=function(e){var k=e.key,n=k==='ArrowRight'?(i+1)%3:k==='ArrowLeft'?(i+2)%3:k==='Home'?0:k==='End'?2:-1;if(n>=0){e.preventDefault();tabs[n].click();}};});
    dialog.querySelectorAll('[data-grade]').forEach(function(btn){btn.onclick=function(){selection={grade:Number(btn.dataset.grade),kind:btn.dataset.kind};detailOpener=btn;details();};});
    var priority=dialog.querySelector('[data-priority]');if(priority)priority.onclick=function(){selection={grade:3,kind:'due'};detailOpener=priority;details();};
    if(window.lucide)window.lucide.createIcons();
  }
  function load() {
    var request=++version;month=state.tuition.selectedMonth;
    dialog.innerHTML='<header class="tg-head"><h2 id="tgTitle">그룹별 수납 현황</h2><button type="button" data-close>닫기</button></header><p class="tg-empty" role="status">선택 월의 안내·수납 현황을 불러오는 중입니다…</p>';
    dialog.querySelector('[data-close]').onclick=function(){dialog.close();};
    if(!dialog.open)dialog.showModal();
    runServer('getTuitionMonthSummary',{monthName:month,includeNoticeDates:true}).then(function(res){
      if(request!==version||!dialog.open)return;
      if(!res||!res.success||res.pendingSummary)throw new Error(res&&res.message||'월별 집계가 준비되지 않았습니다.');
      rows=(res.rows||[]).filter(function(r){return !r.hiddenFromTuition;});render();dialog.querySelector('[data-close]').focus();
      if(res.noticeDatesTruncated)dialog.querySelector('.tg-basis').textContent+=' 안내 기록이 많아 일부만 조회되었습니다.';
    }).catch(function(err){if(request!==version||!dialog.open)return;dialog.querySelector('.tg-empty').innerHTML=esc(err.message||'조회 실패')+' <button type="button" data-retry>다시 시도</button>';dialog.querySelector('[data-retry]').onclick=load;});
  }
  opener.onclick=function(){level='고등';selection={grade:3,kind:'due'};load();};
  dialog.addEventListener('close',function(){version++;if(detailDialog.open)detailDialog.close();opener.focus();});
  var calendar=document.getElementById('tuitionCalendarModal');
  var search=document.createElement('label');search.className='tg-calendar-search';search.innerHTML='<i data-lucide="search" aria-hidden="true"></i><span>학생 납부일 찾기</span><input type="search" aria-label="캘린더 학생 검색" placeholder="학생 이름 검색 · 보고 있는 달 기준">';
  calendar.querySelector('.tuition-calendar-toolbar').after(search);
  search.querySelector('input').oninput=function(){state.tuition.calendarSearch=this.value;state.tuition.calendarSelectedDateKey='';renderTuitionCalendarPopup_();};
  if(window.lucide)window.lucide.createIcons();
})();
