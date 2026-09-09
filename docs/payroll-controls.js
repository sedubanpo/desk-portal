/* Presentation adapters retain the original selects and change handlers. */
(function() {
  'use strict';
  function init() {
    var host = document.getElementById('moduleTeacher');
    if (!host) return;
    function enhance(id, searchable) {
      var select = document.getElementById(id); if (!select) return;
      var label = select.labels && select.labels[0];
      var title = label ? label.textContent : '선택';
      var wrap = document.createElement('div'); wrap.className='payroll-picker';
      var trigger = document.createElement('button');trigger.type='button';trigger.className='payroll-picker-trigger';trigger.setAttribute('aria-label',title);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
      var panel=document.createElement('div');panel.className='payroll-picker-panel';panel.hidden=true;
      var search=document.createElement('input');search.type='search';search.placeholder='강사명 검색';search.setAttribute('aria-label',title+' 검색');
      var list=document.createElement('div');list.role='listbox';list.id=id+'Choices';list.setAttribute('aria-label',title);trigger.setAttribute('aria-controls',list.id);
      if(searchable)panel.append(search);panel.append(list);wrap.append(trigger,panel);select.after(wrap);select.hidden=true;
      if(label){label.htmlFor=id+'Trigger';trigger.id=id+'Trigger';}
      function close(focus){panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
      function options(){
        list.replaceChildren();var term=search.value.trim().toLocaleLowerCase();
        Array.from(select.options).filter(function(o){return !term||o.textContent.toLocaleLowerCase().includes(term);}).forEach(function(o){
          var b=document.createElement('button');b.type='button';b.role='option';b.textContent=o.textContent;b.disabled=o.disabled;b.setAttribute('aria-selected',String(o.selected));
          b.onclick=function(){select.value=o.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close(true);};list.append(b);
        });
        if(!list.children.length){var empty=document.createElement('p');empty.textContent='검색 결과가 없습니다.';list.append(empty);}
      }
      function sync(){trigger.textContent=(select.selectedOptions[0]||{}).textContent||'선택';trigger.disabled=select.disabled||!select.options.length;if(!panel.hidden)options();}
      trigger.onclick=function(){var opening=panel.hidden;document.dispatchEvent(new Event('payroll-picker-close'));if(opening){panel.hidden=false;trigger.setAttribute('aria-expanded','true');search.value='';options();if(searchable)search.focus();else {var b=list.querySelector('[aria-selected="true"]')||list.querySelector('button');if(b)b.focus();}}};
      wrap.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();close(true);}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(panel.hidden){trigger.click();return;}var buttons=Array.from(list.querySelectorAll('button:not(:disabled)'));var i=buttons.indexOf(document.activeElement);var next=buttons[i<0?(e.key==='ArrowDown'?0:buttons.length-1):(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length];if(next)next.focus();}});
      wrap.addEventListener('focusout',function(e){if(!wrap.contains(e.relatedTarget))close(false);});
      document.addEventListener('pointerdown',function(e){if(!wrap.contains(e.target))close(false);});document.addEventListener('payroll-picker-close',function(){close(false);});
      search.oninput=options;select.addEventListener('change',sync);new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true});sync();
      return sync;
    }
    var syncs=['monthSelect','teacherSelect','payrollBulkTeacherSelect','attendanceFilterSelect','recognizedFilterSelect','classTypeFilterSelect'].map(function(id){return enhance(id,id.includes('Teacher')||id==='teacherSelect');}).filter(Boolean);
    var subject=document.getElementById('subjectSelect');subject.hidden=true;
    var buttons=document.createElement('div');buttons.className='payroll-subject-buttons';buttons.setAttribute('role','group');buttons.setAttribute('aria-label','과목군 · 선택한 과목을 다시 누르면 전체');subject.after(buttons);
    var glyphs=['<path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16"/>','<path d="M3 5h12M9 3v2M5 5c0 6 5 10 9 11M13 5c0 6-5 10-10 12M14 21l4-10 4 10M16 17h4"/>','<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2"/>','<path d="M9 3h6M10 3v7L4 20q0 1 2 1h12q2 0 2-1l-6-10V3M7 15h10"/>','<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>'];
    ['국어','영어','수학','과학','사회'].forEach(function(name,i){var b=document.createElement('button');b.type='button';b.dataset.subject=name;b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+glyphs[i]+'</svg>'+name;b.onclick=function(){subject.value=subject.value===name?'':name;subject.dispatchEvent(new Event('change',{bubbles:true}));syncSubjects();syncs.forEach(function(f){f();});};buttons.append(b);});
    function syncSubjects(){Array.from(buttons.children).forEach(function(b){b.setAttribute('aria-pressed',String(subject.value===b.dataset.subject));b.title=subject.value===b.dataset.subject?'다시 눌러 전체 과목 보기':b.dataset.subject;});}
    new MutationObserver(syncSubjects).observe(subject,{childList:true,subtree:true,attributes:true});subject.addEventListener('change',syncSubjects);syncSubjects();

  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
