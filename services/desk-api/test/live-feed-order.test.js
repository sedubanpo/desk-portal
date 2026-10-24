import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../../docs/index.html',import.meta.url),'utf8');
const start=source.indexOf('function collectDeskLiveFeedItems_('),end=source.indexOf('      var runWorker',start);
const code=source.slice(start,end)+'return combined; }';
const collect=new Function('getDeskDailyJournalMemos_','getDeskDailyJournalTasks_','getDeskMemoDisplayParts_','getDeskMemoType_','getDeskMemoMode_','normalizeDeskDailyMemoClientOrder_','getDeskLiveFeedCardStyle_','getDeskTaskMeta_','getDeskDateKey_', 'return '+code);
test('live feed sorts mixed UTC/Seoul timestamps by input time and ignores later notice edits',()=>{
 const memos=[{id:'later',createdAt:'2026-10-24T09:33:00+09:00'},{id:'early',createdAt:'2026-10-24T09:20:00+09:00'}];
 const tasks=[{id:'notice',createdAt:'2026-10-24T03:09:00.000Z',updatedAt:'2026-10-24T15:00:00Z'}];
 const fn=collect(()=>memos,()=>tasks,x=>x,()=>'',()=>'',n=>n||0,()=>'',()=>({}),d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(d));
 assert.deepEqual(fn(['2026-10-24']).map(x=>x.id),['memo_2026-10-24_early','memo_2026-10-24_later','task_2026-10-24_notice']);
});
