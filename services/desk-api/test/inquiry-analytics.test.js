import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../../../docs/inquiry-analytics.js');
const row = (id, patch = {}) => ({ id, firstContact:'2026-09-20T10:00:00+09:00', createdAt:'2026-09-01T00:00:00Z', stage:'신규', followup:'재연락 필요', subjects:['수학'], ...patch });
const span = A.range('custom','2026-09-01','2026-09-30');
test('Seoul midnight puts a UTC evening inquiry into the next date', () => {
 assert.equal(A.dateKey('2026-08-31T15:00:00Z'),'2026-09-01');
 assert.equal(A.inRange(row('a',{firstContact:'2026-08-31T14:59:00Z'}),span.from,span.to),false);
});
test('previous range has equal inclusive duration across year and leap month boundaries', () => {
 assert.deepEqual(A.range('7','','','2026-01-03'),{from:'2025-12-28',to:'2026-01-03',days:7,previousFrom:'2025-12-21',previousTo:'2025-12-27'});
 assert.equal(A.range('lastmonth','','','2024-03-15').days,29);
});
test('registration rate is current status within arrival cohort, excludes trash and inaccessible records', () => {
 const m=A.summarize([row('a',{stage:'등록 완료'}),row('b'),row('c',{stage:'등록 완료',firstContact:'2026-08-01'}),row('d',{trashed:true}),row('e',{unavailable:true})],span,'2026-09-28');
 assert.equal(m.cohort.length,2);assert.equal(m.registered,1);assert.equal(m.registrationRate,50);
});
test('empty recomputed contact summary overrides stale legacy lastContact after cancellation', () => {
 assert.equal(A.contacted(row('a',{lastContact:'2026-09-20',historyLastContact:'',contactCounts:{전화:0}})),false);
 assert.equal(A.contacted(row('b',{lastContact:'2026-09-20'})),true);
 assert.equal(A.contacted(row('c',{contactCounts:{문자:1}})),true);
});
test('missing arrival uses creation time and fully missing dates are reported, never silently counted', () => {
 const m=A.summarize([row('a',{firstContact:'invalid',createdAt:'2026-09-03'}),row('b',{firstContact:'',createdAt:''})],span);
 assert.equal(m.cohort.length,1);assert.equal(m.missingDates,1);
});
test('follow-up queue remains across all periods and respects opt-out and completed stages', () => {
 const m=A.summarize([row('old',{firstContact:'2025-01-01',nextDate:'2026-09-25'}),row('today',{nextDate:'2026-09-28'}),row('unscheduled'),row('later',{nextDate:'2026-10-01'}),row('optout',{followup:'연락금지'}),row('registered',{stage:'등록 완료'}),row('hold',{stage:'연락 보류'})],span,'2026-09-28');
 assert.deepEqual(m.queue.map(r=>r.id),['old','today','unscheduled','later']);assert.equal(m.overdue,1);
});
test('long ranges use bounded buckets without losing current or comparison inquiry counts', () => {
 const s=A.range('custom','2026-01-01','2026-12-31');const m=A.summarize([row('a',{firstContact:'2026-01-01'}),row('b',{firstContact:'2026-12-31'}),row('c',{firstContact:s.previousFrom})],s);
 assert.ok(m.buckets.length<=30);assert.equal(m.buckets.reduce((n,b)=>n+b.count,0),2);assert.equal(m.buckets.reduce((n,b)=>n+b.previous,0),1);
});
test('multi-select breakdown counts each subject once and keeps registration subsets', () => {
 const groups=A.breakdown([row('a',{stage:'등록 완료',subjects:['수학','영어','수학']}),row('b',{subjects:[]})],'subjects');
 assert.equal(groups.find(g=>g.name==='수학').count,1);assert.equal(groups.find(g=>g.name==='영어').registered,1);assert.equal(groups.find(g=>g.name==='미입력').count,1);
});
test('empty cohorts have undefined rates, unknown stages remain visible', () => {
 assert.equal(A.summarize([],span).registrationRate,null);
 assert.equal(A.summarize([],span).change,null);
 const m=A.summarize([row('a',{stage:'외부 상태'})],span);assert.equal(m.statuses.find(s=>s.key==='unknown').count,1);
});
test('CSV contains definitions and grouped data but no identity or phone fields; formula cells are escaped', () => {
 const m=A.summarize([row('a',{name:'DO_NOT_EXPORT_PERSON',phone:'DO_NOT_EXPORT_PHONE',school:'=HYPERLINK("example")'})],span);
 const csv=A.report(m,span);assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/기간 내 등록 건수 아님/);assert.ok(csv.includes("'=HYPERLINK"));assert.ok(!csv.includes('DO_NOT_EXPORT'));
});
test('multi-series curve represents current contact and registration by arrival, not event dates', () => {
 const s=A.range('custom','2026-09-01','2026-09-03');
 const m=A.summarize([row('a',{firstContact:'2026-09-01',lastContact:'2026-09-28'}),row('b',{firstContact:'2026-09-03',stage:'등록 완료'}),row('c',{firstContact:'2026-09-03'})],s);
 assert.deepEqual(m.buckets.map(b=>b.contacted),[1,0,0]);
 assert.deepEqual(m.buckets.map(b=>b.registered),[0,0,1]);
 const original=structuredClone(m.buckets),series=A.series(m.buckets,true);
 assert.deepEqual(series.map(b=>b.count),[1,1,3]);assert.deepEqual(series.map(b=>b.registered),[0,0,1]);assert.deepEqual(m.buckets,original);
 assert.equal(A.series(m.buckets,false)[2].count,2);
});
test('channel counts use selected-cohort valid summaries and omit other dates and unknown methods', () => {
 const m=A.summarize([row('a',{contactCounts:{전화:2,카톡:1,문자:0,unknown:4}}),row('b',{firstContact:'2026-08-01',contactCounts:{전화:9}}),row('c',{trashed:true,contactCounts:{문자:8}})],span);
 assert.deepEqual(m.channels,[{method:'전화',count:2},{method:'카톡',count:1},{method:'문자',count:0}]);
 assert.match(A.report(m,span),/기간 내 연락 횟수 아님/);
});

test('hidden followups remain in inquiry, school and acquisition statistics but leave the active queue',()=>{
 const rows=[row('a',{school:'가학교',acquisitionSource:' 지인 소개 ',queueHidden:true}),row('b',{school:'나학교',acquisitionSource:'검색'}),row('c',{school:'가학교',acquisitionSource:'지인 소개'})];
 const m=A.summarize(rows,span);assert.equal(m.cohort.length,3);assert.equal(m.queue.length,2);assert.equal(m.hiddenQueue.length,1);
 assert.deepEqual(A.breakdown(m.cohort,'school').map(x=>[x.name,x.count]),[['가학교',2],['나학교',1]]);
 assert.deepEqual(A.breakdown(m.cohort,'acquisitionSource').map(x=>[x.name,x.count]),[['지인 소개',2],['검색',1]]);
 assert.equal(A.summarize(rows.map(r=>({...r,queueHidden:false})),span).queue.length,3);
 assert.equal(A.breakdown([row('d',{acquisitionSource:'  '})],'acquisitionSource')[0].name,'미입력');
});
