import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {createTrainingRouter,validateEvidence} from '../src/training.js';
import {errorHandler} from '../src/http.js';
function setup(){
 const values=new Map([['users/a',{name:'담당자',role:'ADMIN',status:'ACTIVE'}],['users/u',{name:'근무자',role:'INSTRUCTOR',status:'ACTIVE'}],['users/v',{name:'다른 근무자',role:'STAFF',status:'ACTIVE'}]]),objects=new Map();
 function doc(path){return {id:path.split('/').at(-1),path,get:async()=>({id:path.split('/').at(-1),exists:values.has(path),data:()=>values.get(path)}),collection:name=>col(path+'/'+name)};}
 function col(path,predicate=()=>true){return {doc:id=>doc(path+'/'+id),where:(key,_op,value)=>col(path,v=>v[key]===value),get:async()=>({docs:[...values].filter(([k,v])=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1&&predicate(v)).map(([k,v])=>({id:k.split('/').at(-1),data:()=>v}))})};}
 const firestore={collection:col,runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v)=>values.set(r.path,v),update:(r,v)=>values.set(r.path,{...values.get(r.path),...v})})};
 const bucket={file:path=>({save:async buffer=>objects.set(path,buffer),delete:async()=>objects.delete(path),download:async()=>{if(!objects.has(path))throw Error('missing');return [objects.get(path)];}})};
 const app=express();app.use('/v1/training',createTrainingRouter({firestore,bucket,verifyIdToken:async token=>({uid:token}),loadAccount:async uid=>({account:values.get('users/'+uid),access:{apps:{deskPortal:uid==='a'}}})}));app.use(errorHandler);
 const call=(who='a')=>({get:path=>request(app).get('/v1/training'+path).set('Authorization','Bearer '+who),post:(path,body)=>request(app).post('/v1/training'+path).set('Authorization','Bearer '+who).send(body)});
 return {values,objects,call};
}
const pdf={name:'증명.pdf',type:'application/pdf',data:Buffer.from('%PDF-1.7\nsynthetic').toString('base64')};
test('active instructors can use own training without desk permission; users cannot access other records or manager settings',async()=>{
 const {call,values}=setup();values.set('deskTraining/2026/records/v__child',{workerUid:'v',courseId:'child',files:[{id:'file',name:'secret.pdf'}]});
 let res=await call('u').get('/2026');assert.equal(res.status,200);assert.equal(res.body.manager,false);assert.deepEqual(res.body.records,[]);assert.equal(res.body.workers.length,1);assert.equal(res.body.sessions.length,0);
 assert.equal((await call('u').get('/2026/records/v__child/files/file')).status,403);
 assert.equal((await call('u').post('/2026/courses',{name:'x'})).status,403);
 assert.equal((await call('u').post('/2026/sessions',{courseId:'child'})).status,403);
 assert.equal((await call('u').post('/2026/records/v__child/files',pdf)).status,403);
});
test('employee cannot spoof worker or approval; upload uses private objects and resets status for review',async()=>{
 const {call,values,objects}=setup();let res=await call('u').post('/2026/records',{workerUid:'v',courseId:'child',status:'approved',applicability:'exempt',completedDate:'2026-09-25'});assert.equal(res.status,200);assert.equal(res.body.workerUid,'u');assert.equal(res.body.status,'missing');assert.equal(res.body.applicability,'pending');
 res=await call('u').post('/2026/records/u__child/files',pdf);assert.equal(res.status,200);const fid=res.body.id;assert.equal(objects.size,1);assert.equal(values.get('deskTraining/2026/records/u__child').status,'submitted');
 assert.equal((await call('u').get('/2026/records/u__child/files/'+fid)).status,200);assert.equal((await call('v').get('/2026/records/u__child/files/'+fid)).status,403);
 assert.equal((await call('a').get('/2026/records/u__child/files/'+fid)).status,200);
});
test('approval requires evidence and stale saves fail without overwriting',async()=>{
 const {call}=setup();assert.equal((await call().post('/2026/records',{workerUid:'u',courseId:'child',status:'approved'})).status,400);
 let res=await call().post('/2026/records',{workerUid:'u',courseId:'child',applicability:'required'});assert.equal(res.status,200);
 assert.equal((await call().post('/2026/records',{workerUid:'u',courseId:'child',version:0})).status,409);
 assert.equal((await call().post('/2026/records',{workerUid:'u',courseId:'child',version:1,completedDate:'2026-02-31'})).status,400);
 assert.equal((await call().post('/2026/records',{workerUid:'u',courseId:'child',version:1,sessionId:'unknown',status:'approved'})).status,400);
});
test('internal education evidence can only be linked to a participant of matching course',async()=>{
 const {call,values}=setup();values.set('deskTraining/2026/sessions/s1',{courseId:'harassment',participants:[{uid:'u',name:'근무자'}],files:[{id:'evidence'}]});
 assert.equal((await call().post('/2026/records',{workerUid:'u',courseId:'harassment',sessionId:'s1',status:'approved'})).status,200);
 assert.equal((await call().post('/2026/records',{workerUid:'v',courseId:'harassment',sessionId:'s1',status:'approved'})).status,400);
 assert.equal((await call().post('/2026/records',{workerUid:'u',courseId:'child',sessionId:'s1',status:'approved'})).status,400);
});
test('rejects executable uploads, mismatched MIME, empty files and oversized files',()=>{
 assert.throws(()=>validateEvidence({...pdf,type:'text/html'}));assert.throws(()=>validateEvidence({...pdf,data:Buffer.from('<script>').toString('base64')}));assert.throws(()=>validateEvidence({...pdf,data:''}));assert.throws(()=>validateEvidence({...pdf,data:Buffer.alloc(10*1024*1024+1).toString('base64')}));assert.equal(validateEvidence(pdf).name,'증명.pdf');
});
test('anonymous and inactive accounts denied',async()=>{
 const {call,values}=setup();values.set('users/u',{name:'inactive',role:'INSTRUCTOR',status:'INACTIVE'});assert.equal((await call('u').get('/2026')).status,403);assert.equal((await call('unknown').get('/2026')).status,403);
});
