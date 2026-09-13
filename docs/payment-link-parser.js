(function(root) {
  'use strict';
  function parse(rows, students, selectedMonth) {
    var required = ['결제상태','결제일시','이름','품목','승인번호','금액(원)'];
    var start = rows.findIndex(function(row) { return required.every(function(h) { return row.includes(h); }); });
    if (start < 0) throw new Error('결제링크 엑셀의 필수 열을 찾을 수 없습니다. 결제내역 파일을 선택해 주세요.');
    var headers = rows[start], seen = new Set();
    return rows.slice(start + 1).filter(function(row) { return row.some(function(v) { return v !== '' && v != null; }); }).map(function(row, index) {
      function get(key) { return String(row[headers.indexOf(key)] == null ? '' : row[headers.indexOf(key)]).trim(); }
      var name = get('이름'), item = get('품목'), paidAt = get('결제일시').slice(0,10);
      var candidates = students.filter(function(student) {
        var n = String(student.studentName || student.name || '').trim();
        return n && (name === n || name.startsWith(n + ' ') || item.startsWith(n + ' 학생'));
      });
      var names = Array.from(new Set(candidates.map(function(s) { return s.studentName || s.name; })));
      var itemMonths = Array.from(item.matchAll(/(?:^|[^0-9])(1[0-2]|[1-9])월/g)).map(function(m) { return m[1].padStart(2,'0'); });
      var month = itemMonths.length === 1 ? selectedMonth.slice(0,3) + itemMonths[0] + 's' : '';
      var amount = Number(get('금액(원)').replace(/,/g,''));
      var status = get('결제상태'), cancelledAt = get('취소일시');
      var issue = status !== '결제' || cancelledAt ? '취소 건 · 원결제/환불 확인 필요' : !Number.isSafeInteger(amount) || amount <= 0 ? '금액 확인 필요' : !/^\d{4}-\d{2}-\d{2}$/.test(paidAt) ? '결제일 확인 필요' : '';
      var key = [get('승인번호'), paidAt, amount].join('|');
      if (seen.has(key)) issue = '파일 내 중복';
      seen.add(key);
      return { rowNumber: start + index + 2, rawName: name, itemName: item, studentName: names.length === 1 ? names[0] : '', monthName: month,
        paidAt: paidAt, approvalNo: get('승인번호'), amount: -amount, cardCompany: get('카드사명') || get('매입사명'), status: status, cancelledAt: cancelledAt, issue: issue };
    });
  }
  root.PaymentLinkParser = { parse: parse };
  if (typeof module !== 'undefined') module.exports = root.PaymentLinkParser;
})(typeof window === 'undefined' ? globalThis : window);
