import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {prepareResponseLog} from '../src/desk/response-log.js';
import {createDeskHandlers} from '../src/desk/handlers.js';
const require = createRequire(import.meta.url);
const A = require('../../../docs/inquiry-analytics.js');
const now = () => '2026-10-02T03:00:00.000Z';
const admin = {uid:'synthetic-admin',name:'테스트 관리자',role:'ADMIN'};
test('question author and timestamp come from server identity, not form claims',()=>{
 const row=prepareResponseLog({text:'합성 질문',createdAt:'forged',createdByUid:'forged',createdByName:'forged',answerText:'합성 답변',answeredByUid:'forged'},null,admin,now,'q1');
 assert.equal(row.createdAt,now()); assert.equal(row.createdByUid,admin.uid); assert.equal(row.answeredByUid,admin.uid); assert.equal(row.answerText,'합성 답변');
});
test('answer updates preserve original question and unknown legacy author',()=>{
 const old={text:'원래 질문',createdAt:'2026-09-01T00:00:00.000Z'};
 const row=prepareResponseLog({text:'변경 시도',createdByName:'forged',answerText:'답변'},old,admin,now,'q1');
 assert.equal(row.text,old.text); assert.equal(row.createdAt,old.createdAt); assert.equal(row.createdByName,''); assert.equal(row.answeredAt,now());
});
test('staff cannot overwrite an answer; old clients preserve saved answers and author fields',()=>{
 const old={text:'질문',answerText:'기존 답변',answeredByUid:'admin',answeredAt:now()};
 assert.throws(()=>prepareResponseLog({text:'질문',answerText:'다른 답변'},old,{role:'STAFF'},now,'q1'),e=>e.status===403);
 const result=prepareResponseLog({text:'질문',status:'검토중',answeredByUid:'forged'},old,{role:'STAFF'},now,'q1');
 assert.equal(result.answerText,old.answerText); assert.equal(result.answeredByUid,'admin');
});
test('empty and oversized questions or answers are rejected',()=>{
 for(const value of [{text:''},{text:'x'.repeat(5001)},{text:'질문',answerText:'x'.repeat(20001)}]) assert.throws(()=>prepareResponseLog(value,null,admin,now,'q1'),e=>e.status===400);
});
test('question config uses item CAS and refuses collection replacement',async()=>{
 let stored=null;
 const h=createDeskHandlers({now,store:{transaction:async(_,update)=>{stored=update(stored);return stored;}}});
 const first=await h.saveDeskPortalConfig({scope:'daily',key:'responseLogs/q1',expectedValue:null,value:{text:'질문'}},admin);
 assert.equal(first.value.createdByUid,admin.uid);
 await assert.rejects(h.saveDeskPortalConfig({scope:'daily',key:'responseLogs/q1',expectedValue:null,value:{text:'질문',answerText:'덮어쓰기'}},admin),e=>e.status===409);
 assert.equal((await h.saveDeskPortalConfig({scope:'daily',key:'responseLogs',expectedValue:null,value:{q1:{answerText:'우회'}}},admin)).success,false);
});
test('template rows are excluded from analytics and follow-up, including spacing variants',()=>{
 const row={id:'real',name:'합성 문의',createdAt:'2026-10-01T00:00:00Z',followup:'재연락 필요',stage:'상담 중',subjects:['수학']};
 const rows=[row,{...row,id:'template',name:' 신규문의  템플릿 '}];
 assert.equal(A.needs(rows[1]),false); assert.equal(A.isTemplate(row),false);
 const model=A.summarize(rows,A.range('custom','2026-10-01','2026-10-02'),'2026-10-02');
 assert.equal(model.cohort.length,1);
});
