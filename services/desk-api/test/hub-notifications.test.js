import test from 'node:test';import assert from 'node:assert/strict';
import {buildHubNotifications} from '../src/desk/hub-notifications.js';
test('admin inbox is still scoped to the selected identity; deleted/unrelated tasks omitted',()=>{
 const at='2026-10-02T00:00:00Z',who={uid:'u',name:'테스트',role:'ADMIN'};
 const result=buildHubNotifications(who,[{id:'one',worker:'테스트',title:'업무',updatedAt:at},{id:'two',worker:'다른사람',updatedAt:at},{id:'three',worker:'테스트',deleted:true,updatedAt:at}],{records:[{uid:'other',dateKey:'2026-10-02',clockIn:at},{uid:'u',dateKey:'2026-10-02',clockIn:at}],requests:[]},at);
 assert.equal(result.items.length,2);assert.ok(result.items.every(i=>i.recipientUid==='u'));assert.ok(!JSON.stringify(result).includes('two'));
});
