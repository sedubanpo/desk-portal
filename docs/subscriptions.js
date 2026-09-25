/* Subscription ledger: monthly manual entries, isolated from stock data. */
(function () {
  'use strict';
  const presets = [
    ['google', '구글 오피스', 'Google Workspace', 'google.svg'],
    ['chatgpt', 'ChatGPT', 'AI 업무 도구', 'openai.svg'],
    ['firebase', 'Firebase', '앱 · 데이터 서비스', 'firebase.svg'],
    ['supabase', 'Supabase', '데이터베이스', 'supabase.svg'],
    ['notion', '노션', '문서 · 협업', 'notion.svg'],
    ['baemin', '배민클럽', '배달 멤버십', 'baemin.png']
  ];
  const details = window.SubscriptionDetails;
  let fx=null, fxLoading=false, selectedService='';
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let records = {}, providers = {}, loaded = false, loading = false, busy = false, editing = '', draftLogo = '', owner = '', logoRequest = 0, logoLoading = false;
  let month = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date());
  function services() {
    const base = presets.map(([id,name,description,asset]) => ({id,name,description,asset,active:true,payments:{},...(records[id] || {})}));
    return base.concat(Object.keys(records).filter(id => !presets.some(p => p[0] === id)).map(id => ({payments:{},...records[id],id})));
  }
  function logo(s) { return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.logo || '') ? s.logo : (s.asset && presets.some(p => p[3] === s.asset) ? './assets/subscriptions/' + s.asset : ''); }
  function logoHTML(s) { const src = logo(s); return src ? '<img class="'+(s.asset==='baemin.png'?'sub-wide-logo':'')+'" src="'+esc(src)+'" alt="" width="40" height="40">' : '<span class="sub-initial" aria-hidden="true">'+esc(s.name.slice(0,1))+'</span>'; }
  function manualEntry(s) { return s.payments && s.payments[month] || {}; }
  function entry(s) {
    const manual=manualEntry(s),linked=s.linkedPayments && s.linkedPayments[month] || {};
    const p=manual.amount != null ? {...manual,_source:'manual'} : linked.amount != null ? {...linked,date:manual.date || linked.date || '',status:manual.status || linked.status,note:manual.note || linked.note || '',_source:'linked'} : {...manual,_source:'empty'};
    return {...p,billingCycle:manual.billingCycle || 'unknown',paymentCard:manual.paymentCard || null};
  }
  function fxText(p) {const n=details.estimate(p,fx);return n==null?'원화 예상액: '+(fxLoading?'환율 조회 중':'환율 조회 불가'):'약 '+money(n,'KRW');}
  function fxPreview() { const p={currency:el('subCurrency').value,amount:el('subAmount').value};el('subFxPreview').textContent=p.currency==='USD'&&p.amount!==''?fxText(p)+(fx?' · '+fx.date+' 기준 · 수수료 제외':''):''; }
  async function loadFx() {
    if(fxLoading)return;fxLoading=true;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try {const response=await fetch('https://api.frankfurter.dev/v2/rate/USD/KRW',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw new Error('rate');const value=await response.json();if(!Number.isFinite(value.rate)||value.rate<=0||!details.validDate(value.date))throw new Error('rate');fx={rate:value.rate,date:value.date};}catch(e){fx=null;}finally{clearTimeout(timer);fxLoading=false;if(loaded)render();fxPreview();}
  }
  function cardHTML(card) {const found=card&&details.cards.find(c=>c[0]===card.issuer);return '<span class="sub-card-display">'+(found?'<img src="./assets/cards/'+found[2]+'" width="22" height="22" alt="">':'')+esc(details.cardLabel(card))+'</span>';}
  function included() { return services().filter(s => s.active !== false || s.payments && s.payments[month] || s.linkedPayments && s.linkedPayments[month]); }
  function money(n,c) { return n == null || n === '' ? '미입력' : new Intl.NumberFormat('ko-KR',{style:'currency',currency:c || 'KRW',maximumFractionDigits:c === 'USD' ? 2 : 0}).format(Number(n)); }
  function totals(list) { const result = {}; list.forEach(s => {const p=entry(s); if(p.amount != null && p.amount !== '') result[p.currency || 'KRW']=(result[p.currency || 'KRW'] || 0)+details.monthlyAmount(p);}); return result; }
  function status(text,error) { el('subStatus').textContent=text; el('subStatus').classList.toggle('sub-error',!!error); }
  function sourceHTML(s,p) { if(p._source==='manual') return '<span class="sub-source sub-manual">수동 입력</span>'; if(p._source==='linked') return '<span class="sub-source sub-linked">연동 · 예상</span><small class="sub-source-detail">'+esc(p.source==='supabase-management-estimate'?'Supabase 공식 API':'Google Cloud 결제 내보내기')+'</small>'; const sync=s.sync || {}; return sync.status==='error'?'<span class="sub-source sub-error-source">연동 오류</span>':'<span class="sub-source">미입력</span>'; }
  function provider(s) { return providers[s.id] || {mode:'manual',label:'수동 입력',reason:s.id && s.id.startsWith('custom-')?'직접 추가한 구독은 수동 입력만 지원합니다.':'공식 청구 연동을 지원하지 않습니다.',officialUrl:'',configured:false}; }
  function render() {
    const list=included(), sum=totals(list), known=list.filter(s => entry(s).amount != null).length;
    el('subMonth').value=month;
    const complete=!(sum.USD&&!fx),totalKRW=(sum.KRW||0)+(fx?(sum.USD||0)*fx.rate:0);
    el('subTotal').textContent=Object.keys(sum).length ? '월 '+(complete?money(totalKRW,'KRW')+(sum.USD?' (예상)':''):Object.keys(sum).map(c=>money(sum[c],c)).join(' / ')) : '결제 금액을 입력해 주세요';
    el('subSummary').textContent=month.replace('-','년 ')+'월 · 금액 입력 '+known+'/'+list.length+'개 · 연간 결제는 12개월로 나눠 합산 · 주기 미입력은 월 금액으로 계산'+(fx?' · 원화 예상: '+fx.date+' 환율, 수수료 제외':'');
    el('subList').innerHTML=list.map(s=>{const p=entry(s),cap=provider(s),linkedMode=['google-cloud-billing-export','supabase-management-estimate'].includes(s.integrationMode),canSync=linkedMode&&cap.configured;return '<tr><th scope="row"><div class="sub-brand">'+logoHTML(s)+'<div><strong>'+esc(s.name)+'</strong><small>'+esc(s.plan || s.description || '직접 등록한 구독')+(s.active === false ? ' · 사용 중지' : '')+'</small></div></div></th><td class="sub-date">'+esc(p.date || '미입력')+'<small>'+esc(details.cycleLabel(p.billingCycle))+'</small></td><td class="sub-amount">'+esc(money(p.amount,p.currency))+(p.billingCycle==='yearly'?'<small class="sub-monthly">월 '+esc(money(details.monthlyAmount(p),p.currency))+' · 연간 ÷ 12</small>':'')+(p.currency==='USD'&&p.amount!=null?'<small>'+esc(fxText(p))+'</small>':'')+'</td><td><span class="sub-state '+(p.status === 'paid'?'sub-paid':'')+'">'+details.icon(p.status)+(p.status === 'paid'?'결제 완료':p.status === 'scheduled'?'결제 예정':'미확인')+'</span></td><td>'+cardHTML(p.paymentCard)+'</td><td class="sub-note">'+esc(p.note || '—')+'</td><td><div class="sub-row-actions"><button type="button" data-sub-edit="'+esc(s.id)+'" aria-label="'+esc(s.name)+' 결제 기록 입력">기록 입력</button>'+(linkedMode?'<button type="button" data-sub-sync="'+esc(s.id)+'" '+(canSync?'':'disabled')+' aria-label="'+esc(s.name)+' 공식 비용 동기화">'+(canSync?'비용 동기화':'연동 설정 필요')+'</button>':'')+'</div></td></tr>';}).join('') || '<tr><td colspan="7">표시할 구독이 없습니다. 구독 설정에서 추가해 주세요.</td></tr>';
    renderChart(list);
    el('subList').querySelectorAll('[data-sub-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.subEdit));
    el('subList').querySelectorAll('[data-sub-sync]').forEach(b=>b.onclick=()=>syncRecord(b.dataset.subSync));
  }
  function renderChart(list) {
    const colors=['#2563eb','#0d9488','#7c3aed','#e87924','#db4877','#557b38','#0e7490','#8b5e3c'];
    const rows=list.map((s,i)=>({s,p:entry(s),value:details.monthlyKRW(entry(s),fx),color:colors[i%colors.length]})),total=rows.reduce((n,r)=>n+(r.value||0),0),missing=rows.filter(r=>r.value==null).length,unconverted=rows.some(r=>r.p.currency==='USD'&&r.p.amount>0&&!fx);
    if(!rows.some(r=>r.s.id===selectedService))selectedService=(rows.find(r=>r.value>0)||rows[0]||{}).s?.id||'';
    let offset=0;
    const arcs=rows.filter(r=>r.value>0).map(r=>{const percent=r.value/total*100,start=offset;offset+=percent;return '<circle class="sub-arc" cx="140" cy="140" r="112" fill="none" stroke="'+r.color+'" stroke-width="26" pathLength="100" stroke-dasharray="'+percent+' '+(100-percent)+'" stroke-dashoffset="'+(-start)+'" transform="rotate(-90 140 140)" role="button" tabindex="0" data-sub-detail="'+esc(r.s.id)+'" aria-label="'+esc(r.s.name)+' '+percent.toFixed(1)+'% 상세 보기" aria-pressed="'+(r.s.id===selectedService)+'"><title>'+esc(r.s.name)+' '+percent.toFixed(1)+'%</title></circle>';}).join('');
    const selected=rows.find(r=>r.s.id===selectedService);
    el('subChart').innerHTML='<h4>월별 지출 구성</h4><div class="sub-donut"><svg viewBox="0 0 280 280" aria-label="구독별 월 지출 비율"><circle cx="140" cy="140" r="112" fill="none" stroke="#e8edf5" stroke-width="26"/>'+arcs+'</svg><div class="sub-donut-center"><span>'+ (unconverted?'원화 소계':'월별 총 금액')+'</span><strong>'+ (rows.some(r=>r.value!=null)?esc(money(total,'KRW')):'미입력')+'</strong><small>'+ (unconverted?'달러 환산 대기':rows.some(r=>r.p.currency==='USD'&&r.p.amount!=null)?'환율 적용 예상액':'월 환산 기준')+'</small></div></div><p class="sub-chart-help">'+(unconverted?'환율 조회 전에는 달러 항목을 비율에서 제외합니다.':missing?'금액 미입력 '+missing+'개는 비율에서 제외합니다.':'연간 결제는 12개월로 나눈 금액입니다.')+'</p><div class="sub-legend">'+rows.map(r=>'<button type="button" data-sub-detail="'+esc(r.s.id)+'" aria-pressed="'+(r.s.id===selectedService)+'"><span class="sub-swatch" style="background:'+r.color+'"></span><span>'+esc(r.s.name)+'</span><strong>'+ (r.value==null?'—':total>0?(r.value/total*100).toFixed(1)+'%':'0.0%')+'</strong></button>').join('')+'</div>'+(selected?'<div class="sub-chart-detail" aria-live="polite"><div class="sub-brand">'+logoHTML(selected.s)+'<strong>'+esc(selected.s.name)+'</strong></div><dl><div><dt>월 환산액</dt><dd class="sub-spend">'+esc(money(details.monthlyAmount(selected.p),selected.p.currency))+'</dd></div><div><dt>입력 금액</dt><dd class="sub-spend">'+esc(money(selected.p.amount,selected.p.currency))+' · '+esc(details.cycleLabel(selected.p.billingCycle))+'</dd></div><div><dt>납부일</dt><dd>'+esc(selected.p.date||'미입력')+'</dd></div><div><dt>결제 카드</dt><dd>'+cardHTML(selected.p.paymentCard)+'</dd></div></dl><p>'+esc(selected.p.note||'등록된 비고가 없습니다.')+'</p></div>':'');
    el('subChart').querySelectorAll('[data-sub-detail]').forEach(b=>{const select=()=>{selectedService=b.dataset.subDetail;renderChart(list);const match=Array.from(el('subChart').querySelectorAll('[data-sub-detail]')).find(x=>x.tagName===b.tagName&&x.dataset.subDetail===selectedService);if(match)match.focus({preventScroll:true});};b.onclick=select;if(b.tagName.toLowerCase()==='circle')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};});
  }
  async function load() {
    if (loading || busy) return;
    loadFx(); loading=true; status('구독 기록을 불러오는 중입니다.');
    el('subReload').disabled=true;
    try { const result=await Promise.all([loadDeskPortalConfig_('daily','subscriptions'),runServer('getDeskSubscriptionSyncCapabilities',{}).catch(()=>({providers:{}}))]); records=result[0] || {}; providers=result[1] && result[1].providers || {}; loaded=true; render(); status('수동 입력이 우선이며, Firebase와 Supabase 연동 값은 결제 확정액이 아닌 예상 비용입니다.'); }
    catch(e) { loaded=false; status('불러오기 실패: '+e.message+' · 새로고침으로 다시 시도하세요.',true); }
    finally { loading=false; el('subReload').disabled=false; }
  }
  function dialog(id) { const d=el(id); if(!d.open) d.showModal(); }
  function openEditor(id) {
    if(!loaded || busy) return;
    editing=id; const s=services().find(s=>s.id===id),p=manualEntry(s);
    el('subEditTitle').textContent=s.name+' · '+month+' 결제 기록';
    el('subDate').value=p.date || ''; el('subDateButton').textContent=p.date || '날짜 선택';
    el('subCalendar').hidden=true;el('subDateButton').setAttribute('aria-expanded','false');
    const current=entry(s),newMonth=!(s.payments&&Object.prototype.hasOwnProperty.call(s.payments,month)),card=newMonth?s.paymentCard:current.paymentCard,cycle=newMonth?(s.billingCycle||'unknown'):current.billingCycle;
    document.querySelectorAll('[name=subBillingCycle]').forEach(r=>r.checked=r.value===cycle);
    document.querySelectorAll('[name=subCardIssuer]').forEach(r=>r.checked=r.value===(card&&card.issuer||''));
    el('subCardLast4').value=card&&card.last4||'';
    el('subEditorSource').innerHTML='<strong>자료 출처</strong>'+sourceHTML(s,current)+(current._source==='linked'?'<span>연동 예상액 '+esc(money(current.amount,current.currency))+' · 수동 금액을 입력하면 우선 적용됩니다.</span>':'');
    el('subAmount').value=p.amount == null?'':p.amount; el('subCurrency').value=p.currency || 'KRW';
    el('subPaymentStatus').value=p.status || 'unknown'; el('subNote').value=p.note || '';
    el('subEditStatus').textContent=p.updatedAt?'마지막 수정 '+new Date(p.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+(p.updatedBy || '기록 없음'):'';
    fxPreview(); dialog('subEditDialog');
  }
  async function saveRecord(id,value) {
    busy=true;
    document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=true);
    try { const saved=await saveDeskPortalConfig_('daily','subscriptions/'+id,value); records[id]=saved; render(); return true; }
    finally { busy=false; document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=false); }
  }
  async function syncRecord(id) {
    if(!loaded || busy)return; const s=services().find(x=>x.id===id); busy=true; render(); status(s.name+'의 '+month+' 공식 비용을 확인하는 중입니다.');
    try{const res=await runServer('saveDeskSubscriptionSync',{serviceId:id,month,expectedValue:records[id] || null});if(res && res.value)records[id]=res.value;render();if(!res || res.success===false)throw new Error(res && res.message || '동기화하지 못했습니다.');status(s.name+'의 '+month+' 예상 비용을 동기화했습니다. 수동 입력 금액이 있으면 그 금액을 우선 표시합니다.');}
    catch(err){render();status('동기화 실패: '+err.message+' · 기존 금액은 변경하지 않았습니다.',true);}finally{busy=false;render();}
  }
  function renderIntegrationInfo(s) { const cap=provider(s),mode=el('subIntegrationMode').value,linked=mode!=='manual',gcp=el('subIntegrationMode').querySelector('option[value="google-cloud-billing-export"]'),supabase=el('subIntegrationMode').querySelector('option[value="supabase-management-estimate"]'); gcp.disabled=s.id!=='firebase'; supabase.disabled=s.id!=='supabase'; el('subIntegrationInfo').innerHTML='<strong>'+esc(cap.label || '수동 입력')+'</strong><span>'+esc(cap.reason || '')+'</span>'+(cap.officialUrl?'<a href="'+esc(cap.officialUrl)+'" target="_blank" rel="noopener noreferrer">공식 문서</a>':'')+(linked?'<em class="'+(cap.configured?'sub-ready':'sub-not-ready')+'">'+(cap.configured?'서버 연동 설정 완료':'서버 환경 설정 필요')+'</em>':''); }
  function openSettings(id) {
    if(!loaded || busy) return;
    logoRequest++; logoLoading=false; document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=false);
    editing=id || ''; const s=services().find(s=>s.id===id) || {name:'',plan:'',active:true}; draftLogo=s.logo || '';
    el('subName').value=s.name; el('subPlan').value=s.plan || ''; el('subActive').checked=s.active!==false; el('subLogo').value=''; el('subIntegrationMode').value=s.integrationMode || 'manual'; if(!['firebase','supabase'].includes(s.id))el('subIntegrationMode').value='manual'; renderIntegrationInfo({...s,id:id || ''});
    el('subLogoPreview').innerHTML=logoHTML(s); el('subSettingsStatus').textContent='PNG, JPG, WebP · 최대 2MB. 보고서에도 함께 표시됩니다.';
    el('subServiceSelect').innerHTML='<option value="">새 구독 추가</option>'+services().map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+(x.active===false?' (사용 중지)':'')+'</option>').join('');
    el('subServiceSelect').value=id || ''; dialog('subSettingsDialog');
  }
  async function makeReport() {
    const list=included(),sum=totals(list),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    const wrap=(text,width,font)=>{ctx.font=font;const lines=[];let line='';for(const c of String(text)){if(c==='\n'||ctx.measureText(line+c).width>width){lines.push(line);line=c==='\n'?'':c;}else line+=c;}lines.push(line);return lines;};
    if(document.fonts) await document.fonts.ready;
    const rows=list.map(s=>({s,p:entry(s),notes:wrap(entry(s).note || '—',290,'bold 16px sans-serif'),names:wrap(s.name,s.asset==='baemin.png'?162:200,'bold 19px sans-serif')}));
    const heights=rows.map(r=>Math.max(112,Math.max(r.notes.length,r.names.length)*24+32));
    canvas.width=1200;canvas.height=310+heights.reduce((a,b)=>a+b,0)+80;
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#eff5da';ctx.fillRect(0,0,1200,210);
    const text=(value,x,y,font,color)=>{ctx.font=font;ctx.fillStyle=color || '#263324';ctx.fillText(value,x,y);};
    text('유료 구독 사용 현황',48,65,'bold 32px sans-serif');text(month.replace('-','년 ')+'월 결제 보고',48,100,'18px sans-serif');
    text(Object.keys(sum).length?'월 '+Object.keys(sum).map(c=>money(sum[c],c)).join('  /  '):'금액 미입력',48,155,'bold 28px sans-serif','#2563eb');
    text('월 환산 합계 · 연간 ÷ 12 · 결제 예정 포함 · 통화별 표시',48,185,'15px sans-serif','#526345');
    ['구독 서비스','결제일','금액','상태','비고 / 설명'].forEach((v,i)=>text(v,[48,310,490,705,845][i],260,'bold 16px sans-serif'));
    let y=285;
    for(let i=0;i<rows.length;i++) {const {s,p,notes,names}=rows[i],h=heights[i];ctx.fillStyle=i%2?'#f8faf4':'#ffffff';ctx.fillRect(32,y,1136,h);const src=logo(s);if(src){try {const img=new Image();img.src=src;await img.decode();const scale=Math.min((s.asset==='baemin.png'?64:34)/img.width,34/img.height);ctx.drawImage(img,48,y+24,img.width*scale,img.height*scale);}catch(e){throw new Error(s.name+' 로고를 불러오지 못했습니다. 다시 시도해 주세요.');}}
      names.forEach((v,n)=>text(v,s.asset==='baemin.png'?132:94,y+34+n*24,'bold 19px sans-serif'));text(p.date || '미입력',310,y+36,'bold 17px sans-serif');text(details.cycleLabel(p.billingCycle),310,y+60,'14px sans-serif');text(details.cardLabel(p.paymentCard),310,y+84,'12px sans-serif');text(money(p.amount,p.currency),490,y+36,'bold 19px sans-serif','#2563eb');if(p.billingCycle==='yearly')text('월 '+money(details.monthlyAmount(p),p.currency),490,y+60,'bold 14px sans-serif','#2563eb');if(p.currency==='USD'&&p.amount!=null)text(fxText(p),490,y+84,'bold 14px sans-serif','#2563eb');text(p.status==='paid'?'결제 완료':p.status==='scheduled'?'결제 예정':'미확인',705,y+36,'16px sans-serif');notes.forEach((v,n)=>text(v,845,y+34+n*24,'bold 16px sans-serif'));y+=h;}
    text('금액 미입력 '+list.filter(s=>entry(s).amount==null).length+'개 · 저장 금액 기준 · 생성 '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),48,y+42,'14px sans-serif','#526345');
    if(fx)text('원화 예상액: '+fx.date+' 기준 · 1 USD = '+fx.rate+' KRW · Frankfurter · 수수료 제외',48,y+66,'13px sans-serif','#526345');
    return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('이미지를 생성하지 못했습니다.')),'image/png'));
  }
  async function report(copy) {
    if(!loaded || busy) return;
    busy=true; el('subCopy').disabled=true; el('subDownload').disabled=true;status('보고 이미지를 만드는 중입니다.');
    try {const promise=makeReport(); if(copy && navigator.clipboard && window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'image/png':promise})]);status('보고 이미지를 복사했습니다. 메신저에 붙여넣으세요.');}else if(copy){await promise;throw new Error('이미지 복사를 지원하지 않습니다. PNG 저장을 이용해 주세요.');}else{const blob=await promise,url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='구독현황-'+month+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('보고 이미지를 PNG 파일로 저장했습니다.');}}
    catch(e){status('이미지 복사/저장 실패: '+e.message+' · PNG 저장도 이용할 수 있습니다.',true);}
    finally{busy=false;el('subCopy').disabled=false;el('subDownload').disabled=false;}
  }
  window.ensureDeskSubscriptions = function () {
    if(!el('deskSubscriptions')) return;
    const uid=String(state.cloudIdentity && state.cloudIdentity.uid || '');
    if(owner!==uid){owner=uid;records={};loaded=false;}
    if(!loaded && !loading) load();
  };
  function init() {
    if(!el('deskSubscriptions')) return;
    details.mount();
    el('subAmount').addEventListener('input',fxPreview);el('subCurrency').addEventListener('change',fxPreview);
    el('subMonth').value=month;
    el('subMonth').onchange=e=>{if(busy){e.target.value=month;return;}if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){month=e.target.value;render();}};
    el('subReload').onclick=load; el('subSettings').onclick=()=>openSettings('');
    el('subCopy').onclick=()=>report(true);el('subDownload').onclick=()=>report(false);
    document.querySelectorAll('[data-sub-close]').forEach(b=>b.onclick=()=>{if(!busy)el(b.dataset.subClose).close();});
    ['subEditDialog','subSettingsDialog'].forEach(id=>el(id).addEventListener('cancel',e=>{if(busy)e.preventDefault();}));
    el('subEditForm').onsubmit=async e=>{e.preventDefault();if(busy)return;const s=services().find(s=>s.id===editing),amount=el('subAmount').value;
      if(el('subCurrency').value==='KRW' && amount!=='' && Number(amount)%1){el('subEditStatus').textContent='원화는 정수로 입력해 주세요.';return;}
      const billingCycle=document.querySelector('[name=subBillingCycle]:checked').value,issuer=document.querySelector('[name=subCardIssuer]:checked').value,last4=el('subCardLast4').value.trim();
      if((issuer&&!/^[0-9]{4}$/.test(last4))||(!issuer&&last4)){el('subEditStatus').textContent='카드사와 카드번호 끝 4자리를 함께 입력해 주세요.';return;}
      const paymentCard=issuer?{issuer,last4}:null;
      const p={billingCycle,paymentCard,date:el('subDate').value,amount:amount===''?null:Number(amount),currency:el('subCurrency').value,status:el('subPaymentStatus').value,note:el('subNote').value.trim(),updatedAt:new Date().toISOString(),updatedBy:String(state.cloudIdentity && state.cloudIdentity.name || '')};
      try {await saveRecord(editing,{...s,billingCycle,paymentCard,payments:{...(s.payments || {}),[month]:p}});el('subEditDialog').close();status(s.name+'의 '+month+' 결제 기록을 저장했습니다.');}catch(err){el('subEditStatus').textContent=err.message+' · 창을 닫고 새로고침 후 다시 입력해 주세요.';}};
    el('subServiceSelect').onchange=e=>{if(busy){e.target.value=editing;return;}openSettings(e.target.value);}; el('subIntegrationMode').onchange=()=>renderIntegrationInfo(services().find(s=>s.id===editing) || {id:''});
    el('subLogoReset').onclick=()=>{logoRequest++;logoLoading=false;document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=false);draftLogo='';el('subLogo').value='';el('subLogoPreview').innerHTML=logoHTML({...services().find(s=>s.id===editing),name:el('subName').value,logo:''});};
    el('subLogo').onchange=async e=>{const f=e.target.files[0];if(!f)return;const request=++logoRequest;logoLoading=true;document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=true);try{if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>2*1024*1024)throw new Error('2MB 이하 PNG, JPG, WebP 파일을 선택해 주세요.');const img=await createImageBitmap(f);if(request!==logoRequest){img.close();return;}const c=document.createElement('canvas');const scale=Math.min(1,128/img.width,128/img.height);c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);img.close();draftLogo=c.toDataURL('image/png');el('subLogoPreview').innerHTML=logoHTML({name:el('subName').value,logo:draftLogo});el('subSettingsStatus').textContent='로고가 준비되었습니다. 저장하면 반영됩니다.';}catch(err){if(request===logoRequest)el('subSettingsStatus').textContent=err.message;}finally{if(request===logoRequest){logoLoading=false;document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=busy);}}};
    el('subSettingsForm').onsubmit=async e=>{e.preventDefault();if(busy || logoLoading)return;const name=el('subName').value.trim();if(!name)return;const id=editing || 'custom-'+crypto.randomUUID(),s=services().find(s=>s.id===editing) || {id,payments:{}};
      try{const mode=['firebase','supabase'].includes(id)?el('subIntegrationMode').value:'manual';await saveRecord(id,{...s,id,name,plan:el('subPlan').value.trim(),logo:draftLogo,active:el('subActive').checked,integrationMode:mode});el('subSettingsDialog').close();status('구독 설정을 저장했습니다.');}catch(err){el('subSettingsStatus').textContent=err.message+' · 창을 닫고 새로고침 후 다시 시도하세요.';}};
  }
  init();
})();
