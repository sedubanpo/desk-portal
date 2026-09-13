import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTuitionHandlers } from '../src/tuition/handlers.js';
import { paymentId, snapshotId } from '../src/tuition/normalizers.js';
import { paymentLinkDuplicate } from '../src/tuition/payment-link.js';

const month = '26-09s';
const input = { monthName: month, studentName:'테스트학생', paidAt:'2026-09-12', amount:-300000, approvalNo:'00123456', status:'결제', fileName:'fixture.xlsx' };
function fixture(extra = {}) {
  const docs = new Map(Object.entries({
    [`tuitionMonthSnapshots/${snapshotId(month)}`]: { success:true, selectedMonth:month, rows:[{studentName:input.studentName, guideAmount:900000, collectedAmount:0}], payments:[], allPayments:[] },
    ...extra
  }));
  const list = collection => [...docs].filter(([k]) => k.startsWith(collection + '/')).map(([id,v]) => ({id,...structuredClone(v)}));
  let queue = Promise.resolve();
  const store = { get:async key => docs.get(key), list:async c => list(c), listWhere:async(c,f,o,v) => list(c).filter(r => r[f] === v),
    transaction(keys,fn,queries=[]) {
      const task = queue.then(async() => {
        const current = Object.fromEntries(keys.filter(Boolean).map(k => [k,structuredClone(docs.get(k) || null)]));
        queries.forEach(q => current[q.key] = list(q.collection).filter(r => r[q.field] === q.value));
        const change = await fn(current);
        Object.entries(change.writes || {}).forEach(([k,v]) => docs.set(k,structuredClone(v)));
        (change.deletes || []).forEach(k => docs.delete(k));
        return change.result;
      }); queue = task.catch(() => {}); return task;
    }
  };
  return { docs, handlers:createTuitionHandlers({store,now:() => new Date('2026-09-13T12:00:00Z')}) };
}
test('preview has no writes; concurrent replay creates exactly one receipt and trusted actor history',async() => {
  const {docs,handlers:h} = fixture();
  const size = docs.size;
  assert.equal((await h.previewTuitionPaymentLink(input)).duplicate,false);
  assert.equal(docs.size,size);
  const result = await Promise.all([h.importTuitionPaymentLink({...input,actorName:'forged'},{uid:'staff1',name:'직원'}), h.importTuitionPaymentLink(input,{uid:'staff2',name:'다른 직원'})]);
  assert.equal(result.filter(r => !r.duplicate).length,1);
  assert.equal([...docs.keys()].filter(k => k.startsWith('tuitionPayments/')).length,1);
  const history = await h.getTuitionPaymentLinkHistory({monthName:month});
  assert.equal(history.events.length,1); assert.equal(history.events[0].actorName,'직원');
});
test('manual entries in another due month and without approval are excluded; split approvals are preserved',async() => {
  for (const approval of ['00123456','']) {
    const manual = {...input,sourceDueMonth:'26-08s',requestId:'manual',approvalNo:approval,source:'desk_portal'};
    const {handlers:h} = fixture({[`tuitionPayments/${paymentId(manual)}`]:manual});
    assert.equal((await h.importTuitionPaymentLink(input)).duplicate,true);
  }
  const {handlers:h} = fixture();
  await h.importTuitionPaymentLink(input);
  assert.equal((await h.importTuitionPaymentLink({...input,approvalNo:'87654321'})).duplicate,false);
});
test('update/delete preserve provenance and tombstone prevents accidental resurrection',async() => {
  const {handlers:h,docs} = fixture();
  await h.importTuitionPaymentLink(input,{name:'입력직원'});
  const row = [...docs].find(([k]) => k.startsWith('tuitionPayments/'))[1];
  const edit = await h.updateTuitionPaymentEntry({monthName:month,payment:row,updatedPayment:{...row,amount:-250000},clientRequestId:'edit-1',reason:'금액 수정'},{name:'수정직원'});
  assert.equal(edit.success,true); assert.equal(edit.payment.importFile,'fixture.xlsx');
  assert.equal((await h.importTuitionPaymentLink(input)).duplicate,true);
  const deleted = await h.deleteTuitionPaymentEntry({monthName:month,payment:edit.payment,clientRequestId:'delete-1',reason:'중복 정리'},{name:'삭제직원'});
  assert.equal(deleted.success,true);
  assert.equal((await h.importTuitionPaymentLink(input)).duplicate,true);
  const history = await h.getTuitionPaymentLinkHistory({monthName:month});
  assert.deepEqual(new Set(history.events.map(e => e.action)),new Set(['created','updated','deleted']));
});
test('invalid dates, cancellation, unknown students and zero amounts cannot mutate',async() => {
  const {handlers:h,docs} = fixture(); const size=docs.size;
  for (const patch of [{status:'취소'},{cancelledAt:'2026-09-13'},{paidAt:'2026-02-30'},{amount:0},{studentName:'없는학생'},{approvalNo:''}]) {
    assert.equal((await h.importTuitionPaymentLink({...input,...patch})).success,false);
    assert.equal(docs.size,size);
  }
});
test('amount adjustments are never mistaken for receipts',() => {
  assert.equal(paymentLinkDuplicate(input,[{...input,entryKind:'adjustment'}]),undefined);
});
