/* Message composition uses transient names; only reusable template content is saved. */
function personalizeTemplate_(text, names) {
  var values = {'학생명':names.student,'강사명':names.teacher,'담당강사':names.teacher,'지원자명':names.applicant};
  return String(text || '').replace(/\{(학생명|강사명|담당강사|지원자명)\}/g, function(token,key) { return String(values[key] || '').trim() || token; });
}
function templateNames_() {
  function value(id) { return (document.getElementById(id).value || '').trim(); }
  return {student:value('templateStudentName'),teacher:value('templateTeacherName'),applicant:value('templateApplicantName')};
}
function templateTimestamp_(value) {
  var date = new Date(value);
  return !value || !Number.isFinite(date.getTime()) ? '시각 기록 없음' : date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
}
function copyCompletedTemplate_(text) {
  var result = personalizeTemplate_(text,templateNames_());
  if (!result.trim()) return;
  var missing = result.match(/\{[^{}]+\}/g);
  if (missing && !confirm('아직 입력하지 않은 항목: ' + Array.from(new Set(missing)).join(', ') + '\n이 상태로 복사할까요?')) return;
  return copyDeskPlainText_(result);
}
function updateDeskMessageTemplatePreview_() {
  var item = findDeskMessageTemplate_(state.desk.messageTemplates.selectedTemplateId);
  var text = item && deskTemplateMessageInputEl ? deskTemplateMessageInputEl.value : '';
  var output = personalizeTemplate_(text,templateNames_());
  deskTemplatePreviewEl.textContent = output || '목록에서 사용할 문구를 선택하세요.';
  document.getElementById('templateOutputTitle').textContent = item ? deskTemplateTitleInputEl.value : '문구를 선택하세요';
  document.getElementById('templateOutputTarget').textContent = item ? deskTemplateTargetSelectEl.value + ' 대상' : '';
  var missing = output.match(/\{[^{}]+\}/g);
  document.getElementById('templateMissingNames').textContent = missing ? '입력 필요 · ' + Array.from(new Set(missing)).join(' · ') : (output ? '입력한 이름이 반영되었습니다. 내용을 확인한 뒤 복사하세요.' : '');
  deskTemplateCopyBtnEl.disabled = !output.trim();
}
function templateData_() {
  var current = state.desk.messageTemplates;
  return JSON.parse(JSON.stringify({tags:current.tags || [],templates:current.templates || []}));
}
function applyTemplateData_(value) {
  var current = state.desk.messageTemplates;
  current.tags = value.tags || []; current.templates = value.templates || []; current.history = value.history || {};
  current.dataInitialized = true;
  try { localStorage.setItem(DESK_MESSAGE_TEMPLATES_STORAGE_KEY,JSON.stringify(value)); } catch (e) {}
}
async function commitTemplateData_(data, options) {
  var current = state.desk.messageTemplates;
  if (current.remoteSaving) return false;
  current.remoteSaving = true;
  var controls = Array.from(document.querySelectorAll('[data-desk-panel="messageTemplates"] input,[data-desk-panel="messageTemplates"] select,[data-desk-panel="messageTemplates"] textarea,[data-desk-panel="messageTemplates"] button')).map(function(el) { var saved = {el:el,disabled:el.disabled}; el.disabled=true; return saved; });
  var status = document.getElementById('templateSyncStatus');
  status.textContent = '문구와 변경 이력을 저장하고 있습니다.';
  try {
    var saved = await saveDeskPortalConfig_('daily','messageTemplates',data);
    applyTemplateData_(saved);
    if (options && options.selectedId) current.selectedTemplateId = options.selectedId;
    if (options && options.tagId) current.selectedTagId = options.tagId;
    current.editorDirty = false;
    renderDeskMessageTemplates_();
    updateDeskMessageTemplatePreview_();
    status.textContent = '저장 완료 · 실행자와 일시가 변경 이력에 기록되었습니다.';
    return true;
  } catch (err) {
    status.textContent = '저장하지 못했습니다. 입력 내용은 유지됩니다. ' + (err.message || '다시 시도해 주세요.');
    return false;
  } finally { current.remoteSaving = false; controls.forEach(function(entry) { if(entry.el.isConnected) entry.el.disabled=entry.disabled; }); if(!findDeskMessageTemplate_(current.selectedTemplateId)) document.querySelector('.desk-template-editor').querySelectorAll('input,select,textarea,button').forEach(function(el) { el.disabled=true; }); updateDeskMessageTemplatePreview_(); }
}
async function saveDeskMessageTemplateFromEditor_() {
  var current = state.desk.messageTemplates;
  var item = findDeskMessageTemplate_(current.selectedTemplateId);
  if (!item || current.remoteSaving) return;
  var next = Object.assign({},item,{title:deskTemplateTitleInputEl.value.trim(),target:deskTemplateTargetSelectEl.value,tagId:deskTemplateTagSelectEl.value,tone:current.selectedTone,message:deskTemplateMessageInputEl.value.trim()});
  if (!next.title || !next.message) { showClientMessage('문구 제목과 내용을 입력해 주세요.'); return; }
  var data = templateData_(); data.templates = data.templates.map(function(row) { return row.id === item.id ? next : row; });
  await commitTemplateData_(data,{selectedId:next.id,tagId:next.tagId});
}
async function addDeskMessageTemplate_() {
  var tag = findDeskMessageTag_(state.desk.messageTemplates.selectedTagId);
  var data = templateData_();
  var item = {id:buildDeskShiftId_('messageTemplate',Date.now(),Math.random().toString(36).slice(2)),tagId:tag?tag.id:'',target:tag?tag.target:'학부모',title:'새 메시지 문구',tone:'정중하게',message:'{학생명} 학생 관련 안내드립니다.'};
  data.templates.unshift(item);
  if (await commitTemplateData_(data,{selectedId:item.id})) { document.getElementById('templateEditDetails').open = true; deskTemplateTitleInputEl.focus(); deskTemplateTitleInputEl.select(); }
}
async function duplicateDeskMessageTemplate_(id) {
  var item = findDeskMessageTemplate_(id); if (!item) return;
  var copy = Object.assign({},item,{id:buildDeskShiftId_('messageTemplate',Date.now(),Math.random().toString(36).slice(2)),title:item.title+' 복사본'});
  var data = templateData_(); data.templates.unshift(copy);
  if (await commitTemplateData_(data,{selectedId:copy.id,tagId:copy.tagId})) document.getElementById('templateEditDetails').open = true;
}
async function deleteDeskMessageTemplate_(id) {
  var item = findDeskMessageTemplate_(id); if (!item || !confirm("'"+item.title+"' 문구를 삭제할까요? 삭제 이력은 보관됩니다.")) return;
  var data = templateData_(); data.templates = data.templates.filter(function(row) { return row.id !== id; });
  await commitTemplateData_(data);
}
async function addDeskMessageTag_() {
  var label = prompt('추가할 유형 태그명을 입력해 주세요.',''); if (!label || !label.trim()) return;
  var data = templateData_(); var tag = {id:buildDeskShiftId_('messageTag',Date.now(),Math.random().toString(36).slice(2)),label:label.trim(),target:'학부모',icon:'tag',description:'',procedure:''};
  data.tags.push(tag); await commitTemplateData_(data,{tagId:tag.id});
}
async function editDeskMessageTag_(id) {
  var data = templateData_(); var tag = data.tags.find(function(row) { return row.id === id; }); if (!tag) return;
  var label = prompt('유형 태그명',tag.label); if (!label || !label.trim()) return;
  var target = prompt('대상: 학생, 강사, 학부모, 지원자, 내부 업무',tag.target); if (target === null) return;
  tag.label = label.trim(); tag.target = target.trim() || tag.target; await commitTemplateData_(data);
}
async function deleteDeskMessageTag_(id) {
  var data = templateData_(); var tag = data.tags.find(function(row) { return row.id === id; });
  if (!tag || !confirm("'"+tag.label+"' 태그를 삭제할까요? 문구는 다른 태그로 이동합니다.")) return;
  data.tags = data.tags.filter(function(row) { return row.id !== id; });
  data.templates.forEach(function(row) { if(row.tagId===id) row.tagId=data.tags[0]?data.tags[0].id:''; });
  await commitTemplateData_(data,{tagId:data.tags[0]?data.tags[0].id:''});
}
function renderDeskMessageTemplateHistory_() {
  var current = state.desk.messageTemplates;
  var events = Object.values(current.history || {}).sort(function(a,b) { return String(b.at).localeCompare(String(a.at)); });
  var limit = current.historyLimit || 8;
  deskTemplateAuditListEl.innerHTML = events.length ? events.slice(0,limit).map(function(event) {
    var label = {create:'추가',update:'수정',delete:'삭제'}[event.action] || '변경';
    return '<details class="template-audit-entry"><summary><span class="template-audit-action '+escapeHtml(event.action)+'">'+label+'</span><strong>'+escapeHtml(event.title)+'</strong><span>'+escapeHtml(event.actorName || '실행자 기록 없음')+'</span><time>'+escapeHtml(templateTimestamp_(event.at))+'</time></summary><div class="template-audit-detail">'+(event.before?'<strong>변경 전</strong><pre>'+escapeHtml(event.before.message || event.before.label || '')+'</pre>':'')+(event.after?'<strong>변경 후</strong><pre>'+escapeHtml(event.after.message || event.after.label || '')+'</pre>':'<p>문구가 삭제되었습니다. 삭제 전 내용은 위에 보관됩니다.</p>')+'</div></details>';
  }).join('') : '<p class="template-history-empty">아직 저장된 변경 이력이 없습니다. 다음 추가·수정·삭제부터 실행자와 일시가 기록됩니다.</p>';
  document.getElementById('templateHistoryMore').hidden = events.length <= limit;
  var recent = (current.templates || []).filter(function(item) { return Number.isFinite(new Date(item.updatedAt).getTime()); }).sort(function(a,b) { return new Date(b.updatedAt)-new Date(a.updatedAt); }).slice(0,4);
  deskTemplateRecentListEl.innerHTML = recent.length ? recent.map(function(item) { return '<div class="template-recent-entry"><strong>'+escapeHtml(item.title)+'</strong><span>'+escapeHtml(item.updatedBy || '실행자 기록 없음')+' · '+escapeHtml(templateTimestamp_(item.updatedAt))+'</span></div>'; }).join('') : '<p class="template-history-empty">기존 문구의 수정 일시는 확인되지 않습니다.</p>';
}
if (typeof module !== 'undefined' && module.exports) module.exports = {personalizeTemplate_,templateTimestamp_};
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded',function() {
  ['templateStudentName','templateTeacherName','templateApplicantName'].forEach(function(id) { document.getElementById(id).addEventListener('input',updateDeskMessageTemplatePreview_); });
  document.getElementById('deskTemplateVariableRow').addEventListener('click',function(event) { if(event.target.closest('[data-desk-template-variable]')) { state.desk.messageTemplates.editorDirty=true; deskTemplateEditorStatusEl.textContent='저장하지 않은 변경'; } });
  document.getElementById('templateHistoryMore').addEventListener('click',function() { state.desk.messageTemplates.historyLimit=(state.desk.messageTemplates.historyLimit || 8)+20; renderDeskMessageTemplateHistory_(); });
  document.querySelector('[data-desk-panel="messageTemplates"]').addEventListener('click',function(event) {
    if (state.desk.messageTemplates.remoteSaving) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (event.target.closest('[data-desk-template-edit-message]')) document.getElementById('templateEditDetails').open = true;
  },true);
  document.querySelector('[data-desk-panel="messageTemplates"]').addEventListener('beforeinput',function(event) { if(state.desk.messageTemplates.remoteSaving) event.preventDefault(); },true);
  var originalEditor = renderDeskMessageTemplateEditor_;
  renderDeskMessageTemplateEditor_ = function() { originalEditor(); updateDeskMessageTemplatePreview_(); };
});
