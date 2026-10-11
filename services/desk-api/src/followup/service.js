import { randomUUID } from 'node:crypto';
import { ApiError } from '../http.js';
import { FIELDS, STATUSES, TYPES, hash, id, normalize, compact, validatePatch, properties, buildQuery, today } from './model.js';
import { parseChat } from './import.js';

export function createFollowupService({notion,firestore,sourceId,now=()=>new Date()}){
 const root=firestore.collection('deskFollowup').doc(id(sourceId));
 const queries=root.collection('queries'),ops=root.collection('operations'),locks=root.collection('locks'),batches=root.collection('imports');
 let metadata=null,metadataAt=0;
 async function schema(){if(metadata&&now().getTime()-metadataAt<60000)return metadata;const raw=await notion(`/data_sources/${sourceId}`);for(const key of ['title','status','rooms','owners','nextCheck','evidence','messageKeys'])if(!raw.properties?.[FIELDS[key]])throw new ApiError(503,'schema_changed','노션 업무 팔로우 속성을 확인해 주세요.');metadata=raw;metadataAt=now().getTime();return raw;}
 async function meta(){const s=await schema();return {statuses:STATUSES,types:TYPES,rooms:(s.properties['소스방']?.multi_select?.options||[]).map(o=>o.name),owners:(s.properties['담당']?.multi_select?.options||[]).map(o=>o.name),sourceUrl:'https://www.notion.so/'+id(sourceId)};}
 async function sourcePage(value){const p=await notion('/pages/'+id(value));if(!p.parent?.data_source_id||id(p.parent.data_source_id)!==id(sourceId))throw new ApiError(403,'wrong_source','업무 팔로우 DB의 항목만 관리할 수 있습니다.');if(p.archived||p.in_trash)throw new ApiError(409,'archived','노션에서 보관된 업무입니다.');return p;}
 async function list(input={},actor={}){
  const query=buildQuery(input,actor,now()),ref=queries.doc(hash(query));const saved=(await ref.get()).data(),generation=(await root.get()).data()?.generation||'';
  if(input.refresh!=='1'&&saved?.generation===generation&&now().getTime()-Date.parse(saved.syncedAt)<30000)return {...saved,warning:''};
  try{const result=await notion(`/data_sources/${sourceId}/query`,'POST',query);const value={items:result.results.map(normalize).filter(r=>!r.archived).map(compact),nextCursor:result.has_more?result.next_cursor:null,syncedAt:now().toISOString(),generation};await ref.set(value);return {...value,warning:''};}
  catch(e){if(saved && e.code!=='notion_access_required')return {...saved,warning:e.message};throw e;}
 }
 async function detail(value){return {item:normalize(await sourcePage(value))};}
 async function invalidate(){await root.set({generation:randomUUID()},{merge:true});metadataAt=0;}
 const actorName=a=>a.nickname||a.name||a.loginId||a.uid;
 async function known(marker){const r=await notion(`/data_sources/${sourceId}/query`,'POST',{page_size:2,filter:{property:'원문메시지키',rich_text:{contains:marker}}});return r.results?.[0];}
 async function save(body,actor,importRecord=null){
  const target=body.id?id(body.id):'',patch=validatePatch(body.patch||{});
  if(!/^[a-zA-Z0-9-]{16,100}$/.test(body.requestId||''))throw new ApiError(400,'request_id_required','저장 요청 번호가 필요합니다.');
  if(body.mergeTarget&&actor.role!=='ADMIN')throw new ApiError(403,'admin_required','업무 병합은 관리자가 처리합니다.');
  if(body.mergeTarget&&(!target||id(body.mergeTarget)===target))throw new ApiError(400,'invalid_merge','서로 다른 두 업무를 선택해 주세요.');
  if(patch.status==='병합'&&!body.mergeTarget)throw new ApiError(400,'merge_target_required','병합할 대표 업무를 선택해 주세요.');
  if(typeof body.note!=='undefined'&&(typeof body.note!=='string'||body.note.length>12000))throw new ApiError(400,'invalid_note','후속 기록은 12,000자 이내로 입력해 주세요.');
  const key=importRecord?hash(['import',importRecord.message.key,importRecord.slot]):hash([actor.uid,body.requestId]);
  const marker='portal:'+key,ref=ops.doc(key),lock=locks.doc(target||key),owner=randomUUID();
  const fingerprint=hash({target,patch,note:body.note||'',mergeTarget:body.mergeTarget||'',importKey:importRecord?.message.key||''});
  let op=await firestore.runTransaction(async tx=>{const old=(await tx.get(ref)).data(),held=(await tx.get(lock)).data();
   // A message slot is a durable receipt across repeat imports and staff accounts.
   if(old?.response&&importRecord)return old;
   if(old?.fingerprint&&old.fingerprint!==fingerprint)throw new ApiError(409,'request_reused','진행 중인 요청의 내용이 달라졌습니다. 저장 결과를 먼저 확인해 주세요.');
   if(old?.response)return old;if(held?.until>now().getTime())throw new ApiError(409,'save_in_progress','이 업무를 저장 중입니다. 잠시 후 다시 시도해 주세요.');
   const value=old||{fingerprint,at:now().toISOString(),actor:actorName(actor),target};tx.set(lock,{owner,until:now().getTime()+180000});tx.set(ref,value);return value;});
  if(op.response)return importRecord?{...op.response,duplicate:true}:op.response;
  try{
   await schema();let page=target?await sourcePage(target):null;
   if(!page){const found=await known(marker);if(found){page=await sourcePage(found.id);const response={ok:true,item:normalize(page)};await ref.set({response},{merge:true});await invalidate();return {...response,duplicate:true};}}
   let current=page?normalize(page):null;
   if(!op.prepared){
    if(current&&current.version!==body.version)throw new ApiError(409,'stale_record','노션 또는 다른 근무자가 수정한 업무입니다. 다시 열어 변경 내용을 확인해 주세요.');
    if(!target&&!patch.title)throw new ApiError(400,'title_required','업무명을 입력해 주세요.');
    const next={...(!target?{status:'확인 필요',importance:'★★★',type:'기타',ownerConfirmation:'미확인'}:{}),...patch,lastCheck:today(now())};
    if(!target&&!next.rooms?.length&&!importRecord)throw new ApiError(400,'room_required','소스방을 선택하거나 입력해 주세요.');
    if(next.status==='해결'&&!(next.resolution||current?.resolution)?.trim())throw new ApiError(400,'resolution_required','해결을 확인할 수 있는 근거를 입력해 주세요.');
    if(next.status==='해결')next.resolvedAt=today(now());else if(current?.status==='해결'&&next.status)next.resolvedAt='';
    if(body.mergeTarget){const representative=normalize(await sourcePage(body.mergeTarget));if(representative.status==='병합')throw new ApiError(409,'merged_target','이미 병합된 업무는 대표 업무로 지정할 수 없습니다.');next.status='병합';next.mergeTarget=[id(body.mergeTarget)];}
    let entry=`[${op.at} · ${op.actor}] ${!target?'업무 등록':body.mergeTarget?'대표 업무로 병합':importRecord?'대화 후속 연결':'업무 수정'}`;
    if(body.note?.trim())entry+='\n'+body.note.trim();
    if(target){const changes=Object.entries(patch).filter(([k,v])=>JSON.stringify(current[k])!==JSON.stringify(v)).map(([k,v])=>`${FIELDS[k]}: ${Array.isArray(current[k])?current[k].join(', '):current[k]||'—'} → ${Array.isArray(v)?v.join(', '):v||'—'}`);if(changes.length)entry+='\n'+changes.join('\n');}
    if(importRecord){const m=importRecord.message;entry+=`\n소스방: ${importRecord.room} · ${m.at} · ${m.sender}\n${m.text}`;next.rooms=[...new Set([...(next.rooms||current?.rooms||[]),importRecord.room])];next.firstEvidence=current?.firstEvidence&&current.firstEvidence<m.at.slice(0,10)?current.firstEvidence:m.at.slice(0,10);next.latestEvidence=current?.latestEvidence&&current.latestEvidence>m.at.slice(0,10)?current.latestEvidence:m.at.slice(0,10);next.sourceLocation=[current?.sourceLocation,`${importRecord.filename} · ${m.location}`].filter(Boolean).join('\n');}
    if(body.mergeTarget)entry+='\n대표 업무: https://www.notion.so/'+id(body.mergeTarget);
    next.evidence=[current?.evidence,entry].filter(Boolean).join('\n\n');next.messageKeys=[current?.messageKeys,marker,importRecord?'message:'+importRecord.message.key:''].filter(Boolean).join('\n');
    op={...op,prepared:true,before:current?.version||'',expected:next,properties:properties(next)};if(Buffer.byteLength(JSON.stringify(op))>650000)throw new ApiError(400,'history_full','누적 근거가 많습니다. 노션에서 이력을 정리한 뒤 저장해 주세요.');await ref.set(op);
   }
   const matches=r=>Object.entries(op.expected).every(([k,v])=>JSON.stringify(Array.isArray(r[k])?[...r[k]].sort():r[k])===JSON.stringify(Array.isArray(v)?[...v].sort():v));
   if(target){if(current.version!==op.before&&!(op.attempted&&matches(current)))throw new ApiError(409,'stale_record','저장 중 원본이 변경되었습니다. 업무를 다시 열어 주세요.');if(!matches(current)){await ref.set({attempted:true},{merge:true});page=await notion('/pages/'+target,'PATCH',{properties:op.properties});}}
   else {if(op.attempted)throw new ApiError(503,'create_uncertain','이전 등록 결과를 확인 중입니다. 같은 요청으로 재시도해 주세요. 중복 생성을 막기 위해 다시 등록하지 않습니다.');await ref.set({attempted:true},{merge:true});page=await notion('/pages','POST',{parent:{type:'data_source_id',data_source_id:sourceId},properties:op.properties});}
   const verified=normalize(await sourcePage(page.id));if(!matches(verified))throw new ApiError(409,'verification_conflict','저장 결과가 변경되었습니다. 노션 원본을 확인해 주세요.');
   const response={ok:true,item:verified};await ref.set({response,finishedAt:now().toISOString()},{merge:true});await invalidate();return response;
  }finally{await firestore.runTransaction(async tx=>{const held=(await tx.get(lock)).data();if(held?.owner===owner)tx.set(lock,{until:0});});}
 }
 async function upload(body,actor){const parsed=parseChat(body),batchId=hash([actor.uid,parsed.room,parsed.messages.map(m=>m.key)]),ref=batches.doc(batchId);const existing=(await ref.get()).data();if(existing?.ready)return {batchId,...existing,resumed:true};
  const {messages,...info}=parsed;await ref.set({...info,uid:actor.uid,createdAt:now().toISOString(),total:messages.length,ready:false});
  for(let start=0;start<messages.length;start+=200){const writes=[];for(let i=start;i<Math.min(start+200,messages.length);i+=10)writes.push(ref.collection('chunks').doc(String(i/10)).set({messages:messages.slice(i,i+10)}));await Promise.all(writes);}
  await ref.set({ready:true},{merge:true});return {batchId,...info,total:messages.length};
 }
 async function importMeta(batchId,actor){if(!/^[a-f0-9]{64}$/.test(batchId))throw new ApiError(400,'invalid_batch','가져오기 번호를 확인해 주세요.');const ref=batches.doc(batchId),data=(await ref.get()).data();if(!data||data.uid!==actor.uid)throw new ApiError(404,'batch_not_found','본인이 가져온 파일만 검토할 수 있습니다.');if(!data.ready)throw new ApiError(409,'batch_incomplete','파일 업로드가 끝나지 않았습니다. 다시 업로드해 주세요.');return {ref,data};}
 async function importPage(batchId,input,actor){const {ref,data}=await importMeta(batchId,actor);const page=Number(input.page||0);if(!Number.isInteger(page)||page<0||page>=Math.ceil(data.total/10))throw new ApiError(400,'invalid_page','검토 페이지를 확인해 주세요.');const records=(await ref.collection('chunks').doc(String(page)).get()).data()?.messages||[];const messages=await Promise.all(records.map(async(m,i)=>{const receipts=(await root.collection('messageReceipts').doc(m.key).get()).data()?.slots||{};const review=(await ref.collection('review').doc(m.key).get()).data()||{};return {...m,index:page*10+i,receipts:Object.values(receipts),skipped:!!review.skipped};}));return {...data,batchId,page,messages};}
 async function commitImport(batchId,body,actor){const {ref,data}=await importMeta(batchId,actor);const index=body.index;if(!Number.isInteger(index)||index<0||index>=data.total)throw new ApiError(400,'invalid_message','원문 메시지를 선택해 주세요.');const message=(await ref.collection('chunks').doc(String(Math.floor(index/10))).get()).data()?.messages[index%10];const slot=String(body.slot||'0');if(!/^[a-zA-Z0-9-]{1,80}$/.test(slot))throw new ApiError(400,'invalid_slot','후보 번호를 확인해 주세요.');if(body.reviewed!==true)throw new ApiError(400,'review_required','원문과 후보를 확인한 후 등록해 주세요.');const response=await save(body,actor,{message,slot,room:data.room,filename:data.filename});const receiptRef=root.collection('messageReceipts').doc(message.key);await firestore.runTransaction(async tx=>{const old=(await tx.get(receiptRef)).data()?.slots||{};tx.set(receiptRef,{slots:{...old,[slot]:{slot,id:response.item.id,code:response.item.code,title:response.item.title,url:response.item.url,at:now().toISOString()}}});});return response;}
 async function skipImport(batchId,body,actor){const {ref,data}=await importMeta(batchId,actor);if(!Number.isInteger(body.index)||body.index<0||body.index>=data.total||typeof body.skipped!=='boolean')throw new ApiError(400,'invalid_review','검토 항목을 확인해 주세요.');const message=(await ref.collection('chunks').doc(String(Math.floor(body.index/10))).get()).data()?.messages[body.index%10];await ref.collection('review').doc(message.key).set({skipped:body.skipped,at:now().toISOString()});return {ok:true};}
 return {meta,list,detail,save,upload,importPage,commitImport,skipImport};
}
