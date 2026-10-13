import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../../../docs/index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('    function loadDeskSharedStaffIcons_(force)'), html.indexOf('    function getDeskStaffIcon_'));
function setup() {
  let fail = false, calls = 0, pending;
  const state = {firebaseUser:{uid:'a'}, desk:{staffIcons:{}}, firebaseFirestore:{collection:()=>({get:async()=>({docs:[{id:'icon'}]})})}};
  const ctx = {state, console:{warn(){}}, Date, normalizeDeskStaffIconAsset_:x=>x,
    runServer:async(action)=>{if(action==='getDeskStaffIcons') return {success:true,icons:[{id:'icon'}]}; calls++; if(pending) await pending; if(fail) return {success:false}; return {success:true,staff:[]};},
    indexDeskStaffIcons_:()=>{state.desk.staffIcons.loaded=true; return state.desk.staffIcons.byName={worker:{imageUrl:'ok'}};}};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {state,load:ctx.loadDeskSharedStaffIcons_,fail:v=>fail=v,calls:()=>calls,hold:p=>pending=p};
}
test('directory failure is retryable and refresh failure preserves last good icons',async()=>{
 const x=setup();x.fail(true);await x.load(false);assert.equal(x.state.desk.staffIcons.loaded,false);
 x.fail(false);await x.load(false);assert.equal(x.state.desk.staffIcons.byName.worker.imageUrl,'ok');
 x.fail(true);await x.load(true);assert.equal(x.state.desk.staffIcons.byName.worker.imageUrl,'ok');assert.equal(x.state.desk.staffIcons.loaded,false);
 x.fail(false);await x.load(false);assert.equal(x.calls(),4);
});
test('forced concurrent loads coalesce and expired data refreshes',async()=>{
 const x=setup();let release;x.hold(new Promise(r=>release=r));const a=x.load(false),b=x.load(true);assert.equal(a,b);release();await a;
 await x.load(false);assert.equal(x.calls(),1);x.state.desk.staffIcons.loadedAt=0;await x.load(false);assert.equal(x.calls(),2);
});
test('old user response cannot populate a new login or logout cache',async()=>{
 const x=setup();let release;x.hold(new Promise(r=>release=r));const old=x.load(false);x.state.firebaseUser={uid:'b'};const next=x.load(false);release();await old;await next;assert.equal(x.state.desk.staffIcons.uid,'b');
 x.state.firebaseUser=null;await x.load(false);assert.equal(Object.keys(x.state.desk.staffIcons.byName).length,0);
});
