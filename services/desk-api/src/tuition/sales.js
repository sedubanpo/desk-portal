import { monthName } from './normalizers.js';

export function paymentKind(row) {
  const method = (row.paymentType || '').replace(/\s/g, '');
  const company = (row.cardCompany || '').replace(/\s/g, '');
  if (/현금|현영|무통장|계좌|이체|송금|입금|서울페이|서초페이|제로페이/.test(method + company)) return 'cash';
  if (/카드|card|결[제재]링크/i.test(method) || (company && !/^(-|없음|기타|미입력)$/.test(company))) return 'card';
  return 'unknown';
}

// Legacy entries store M/D. Use nearby dated context only to resolve the year.
export function settlementDate(row) {
  const value = String(row.paidAt || '').trim();
  const full = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:$|[ T])/.exec(value);
  const short = /^(\d{1,2})[-./](\d{1,2})(?:$|\s)/.exec(value);
  if (!full && !short) return '';
  const month = Number(full ? full[2] : short[1]), day = Number(full ? full[3] : short[2]);
  let year = full && Number(full[1]);
  if (!full) {
    const base = /^(\d{4})-(\d{2})-/.exec(row.inputAt || '') ||
      /^(\d{4})-(\d{2})/.exec('20' + monthName(row.sourceDueMonth || row.sourceMonth));
    if (!base) return '';
    year = Number(base[1]) + (Number(base[2]) - month > 6 ? 1 : month - Number(base[2]) > 6 ? -1 : 0);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? date.toISOString().slice(0,10) : '';
}

function gradeLabel(row) {
  const school = String(row.school || '').replace(/\s|\([^)]*\)/g, '');
  const grade = String(row.grade || '').replace(/\s/g, '');
  const prefix = /초(?:등학교)?$/.test(school) ? '초' : /중(?:학교)?$/.test(school) ? '중' : /고(?:등학교)?$/.test(school) ? '고' : '';
  const match = /^(초|중|고)?([1-6])(?:학년)?$/.exec(grade);
  const level = prefix || match?.[1];
  if (!match || !level || (match[1] && prefix && match[1] !== prefix) || (level !== '초' && Number(match[2]) > 3)) return '기타';
  return level + match[2];
}

function bucket() { return { receipts:0, refunds:0, net:0, count:0 }; }
function add(target, amount) {
  target.receipts += Math.max(0, amount);
  target.refunds += Math.max(0, -amount);
  target.net += amount;
  target.count++;
}

export function salesBreakdown(rows, roster) {
  const grades = new Map(roster.map(row => [row.sourceMonth + '|' + row.studentName, gradeLabel(row)]));
  const months = {};
  let undated = 0;
  for (const row of rows) {
    if (!row.amount || row.countsAsPayment === false || row.entryKind === 'adjustment') continue;
    const date = settlementDate(row);
    if (!date) { undated++; continue; }
    const label = date.slice(2,7), method = paymentKind(row);
    const report = months[label] ||= {total:bucket(), methods:{}, grades:{}, days:{}};
    const grade = grades.get(label + 's|' + row.studentName) || grades.get(monthName(row.sourceDueMonth || row.sourceMonth) + '|' + row.studentName) || '기타';
    const day = report.days[date] ||= {card:0,cash:0,unknown:0,net:0};
    const amount = -row.amount;
    add(report.total, amount);
    add(report.methods[method] ||= bucket(), amount);
    add(report.grades[grade] ||= bucket(), amount);
    day[method] += amount;
    day.net += amount;
  }
  return {months, undated};
}
