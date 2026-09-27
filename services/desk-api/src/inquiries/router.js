import { Router, json } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createRequireStaff } from '../auth.js';
import { ApiError } from '../http.js';
import { createNotionClient } from './notion-client.js';
import { createInquiryService } from './service.js';
const equal = (a,b) => timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export function createInquiryRouter({ verifyIdToken, loadAccount, firestore, token, sourceId, historySourceId, syncKey, notion, service }) {
 const router=Router();
 const manager=service || createInquiryService({firestore,sourceId,historySourceId,notion:notion || createNotionClient({token})});
 router.use(json({limit:'128kb'}));
 router.post('/sync-job',async(req,res,next)=>{try{if(!syncKey || !equal(req.get('x-inquiry-sync-key') || '',syncKey))throw new ApiError(401,'invalid_sync_key','인증이 필요합니다.');await manager.sync(true);res.json({ok:true});}catch(e){next(e);}});
 router.use(createRequireStaff({verifyIdToken,loadAccount}));
 router.use((req,res,next)=>{if(!['ADMIN','STAFF','DESK'].includes(req.identity.role))return next(new ApiError(403,'staff_only','신규문의는 실무자만 관리할 수 있습니다.'));next();});
 router.get('/',async(req,res,next)=>{try{res.json(await manager.list());}catch(e){next(e);}});
 router.post('/sync',async(req,res,next)=>{try{res.json(await manager.list(true));}catch(e){next(e);}});
 router.get('/:id',async(req,res,next)=>{try{res.json(await manager.detail(req.params.id));}catch(e){next(e);}});
 router.post('/:id',async(req,res,next)=>{try{res.json(await manager.change(req.params.id,req.body,req.identity));}catch(e){next(e);}});
 return router;
}
