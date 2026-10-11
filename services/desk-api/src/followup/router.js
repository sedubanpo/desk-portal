import { Router, json } from 'express';
import { createRequireStaff } from '../auth.js';
import { ApiError } from '../http.js';
import { createNotionClient } from '../inquiries/notion-client.js';
import { createFollowupService } from './service.js';
export function createFollowupRouter({verifyIdToken,loadAccount,firestore,token,sourceId,notion,service}){
 const router=Router(), manager=service||createFollowupService({firestore,sourceId,notion:notion||createNotionClient({token})});
 router.use(createRequireStaff({verifyIdToken,loadAccount}));router.use((req,res,next)=>['ADMIN','STAFF','DESK'].includes(req.identity.role)?next():next(new ApiError(403,'staff_only','업무 팔로우는 실무자만 이용할 수 있습니다.')));
 router.use(json({limit:'6mb'}));
 const route=(method,path,fn)=>router[method](path,async(req,res,next)=>{try{res.set('Cache-Control','no-store').json(await fn(req));}catch(e){next(e);}});
 route('get','/meta',()=>manager.meta());route('get','/',r=>manager.list(r.query,r.identity));
 route('post','/save',r=>manager.save(r.body,r.identity));route('post','/imports',r=>manager.upload(r.body,r.identity));
 route('get','/imports/:batch',r=>manager.importPage(r.params.batch,r.query,r.identity));route('post','/imports/:batch/commit',r=>manager.commitImport(r.params.batch,r.body,r.identity));
 route('post','/imports/:batch/review',r=>manager.skipImport(r.params.batch,r.body,r.identity));
 route('get','/:id',r=>manager.detail(r.params.id));return router;
}
