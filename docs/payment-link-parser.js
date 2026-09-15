(function(root) {
  'use strict';
  function parse(rows, students, selectedMonth) {
    var required = ['결제상태','결제일시','이름','품목','승인번호','금액(원)'];
    var start = rows.findIndex(function(row) { return required.every(function(h) { return row.includes(h); }); });
    if (start < 0) throw new Error('결제링크 엑셀의 필수 열을 찾을 수 없습니다. 결제내역 파일을 선택해 주세요.');
    var headers = rows[start], seen = new Set();
    return rows.slice(start + 1).filter(function(row) { return row.some(function(v) { return v !== '' && v != null; }); }).flatMap(function(row, index) {
      function get(key) { return String(row[headers.indexOf(key)] == null ? '' : row[headers.indexOf(key)]).trim(); }
      var name = get('이름'), item = get('품목'), paidAt = get('결제일시').slice(0,10);
      function normalized(v) { return String(v || '').normalize('NFKC').trim(); }
      function mentions(text, n) {
        var at = -1;
        while ((at = text.indexOf(n, at + 1)) !== -1) {
          var before = text.slice(0, at), after = text.slice(at + n.length);
          if ((!before || !/[가-힣a-zA-Z]$/.test(before)) && (!after || /^(?:학생|[\s,/(·)\-])/.test(after))) return true;
        }
        return false;
      }
      var allNames = Array.from(new Set(students.map(function(s) { return s.studentName || s.name; }).filter(Boolean)));
      var sourceNames = allNames.filter(function(n) { return mentions(normalized(name), normalized(n)); });
      var itemNames = allNames.filter(function(n) { return mentions(normalized(item), normalized(n)); });
      // A bill's item is authoritative for siblings; a suffix in the recipient disambiguates names.
      var names = itemNames.length ? itemNames : sourceNames;
      if (itemNames.length === 1 && sourceNames.length === 1 && sourceNames[0].replace(/[a-z]$/i,'') === itemNames[0]) names = sourceNames;
      var combined = itemNames.length > 1;
      var normalizedItem = normalized(item);
      var itemMonths = Array.from(normalizedItem.matchAll(/(?:^|[^0-9])(1[0-2]|[1-9])월/g)).map(function(m) { return m[1].padStart(2,'0'); });
      var month = itemMonths.length === 1 ? selectedMonth.slice(0,3) + itemMonths[0] + 's' : '';
      var amount = Number(get('금액(원)').replace(/,/g,''));
      var status = get('결제상태'), cancelledAt = get('취소일시');
      var cancelled = ['취소','결제취소','전체취소'].includes(status) || (status === '결제' && !!cancelledAt);
      var issue = !['결제','취소','결제취소','전체취소'].includes(status) ? '결제상태 확인 필요' : combined ? '합산 결제 · 학생별 배분 필요' : !Number.isSafeInteger(amount) || amount <= 0 ? '금액 확인 필요' : !/^\d{4}-\d{2}-\d{2}$/.test(paidAt) ? '결제일 확인 필요' : '';
      var base = { rowNumber: start + index + 2, rawName: name, itemName: item, studentName: names.length === 1 ? names[0] : '', monthName: month,
        originalPaidAt: paidAt, paidAt: paidAt, approvalNo: get('승인번호'), amount: -amount, cardCompany: get('카드사명') || get('매입사명'), status: '결제', cancelledAt: '', issue: issue };
      var result = [base];
      if (cancelled) result.push(Object.assign({}, base, { paidAt: cancelledAt.slice(0,10), amount: amount, status: '환불', cancelledAt: cancelledAt,
        issue: issue || (!/^\d{4}-\d{2}-\d{2}$/.test(cancelledAt.slice(0,10)) ? '취소일 확인 필요' : '') }));
      return result.map(function(entry) {
        var key = [entry.approvalNo,entry.paidAt,entry.amount].join('|');
        if (seen.has(key)) entry.issue = '파일 내 중복';
        seen.add(key); return entry;
      });
    });
  }
  root.PaymentLinkParser = { parse: parse };
  if (typeof module !== 'undefined') module.exports = root.PaymentLinkParser;
})(typeof window === 'undefined' ? globalThis : window);
