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
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let records = {}, loaded = false, loading = false, busy = false, editing = '', draftLogo = '', owner = '', logoRequest = 0, logoLoading = false;
  let month = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date());
  function services() {
    const base = presets.map(([id,name,description,asset]) => ({id,name,description,asset,active:true,payments:{},...(records[id] || {})}));
    return base.concat(Object.keys(records).filter(id => !presets.some(p => p[0] === id)).map(id => ({payments:{},...records[id],id})));
  }
  function logo(s) { return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.logo || '') ? s.logo : (s.asset && presets.some(p => p[3] === s.asset) ? './assets/subscriptions/' + s.asset : ''); }
  function logoHTML(s) { const src = logo(s); return src ? '<img class="'+(s.asset==='baemin.png'?'sub-wide-logo':'')+'" src="'+esc(src)+'" alt="" width="40" height="40">' : '<span class="sub-initial" aria-hidden="true">'+esc(s.name.slice(0,1))+'</span>'; }
  function entry(s) { return s.payments && s.payments[month] || {}; }
  function included() { return services().filter(s => s.active !== false || s.payments && s.payments[month]); }
  function money(n,c) { return n == null || n === '' ? '미입력' : new Intl.NumberFormat('ko-KR',{style:'currency',currency:c || 'KRW',maximumFractionDigits:c === 'USD' ? 2 : 0}).format(Number(n)); }
  function totals(list) { const result = {}; list.forEach(s => {const p=entry(s); if(p.amount != null && p.amount !== '') result[p.currency || 'KRW']=(result[p.currency || 'KRW'] || 0)+Number(p.amount);}); return result; }
  function status(text,error) { el('subStatus').textContent=text; el('subStatus').classList.toggle('sub-error',!!error); }
  function render() {
    const list=included(), sum=totals(list), known=list.filter(s => entry(s).amount != null).length;
    el('subMonth').value=month;
    el('subTotal').textContent=Object.keys(sum).length ? Object.keys(sum).map(c=>money(sum[c],c)).join(' / ') : '결제 금액을 입력해 주세요';
    el('subSummary').textContent=month.replace('-','년 ')+'월 · 금액 입력 '+known+'/'+list.length+'개 · 통화별 합계';
    el('subList').innerHTML=list.map(s=>{const p=entry(s);return '<tr><th scope="row"><div class="sub-brand">'+logoHTML(s)+'<div><strong>'+esc(s.name)+'</strong><small>'+esc(s.plan || s.description || '직접 등록한 구독')+(s.active === false ? ' · 사용 중지' : '')+'</small></div></div></th><td>'+esc(p.date || '미입력')+'</td><td class="sub-amount">'+esc(money(p.amount,p.currency))+'</td><td><span class="sub-state '+(p.status === 'paid'?'sub-paid':'')+'">'+(p.status === 'paid'?'결제 완료':p.status === 'scheduled'?'결제 예정':'미확인')+'</span></td><td class="sub-note">'+esc(p.note || '—')+'</td><td><button type="button" data-sub-edit="'+esc(s.id)+'" aria-label="'+esc(s.name)+' 결제 기록 입력">기록 입력</button></td></tr>';}).join('') || '<tr><td colspan="6">표시할 구독이 없습니다. 구독 설정에서 추가해 주세요.</td></tr>';
    el('subList').querySelectorAll('[data-sub-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.subEdit));
  }
  async function load() {
    if (loading || busy) return;
    loading=true; status('구독 기록을 불러오는 중입니다.');
    el('subReload').disabled=true;
    try { records=await loadDeskPortalConfig_('daily','subscriptions') || {}; loaded=true; render(); status('월별 기록은 저장한 금액 기준입니다. 실시간 요금 연동 전입니다.'); }
    catch(e) { loaded=false; status('불러오기 실패: '+e.message+' · 새로고침으로 다시 시도하세요.',true); }
    finally { loading=false; el('subReload').disabled=false; }
  }
  function dialog(id) { const d=el(id); if(!d.open) d.showModal(); }
  function openEditor(id) {
    if(!loaded || busy) return;
    editing=id; const s=services().find(s=>s.id===id),p=entry(s);
    el('subEditTitle').textContent=s.name+' · '+month+' 결제 기록';
    el('subDate').value=p.date || ''; el('subDate').min=month+'-01';
    el('subDate').max=month+'-'+new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
    el('subAmount').value=p.amount == null?'':p.amount; el('subCurrency').value=p.currency || 'KRW';
    el('subPaymentStatus').value=p.status || 'unknown'; el('subNote').value=p.note || '';
    el('subEditStatus').textContent=p.updatedAt?'마지막 수정 '+new Date(p.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+(p.updatedBy || '기록 없음'):'';
    dialog('subEditDialog');
  }
  async function saveRecord(id,value) {
    busy=true;
    document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=true);
    try { const saved=await saveDeskPortalConfig_('daily','subscriptions/'+id,value); records[id]=saved; render(); return true; }
    finally { busy=false; document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=false); }
  }
  function openSettings(id) {
    if(!loaded || busy) return;
    logoRequest++; logoLoading=false; document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=false);
    editing=id || ''; const s=services().find(s=>s.id===id) || {name:'',plan:'',active:true}; draftLogo=s.logo || '';
    el('subName').value=s.name; el('subPlan').value=s.plan || ''; el('subActive').checked=s.active!==false; el('subLogo').value='';
    el('subLogoPreview').innerHTML=logoHTML(s); el('subSettingsStatus').textContent='PNG, JPG, WebP · 최대 2MB. 보고서에도 함께 표시됩니다.';
    el('subServiceSelect').innerHTML='<option value="">새 구독 추가</option>'+services().map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+(x.active===false?' (사용 중지)':'')+'</option>').join('');
    el('subServiceSelect').value=id || ''; dialog('subSettingsDialog');
  }
  async function makeReport() {
    const list=included(),sum=totals(list),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    const wrap=(text,width,font)=>{ctx.font=font;const lines=[];let line='';for(const c of String(text)){if(c==='\n'||ctx.measureText(line+c).width>width){lines.push(line);line=c==='\n'?'':c;}else line+=c;}lines.push(line);return lines;};
    if(document.fonts) await document.fonts.ready;
    const rows=list.map(s=>({s,p:entry(s),notes:wrap(entry(s).note || '—',290,'16px sans-serif'),names:wrap(s.name,s.asset==='baemin.png'?162:200,'bold 19px sans-serif')}));
    const heights=rows.map(r=>Math.max(90,Math.max(r.notes.length,r.names.length)*24+32));
    canvas.width=1200;canvas.height=310+heights.reduce((a,b)=>a+b,0)+80;
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#eff5da';ctx.fillRect(0,0,1200,210);
    const text=(value,x,y,font,color)=>{ctx.font=font;ctx.fillStyle=color || '#263324';ctx.fillText(value,x,y);};
    text('유료 구독 사용 현황',48,65,'bold 32px sans-serif');text(month.replace('-','년 ')+'월 결제 보고',48,100,'18px sans-serif');
    text(Object.keys(sum).length?Object.keys(sum).map(c=>money(sum[c],c)).join('  /  '):'금액 미입력',48,155,'bold 28px sans-serif');
    text('입력 금액 합계 · 결제 예정 포함 · 통화별 표시',48,185,'15px sans-serif','#526345');
    ['구독 서비스','결제일','금액','상태','비고 / 설명'].forEach((v,i)=>text(v,[48,310,490,705,845][i],260,'bold 16px sans-serif'));
    let y=285;
    for(let i=0;i<rows.length;i++) {const {s,p,notes,names}=rows[i],h=heights[i];ctx.fillStyle=i%2?'#f8faf4':'#ffffff';ctx.fillRect(32,y,1136,h);const src=logo(s);if(src){try {const img=new Image();img.src=src;await img.decode();const scale=Math.min((s.asset==='baemin.png'?64:34)/img.width,34/img.height);ctx.drawImage(img,48,y+24,img.width*scale,img.height*scale);}catch(e){throw new Error(s.name+' 로고를 불러오지 못했습니다. 다시 시도해 주세요.');}}
      names.forEach((v,n)=>text(v,s.asset==='baemin.png'?132:94,y+34+n*24,'bold 19px sans-serif'));text(p.date || '미입력',310,y+36,'17px sans-serif');text(money(p.amount,p.currency),490,y+36,'bold 19px sans-serif');text(p.status==='paid'?'결제 완료':p.status==='scheduled'?'결제 예정':'미확인',705,y+36,'16px sans-serif');notes.forEach((v,n)=>text(v,845,y+34+n*24,'16px sans-serif'));y+=h;}
    text('금액 미입력 '+list.filter(s=>entry(s).amount==null).length+'개 · 수동 입력 기준 · 생성 '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),48,y+42,'14px sans-serif','#526345');
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
    el('subMonth').value=month;
    el('subMonth').onchange=e=>{if(busy){e.target.value=month;return;}if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){month=e.target.value;render();}};
    el('subReload').onclick=load; el('subSettings').onclick=()=>openSettings('');
    el('subCopy').onclick=()=>report(true);el('subDownload').onclick=()=>report(false);
    document.querySelectorAll('[data-sub-close]').forEach(b=>b.onclick=()=>{if(!busy)el(b.dataset.subClose).close();});
    ['subEditDialog','subSettingsDialog'].forEach(id=>el(id).addEventListener('cancel',e=>{if(busy)e.preventDefault();}));
    el('subEditForm').onsubmit=async e=>{e.preventDefault();if(busy)return;const s=services().find(s=>s.id===editing),amount=el('subAmount').value;
      if(el('subCurrency').value==='KRW' && amount!=='' && Number(amount)%1){el('subEditStatus').textContent='원화는 정수로 입력해 주세요.';return;}
      const p={date:el('subDate').value,amount:amount===''?null:Number(amount),currency:el('subCurrency').value,status:el('subPaymentStatus').value,note:el('subNote').value.trim(),updatedAt:new Date().toISOString(),updatedBy:String(state.cloudIdentity && state.cloudIdentity.name || '')};
      try {await saveRecord(editing,{...s,payments:{...(s.payments || {}),[month]:p}});el('subEditDialog').close();status(s.name+'의 '+month+' 결제 기록을 저장했습니다.');}catch(err){el('subEditStatus').textContent=err.message+' · 창을 닫고 새로고침 후 다시 입력해 주세요.';}};
    el('subServiceSelect').onchange=e=>{if(busy){e.target.value=editing;return;}openSettings(e.target.value);};
    el('subLogoReset').onclick=()=>{logoRequest++;logoLoading=false;document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=false);draftLogo='';el('subLogo').value='';el('subLogoPreview').innerHTML=logoHTML({...services().find(s=>s.id===editing),name:el('subName').value,logo:''});};
    el('subLogo').onchange=async e=>{const f=e.target.files[0];if(!f)return;const request=++logoRequest;logoLoading=true;document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=true);try{if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>2*1024*1024)throw new Error('2MB 이하 PNG, JPG, WebP 파일을 선택해 주세요.');const img=await createImageBitmap(f);if(request!==logoRequest){img.close();return;}const c=document.createElement('canvas');const scale=Math.min(1,128/img.width,128/img.height);c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);img.close();draftLogo=c.toDataURL('image/png');el('subLogoPreview').innerHTML=logoHTML({name:el('subName').value,logo:draftLogo});el('subSettingsStatus').textContent='로고가 준비되었습니다. 저장하면 반영됩니다.';}catch(err){if(request===logoRequest)el('subSettingsStatus').textContent=err.message;}finally{if(request===logoRequest){logoLoading=false;document.querySelectorAll('[data-sub-save]').forEach(b=>b.disabled=busy);}}};
    el('subSettingsForm').onsubmit=async e=>{e.preventDefault();if(busy || logoLoading)return;const name=el('subName').value.trim();if(!name)return;const id=editing || 'custom-'+crypto.randomUUID(),s=services().find(s=>s.id===editing) || {id,payments:{}};
      try{await saveRecord(id,{...s,name,plan:el('subPlan').value.trim(),logo:draftLogo,active:el('subActive').checked});el('subSettingsDialog').close();status('구독 설정을 저장했습니다.');}catch(err){el('subSettingsStatus').textContent=err.message+' · 창을 닫고 새로고침 후 다시 시도하세요.';}};
  }
  init();
})();
