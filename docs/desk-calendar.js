// Keep the source input as the form value so existing validation and listeners still work.
(() => {
  'use strict';
  const selector = 'input[type="date"], input[type="month"], [data-desk-calendar-for]';
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(new Date());
  const pad = value => String(value).padStart(2,'0');
  function dateAt(year, month, day) {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    return date;
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'desk-picker';
  dialog.setAttribute('aria-labelledby','deskPickerTitle');
  dialog.innerHTML = `
    <header><strong id="deskPickerTitle"></strong><button type="button" data-close aria-label="달력 닫기">×</button></header>
    <div class="dp-nav"><button type="button" data-prev>‹</button>
      <label><input type="number" min="1" max="9999" aria-label="달력 연도">년</label>
      <button type="button" data-months></button><button type="button" data-next>›</button>
    </div><div class="dp-week" aria-hidden="true">일 월 화 수 목 금 토</div>
    <div class="dp-grid" role="group"></div>
    <footer><button type="button" data-clear>지우기</button><button type="button" data-today></button></footer>`;
  document.body.append(dialog);
  const find = query => dialog.querySelector(query);
  const grid = find('.dp-grid');
  find('.dp-week').replaceChildren(...[...'일월화수목금토'].map(day => {
    const span = document.createElement('span'); span.textContent = day; return span;
  }));
  let field, trigger, year, month, monthly, monthGrid, current, probe;
  const prefix = () => String(year).padStart(4,'0') + '-' + pad(month);
  function valid(value) {
    if ((field.min && value < field.min) || (field.max && value > field.max)) return false;
    probe.value = value;
    return probe.value === value && probe.validity.valid;
  }
  function monthAllowed(key) {
    if (monthly) return valid(key);
    return (!field.min || key >= field.min.slice(0,7)) && (!field.max || key <= field.max.slice(0,7));
  }
  function draw(focusValue) {
    const key = prefix(), now = today();
    find('input').value = year;
    find('[data-months]').textContent = monthGrid ? '월 선택' : month+'월 ▾';
    find('[data-months]').disabled = monthly || monthGrid;
    find('[data-prev]').setAttribute('aria-label',monthGrid?'이전 연도':'이전 달');
    find('[data-next]').setAttribute('aria-label',monthGrid?'다음 연도':'다음 달');
    const lower = (field.min || '0001-01').slice(0,7);
    const upper = (field.max || '9999-12').slice(0,7);
    find('[data-prev]').disabled = monthGrid ? year <= Number(lower.slice(0,4)) : key <= lower;
    find('[data-next]').disabled = monthGrid ? year >= Number(upper.slice(0,4)) : key >= upper;
    find('.dp-week').hidden = monthGrid;
    grid.classList.toggle('dp-month-grid',monthGrid);
    grid.setAttribute('aria-label',monthGrid ? year+'년 월 선택' : year+'년 '+month+'월 날짜 선택');
    grid.replaceChildren();
    const count = monthGrid ? 12 : dateAt(year,month+1,0).getUTCDate();
    for (let n=1; n<=count; n++) {
      const value = monthGrid ? key.slice(0,5)+pad(n) : key+'-'+pad(n);
      const btn = document.createElement('button');
      btn.type='button'; btn.dataset.value=value; btn.textContent=n+(monthGrid?'월':'');
      btn.setAttribute('aria-label',value);
      btn.setAttribute('aria-pressed',String(value === (monthGrid?current.slice(0,7):current)));
      if (value === (monthGrid?now.slice(0,7):now)) btn.setAttribute('aria-current','date');
      btn.disabled = monthGrid ? !monthAllowed(value) : !valid(value);
      if (!monthGrid && n===1) btn.style.gridColumnStart=dateAt(year,month,1).getUTCDay()+1;
      grid.append(btn);
    }
    if (focusValue) (grid.querySelector('[data-value="'+focusValue+'"]:enabled') || grid.querySelector('button:enabled') || find('[data-close]')).focus();
  }
  function open(target) {
    const input = target.dataset.deskCalendarFor ? document.getElementById(target.dataset.deskCalendarFor) : target;
    if (!input || input.matches(':disabled') || input.readOnly || dialog.open) return;
    field=input; trigger=target;
    monthly=field.getAttribute('type')==='month'; monthGrid=monthly;
    probe=document.createElement('input'); probe.type=monthly?'month':'date';
    for (const attr of ['min','max','step','value']) if (field.hasAttribute(attr)) probe.setAttribute(attr,field.getAttribute(attr));
    current=field.value;
    if (target.dataset.deskCalendarFor) {
      const parts=/^(\d{2}|\d{4})-(\d{1,2})-(\d{1,2})/.exec(current);
      current=parts ? (parts[1].length===2?'20':'')+parts[1]+'-'+pad(parts[2])+'-'+pad(parts[3]) : '';
    }
    const now=today(), todayValue=monthly?now.slice(0,7):now;
    const initial=[current,todayValue,field.min,field.max].find(value=>value && valid(value)) || todayValue;
    [year,month]=initial.split('-').map(Number);
    const label = field.getAttribute('aria-label') || field.labels?.[0]?.textContent.trim() || (monthly?'월 선택':'날짜 선택');
    find('#deskPickerTitle').textContent=label;
    find('[data-clear]').disabled=field.required;
    find('[data-today]').textContent=monthly?'이번 달':'오늘';
    find('[data-today]').disabled=!valid(todayValue);
    dialog.showModal();
    draw(monthGrid?initial.slice(0,7):initial);
  }
  function choose(value) {
    if (!field.isConnected || field.matches(':disabled') || field.readOnly) {dialog.close();return;}
    const input=field;
    if (value && !valid(value)) return;
    if (trigger.dataset.deskCalendarFor && value && !/^\d{4}-/.test(input.value) && value.startsWith('20')) value=value.slice(2);
    dialog.close();
    if (input.value===value) return;
    input.value=value;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function shift(delta) {
    const date=dateAt(year,month+(monthGrid?delta*12:delta),1);
    year=date.getUTCFullYear();month=date.getUTCMonth()+1;draw();
  }
  find('[data-prev]').onclick=()=>shift(-1);
  find('[data-next]').onclick=()=>shift(1);
  find('[data-months]').onclick=()=>{monthGrid=true;draw(prefix());};
  find('input').onchange=event=>{
    const n=event.target.valueAsNumber;
    if (Number.isInteger(n) && n>=1 && n<=9999) year=n;
    draw();
  };
  grid.onclick=event=>{
    const value=event.target.closest('[data-value]')?.dataset.value;
    if (!value) return;
    if (monthGrid && !monthly) {month=Number(value.slice(5));monthGrid=false;draw(value+'-01');}
    else choose(value);
  };
  grid.onkeydown=event=>{
    const value=event.target.dataset.value;
    const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:monthGrid?-3:-7,ArrowDown:monthGrid?3:7}[event.key];
    if (!value || !step) return;
    event.preventDefault();
    const [y,m,d]=value.split('-').map(Number);
    const dest=monthGrid ? dateAt(y,m+step,1) : dateAt(y,m,d+step);
    if (dest.getUTCFullYear()<1 || dest.getUTCFullYear()>9999) return;
    const next=dest.toISOString().slice(0,monthGrid?7:10);
    if (monthGrid ? !monthAllowed(next) : !valid(next)) return;
    year=dest.getUTCFullYear();month=dest.getUTCMonth()+1;draw(next);
  };
  find('[data-close]').onclick=()=>dialog.close();
  find('[data-clear]').onclick=()=>choose('');
  find('[data-today]').onclick=()=>choose(today().slice(0,monthly?7:10));
  dialog.addEventListener('click',event=>{
    if (event.target!==dialog) return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close();
  });
  dialog.addEventListener('keydown',event=>{
    if (event.key==='Escape') {event.stopPropagation();event.preventDefault();dialog.close();}
  });
  // Delegation also covers fields created later in a sheet, dialog or filtered list.
  function activate(event) {
    const target=event.target.closest?.(selector);
    if (!target || target.matches(':disabled,[readonly]')) return;
    event.preventDefault();
    event.stopPropagation();
    open(target);
  }
  document.addEventListener('click',activate,true);
  document.addEventListener('keydown',event=>{
    if (['Enter',' ','F4'].includes(event.key) || (event.altKey && event.key==='ArrowDown')) activate(event);
  },true);
})();
