/* Operations refinements: existing authenticated config API remains the persistence boundary. */
var deskQuestionSelection = null;
var deskQuestionDirty = false;
var deskQuestionSaving = false;
function deskQuestionCanEdit_() { return String((state.cloudIdentity || {}).role || '').toUpperCase() === 'ADMIN'; }
function renderDeskQuestionEditor_() {
  var root = document.getElementById('deskQuestionEditor');
  if (!root || deskQuestionDirty || deskQuestionSaving) return;
  var logs = state.desk.responseCenter.logs || [];
  if (deskQuestionSelection === null) deskQuestionSelection = (logs[0] || {}).id || 'new';
  var row = findDeskResponseLog_(deskQuestionSelection);
  var canEdit = deskQuestionCanEdit_();
  var meta = row ? (row.createdByName || '입력자 기록 없음') + ' · ' + formatDeskResponseLogDate_(row.createdAt) : ((state.cloudIdentity || {}).name || '로그인 계정') + ' · 저장 시 접수 일시 자동 기록';
  root.innerHTML = '<form id="deskQuestionForm"><div class="desk-question-editor-head"><h4>' + (row ? '질문별 맞춤 답변' : '질문 직접 입력') + '</h4><span>' + (row && row.answerText ? '답변 저장됨' : '작성 대기') + '</span></div>' +
    '<p class="desk-question-author">입력자 · ' + escapeHtml(meta) + '</p>' +
    '<label>접수된 질문<textarea name="question" rows="4" maxlength="5000" required ' + (row || !canEdit ? 'readonly' : '') + ' placeholder="접수된 질문을 입력하세요.">' + escapeHtml(row ? row.text : '') + '</textarea></label>' +
    '<label>맞춤 답변<textarea name="answer" rows="8" maxlength="20000" ' + (!canEdit ? 'readonly' : '') + ' placeholder="이 질문에 대한 구체적인 답변과 다음 할 일을 작성하세요.">' + escapeHtml(row ? row.answerText || '' : '') + '</textarea></label>' +
    '<p class="desk-question-answer-meta">' + (row && row.answeredAt ? '답변 작성 · ' + escapeHtml(row.answeredByName || '기록 없음') + ' · ' + escapeHtml(formatDeskResponseLogDate_(row.answeredAt)) : '답변 작성자와 저장 시각이 함께 기록됩니다.') + '</p>' +
    '<p class="desk-question-save-status" role="status" aria-live="polite"></p><div class="desk-question-editor-actions"><button type="submit" class="primary" ' + (!canEdit ? 'disabled' : '') + '><i data-lucide="save"></i>' + (row ? '답변 저장' : '질문과 답변 저장') + '</button><button type="button" data-question-copy ' + (!row || !row.answerText ? 'disabled' : '') + '><i data-lucide="copy"></i>답변 복사</button></div>' +
    (!canEdit ? '<p>맞춤 답변은 관리자 계정에서 작성할 수 있습니다.</p>' : '') + '</form>';
  root.querySelector('form').addEventListener('input', function() { deskQuestionDirty = true; });
  root.querySelector('form').addEventListener('submit', saveDeskQuestionAnswer_);
  document.querySelectorAll('[data-question-new]').forEach(function(el) { el.disabled = !canEdit; });
}
async function saveDeskQuestionAnswer_(event) {
  event.preventDefault();
  if (!deskQuestionCanEdit_() || deskQuestionSaving) return;
  var form = event.currentTarget;
  var row = findDeskResponseLog_(deskQuestionSelection);
  var text = form.elements.question.value.trim();
  var answer = form.elements.answer.value.trim();
  var status = form.querySelector('[role="status"]');
  if (!text) { status.textContent = '질문을 입력해 주세요.'; return; }
  if (!state.desk.responseCenter.logsRemoteLoaded) { status.textContent = '질문 목록을 불러온 뒤 다시 저장해 주세요.'; return; }
  var value = normalizeDeskResponseLog_(Object.assign({}, row || {id: 'question_' + crypto.randomUUID(), source: '관리자 직접 입력', status: '미처리'}, {text: text, answerText: answer}));
  deskQuestionSaving = true;
  form.querySelectorAll('button,textarea').forEach(function(el) { el.disabled = true; });
  status.textContent = '저장 중';
  try {
    var saved = await saveDeskPortalConfig_('daily', 'responseLogs/' + value.id, value);
    state.desk.responseCenter.logs = mergeDeskResponseLogs_([saved], (state.desk.responseCenter.logs || []).filter(function(item) { return item.id !== saved.id; }));
    saveDeskResponseLogsLocal_();
    deskQuestionSelection = saved.id; deskQuestionDirty = false; deskQuestionSaving = false;
    renderDeskResponseAdminDashboard_();
    document.querySelector('#deskQuestionEditor [role="status"]').textContent = '저장했습니다.';
  } catch (error) {
    status.textContent = '저장하지 못했습니다. 입력 내용은 유지됩니다. ' + (error.message || '다시 시도해 주세요.');
  } finally {
    deskQuestionSaving = false;
    form.querySelectorAll('button,textarea').forEach(function(el) { el.disabled = false; });
  }
}
function buildDeskDayClipboardText_(dateKey, items, hideManager) {
  var rows = items.filter(function(item) { return item.date === dateKey && (!hideManager || String(item.worker || '').trim() !== '홍성우'); }).slice().sort(compareDeskShift_);
  return [formatDeskDateLabel_(dateKey, true) + ' 근무표', hideManager ? '관리자 제외 · 홍성우' : '', rows.length ? rows.map(function(item) { return item.worker + ' · ' + formatDeskShiftTime_(item) + (item.role ? ' · ' + item.role : ''); }).join('\n') : '등록된 근무 일정 없음', '총 ' + rows.length + '건 · 집계 ' + formatDeskHours_(sumDeskCountedHours_(rows))].filter(Boolean).join('\n');
}
function copyDeskDayScheduleText_(dateKey, hideManager) {
  var items = getDeskVisibleDeskItems_(getDeskMonthItems_(state.desk.currentMonth));
  copyDeskPlainText_(buildDeskDayClipboardText_(dateKey, items, hideManager), function(ok) { showClientMessage(ok ? '해당 날짜의 근무표를 복사했습니다.' : '복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.'); });
}
(function installDeskRefinements() {
  var dashboard = document.getElementById('deskResponseAdminDashboard');
  if (dashboard) {
    dashboard.addEventListener('click', function(event) {
      var select = event.target.closest('[data-question-answer],[data-question-new]');
      if (select) {
        if (deskQuestionSaving || (deskQuestionDirty && !confirm('작성 중인 답변을 저장하지 않고 이동할까요?'))) return;
        deskQuestionSelection = select.hasAttribute('data-question-new') ? 'new' : select.dataset.questionAnswer;
        deskQuestionDirty = false; renderDeskQuestionEditor_(); refreshLucideIcons_();
        var field = document.querySelector('#deskQuestionForm [name="' + (deskQuestionSelection === 'new' ? 'question' : 'answer') + '"]');
        if (field) field.focus();
      }
      if (event.target.closest('[data-question-copy]')) { var field = document.querySelector('#deskQuestionForm [name="answer"]'); copyDeskPlainText_(field.value, function(ok) { showClientMessage(ok ? '답변을 복사했습니다.' : '클립보드 권한을 확인해 주세요.'); }); }
    });
    function protectQuestion(event) {
      if (deskQuestionSaving || (deskQuestionDirty && !confirm('작성 중인 질문과 답변을 저장하지 않고 닫을까요?'))) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      deskQuestionDirty = false;
    }
    dashboard.addEventListener('cancel', protectQuestion);
    document.getElementById('deskResponseAdminCloseBtn').addEventListener('click', protectQuestion, true);
  }
  var panel = document.querySelector('[data-desk-panel="messageTemplates"]');
  if (panel) {
    panel.addEventListener('input', function(event) {
      if (event.target.closest('.desk-template-editor')) { state.desk.messageTemplates.editorDirty = true; deskTemplateEditorStatusEl.textContent = '저장하지 않은 변경'; }
    });
    document.addEventListener('click', function(event) {
      var current = state.desk.messageTemplates;
      if (!current || !current.editorDirty || !panel.contains(event.target) && !event.target.closest('[data-desk-tab],[data-module]')) return;
      var action = event.target.closest('[data-desk-template-tag],[data-desk-template-message],[data-desk-template-target],[data-desk-tab],[data-module],#deskTemplateAddMessageBtn,#deskTemplateAddMessageToTagBtn');
      if (action && !event.target.closest('[data-desk-template-copy-message],[data-desk-template-check]')) {
        if (current.editorSaving || !confirm('편집 중인 메시지를 저장하지 않고 이동할까요?')) { event.preventDefault(); event.stopImmediatePropagation(); }
        else current.editorDirty = false;
      }
    }, true);
    panel.addEventListener('click', function(event) { if (event.target.closest('[data-desk-template-tone]')) { state.desk.messageTemplates.editorDirty = true; deskTemplateEditorStatusEl.textContent = '저장하지 않은 변경'; } });
  }
  window.addEventListener('beforeunload', function(event) { if (deskQuestionDirty || state.desk.messageTemplates.editorDirty) { event.preventDefault(); event.returnValue = ''; } });
})();
