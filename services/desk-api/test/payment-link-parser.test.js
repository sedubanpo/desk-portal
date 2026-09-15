import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const scope = {}; vm.runInNewContext(readFileSync(new URL('../../../docs/payment-link-parser.js', import.meta.url),'utf8'),scope);
const parse = scope.PaymentLinkParser.parse;
const headers = ['결제상태','결제일시','이름','품목','승인번호','금액(원)','취소일시'];
test('payment workbook matches exact names with guardian text, keeps leading zero and prior month',() => {
  const rows = parse([headers,['결제','2026-09-12 20:00:00','홍테스트 학교1 모','8월 수강료','00123456','300,000','']], [{studentName:'홍테스트'},{studentName:'홍테스트b'}],'26-09s');
  assert.equal(rows[0].studentName,'홍테스트'); assert.equal(rows[0].monthName,'26-08s'); assert.equal(rows[0].approvalNo,'00123456'); assert.equal(rows[0].amount,-300000);
});
test('ambiguous names/months, cancellations and file duplicates stay visible for review',() => {
  const row = ['결제','2026-09-12','홍테스트b 학생','8월 9월 수강료','123456','300000',''];
  const rows = parse([headers,row,row,['취소','2026-09-12','홍테스트 학생','9월 수강료','999999','300000','2026-09-13']], [{studentName:'홍테스트'}],'26-09s');
  assert.equal(rows[0].studentName,''); assert.equal(rows[0].monthName,''); assert.equal(rows[1].issue,'파일 내 중복'); assert.equal(rows[2].amount,-300000); assert.equal(rows[3].amount,300000); assert.equal(rows[3].paidAt,'2026-09-13'); assert.equal(rows[3].status,'환불');
  assert.throws(() => parse([['잘못된 파일']],[],'26-09s'),/필수 열/);
});

test('item student takes precedence over recipient siblings, suffixes and fullwidth month are preserved', () => {
  const header=['결제상태','결제일시','이름','품목','승인번호','금액(원)'];
  const students=['백승재','백시은','박태민','박시언','강민재','최시영','최시영b','장민우','장민재'].map(studentName=>({studentName}));
  const rows=[['백승재 백시은 학부모님','백시은 ９월 수업 수강료'],['박태민 학생 학부모님','박시언 9월 수업 수강료'],['강민재학생','9월 첫등록'],['최시영b 학생 학부모','최시영 학생 9월 수강료'],['장민우 학생','장민우, 장민재 학생 8월 수강료']];
  const result=parse([header,...rows.map((r,i)=>['결제','2026-09-12 10:00:00',...r,'000'+i,100000])],students,'26-09s');
  assert.deepEqual(Array.from(result,r=>r.studentName),['백시은','박시언','강민재','최시영b','']);
  assert.equal(result[0].monthName,'26-09s');assert.match(result[4].issue,/합산/);assert.equal(result[0].approvalNo,'0000');
});
