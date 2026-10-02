import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '../http.js';
import { cleanId, sameId, normalize, validatePatch, notionProperties, richText, RESULTS, METHODS, textValue, pageVersion } from './model.js';

export function createInquiryService({ notion, firestore, sourceId, historySourceId, now = () => new Date() }) {
 const equivalent=(k,a,b)=>JSON.stringify(k==='subjects'?[...(a||[])].sort():a)===JSON.stringify(k==='subjects'?[...(b||[])].sort():b);
 const root = firestore.collection('deskInquiryMirror');
 const items = root.doc('main').collection('items');
 const meta = root.doc('main');
 const operations = root.doc('main').collection('operations');
 const summaries = root.doc('main').collection('contactSummaries');
 const visibility = meta.collection('queueVisibility');
 const methodOf=p=>textValue(p.properties['연락 방법']) || ({'통화 완료':'전화','부재':'전화','문자 보냄':'문자','카톡 보냄':'카톡'}[textValue(p.properties['연락 결과'])] || '');
 const timeOf=p=>textValue(p.properties['기록 시각 원본'])||textValue(p.properties['연락 시각']);
 async function summarize(id,entries,observedAt){
  const valid=entries.filter(p=>!p.in_trash&&!p.archived&&textValue(p.properties['기록 상태'])!=='취소').sort((a,b)=>timeOf(b).localeCompare(timeOf(a)));
  const counts=Object.fromEntries(METHODS.map(m=>[m,valid.filter(p=>methodOf(p)===m).length]));
  const value={contactCounts:counts,lastActor:valid[0]?textValue(valid[0].properties['기록자']):'',historyLastContact:valid[0]?timeOf(valid[0]):'',observedAt};
  await firestore.runTransaction(async tx=>{const ref=summaries.doc(cleanId(id)),old=(await tx.get(ref)).data();if(!old || old.observedAt<=observedAt)tx.set(ref,value);});return value;
 }
 const locks = root.doc('main').collection('locks');
 const configured = () => { if (!sourceId) throw new ApiError(503,'notion_not_configured','신규문의 노션 DB 연결 설정이 필요합니다.'); };
 const schema = () => notion(`/data_sources/${sourceId}`);
 async function queryAll(id, body = {}) {
  const rows = []; let cursor;
  do { const readStartedAt=now().getTime();const result = await notion(`/data_sources/${id}/query`, 'POST', { ...body, page_size:100, ...(cursor ? {start_cursor:cursor} : {}) }); rows.push(...result.results.map(p=>({...p,_mirrorReadStartedAt:readStartedAt}))); cursor = result.has_more ? result.next_cursor : null; } while (cursor);
  return rows;
 }
 async function sourcePage(id) {
  const readStartedAt=now().getTime();
  const page = await notion(`/pages/${cleanId(id)}`);page._mirrorReadStartedAt=readStartedAt;
  if (!sameId(page.parent?.data_source_id,sourceId)) throw new ApiError(403,'wrong_source','신규문의 DB의 자료만 관리할 수 있습니다.');
  return page;
 }
 async function cache(page) { const row={...normalize(page),observedAt:page._mirrorReadStartedAt || now().getTime()}; await firestore.runTransaction(async tx=>{const ref=items.doc(row.id),old=(await tx.get(ref)).data();if(!old?.editedAt || old.editedAt<row.editedAt || (old.editedAt===row.editedAt && (old.observedAt||0)<=row.observedAt))tx.set(ref,row);}); return row; }
 async function sync(force = false) {
  configured();
  const owner = randomUUID(), start = now().toISOString();
  const state = await firestore.runTransaction(async tx => {
   const old=(await tx.get(meta)).data() || {};
   if (old.syncLeaseUntil > now().getTime() || (!force && old.projectionVersion===2 && old.syncedAt && now().getTime()-Date.parse(old.syncedAt)<45000)) return null;
   tx.set(meta,{syncOwner:owner,syncLeaseUntil:now().getTime()+300000},{merge:true});return old;
  });
  if (!state) return;
  try {
   const full=force || state.projectionVersion!==2 || !state.fullSyncedAt || now().getTime()-Date.parse(state.fullSyncedAt)>600000;
   const query=full ? {} : {filter:{timestamp:'last_edited_time',last_edited_time:{on_or_after:new Date(Date.parse(state.syncedAt)-60000).toISOString()}}};
   const pages=await queryAll(sourceId,query);
   for(const page of pages) await cache(page);
   if(full){
    const seen=new Set(pages.map(p=>cleanId(p.id)));
    const previous=await items.get();
    for(const doc of previous.docs) if(!seen.has(doc.id)) {
     try {await cache(await sourcePage(doc.id));}
     catch(e){ if(e.code==='notion_access_required' || e.code==='wrong_source') await doc.ref.set({unavailable:true},{merge:true}); else throw e; }
    }
   }
   if(historySourceId){
    const observedAt=now().getTime(), logs=await queryAll(historySourceId), grouped=new Map();
    for(const entry of logs) for(const rel of entry.properties['문의']?.relation||[]){const key=cleanId(rel.id);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(entry);}
    const previous=await summaries.get();for(const doc of previous.docs)if(!grouped.has(doc.id))grouped.set(doc.id,[]);
    for(const [id,entries] of grouped)await summarize(id,entries,observedAt);
   }
   await meta.set({projectionVersion:2,syncedAt:start,...(full?{fullSyncedAt:start}:{}),syncError:''},{merge:true});
  }catch(e){await meta.set({syncError:e.message},{merge:true});throw e;}
  finally{await firestore.runTransaction(async tx=>{const d=(await tx.get(meta)).data();if(d?.syncOwner===owner)tx.set(meta,{syncLeaseUntil:0},{merge:true});});}
 }
 async function list(force=false){
  let warning='';try{await sync(force);}catch(e){warning=e.message;}
  const [data,status,summaryDocs,visibilityDocs]=await Promise.all([items.get(),meta.get(),summaries.get(),visibility.get()]);
  const hiddenById=new Map(visibilityDocs.docs.map(d=>[d.id,d.data()]));
  const byId=new Map(summaryDocs.docs.map(d=>[d.id,d.data()]));
  const rows=data.docs.map(d=>({...d.data(),...byId.get(d.id),...hiddenById.get(d.id)})).filter(r=>!r.unavailable);
  return {items:rows,syncedAt:status.data()?.syncedAt || null,warning:warning || status.data()?.syncError || '', syncing:(status.data()?.syncLeaseUntil || 0)>now().getTime()};
 }
 async function detail(id){
  configured(); const page=await sourcePage(id), row=await cache(page);
  const observedAt=now().getTime();
  const entries=historySourceId ? await queryAll(historySourceId,{filter:{property:'문의',relation:{contains:page.id}},sorts:[{property:'연락 시각',direction:'descending'}]}) : [];
  // Keep normalization of historical properties explicit to avoid sending raw Notion objects.
  const contactSummary=await summarize(id,entries,observedAt);
  return {item:{...row,...contactSummary,...(await visibility.doc(cleanId(id)).get()).data()},history:entries.sort((a,b)=>(textValue(b.properties['기록 시각 원본'])||textValue(b.properties['연락 시각'])).localeCompare(textValue(a.properties['기록 시각 원본'])||textValue(a.properties['연락 시각']))).map(p=>({id:cleanId(p.id),version:pageVersion(p),method:methodOf(p),...Object.fromEntries(Object.entries({result:'연락 결과',note:'메모',actor:'기록자',at:'연락 시각',state:'기록 상태'}).map(([k,n])=>[k,textValue(p.properties[n])]))}))};
 }
 async function change(id, body, actor){
  configured();id=cleanId(id);
  if(!/^[a-zA-Z0-9-]{16,100}$/.test(body.requestId || '')) throw new ApiError(400,'request_id_required','저장 요청 번호가 필요합니다.');
  if(!['edit','contact','delete','restore','history'].includes(body.action))throw new ApiError(400,'invalid_action','지원하지 않는 동작입니다.');
  let patch=validatePatch(body.patch || {});
  const actorName=actor.nickname || actor.name || actor.loginId || actor.uid;
  if(body.action==='contact' && body.method!==undefined && !METHODS.includes(body.method))throw new ApiError(400,'invalid_method','연락 방법을 확인해 주세요.');
  if(patch.stage && patch.followup===undefined){
   if(['타원 등록','연락 보류'].includes(patch.stage))patch.followup='재연락 안 함';
   else if(['상담 중','재연락 대상','연락두절'].includes(patch.stage))patch.followup='재연락 필요';
  }
  if(body.action==='contact' && (!RESULTS.includes(body.result) || typeof body.note!=='string' || body.note.length>10000))throw new ApiError(400,'invalid_contact','연락 결과와 메모를 확인해 주세요.');
  if(body.action==='contact' && body.method && !({'전화':['통화 완료','부재'],'카톡':['카톡 보냄','답변 받음'],'문자':['문자 보냄','답변 받음']}[body.method]||[]).includes(body.result))throw new ApiError(400,'invalid_contact_result','연락 방법에 맞는 결과를 선택해 주세요.');
  if(body.action==='contact' && !historySourceId)throw new ApiError(503,'history_required','연락 이력 DB 연결이 필요합니다.');
  if(body.action==='history' && (!historySourceId || !['유효','취소'].includes(body.historyState) || typeof body.note!=='string' || body.note.length>10000))throw new ApiError(400,'invalid_history','연락 이력 수정 내용을 확인해 주세요.');
  const key=createHash('sha256').update(actor.uid+':'+body.requestId).digest('hex');
  const fingerprint=createHash('sha256').update(JSON.stringify({id,body})).digest('hex');
  const ref=operations.doc(key),lock=locks.doc(id),attempt=randomUUID();
  let op=await firestore.runTransaction(async tx=>{
   const old=(await tx.get(ref)).data(); const held=(await tx.get(lock)).data();
   if(old?.fingerprint && old.fingerprint!==fingerprint)throw new ApiError(409,'request_reused','다른 저장에는 새 요청 번호가 필요합니다.');
   if(old?.response)return old;
   if(held?.until>now().getTime())throw new ApiError(409,'save_in_progress','다른 저장이 진행 중입니다. 잠시 후 다시 시도해 주세요.');
   const value=old || {fingerprint,actor:{uid:actor.uid,name:actorName},at:new Date(Math.floor(now().getTime()/60000)*60000).toISOString(),exactAt:now().toISOString(),action:body.action,id,request:body};
   tx.set(lock,{attempt,until:now().getTime()+300000});tx.set(ref,value);return value;
  });
  if(op.response)return op.response;
  try{
   let page=await sourcePage(id),current=normalize(page);
   if(!op.prepared){
    if(body.version!==current.version)throw new ApiError(409,'stale_record','다른 곳에서 변경된 문의입니다. 새로고침하여 내용을 확인해 주세요.');
    if(current.trashed && body.action!=='restore')throw new ApiError(409,'trashed_record','삭제된 문의입니다. 먼저 복원해 주세요.');
    if(body.action==='contact'){patch={...patch,lastContact:op.at,lastResult:body.result};}
    op={...op,prepared:true,before:current,patch,properties:notionProperties(patch,await schema())};
    await ref.set(op);
   }
   if(body.action==='history'){
    const entry=await notion(`/pages/${cleanId(body.historyId)}`);
    if(!sameId(entry.parent?.data_source_id,historySourceId) || !entry.properties['문의']?.relation?.some(r=>sameId(r.id,id)))throw new ApiError(403,'wrong_history','이 문의의 연락 기록만 수정할 수 있습니다.');
    if(!op.historyWritten){
        const already=textValue(entry.properties['메모'])===body.note && textValue(entry.properties['기록 상태'])===body.historyState;
     if(pageVersion(entry)!==body.historyVersion && !(op.historyAttempted && already))throw new ApiError(409,'stale_history','연락 기록이 변경되었습니다. 다시 열어 주세요.');
     await ref.set({historyAttempted:true,historyBefore:entry.properties},{merge:true});
     if(!already)await notion(`/pages/${entry.id}`,'PATCH',{properties:{'메모':{rich_text:richText(body.note)},'기록 상태':{select:{name:body.historyState}},'수정자':{rich_text:richText(actorName)},'수정 시각':{date:{start:now().toISOString()}}}});
     await ref.set({historyWritten:true},{merge:true});
    }
      const all=await queryAll(historySourceId,{filter:{property:'문의',relation:{contains:page.id}},sorts:[{property:'연락 시각',direction:'descending'}]});
    const valid=all.filter(p=>textValue(p.properties['기록 상태'])!=='취소').sort((a,b)=>(textValue(b.properties['기록 시각 원본'])||textValue(b.properties['연락 시각'])).localeCompare(textValue(a.properties['기록 시각 원본'])||textValue(a.properties['연락 시각'])));
    const latest=valid[0];
    const summary={lastContact:latest?textValue(latest.properties['연락 시각']):'',lastResult:latest?textValue(latest.properties['연락 결과']):''};
    await notion(`/pages/${id}`,'PATCH',{properties:notionProperties(summary,await schema())});
   }else{
    const trash=body.action==='delete'?true:body.action==='restore'?false:undefined;
    const matches=Object.entries(op.patch).every(([k,v])=>equivalent(k,current[k],v)) && (trash===undefined || current.trashed===trash);
    if(!op.written){
     if(current.version!==op.before.version && !(op.attempted && matches))throw new ApiError(409,'stale_record','노션에서 내용이 변경되었습니다. 새로고침 후 확인해 주세요.');
     await ref.set({attempted:true},{merge:true});
     if(!matches)page=await notion(`/pages/${id}`,'PATCH',{properties:op.properties,...(trash===undefined?{}:{in_trash:trash})});
     await ref.set({written:true},{merge:true});
    }
    if(body.action==='contact'){
     const found=await queryAll(historySourceId,{filter:{property:'요청 ID',rich_text:{equals:key}}});
     if(!found.length){
      if(op.historyAttempted)throw new ApiError(503,'history_uncertain','문의 상태는 저장되었으나 연락 이력 저장 결과가 불명확합니다. 같은 요청을 다시 시도하고, 계속 실패하면 담당자에게 문의해 주세요.');
      await ref.set({historyAttempted:true},{merge:true});
      await notion('/pages','POST',{parent:{type:'data_source_id',data_source_id:historySourceId},properties:{
       '이름':{title:richText(`${op.before.name} · ${body.result}`)},'문의':{relation:[{id}]},'요청 ID':{rich_text:richText(key)},
       ...(body.method?{'연락 방법':{select:{name:body.method}}}:{}),'연락 결과':{select:{name:body.result}},'메모':{rich_text:richText(body.note)},'기록자':{rich_text:richText(actorName)},
       '연락 시각':{date:{start:op.at}},'기록 시각 원본':{rich_text:richText(op.exactAt || op.at)},'기록 상태':{select:{name:'유효'}}
      }});
     }
    }
   }
   page=await sourcePage(id);let row=await cache(page);
   if(['contact','history'].includes(body.action))row=(await detail(id)).item;
   else row={...row,...(await summaries.doc(id).get()).data()};
   if(body.action!=='history'){
    const expectedTrash=body.action==='delete'?true:body.action==='restore'?false:row.trashed;
    if(row.trashed!==expectedTrash || !Object.entries(op.patch).every(([k,v])=>equivalent(k,row[k],v)))throw new ApiError(409,'verification_conflict','저장 중 노션 내용이 변경되었습니다. 새로고침 후 확인해 주세요.');
   }
   const response={item:{...row,...(await visibility.doc(cleanId(id)).get()).data()},ok:true};await ref.set({response,completedAt:now().toISOString()},{merge:true});return response;
  }finally{await firestore.runTransaction(async tx=>{const held=(await tx.get(lock)).data();if(held?.attempt===attempt)tx.set(lock,{until:0},{merge:true});});}
 }
 async function setVisibility(id,body,actor){
  id=cleanId(id);
  if(typeof body?.hidden!=='boolean'||typeof body?.expectedHidden!=='boolean')throw new ApiError(400,'invalid_visibility','숨김 상태를 확인해 주세요.');
  await sourcePage(id);
  const ref=visibility.doc(id);
  const value=await firestore.runTransaction(async tx=>{
   const old=(await tx.get(ref)).data()||{};
   if(Boolean(old.queueHidden)!==body.expectedHidden && Boolean(old.queueHidden)!==body.hidden)throw new ApiError(409,'visibility_conflict','다른 근무자가 상태를 변경했습니다. 새로고침 후 다시 확인해 주세요.');
   if(Boolean(old.queueHidden)===body.hidden)return old;
   const next={queueHidden:body.hidden,queueVisibilityAt:now().toISOString(),queueVisibilityActorUid:actor.uid,queueVisibilityActor:actor.nickname||actor.name||actor.loginId||actor.uid};
   tx.set(ref,next);return next;
  });
  return {id,...value,queueHidden:Boolean(value.queueHidden)};
 }
 async function schoolIcons(){
  const snapshot=await firestore.collection('sharedIconAssets').get();
  return {icons:snapshot.docs.map(d=>({...d.data(),category:String(d.data().category||'').toUpperCase(),imageUrl:d.data().imageUrl||d.data().downloadURL||''})).filter(d=>d.category==='SCHOOL'&&(d.status||'ACTIVE')==='ACTIVE'&&/^https:\/\//i.test(d.imageUrl||'')).map(d=>({displayName:String(d.displayName||''),lookupKey:String(d.lookupKey||''),aliases:Array.isArray(d.aliases)?d.aliases.filter(a=>typeof a==='string'):[],imageUrl:d.imageUrl}))};
 }
 return {list,detail,change,sync,sourcePage,cache,setVisibility,schoolIcons};
}
