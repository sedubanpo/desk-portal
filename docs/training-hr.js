(function(){
const panel=document.querySelector('[data-desk-panel="recruiting"]');if(!panel)return;
const existing=panel.querySelector('.desk-hr-shell');existing.id='deskHrRecruitingContent';
const nav=document.createElement('nav');nav.className='tr-hr-nav';nav.setAttribute('aria-label','인사 관리 소메뉴');
const person='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/></svg>';
const book='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3zM12 6v15"/></svg>';
nav.innerHTML=`<button type="button" aria-pressed="true" aria-controls="deskHrRecruitingContent">${person}인사 관리</button><button type="button" aria-pressed="false" aria-controls="deskHrTrainingContent">${book}법정 의무교육</button>`;
existing.before(nav);const training=document.createElement('section');training.id='deskHrTrainingContent';training.hidden=true;existing.after(training);let mounted=false;
const reload=document.getElementById('deskHrReloadBtn');
function choose(enabled){existing.hidden=enabled;training.hidden=!enabled;if(reload)reload.hidden=enabled;nav.children[0].setAttribute('aria-pressed',String(!enabled));nav.children[1].setAttribute('aria-pressed',String(enabled));if(enabled&&!mounted){mounted=true;DeskTraining.mount(training,{getToken:()=>state.firebaseUser?.getIdToken(),base:DESK_CLOUD_API_BASE});}}
initializeDeskFirebaseAuth_().then(auth=>{if(auth)auth.onAuthStateChanged(()=>{training._trainingAbort?.abort();training.replaceChildren();mounted=false;choose(false);});});
nav.children[0].addEventListener('click',()=>choose(false));nav.children[1].addEventListener('click',()=>choose(true));
document.querySelectorAll('[data-desk-tab="recruiting"]').forEach(button=>button.addEventListener('click',()=>choose(false)));
})();
