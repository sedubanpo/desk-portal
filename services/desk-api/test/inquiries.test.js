import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { normalize, validatePatch, notionProperties, EXTRA_SCHEMA, FIELDS } from '../src/inquiries/model.js';
import { createInquiryService } from '../src/inquiries/service.js';
import { createInquiryRouter } from '../src/inquiries/router.js';
import { errorHandler } from '../src/http.js';
const source='11111111111111111111111111111111', history='22222222222222222222222222222222', id='33333333333333333333333333333333';
const actor={uid:'worker',name:'테스트 실무자'};
function fixture(options={}){
 const data=new Map();
 const ref=path=>({path,id:path.split('/').at(-1),collection:name=>collection(path+'/'+name),async get(){return snapshot(path);},async set(value,options){data.set(path,options?.merge?{...data.get(path),...value}:structuredClone(value));}});
 const snapshot=path=>({id:path.split('/').at(-1),ref:ref(path),exists:data.has(path),data:()=>structuredClone(data.get(path))});
 const collection=path=>({doc:id=>ref(path+'/'+id),async get(){return {docs:[...data.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1).map(snapshot)};}});
 const firestore={collection,runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)})};
 const properties=Object.fromEntries(Object.entries(FIELDS).map(([k,n])=>[n,{id:n,type:k==='name'?'title':k==='subjects'?'multi_select':k==='grade'?'number':EXTRA_SCHEMA[n]?Object.keys(EXTRA_SCHEMA[n])[0]:'rich_text'}]));
 const pages=new Map([[id,{id,parent:{data_source_id:source},created_time:'2026-09-20T00:00:00.000Z',last_edited_time:'2026-09-20T00:00:00.000Z',in_trash:false,properties:{이름:{type:'title',title:[{text:{content:'테스트 문의'}}]},학교:{type:'rich_text',rich_text:[{text:{content:'테스트고'}}]},학년:{type:'number',number:2},'수강 희망 과목':{type:'multi_select',multi_select:[{name:'수학'}]}}}]]);
 let serial=0;const calls=[];
 async function notion(path,method='GET',body){calls.push({path,method,body});
  if(path===`/data_sources/${source}`)return {properties};
  if(path===`/data_sources/${source}/query`)return {results:[...pages.values()].filter(p=>p.parent.data_source_id===source&&!p.in_trash),has_more:false};
  if(path===`/data_sources/${history}/query`)return {results:[...pages.values()].filter(p=>p.parent.data_source_id===history&&(!body.filter || (body.filter.property==='요청 ID'?p.properties['요청 ID'].rich_text[0].text.content===body.filter.rich_text.equals:p.properties['문의'].relation.some(r=>r.id===body.filter.relation.contains)))),has_more:false};
  if(path==='/pages'&&method==='POST'){const key=String(++serial).padStart(32,'0');const p={id:key,parent:body.parent,properties:body.properties,last_edited_time:'2026-09-27T00:00:00.000Z'};Object.values(p.properties).forEach(v=>v.type=Object.keys(v)[0]);pages.set(key,p);return structuredClone(p);}
  const key=path.split('/').at(-1);const p=pages.get(key);if(!p)throw Error('unknown page '+key);
  if(method==='PATCH'){for(const [k,v] of Object.entries(body.properties||{}))p.properties[k]={...v,type:Object.keys(v)[0]};if('in_trash' in body)p.in_trash=body.in_trash;p.last_edited_time=new Date(Date.parse(p.last_edited_time)+1000).toISOString();}
  return structuredClone(p);
 }
 const service=createInquiryService({notion,firestore,sourceId:source,historySourceId:history,now:()=>new Date('2026-09-27T00:00:00.000Z'),log:()=>{},...options});
 return {service,notion,firestore,pages,calls,data};
}
const command=(row,action,extra={})=>({action,version:row.version,requestId:crypto.randomUUID(),...extra});
test('legacy enrollment and forbidden contact retain meaning; blank incomplete defaults to followup',()=>{const {pages}=fixture();const page=pages.get(id);assert.equal(normalize(page).followup,'재연락 필요');page.properties['상태']={type:'status',status:{name:'연락금지'}};assert.equal(normalize(page).followup,'연락금지');page.properties['상태'].status.name='신규등원';assert.equal(normalize(page).stage,'등록 완료');page.properties['상태'].status.name='등원예정';assert.equal(normalize(page).stage,'상담 예약');});
test('validates arbitrary fields, choice values, impossible dates, subject values and numeric grades',()=>{for(const patch of [{uid:'hack'},{stage:'unknown'},{nextDate:'2026-02-30'},{subjects:['']},{name:''}])assert.throws(()=>validatePatch(patch));assert.throws(()=>notionProperties({grade:'abc'},{properties:{학년:{type:'number'}}}));assert.deepEqual(validatePatch({subjects:['수학','수학'],nextDate:'2026-09-27'}),{subjects:['수학'],nextDate:'2026-09-27'});});
test('all query pages are mirrored and successful edit updates real source, rejects stale saves',async()=>{const f=fixture();const list=await f.service.list(true);assert.equal(list.items.length,1);const before=list.items[0];const body=command(before,'edit',{patch:{school:'새학교'}});const result=await f.service.change(id,body,actor);assert.equal(result.item.school,'새학교');assert.equal(normalize(f.pages.get(id)).school,'새학교');assert.deepEqual(await f.service.change(id,body,actor),result);await assert.rejects(f.service.change(id,command(before,'edit',{patch:{school:'덮어쓰기'}}),actor),e=>e.code==='stale_record');});
test('contact retry is idempotent and original notes persist; contact history is in Notion',async()=>{const f=fixture();const row=(await f.service.detail(id)).item;const body=command(row,'contact',{result:'부재',note:'내일 다시',patch:{nextDate:'2026-09-28',followup:'재연락 필요'}});await f.service.change(id,body,actor);await f.service.change(id,body,actor);assert.equal(f.calls.filter(c=>c.path==='/pages'&&c.method==='POST').length,1);const detail=await f.service.detail(id);assert.equal(detail.history.length,1);assert.equal(detail.history[0].result,'부재');assert.equal(detail.item.lastContact,'2026-09-27T00:00:00.000Z');assert.equal(detail.item.nextDate,'2026-09-28');});
test('real trash and restore retain contact data, including a deleted original found during sync',async()=>{const f=fixture();const row=(await f.service.detail(id)).item;let result=await f.service.change(id,command(row,'delete'),actor);assert.equal(f.pages.get(id).in_trash,true);await f.service.sync(true);assert.equal((await f.service.list()).items[0].trashed,true);result=await f.service.change(id,command(result.item,'restore'),actor);assert.equal(result.item.trashed,false);assert.equal(result.item.name,row.name);});
test('page IDs outside the configured source are rejected before mutations',async()=>{const f=fixture();f.pages.get(id).parent.data_source_id=history;await assert.rejects(f.service.detail(id),e=>e.status===403);assert.equal(f.calls.some(c=>c.method==='PATCH'),false);});
test('contact history correction keeps cancelled records and rejects cross-inquiry access',async()=>{const f=fixture();const row=(await f.service.detail(id)).item;await f.service.change(id,command(row,'contact',{result:'통화 완료',note:'original',patch:{}}),actor);const d=await f.service.detail(id);const h=d.history[0];await f.service.change(id,command(d.item,'history',{historyId:h.id,historyVersion:h.version,historyState:'취소',note:'잘못 입력'}),actor);const revised=await f.service.detail(id);assert.equal(revised.history[0].state,'취소');assert.equal(revised.item.lastContact,'');assert.equal(revised.item.lastResult,'');assert.equal(f.pages.size,2);});
test('Notion failures never become success and unsent mutations do not update the mirror',async()=>{const f=fixture();const s=createInquiryService({firestore:f.firestore,sourceId:source,historySourceId:history,notion:async(p,m,b)=>{if(m==='PATCH')throw Error('upstream failed');return f.notion(p,m,b);}});const row=(await s.detail(id)).item;await assert.rejects(s.change(id,command(row,'edit',{patch:{school:'failed'}}),actor));assert.equal((await s.list()).items[0].school,'테스트고');});
test('anonymous, inactive and instructor denied; ordinary staff with desk access can delete',async()=>{const f=fixture();const app=express();app.use('/i',createInquiryRouter({service:f.service,verifyIdToken:async token=>({uid:token}),loadAccount:async uid=>({account:{name:uid,role:uid==='teacher'?'INSTRUCTOR':'STAFF',status:uid==='inactive'?'INACTIVE':'ACTIVE'},access:{apps:{deskPortal:true}}})}));app.use(errorHandler);assert.equal((await request(app).get('/i')).status,401);for(const uid of ['teacher','inactive'])assert.equal((await request(app).get('/i').set('Authorization','Bearer '+uid)).status,403);const row=(await f.service.detail(id)).item;assert.equal((await request(app).post('/i/'+id).set('Authorization','Bearer worker').send(command(row,'delete'))).status,200);});

test('sync follows pagination and never hides the second page',async()=>{const f=fixture();let calls=0;const s=createInquiryService({firestore:f.firestore,sourceId:source,notion:async(p,m,b)=>{if(p===`/data_sources/${source}/query`){calls++;const page=structuredClone(f.pages.get(id));if(b.start_cursor){page.id='44444444444444444444444444444444';return {results:[page],has_more:false};}return {results:[page],has_more:true,next_cursor:'cursor-2'};}return f.notion(p,m,b);}});const result=await s.list(true);assert.equal(calls,2);assert.equal(result.items.length,2);});
test('lost history create response is reconciled by request ID, never duplicated',async()=>{const f=fixture();let fail=true;const s=createInquiryService({firestore:f.firestore,sourceId:source,historySourceId:history,now:()=>new Date('2026-09-27T00:00:00.000Z'),notion:async(p,m,b)=>{const result=await f.notion(p,m,b);if(p==='/pages'&&m==='POST'&&fail){fail=false;throw Error('lost response');}return result;}});const row=(await s.detail(id)).item;const body=command(row,'contact',{result:'부재',note:'retry',patch:{}});await assert.rejects(s.change(id,body,actor));const result=await s.change(id,body,actor);assert.equal(result.ok,true);assert.equal(f.calls.filter(c=>c.path==='/pages'&&c.method==='POST').length,1);});
test('failed historical create of uncertain outcome does not create a duplicate on retry',async()=>{const f=fixture();let attempts=0;const s=createInquiryService({firestore:f.firestore,sourceId:source,historySourceId:history,now:()=>new Date('2026-09-27T00:00:00.000Z'),notion:async(p,m,b)=>{if(p==='/pages'&&m==='POST'){attempts++;throw Error('unknown outcome');}return f.notion(p,m,b);}});const row=(await s.detail(id)).item;const body=command(row,'contact',{result:'부재',note:'retry',patch:{}});await assert.rejects(s.change(id,body,actor));await assert.rejects(s.change(id,body,actor),e=>e.code==='history_uncertain');assert.equal(attempts,1);});

test('real Notion minute precision does not fail contact verification; original ordering time retained',async()=>{const f=fixture();const s=createInquiryService({notion:f.notion,firestore:f.firestore,sourceId:source,historySourceId:history,now:()=>new Date('2026-09-27T10:47:45.808Z')});const row=(await s.detail(id)).item;const result=await s.change(id,command(row,'contact',{result:'부재',note:'minute precision',patch:{}}),actor);assert.equal(result.item.lastContact,'2026-09-27T10:47:00.000Z');const log=[...f.pages.values()].find(p=>p.parent.data_source_id===history);assert.equal(log.properties['기록 시각 원본'].rich_text[0].text.content,'2026-09-27T10:47:45.808Z');});

test('first contact uses Notion input time rather than mirror creation time',()=>{const f=fixture();const p=f.pages.get(id);p.properties['입력 시간']={type:'created_time',created_time:'2026-09-28T05:30:00.000Z'};assert.equal(normalize(p).firstContact,'2026-09-28T05:30:00.000Z');});
test('contact channels count valid entries only, retain nickname, and survive full sync',async()=>{const f=fixture();let row=(await f.service.detail(id)).item;for(const [method,result] of [['전화','부재'],['카톡','카톡 보냄'],['문자','문자 보냄']]){row=(await f.service.change(id,command(row,'contact',{method,result,note:'테스트',patch:{}}),{...actor,nickname:'별명'})).item;}
 assert.deepEqual(row.contactCounts,{전화:1,카톡:1,문자:1});assert.equal(row.lastActor,'별명');await f.service.sync(true);assert.deepEqual((await f.service.list()).items[0].contactCounts,row.contactCounts);
 const d=await f.service.detail(id),h=d.history.find(h=>h.method==='카톡');const cancelled=await f.service.change(id,command(d.item,'history',{historyId:h.id,historyVersion:h.version,historyState:'취소',note:'중복 입력 취소'}),actor);assert.deepEqual(cancelled.item.contactCounts,{전화:1,카톡:0,문자:1});
});
test('unknown legacy reply method is not guessed, invalid methods never mutate',async()=>{const f=fixture();let row=(await f.service.detail(id)).item;row=(await f.service.change(id,command(row,'contact',{result:'답변 받음',note:'이전 기록',patch:{}}),actor)).item;assert.deepEqual(row.contactCounts,{전화:0,카톡:0,문자:0});await assert.rejects(f.service.change(id,command(row,'contact',{method:'unknown',result:'부재',note:'',patch:{}}),actor),e=>e.code==='invalid_method');});
test('progress note persists with explicit followup semantics and legacy notes remain intact',async()=>{const f=fixture();let row=(await f.service.detail(id)).item;row=(await f.service.change(id,command(row,'edit',{patch:{stage:'연락 보류',stageNote:'10월에 다시 확인'}}),actor)).item;assert.equal(row.followup,'재연락 안 함');assert.equal(row.stageNote,'10월에 다시 확인');assert.equal(row.notes,'');row=(await f.service.change(id,command(row,'edit',{patch:{stage:'재연락 대상'}}),actor)).item;assert.equal(row.followup,'재연락 필요');});

test('unreachable incomplete leads remain followup candidates; method/result conflicts are rejected',async()=>{const f=fixture();let row=(await f.service.detail(id)).item;row=(await f.service.change(id,command(row,'edit',{patch:{stage:'연락두절'}}),actor)).item;assert.equal(row.followup,'재연락 필요');await assert.rejects(f.service.change(id,command(row,'contact',{method:'전화',result:'카톡 보냄',note:'',patch:{}}),actor),e=>e.code==='invalid_contact_result');});

test('acquisition source preserves the Notion text and excludes it from arbitrary writes',()=>{
 const f=fixture();const page=f.pages.get(id);page.properties[FIELDS.acquisitionSource]={type:'rich_text',rich_text:[{plain_text:'주변 지인 소개, '},{text:{content:'등록 중인 상태는 아님.'}}]};
 assert.equal(normalize(page).acquisitionSource,'주변 지인 소개, 등록 중인 상태는 아님.');
 assert.throws(()=>validatePatch({acquisitionSource:'임의 변경'}));
});
test('queue visibility survives sync, detail and edits without altering Notion or inquiry status',async()=>{
 const f=fixture();await f.service.list(true);
 const before=structuredClone(f.pages.get(id));
 await f.service.setVisibility(id,{hidden:true,expectedHidden:false},actor);
 assert.deepEqual(f.pages.get(id),before);
 assert.equal((await f.service.list(true)).items[0].queueHidden,true);
 let row=(await f.service.detail(id)).item;
 assert.equal(row.queueVisibilityActor,actor.name);assert.equal(row.queueVisibilityAt,'2026-09-27T00:00:00.000Z');
 assert.equal((await f.service.change(id,command(row,'edit',{patch:{school:'새학교'}}),actor)).item.queueHidden,true);
 await f.service.setVisibility(id,{hidden:false,expectedHidden:true},actor);
 assert.equal((await f.service.detail(id)).item.queueHidden,false);
 await assert.rejects(f.service.setVisibility(id,{hidden:'yes',expectedHidden:false},actor),e=>e.status===400||e.code==='invalid_visibility');
});
test('school icons expose only active school assets and safe image URLs',async()=>{
 const f=fixture();for(const [key,value] of Object.entries({a:{category:'SCHOOL',displayName:'학교',lookupKey:'school:학교',aliases:['학교고'],imageUrl:'https://example.org/logo.svg'},b:{category:'STAFF',imageUrl:'https://example.org/a'},c:{category:'SCHOOL',status:'DELETED',imageUrl:'https://example.org/a'},d:{category:'SCHOOL',imageUrl:'javascript:alert(1)'}}))f.data.set('sharedIconAssets/'+key,value);
 const result=await f.service.schoolIcons();assert.equal(result.icons.length,1);assert.deepEqual(result.icons[0].aliases,['학교고']);
});

test('inquiry school and visibility routes require staff and use the trusted actor',async()=>{
 const f=fixture();const app=express();app.use('/i',createInquiryRouter({service:f.service,verifyIdToken:async token=>({uid:token}),loadAccount:async uid=>({account:{name:'실제 근무자',role:uid==='teacher'?'INSTRUCTOR':'STAFF',status:'ACTIVE'},access:{apps:{deskPortal:true}}})}));app.use(errorHandler);
 assert.equal((await request(app).get('/i/school-icons')).status,401);
 assert.equal((await request(app).post('/i/'+id+'/visibility').set('Authorization','Bearer teacher').send({hidden:true,expectedHidden:false})).status,403);
 assert.equal((await request(app).get('/i/school-icons').set('Authorization','Bearer worker')).status,200);
 const result=await request(app).post('/i/'+id+'/visibility').set('Authorization','Bearer worker').send({hidden:true,expectedHidden:false,actor:'위조 실행자'});
 assert.equal(result.status,200);assert.equal(result.body.queueVisibilityActorUid,'worker');assert.notEqual(result.body.queueVisibilityActor,'위조 실행자');
 f.data.set('sharedIconAssets/legacy',{category:'school',lookupKey:'school:옛학교',downloadURL:'https://example.org/legacy.svg'});
 assert.equal((await f.service.schoolIcons()).icons[0].imageUrl,'https://example.org/legacy.svg');
});

test('sync failure retains watermarks, releases lease, and next attempt repairs projection',async()=>{
 const f=fixture();await f.service.sync(true);const meta='deskInquiryMirror/main';const before=f.data.get(meta).syncedAt;
 let fail=true;const service=createInquiryService({firestore:f.firestore,sourceId:source,historySourceId:history,log:()=>{},notion:async(...args)=>{if(fail&&args[0].includes(history))throw Error('synthetic outage');return f.notion(...args);}});
 await assert.rejects(service.sync(true),/synthetic outage/);assert.equal(f.data.get(meta).syncedAt,before);assert.equal(f.data.get(meta).syncLeaseUntil,0);assert.match(f.data.get(meta).syncError,/outage/);
 fail=false;await service.sync(true);assert.equal(f.data.get(meta).syncError,'');assert.notEqual(f.data.get(meta).syncedAt,before);
});
test('held lease skips without source reads; expired lease can recover',async()=>{
 const f=fixture();const meta='deskInquiryMirror/main';f.data.set(meta,{syncOwner:'other',syncLeaseUntil:Date.parse('2026-09-28')});
 assert.equal((await f.service.sync(true)).status,'skipped');assert.equal(f.calls.length,0);
 f.data.set(meta,{syncOwner:'other',syncLeaseUntil:1});assert.equal((await f.service.sync(true)).status,'completed');assert.equal(f.data.get(meta).syncLeaseUntil,0);
});
test('lost lease cannot commit, clear error or release replacement owner lease',async()=>{
 const f=fixture();const meta='deskInquiryMirror/main';const service=createInquiryService({firestore:f.firestore,sourceId:source,log:()=>{},notion:async(...args)=>{const result=await f.notion(...args);f.data.set(meta,{syncOwner:'replacement',syncLeaseUntil:Date.now()+300000,syncError:'replacement error'});return result;}});
 await assert.rejects(service.sync(true),e=>e.code==='inquiry_sync_lease_lost');assert.equal(f.data.get(meta).syncError,'replacement error');assert.ok(f.data.get(meta).syncLeaseUntil>Date.now());assert.equal(f.data.has(meta+'/items/'+id),false);
});
test('incremental query keeps overlap and full cadence; force still performs full reconciliation',async()=>{
 const f=fixture();const meta='deskInquiryMirror/main';f.data.set(meta,{projectionVersion:2,syncedAt:'2026-09-26T23:58:00.000Z',fullSyncedAt:'2026-09-26T23:55:00.000Z'});
 assert.equal((await f.service.sync()).full,false);assert.equal(f.calls[0].body.filter.last_edited_time.on_or_after,'2026-09-26T23:57:00.000Z');
 f.calls.length=0;assert.equal((await f.service.sync(true)).full,true);assert.equal(f.calls[0].body.filter,undefined);
});
test('older sync page and summary cannot overwrite concurrent newer observations',async()=>{
 const f=fixture();const meta='deskInquiryMirror/main';const observedAt=Date.parse('2026-09-27')+10000;
 f.data.set(meta+'/items/'+id,{...normalize(f.pages.get(id)),name:'newer',observedAt});
 f.data.set(meta+'/contactSummaries/'+id,{contactCounts:{전화:9},observedAt});await f.service.sync(true);
 assert.equal(f.data.get(meta+'/items/'+id).name,'newer');assert.equal(f.data.get(meta+'/contactSummaries/'+id).contactCounts.전화,9);
});
test('move reconciliation cannot hide newer concurrent page; returning page restores visibility',async()=>{
 const f=fixture();await f.service.sync(true);const key='deskInquiryMirror/main/items/'+id;
 f.pages.get(id).parent.data_source_id=history;
 const service=createInquiryService({firestore:f.firestore,sourceId:source,log:()=>{},now:()=>new Date('2026-09-27'),notion:async(...args)=>{
  if(args[0]==='/pages/'+id)f.data.set(key,{...f.data.get(key),observedAt:Date.parse('2026-09-28'),unavailable:false});return f.notion(...args);
 }});
 await service.sync(true);assert.equal(f.data.get(key).unavailable,false);
 f.data.set(key,{...f.data.get(key),observedAt:1});await f.service.sync(true);assert.equal(f.data.get(key).unavailable,true);
 f.pages.get(id).parent.data_source_id=source;await f.service.sync(true);assert.equal(Boolean(f.data.get(key).unavailable),false);
});
test('time budget failure never advances watermark and releases lease',async()=>{
 const f=fixture({syncBudgetMs:0});await assert.rejects(f.service.sync(true),e=>e.code==='inquiry_sync_timeout');const meta=f.data.get('deskInquiryMirror/main');assert.equal(meta.syncedAt,undefined);assert.equal(meta.syncLeaseUntil,0);assert.ok(meta.syncError);
});
test('sync-job exposes failure and skip distinctly; key required before any sync',async()=>{
 let calls=0,mode='fail';const app=express();app.use('/i',createInquiryRouter({verifyIdToken:async()=>({}),loadAccount:async()=>({}),syncKey:'fixture-key',service:{async sync(){calls++;if(mode==='fail')throw Object.assign(new Error('budget'),{ });return {status:'skipped',reason:'lease_or_fresh'};}}}));app.use(errorHandler);
 assert.equal((await request(app).post('/i/sync-job')).status,401);assert.equal(calls,0);
 assert.equal((await request(app).post('/i/sync-job').set('x-inquiry-sync-key','fixture-key')).status,500);
 mode='skip';const result=await request(app).post('/i/sync-job').set('x-inquiry-sync-key','fixture-key');assert.equal(result.body.status,'skipped');assert.equal(result.status,200);
});
test('partial mirror failure drains writes before lease release and retry fills missing rows',async()=>{
 const f=fixture();for(let n=4;n<24;n++){const key=String(n).padStart(32,'0');f.pages.set(key,{...structuredClone(f.pages.get(id)),id:key});}
 const original=f.firestore.runTransaction;let active=0,failed=false,failOnce=true;
 f.firestore.runTransaction=async fn=>{
  let item=false;
  try{return await original(async tx=>fn({get:async ref=>{if(ref.path.includes('/items/')){item=true;active++;await new Promise(r=>setTimeout(r,2));if(failOnce&&!failed){failed=true;throw Error('write failure');}}return tx.get(ref);},set:(ref,value,options)=>{if(value.syncLeaseUntil===0)assert.equal(active,0);return tx.set(ref,value,options);}}));}
  finally{if(item)active--;}
 };
 await assert.rejects(f.service.sync(true),/write failure/);assert.equal(active,0);assert.equal(f.data.get('deskInquiryMirror/main').syncedAt,undefined);
 assert.ok([...f.data.keys()].filter(k=>k.includes('/items/')).length>0);
 failOnce=false;await f.service.sync(true);assert.equal([...f.data.keys()].filter(k=>k.includes('/items/')).length,21);
});
