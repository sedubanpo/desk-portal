(function() {
  'use strict';
  var trigger = document.getElementById('tuitionPaymentLinkBtn');
  var dialog = document.createElement('dialog');
  dialog.className = 'payment-link-dialog';
  dialog.setAttribute('aria-labelledby', 'paymentLinkTitle');
  dialog.innerHTML = '<header><div><h2 id="paymentLinkTitle">결제링크 업로드</h2><p>결제내역을 대조하고 새 수납만 입력합니다.</p></div><button type="button" data-close aria-label="팝업 닫기">✕</button></header>' +
    '<nav aria-label="결제링크 메뉴"><button type="button" data-tab="upload" aria-pressed="true">엑셀 업로드</button><button type="button" data-tab="history" aria-pressed="false">입력·수정·삭제 이력</button></nav>' +
    '<section data-pane="upload"><label class="payment-link-file"><span class="payment-link-upload-icon" aria-hidden="true">⇧</span><strong>결제링크 파일 업로드</strong><span>파일을 끌어 놓거나 아래에서 선택하세요.</span><small>.xlsx · 최대 5MB</small><input type="file" accept=".xlsx" aria-label="결제내역 엑셀 파일"></label><p class="payment-link-help">학생·귀속 월을 확인한 뒤 중복 검사를 실행하세요. 취소 건은 원결제와 환불을 확인한 후 수납 관리에서 처리합니다.</p><div class="payment-link-summary" data-counts aria-live="polite"></div><div class="payment-link-result-filter"><label>대조 결과 <select data-result-filter><option value="all">전체</option><option value="review">확인 필요</option><option value="ready">입력 가능</option><option value="duplicate">중복 제외</option><option value="saved">입력 완료</option></select></label><span data-file-name></span></div><div class="payment-link-table" data-preview></div><footer><button type="button" data-stop hidden>현재 작업 후 중지</button><button type="button" data-check disabled>중복 검사</button><button type="button" data-save disabled>새 수납 입력</button></footer></section>' +
    '<section data-pane="history" hidden><div class="payment-link-history-controls"><label>귀속 월 <select data-month></select></label><label>변경 유형 <select data-action><option value="">전체</option><option value="created">입력</option><option value="updated">수정</option><option value="deleted">삭제</option></select></label><button type="button" data-reload>이력 새로고침</button></div><div data-history></div></section><p class="payment-link-message" role="status" aria-live="polite"></p>';
  document.body.appendChild(dialog);
  var rows = [], roster = [], busy = false, events = [], fileName = '', monthAtOpen = '', stopRequested = false, filter = 'all', processing = false;
  var $ = function(s) { return dialog.querySelector(s); };
  var esc = function(v) { return window.escapeHtml(v); };
  var won = function(v) { return Number(v).toLocaleString('ko-KR') + '원'; };
  function message(text) { $('.payment-link-message').textContent = text; }
  function setBusy(value) {
    busy = value;
    dialog.setAttribute('aria-busy', String(value));
    dialog.querySelectorAll('button, input, select').forEach(function(el) { el.disabled = value; });
    $('[data-stop]').disabled = stopRequested; $('[data-stop]').hidden = !processing;
    $('[data-result-filter]').disabled = false;
    if (!value) {
      dialog.querySelectorAll('[data-row]').forEach(function(el) { var r = rows[Number(el.dataset.row)]; el.disabled = !!r.issue || r.result === 'saved'; });
      $('[data-check]').disabled = !rows.some(eligible);
      $('[data-save]').disabled = !rows.some(function(r) { return r.result === 'ready'; });
    }
  }
  function eligible(r) { return !r.issue && r.studentName && r.monthName; }
  function options(values, selected) { return '<option value="">선택 필요</option>' + values.map(function(v) { return '<option value="' + esc(v) + '"' + (v === selected ? ' selected' : '') + '>' + esc(v.replace(/s$/, '')) + '</option>'; }).join(''); }
  function category(r) { return r.issue || !eligible(r) || r.result === 'error' ? 'review' : r.result || 'unchecked'; }
  function render() {
    var counts = rows.reduce(function(a,r) { var c=category(r); a[c]=(a[c]||0)+1; return a; },{});
    $('[data-counts]').innerHTML = rows.length ? [['전체',rows.length],['확인 필요',counts.review||0],['입력 가능',counts.ready||0],['중복 제외',counts.duplicate||0],['입력 완료',counts.saved||0]].map(function(c){return '<span>'+c[0]+' <strong>'+c[1]+'건</strong></span>';}).join('') : '';
    $('[data-file-name]').textContent = fileName;

    var names = Array.from(new Set(roster.map(function(r) { return r.studentName; }))).sort(function(a,b) { return a.localeCompare(b,'ko'); });
    $('[data-preview]').innerHTML = rows.length ? '<table><thead><tr><th>원본 이름 / 품목</th><th>학생</th><th>귀속 월</th><th>결제일 / 승인번호</th><th>금액</th><th>대조 결과</th></tr></thead><tbody>' + rows.map(function(r,i) {
      if (filter !== 'all' && category(r) !== filter) return '';
      return '<tr data-result="' + category(r) + '"><td>' + esc(r.rawName) + '<small>' + esc(r.itemName) + '</small></td><td><select aria-label="' + r.rowNumber + '행 학생" data-row="' + i + '" data-field="studentName"' + (r.issue ? ' disabled' : '') + '>' + options(names,r.studentName) + '</select></td><td><select aria-label="' + r.rowNumber + '행 귀속 월" data-row="' + i + '" data-field="monthName"' + (r.issue ? ' disabled' : '') + '>' + options(state.tuition.months || [monthAtOpen],r.monthName) + '</select></td><td>' + esc(r.paidAt) + '<small>' + esc(r.approvalNo) + '</small></td><td class="payment-link-money">' + window.tuitionMoneyHtml_((r.status !== '결제' || r.cancelledAt) ? Math.abs(r.amount) : r.amount) + '</td><td>' + esc(r.issue || r.message || (!eligible(r) ? '학생·월 확인 필요' : '검사 전')) + '</td></tr>';
    }).join('') + '</tbody></table>' : '';
  }
  function payload(r) { return { monthName:r.monthName, studentName:r.studentName, paidAt:r.paidAt, amount:r.amount, approvalNo:r.approvalNo, cardCompany:r.cardCompany, status:r.status, cancelledAt:r.cancelledAt, itemName:r.itemName, fileName:fileName, dueDate:r.monthName.replace(/s$/,'') + '-01', business:'반포' }; }
  async function process(save) {
    var targets = rows.filter(function(r) { return save ? r.result === 'ready' : eligible(r) && r.result !== 'saved'; });
    stopRequested = false; processing = true; setBusy(true);
    var completed = 0;
    try {
      async function runOne(r) {
        message((save ? '입력' : '중복 검사') + ' 중 · ' + (completed + 1) + '/' + targets.length);
        try {
          var p = payload(r);
          if (save) p.clientRequestId = buildClientRequestId_('payment-link');
          var result = await runServer(save ? 'importTuitionPaymentLink' : 'previewTuitionPaymentLink', p);
          if (!result || result.success === false) throw new Error(result && result.message || '처리 실패');
          r.result = result.duplicate ? 'duplicate' : save ? 'saved' : 'ready';
          r.message = result.duplicate ? result.message || '기존 수납 · 제외' : save ? '입력 완료' : '새 수납 · 입력 가능';
        } catch (error) { r.result = 'error'; r.message = error.message + ' · 재검사 가능'; }
        completed++;
        render(); setBusy(true);
      }
      // Read checks may overlap; financial writes stay sequential and are rechecked by the server.
      var next = 0;
      async function worker() { while (!stopRequested && next < targets.length) { var r = targets[next++]; await runOne(r); } }
      await Promise.all(Array.from({length:save ? 1 : Math.min(3,targets.length)},worker));
      render();
      var counts = rows.reduce(function(a,r) { a[r.result || 'review'] = (a[r.result || 'review'] || 0) + 1; return a; },{});
      message((stopRequested ? '중지됨 · 처리 결과는 유지됩니다. ' : '') + '입력 완료 ' + (counts.saved || 0) + '건 · 중복 제외 ' + (counts.duplicate || 0) + '건 · 입력 가능 ' + (counts.ready || 0) + '건 · 확인 필요 ' + ((counts.error || 0) + (counts.review || 0)) + '건');
      if (save) { refreshTuitionSummary(true); if(window.TuitionRedesign) TuitionRedesign.toast('입력 완료 '+(counts.saved||0)+'건 · 중복 제외 '+(counts.duplicate||0)+'건'); }
    } finally { processing = false; setBusy(false); }
  }
  function renderHistory() {
    var action = $('[data-action]').value;
    var list = events.filter(function(e) { return !action || e.action === action; });
    $('[data-history]').innerHTML = list.length ? list.map(function(e) {
      var p = e.payment || {}, before = e.previousPayment;
      return '<article class="payment-link-event"><span class="payment-link-actor-icon" aria-hidden="true">' + esc((e.actorName || '?').slice(0,1)) + '</span><div><strong>' + esc(e.actorName) + '</strong> <span class="payment-link-action">' + ({created:'입력',updated:'수정',deleted:'삭제'}[e.action]) + '</span><time>' + esc(new Date(e.changedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})) + '</time><p>' + StudentGenderIcons.render(p.studentName) + ' <b>' + window.tuitionMoneyHtml_(p.amount) + '</b> · ' + esc(p.paidAt) + ' · 승인 ' + esc(p.approvalNo || '-') + '</p>' + (before && e.action === 'updated' ? '<small>변경 전: ' + window.tuitionMoneyHtml_(before.amount) + ' · ' + esc(before.paidAt) + ' · 승인 ' + esc(before.approvalNo || '-') + '</small>' : '') + '<small>' + esc(e.reason || '') + (p.importFile ? ' · ' + esc(p.importFile) : '') + '</small></div></article>';
    }).join('') : '<p class="payment-link-empty">이 월에 해당하는 변경 이력이 없습니다.</p>';
  }
  async function history() {
    setBusy(true); message('변경 이력을 불러오는 중입니다.');
    try {
      var result = await runServer('getTuitionPaymentLinkHistory',{monthName:$('[data-month]').value});
      if (!result || !result.success) throw new Error(result && result.message || '이력을 불러오지 못했습니다.');
      events = result.events; renderHistory(); message(result.truncated ? '최대 5,000건을 표시합니다. 전체 이력은 관리자에게 문의해 주세요.' : events.length + '건의 변경 이력');
    } catch (e) { $('[data-history]').textContent = ''; message(e.message); }
    finally { setBusy(false); }
  }
  trigger.addEventListener('click', async function() {
    monthAtOpen = state.tuition.selectedMonth;
    $('[data-month]').innerHTML = options(state.tuition.months || [monthAtOpen],monthAtOpen);
    dialog.showModal(); setBusy(true); message('월별 학생 목록을 준비합니다.');
    try {
      var summaries = await Promise.all((state.tuition.months || [monthAtOpen]).map(function(m) { return runServer('getTuitionMonthSummary',{monthName:m}); }));
      roster = summaries.flatMap(function(s) { if (!s || s.success === false) throw new Error('학생 목록을 불러오지 못했습니다.'); return s.rows || []; });
      render(); message(rows.length ? '이전 미리보기를 유지했습니다. 필요하면 새 파일을 선택하세요.' : '파일을 선택해 주세요.');
    } catch (e) { message(e.message); }
    finally { setBusy(false); }
  });
  async function readFile(file) {
    if (!file || busy) return;
    rows = []; fileName = ''; setBusy(true); message('엑셀을 읽는 중입니다.');
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 .xlsx 파일을 선택해 주세요.');
      var workbook = XLSX.read(await file.arrayBuffer(), {type:'array',cellDates:false,sheetRows:2002});
      var sheet = workbook.Sheets['결제내역'];
      if (!sheet) throw new Error('결제내역 시트를 찾을 수 없습니다.');
      var data = XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});
      if (data.length > 2001 || sheet['!fullref']) throw new Error('한 번에 2,000행 이하로 나누어 업로드해 주세요.');
      fileName = file.name; rows = PaymentLinkParser.parse(data,roster,monthAtOpen);
      rows.forEach(function(r) { if (!(state.tuition.months || []).includes(r.monthName)) r.monthName = ''; });
      render();
      message(rows.length + '건을 읽었습니다. 학생과 귀속 월을 확인해 주세요.');
    } catch (error) { render(); message(error.message); }
    finally { setBusy(false); }
  }
  $('input[type=file]').addEventListener('change',function(e){readFile(e.target.files[0]);});
  $('.payment-link-file').addEventListener('dragover',function(e){e.preventDefault();});
  $('.payment-link-file').addEventListener('drop',function(e){e.preventDefault();readFile(e.dataTransfer.files[0]);});
  $('[data-stop]').onclick=function(){stopRequested=true;this.disabled=true;message('진행 중인 요청을 마친 후 중지합니다. 완료된 결과는 유지됩니다.');};
  $('[data-result-filter]').onchange=function(){filter=this.value;render();setBusy(busy);};
  $('[data-preview]').addEventListener('change', function(e) {
    var el = e.target; if (!el.dataset.field) return;
    var r = rows[Number(el.dataset.row)]; r[el.dataset.field] = el.value; r.result = ''; r.message = ''; render(); setBusy(false);
  });
  $('[data-check]').addEventListener('click',function() { process(false); });
  $('[data-save]').addEventListener('click',function() { process(true); });
  $('[data-reload]').addEventListener('click',history);
  $('[data-month]').addEventListener('change',history);
  $('[data-action]').addEventListener('change',renderHistory);
  dialog.querySelectorAll('[data-tab]').forEach(function(button) { button.addEventListener('click',function() {
    dialog.querySelectorAll('[data-tab]').forEach(function(b) { b.setAttribute('aria-pressed',String(b === button)); });
    dialog.querySelectorAll('[data-pane]').forEach(function(p) { p.hidden = p.dataset.pane !== button.dataset.tab; });
    if (button.dataset.tab === 'history') history();
    else message(rows.length ? rows.length + '건 · 대조 결과를 확인해 주세요.' : '파일을 선택해 주세요.');
  }); });
  $('[data-close]').addEventListener('click',function() { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel',function(e) { if (busy) e.preventDefault(); });
  dialog.addEventListener('close',function() { trigger.focus(); });
})();
