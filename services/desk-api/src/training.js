import express from 'express';
import { randomUUID } from 'node:crypto';
import { createRequireStaff } from './auth.js';
import { ApiError } from './http.js';

export const TRAINING_COURSES = [
 ['child','아동학대 신고의무자 교육','online'],
 ['emergency','긴급복지지원 신고의무자 교육','online'],
 ['abuse','장애인학대 및 장애인 대상 성범죄 신고의무자 교육','online'],
 ['disability','직장 내 장애인 인식개선 교육','online'],
 ['harassment','직장 내 성희롱 예방교육','internal'],
 ['safety','어린이이용시설 종사자 안전교육','online'],
 ['bus','어린이통학버스 안전교육','online'],
 ['privacy','개인정보 보호교육','internal'],
 ['pension','퇴직연금교육','online']
].map(([id,name,mode])=>({id,name,mode}));
export function canManageTraining(user) {
 return user.role==='ADMIN' || (user.apps?.deskPortal===true && user.permissions?.canManageTraining===true);
}
const fail=(message,status=400)=>{throw new ApiError(status,'training_invalid',message);};
const str=(v,max=2000)=>String(v??'').trim().slice(0,max);
const id=v=>/^[a-zA-Z0-9_-]{1,128}$/.test(String(v))?String(v):fail('항목 식별자가 올바르지 않습니다.');
const date=v=> { if(!v)return ''; const d=new Date(v+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v?v:fail('날짜를 확인해 주세요.'); };
export function trainingPerson(uid, account = {}, profile = {}) {
 const role = String(account.role || '').toUpperCase();
 const subjects = [...new Set([profile.department, ...(Array.isArray(profile.subjects) ? profile.subjects : []), account.subject].filter(v => typeof v === 'string').flatMap(v => v.split(/[,/·|\s]+/)).filter(Boolean))];
 return {uid, name:str(account.name || profile.displayName || uid,100), role, group:role==='INSTRUCTOR'?'instructors':'staff', position:str(account.staffPosition || profile.staffPosition || (profile.teacherPosition==='TEAM_LEAD'?'팀장':''),100), subjects:subjects.map(v=>str(v,50)).slice(0,10)};
}
export function validateEvidence(file) {
 const name=str(file?.name,180),type=str(file?.type,80);
 if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(type)) fail('PDF, JPG, PNG, WEBP 파일만 제출할 수 있습니다.');
 const data=Buffer.from(String(file?.data||''),'base64');
 if(!data.length||data.length>10*1024*1024) fail('파일은 10MB 이하여야 합니다.');
 const valid= type==='application/pdf'?data.subarray(0,5).toString()==='%PDF-':type==='image/jpeg'?data[0]===255&&data[1]===216&&data[2]===255:type==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP';
 if(!valid)fail('파일 내용과 형식이 일치하지 않습니다.');
 return {name:name.replace(/[\r\n/\\]/g,'_')||'certificate',type,data};
}
export function createTrainingRouter({verifyIdToken,loadAccount,firestore,bucket}) {
 const router=express.Router();
 router.use(createRequireStaff({verifyIdToken,loadAccount,trainingOnly:true}));
 router.use(express.json({limit:'15mb'}));
 router.param('year',(req,_res,next,value)=>{if(!/^20\d\d$/.test(value))return next(new ApiError(400,'invalid_year','연도는 2000~2099년으로 선택해 주세요.'));req.trainingYear=value;next();});
 const root=req=>firestore.collection('deskTraining').doc(req.trainingYear);
 const manage=req=>{if(!canManageTraining(req.identity))fail('교육 관리 권한이 필요합니다.',403);};
 const allowed=(req,record)=>{if(!canManageTraining(req.identity)&&record.workerUid!==req.identity.uid)fail('본인의 제출 내역만 확인할 수 있습니다.',403);};
 const worker=async (uid,allowInactive=false)=>{const snap=await firestore.collection('users').doc(id(uid)).get();const u=snap.data();if(!snap.exists||!['ADMIN','STAFF','DESK','INSTRUCTOR'].includes(u.role)||(!allowInactive&&u.status!=='ACTIVE'))fail('활성 근무자 계정을 선택해 주세요.');const profile=(await firestore.collection('userProfiles').doc(uid).get()).data()||{};return trainingPerson(uid,u,profile);};
 const course=async(req,courseId)=>{const custom=await root(req).collection('courses').doc(id(courseId)).get();return custom.exists?{id:custom.id,...custom.data()}:TRAINING_COURSES.find(c=>c.id===courseId)||fail('교육 과정을 찾지 못했습니다.');};
 const save=async(ref,body,req)=>firestore.runTransaction(async tx=>{const old=await tx.get(ref),v=old.exists?old.data():{};if(Number(body.version||0)!==Number(v.version||0))fail('다른 사용자가 수정했습니다. 새로고침 후 다시 저장해 주세요.',409);const next={...body,version:Number(v.version||0)+1,updatedAt:new Date().toISOString(),updatedBy:req.identity.uid};tx.set(ref,next);return {...next,id:ref.id};});
 router.get('/:year',async(req,res,next)=>{try{
  const admin=canManageTraining(req.identity),r=root(req);
  const [cs,rs,ss,us,ps,icons]=await Promise.all([r.collection('courses').get(),(admin?r.collection('records'):r.collection('records').where('workerUid','==',req.identity.uid)).get(),admin?r.collection('sessions').get():Promise.resolve({docs:[]}),admin?firestore.collection('users').get():Promise.resolve({docs:[]}),admin?firestore.collection('userProfiles').get():firestore.collection('userProfiles').doc(req.identity.uid).get(),firestore.collection('sharedIconAssets').get()]);
  const courses=new Map(TRAINING_COURSES.map(c=>[c.id,c]));cs.docs.forEach(d=>courses.set(d.id,{...d.data(),id:d.id}));
  const profiles=new Map(admin?ps.docs.map(d=>[d.id,d.data()]):[[req.identity.uid,ps.data()||{}]]);
  const archivedWorkers=new Map();rs.docs.forEach(d=>{const r=d.data();archivedWorkers.set(r.workerUid,{uid:r.workerUid,name:r.workerName,role:r.workerRole||'',group:r.workerRole==='INSTRUCTOR'?'instructors':'staff',position:r.workerPosition||'',subjects:r.workerSubjects||[]});});ss.docs.forEach(d=>(d.data().participants||[]).forEach(w=>archivedWorkers.set(w.uid,w)));us.docs.filter(d=>['ADMIN','STAFF','DESK','INSTRUCTOR'].includes(d.data().role)&&(d.data().status==='ACTIVE'||archivedWorkers.has(d.id))).forEach(d=>archivedWorkers.set(d.id,trainingPerson(d.id,d.data(),profiles.get(d.id))));
  res.json({icons:icons.docs.map(d=>d.data()).filter(a=>String(a.status||'ACTIVE').toUpperCase()==='ACTIVE'&&String(a.lookupKey||'').startsWith('staff-position:')).map(a=>({lookupKey:a.lookupKey,imageUrl:a.imageUrl||a.downloadURL||''})),user:req.identity,manager:admin,courses:[...courses.values()],records:rs.docs.map(d=>({...d.data(),id:d.id})),sessions:ss.docs.map(d=>({...d.data(),id:d.id})),workers:admin?[...archivedWorkers.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko')): [trainingPerson(req.identity.uid,req.identity,profiles.get(req.identity.uid))]});
 }catch(e){next(e);}});
 router.post('/:year/courses',async(req,res,next)=>{try{manage(req);const b=req.body,cid=b.id?id(b.id):randomUUID();if(!str(b.name,150))fail('교육명을 입력해 주세요.');res.json(await save(root(req).collection('courses').doc(cid),{name:str(b.name,150),mode:b.mode==='internal'?'internal':'online',description:str(b.description),dueDate:date(b.dueDate),version:b.version||0},req));}catch(e){next(e);}});
 router.post('/:year/records',async(req,res,next)=>{try{
  const b=req.body,uid=canManageTraining(req.identity)?id(b.workerUid):req.identity.uid,c=await course(req,b.courseId),w=await worker(uid,canManageTraining(req.identity)),ref=root(req).collection('records').doc(uid+'__'+c.id);
  const old=(await ref.get()).data()||{};const manager=canManageTraining(req.identity);
  const applicability=manager?(b.applicability||old.applicability||'pending'):(old.applicability||'pending');
  if(!['pending','required','exempt'].includes(applicability))fail('대상 여부를 확인해 주세요.');
  const status=manager?(b.status||old.status||'missing'):((old.files||[]).length?'submitted':'missing');
  if(!['missing','submitted','revision','approved'].includes(status))fail('검수 상태를 확인해 주세요.');
  const sessionId=manager?str(b.sessionId,128):old.sessionId||'';
  if(sessionId){const session=(await root(req).collection('sessions').doc(id(sessionId)).get()).data();if(!session||session.courseId!==c.id||!(session.participants||[]).some(p=>p.uid===uid)||!(session.files||[]).length)fail('해당 교육의 참여자이며 증빙 파일이 있는 자체교육을 선택해 주세요.');}
  if(status==='approved'&&!(old.files||[]).length&&!sessionId)fail('수료증 또는 자체교육 증빙을 먼저 등록해 주세요.');
  res.json(await save(ref,{...old,workerUid:uid,workerName:w.name,workerRole:w.role,workerPosition:w.position,workerSubjects:w.subjects,courseId:c.id,sessionId,applicability,status,reviewedBy:manager?req.identity.uid:old.reviewedBy||'',completedDate:date(b.completedDate),note:str(b.note),reviewNote:manager?str(b.reviewNote):old.reviewNote||'',version:b.version||0},req));
 }catch(e){next(e);}});
 router.post('/:year/sessions',async(req,res,next)=>{try{
  manage(req);const b=req.body,c=await course(req,b.courseId),sid=b.id?id(b.id):randomUUID(),ref=root(req).collection('sessions').doc(sid),old=(await ref.get()).data()||{};
  const participants=Array.isArray(b.participants)?[...new Set(b.participants.map(id))]:[];
  if(!b.date||!str(b.content)||!participants.length)fail('교육일, 교육 내용, 참여자를 입력해 주세요.');
  if(participants.length>200)fail('참여자는 200명 이하로 선택해 주세요.');
  const people=await Promise.all(participants.map(uid=>worker(uid,true)));
  res.json(await save(ref,{...old,courseId:c.id,date:date(b.date),content:str(b.content,10000),instructor:str(b.instructor,150),location:str(b.location,200),duration:str(b.duration,100),participants:people,note:str(b.note),version:b.version||0},req));
 }catch(e){next(e);}});
 router.post('/:year/:kind/:recordId/files',async(req,res,next)=>{try{
  const kind=req.params.kind;if(!['records','sessions'].includes(kind))fail('잘못된 제출 경로입니다.');if(kind==='sessions')manage(req);
  const ref=root(req).collection(kind).doc(id(req.params.recordId)),snapshot=await ref.get();if(!snapshot.exists)fail('기록을 먼저 저장해 주세요.',404);const record=snapshot.data();if(kind==='records')allowed(req,record);
  const file=validateEvidence(req.body),fileId=randomUUID(),path=`training/${req.trainingYear}/${kind}/${ref.id}/${fileId}`;
  await bucket.file(path).save(file.data,{resumable:false,metadata:{contentType:file.type,cacheControl:'private, no-store'}});
  const metadata={id:fileId,name:file.name,type:file.type,size:file.data.length,uploadedAt:new Date().toISOString(),uploadedBy:req.identity.uid};
  try{await firestore.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if((current.files||[]).length>=30)fail('기록별 파일은 최대 30개까지 등록할 수 있습니다.');tx.update(ref,{files:[...(current.files||[]),metadata],...(kind==='records'?{status:'submitted'}:{}),version:Number(current.version||0)+1,updatedAt:metadata.uploadedAt,updatedBy:req.identity.uid});});}catch(e){await bucket.file(path).delete().catch(()=>{});throw e;}
  res.json(metadata);
 }catch(e){next(e);}});
 router.get('/:year/:kind/:recordId/files/:fileId',async(req,res,next)=>{try{
  const {kind,recordId,fileId}=req.params;if(!['records','sessions'].includes(kind))fail('잘못된 경로입니다.');if(kind==='sessions')manage(req);
  const doc=await root(req).collection(kind).doc(id(recordId)).get();if(!doc.exists)fail('기록이 없습니다.',404);const record=doc.data();if(kind==='records')allowed(req,record);
  const meta=(record.files||[]).find(f=>f.id===id(fileId));if(!meta)fail('파일을 찾지 못했습니다.',404);
  const [data]=await bucket.file(`training/${req.trainingYear}/${kind}/${recordId}/${fileId}`).download();
  res.set('Content-Type',meta.type);res.set('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`);res.send(data);
 }catch(e){next(e);}});
 return router;
}
