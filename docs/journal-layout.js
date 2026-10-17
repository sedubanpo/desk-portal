(function(){
'use strict';
const tabs=Array.from(document.querySelectorAll('[data-journal-board-tab]'));
function select(tab){
 for(const button of tabs){
  const active=button===tab;
  button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
  document.getElementById(button.getAttribute('aria-controls')).hidden=!active;
 }
}
for(const tab of tabs){
 tab.addEventListener('click',()=>select(tab));
 tab.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  select(tabs[index]);tabs[index].focus();
 });
}
})();
