(function (root) {
  'use strict';
  const DAY = 86400000;
  const dateKey = value => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date) : '';
  };
  const shift = (key, days) => new Date(Date.parse(key + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
  const distance = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
  const firstDate = row => dateKey(row.firstContact) || dateKey(row.createdAt);
  const lastContact = row => row.historyLastContact !== undefined ? row.historyLastContact : row.lastContact;
  const contacted = row => Boolean(lastContact(row)) || Object.values(row.contactCounts || {}).some(n => n > 0);
  const isTemplate = row => String(row.name || '').replace(/\s+/g, '') === '신규문의템플릿';
  const needs = row => !isTemplate(row) && !row.trashed && !row.unavailable && row.followup === '재연락 필요' && !['등록 완료', '종료', '타원 등록', '연락 보류'].includes(row.stage);
  const category = (row, today = dateKey(new Date())) => !needs(row) ? 'closed' : !row.nextDate ? 'unscheduled' : row.nextDate < today ? 'overdue' : row.nextDate === today ? 'today' : 'planned';
  const stageGroups = [
    { key: 'new', label: '신규', stages: ['신규'], color: '#8a62df' },
    { key: 'consulting', label: '상담 진행', stages: ['상담 중', '연락두절', '재연락 대상'], color: '#348be5' },
    { key: 'appointment', label: '상담 예약', stages: ['상담 예약'], color: '#eba83a' },
    { key: 'registered', label: '등록 완료', stages: ['등록 완료'], color: '#23a778' },
    { key: 'hold', label: '연락 보류', stages: ['연락 보류'], color: '#df8653' },
    { key: 'closed', label: '타원 · 종료', stages: ['타원 등록', '종료'], color: '#a8afc0' },
    { key: 'unknown', label: '상태 미분류', stages: [], color: '#727c78' }
  ];
  const stageKey = row => stageGroups.find(group => group.stages.includes(row.stage))?.key || 'unknown';
  function range(period, start, end, today = dateKey(new Date())) {
    let from = start, to = end;
    if (period === '7' || period === '30') { to = today; from = shift(to, 1 - Number(period)); }
    if (period === 'month') { from = today.slice(0, 7) + '-01'; to = today; }
    if (period === 'lastmonth') { to = shift(today.slice(0, 7) + '-01', -1); from = to.slice(0, 7) + '-01'; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '') || from > to) return range('30', '', '', today);
    const days = distance(from, to) + 1;
    return { from, to, days, previousFrom: shift(from, -days), previousTo: shift(from, -1) };
  }
  const inRange = (row, from, to) => { const key = firstDate(row); return Boolean(key) && key >= from && key <= to; };
  function summarize(rows, span, today = dateKey(new Date())) {
    const active = rows.filter(row => !isTemplate(row) && !row.trashed && !row.unavailable);
    const cohort = active.filter(row => inRange(row, span.from, span.to));
    const previous = active.filter(row => inRange(row, span.previousFrom, span.previousTo));
    const registered = cohort.filter(row => row.stage === '등록 완료').length;
    const contactCount = cohort.filter(contacted).length;
    const consulting = cohort.filter(row => ['consulting', 'appointment'].includes(stageKey(row))).length;
    const statuses = stageGroups.map(group => ({ ...group, count: cohort.filter(row => stageKey(row) === group.key).length }));
    const step = Math.max(1, Math.ceil(span.days / 30));
    const buckets = Array.from({ length: Math.ceil(span.days / step) }, (_, i) => ({
      from: shift(span.from, i * step), to: shift(span.from, Math.min(span.days - 1, (i + 1) * step - 1)), count: 0, contacted: 0, registered: 0, previous: 0
    }));
    for (const row of cohort) { const bucket=buckets[Math.floor(distance(span.from, firstDate(row)) / step)]; bucket.count++; if(contacted(row))bucket.contacted++; if(row.stage==='등록 완료')bucket.registered++; }
    for (const row of previous) buckets[Math.floor(distance(span.previousFrom, firstDate(row)) / step)].previous++;
    const queue = active.filter(needs).sort((a, b) => {
      const rank = { overdue: 0, today: 1, unscheduled: 2, planned: 3 };
      return rank[category(a, today)] - rank[category(b, today)] || (a.nextDate || '9999').localeCompare(b.nextDate || '9999') || (firstDate(a) || '9999').localeCompare(firstDate(b) || '9999') || String(a.id).localeCompare(String(b.id));
    });
    const channels=['전화','카톡','문자'].map(method=>({method,count:cohort.reduce((sum,row)=>sum+Math.max(0,Number(row.contactCounts?.[method])||0),0)}));
    return { active, cohort, previous, registered, contactCount, consulting, statuses, buckets, step, queue, channels,
      missingDates: active.filter(row => !firstDate(row)).length,
      missingOwners: queue.filter(row => !row.owner).length,
      overdue: queue.filter(row => category(row, today) === 'overdue').length,
      unscheduled: queue.filter(row => category(row, today) === 'unscheduled').length,
      registrationRate: cohort.length ? registered / cohort.length * 100 : null,
      change: previous.length ? (cohort.length - previous.length) / previous.length * 100 : null
    };
  }
  function series(buckets, cumulative=false) {
    const totals={count:0,contacted:0,registered:0,previous:0};
    return buckets.map(bucket=>Object.assign({},bucket,Object.fromEntries(Object.keys(totals).map(key=>{totals[key]+=bucket[key]||0;return [key,cumulative?totals[key]:bucket[key]||0];}))));
  }
  function breakdown(rows, key) {
    const groups = new Map();
    rows.forEach(row => {
      const values = key === 'subjects' ? [...new Set(row.subjects?.length ? row.subjects : ['미입력'])] : [row[key] || '미입력'];
      values.forEach(value => {
        const name = String(value), group = groups.get(name) || { name, count: 0, registered: 0 };
        group.count++; if (row.stage === '등록 완료') group.registered++; groups.set(name, group);
      });
    });
    return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
  }
  const csvCell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  function report(model, span) {
    const entries = [
      ['신규문의 분석', '시작일', span.from, '종료일', span.to],
      ['집계 기준', 'Notion 입력 시간(없으면 생성 시각), 한국 시간; 휴지통 제외'],
      ['등록 기준', '선택 기간 유입 문의 중 현재 등록 완료 상태; 기간 내 등록 건수 아님'],
      ['지표', '값'], ['신규문의', model.cohort.length], ['직전 동일 길이 기간 문의', model.previous.length],
      ['연락 기록 보유', model.contactCount], ['상담 진행 및 예약', model.consulting], ['등록 완료', model.registered],
      ['등록 완료 비율(%)', model.registrationRate === null ? '' : model.registrationRate.toFixed(1)],
      ['전체 재연락 대상', model.queue.length], ['전체 기한 지남', model.overdue], ['전체 일정 미지정', model.unscheduled],
      ['입력일 미확인(기간 집계 제외)', model.missingDates], [],
      ['유입 추이 시작일', '종료일', '문의 수', '현재 연락 기록 보유', '현재 등록 완료', '직전 기간 대응 구간 문의 수'],
      ...model.buckets.map(b => [b.from, b.to, b.count, b.contacted, b.registered, b.previous]), [],
      ['현재 진행상태', '문의 수'], ...model.statuses.map(s => [s.label, s.count]), [],
      ['연락 채널', '선택 문의에 누적된 유효 연락 횟수(기간 내 연락 횟수 아님)'], ...model.channels.map(g=>[g.method,g.count])
    ];
    [['subjects', '희망 과목(복수 선택)'], ['school', '학교'], ['grade', '학년']].forEach(([key, title]) => entries.push([], [title, '문의 수', '현재 등록 완료 수'], ...breakdown(model.cohort, key).map(g => [g.name, g.count, g.registered])));
    return '\uFEFF' + entries.map(row => row.map(csvCell).join(',')).join('\r\n');
  }
  const api = { isTemplate, dateKey, shift, distance, firstDate, lastContact, contacted, needs, category, stageGroups, stageKey, range, inRange, summarize, series, breakdown, report };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeskInquiryAnalytics = api;
})(globalThis);
