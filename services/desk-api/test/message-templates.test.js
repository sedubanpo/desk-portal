import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {prepareMessageTemplates} from '../src/desk/message-templates.js';
import {createDeskHandlers} from '../src/desk/handlers.js';
const require=createRequire(import.meta.url);
const {personalizeTemplate_,templateTimestamp_}=require('../../../docs/message-templates.js');
const actor={uid:'qa-admin',name:'검증 관리자',role:'ADMIN'};
const now=()=> '2026-10-02T14:00:00.000Z';
const fixture=()=>({tags:[{id:'t',label:'상담',target:'학생'}],templates:[{id:'a',tagId:'t',title:'상담 안내',target:'학생',tone:'정중하게',message:'{학생명} 학생과 {강사명} 강사'}]});
test('personalization replaces all names, legacy aliases and repeated tokens without interpreting replacement text',()=>{
 assert.equal(personalizeTemplate_('{학생명} {학생명} {강사명} {담당강사} {지원자명} {수업일}',{student:'김$&',teacher:'이강사',applicant:'박지원'}),'김$& 김$& 이강사 이강사 박지원 {수업일}');
 assert.equal(personalizeTemplate_('{학생명} {지원자명}',{}),'{학생명} {지원자명}');
 assert.equal(templateTimestamp_('5분 전'),'시각 기록 없음');
});
test('creation attribution and time are server-owned; untrusted history is ignored',()=>{
 const input=fixture();input.history={fake:{action:'delete'}};input.templates[0].updatedBy='위조';input.templates[0].updatedAt='위조';
 const next=prepareMessageTemplates(input,null,actor,now);
 assert.equal(next.templates[0].updatedBy,actor.name);assert.equal(next.templates[0].createdByUid,actor.uid);
 assert.equal(next.templates[0].updatedAt,now());assert.equal(Object.values(next.history).length,2);assert.ok(!next.history.fake);
});
test('edits and deletions retain immutable before/after snapshots and original creation attribution',()=>{
 const first=prepareMessageTemplates(fixture(),null,actor,now); const edit=structuredClone(first);edit.templates[0].message='수정된 문구';edit.history={};
 const second=prepareMessageTemplates(edit,first,{uid:'b',name:'다른 관리자'},()=> '2026-10-03T00:00:00Z');
 assert.equal(Object.keys(second.history).length,3);assert.equal(second.templates[0].createdByUid,actor.uid);
 assert.equal(Object.values(second.history).find(x=>x.action==='update').before.message,first.templates[0].message);
 const deleted=prepareMessageTemplates({...second,templates:[],history:{}},second,actor,now);
 assert.equal(deleted.templates.length,0);assert.equal(Object.keys(deleted.history).length,4);assert.equal(Object.values(deleted.history).find(x=>x.action==='delete').before.message,'수정된 문구');
});
test('no-op saves neither rewrite timestamps nor manufacture history, including legacy records',()=>{
 const legacy=fixture();legacy.templates[0].updatedAt='5분 전';
 const next=prepareMessageTemplates({...legacy,history:{fake:1}},legacy,actor,now);
 assert.equal(Object.keys(next.history).length,0);assert.equal(next.templates[0].updatedAt,'5분 전');
 const first=prepareMessageTemplates(fixture(),null,actor,now);
 assert.deepEqual(prepareMessageTemplates(first,first,actor,()=> '2027-01-01'),first);
});
test('CAS conflict cannot change templates or their audit history; nested bypass is denied',async()=>{
 let stored=null;const h=createDeskHandlers({now,store:{transaction:async(_,cb)=>{stored=cb(stored);return structuredClone(stored);}}});
 const payload={scope:'daily',key:'messageTemplates',expectedValue:null,value:fixture()};
 const first=await h.saveDeskPortalConfig(payload,actor);
 await assert.rejects(h.saveDeskPortalConfig({...payload,value:{tags:[],templates:[]}},actor),e=>e.status===409);
 assert.deepEqual(stored,first.value);
 assert.equal((await h.saveDeskPortalConfig({...payload,key:'messageTemplates/history'},actor)).success,false);
 const last=await h.saveDeskPortalConfig({...payload,expectedValue:stored,value:{tags:[],templates:[]}},actor);
 assert.equal(Object.values(last.value.history).filter(x=>x.action==='delete').length,2);
});
test('invalid collections and duplicate identifiers are rejected atomically',()=>{
 for(const value of [null,{}, {tags:[],templates:[{id:'a'}]}, {...fixture(),templates:[...fixture().templates,...fixture().templates]}]) assert.throws(()=>prepareMessageTemplates(value,null,actor,now),e=>e.status===400);
});

test('RTDB-pruned empty collections retain audit and accept the next creation',()=>{
 const first=prepareMessageTemplates(fixture(),null,actor,now);
 const deleted=prepareMessageTemplates({tags:[],templates:[]},first,actor,now);
 const persisted={history:deleted.history};
 const next=prepareMessageTemplates(fixture(),persisted,actor,now);
 assert.equal(Object.keys(next.history).length,6);
 assert.equal(next.templates[0].createdByUid,actor.uid);
});
