import {
  contactChannel,
  base64Id,
  clientRequestId,
  comparePaymentsDesc,
  followup,
  followupId,
  formatDateKey,
  formatInputAt,
  formatPaidAt,
  memo,
  memoList,
  memoWarning,
  mergePayments,
  monthIndexId,
  monthName,
  number,
  paidDateKey,
  payment,
  paymentId,
  paymentKey,
  paymentMonths,
  resolveStatus,
  snapshotId,
  sortMonths,
  studentMemoId,
  studentName,
  summaryStats,
  text,
  unpaidStatus
} from './normalizers.js';

const COLLECTIONS = Object.freeze({
  followups: 'tuitionFollowups',
  contactLogs: 'tuitionContactLogs',
  payments: 'tuitionPayments',
  deletions: 'tuitionPaymentDeletions',
  monthIndex: 'tuitionMonthIndex',
  statusChanges: 'tuitionStatusChanges',
  guideChanges: 'tuitionGuideAmountChanges',
  studentMemos: 'tuitionStudentMemos',
  students: 'students',
  snapshots: 'tuitionMonthSnapshots',
  paymentIndexes: 'tuitionPaymentReadIndexes',
  monthlyIndexes: 'tuitionMonthlyReadIndexes'
});

const RECENT_LIMIT = 120;
const MONTH_LIMIT = 1500;
const DAILY_LIMIT = 500;

export const TUITION_READ_METHODS = new Set([
  'getTuitionBootstrapData', 'getTuitionMonthSummary', 'getTuitionStudentMonthlyHistory',
  'getTuitionStudentMemoNotes', 'getTuitionGuideDashboard', 'getTuitionMonthlySalesOverview',
  'getTuitionInactiveStudentCandidates'
]);

export const TUITION_WRITE_METHODS = new Set([
  'createTuitionMonth',
  'saveTuitionStatusOnly', 'saveTuitionFollowup', 'saveTuitionStudentMemo',
  'saveTuitionAmountAdjustment', 'appendTuitionPaymentEntry', 'deleteTuitionPaymentEntry'
]);

export const TUITION_METHODS = new Set([...TUITION_READ_METHODS, ...TUITION_WRITE_METHODS]);

export function createTuitionHandlers({ store, now = () => new Date(), timeZone = 'Asia/Seoul' }) {
  if (!store) throw new TypeError('tuition store is required.');
  const nowDate = () => {
    const value = now();
    return value instanceof Date ? value : new Date(value);
  };
  const nowIso = () => nowDate().toISOString();

  const handlers = {
    async getTuitionBootstrapData() {
      const months = await loadMonths(store);
      if (!months.length) return failure('Firestore 수강료 월 인덱스가 비어 있습니다. 수강료 Firebase 마이그레이션을 먼저 실행해 주세요.');
      const selectedMonth = months[0];
      const summary = await buildMonthSummary(store, { monthName: selectedMonth, months });
      return { success: true, months, selectedMonth, summary };
    },

    async getTuitionMonthSummary(payload = {}) {
      const months = await loadMonths(store);
      const selectedMonth = monthName(payload.monthName) || months[0];
      if (!selectedMonth) return failure('Firestore 수강료 월 인덱스가 비어 있습니다. 수강료 Firebase 마이그레이션을 먼저 실행해 주세요.');
      return buildMonthSummary(store, { ...payload, monthName: selectedMonth, months: months.length ? months : [selectedMonth] });
    },

    async createTuitionMonth(payload = {}, identity = {}) {
      const month = monthName(payload.monthName);
      const requestId = requiredRequestId(payload);
      if (!month) return failure('생성할 수강료 월 정보가 올바르지 않습니다.');
      if (!requestId) return failure('월 생성 요청 식별자가 없습니다. 다시 시도해 주세요.');

      const studentDocuments = await loadActiveStudentDocuments(store);
      const rowsByName = new Map();
      studentDocuments.filter(isActiveStudent).map(studentMasterTuitionRow).filter(Boolean).forEach(row => {
        if (!rowsByName.has(row.studentName)) rowsByName.set(row.studentName, row);
      });
      const rows = [...rowsByName.values()].sort((a, b) => a.studentName.localeCompare(b.studentName, 'ko'));
      const timestamp = nowIso();
      const today = formatDateKey(nowDate(), timeZone);
      const keys = {
        snapshot: key(COLLECTIONS.snapshots, snapshotId(month)),
        monthIndex: key(COLLECTIONS.monthIndex, monthIndexId(month)),
        recent: key(COLLECTIONS.paymentIndexes, 'recent'),
        payments: key(COLLECTIONS.paymentIndexes, monthPaymentIndexId(month)),
        followups: key(COLLECTIONS.monthlyIndexes, followupIndexId(month)),
        charges: key(COLLECTIONS.monthlyIndexes, `charges_${month}`)
      };
      const result = await store.transaction(Object.values(keys), documents => {
        if (documents[keys.snapshot]?.success && Array.isArray(documents[keys.snapshot].rows)) {
          return { result: { created: false } };
        }
        const stats = summaryStats(rows, []);
        const recentPayments = mergePayments(documents[keys.recent]?.payments || []);
        return {
          writes: {
            [keys.snapshot]: {
              success: true,
              selectedMonth: month,
              rows,
              payments: [],
              allPayments: recentPayments,
              todayPayments: recentPayments.filter(row => paidDateKey(row) === today),
              kpi: stats.kpi,
              chart: stats.chart,
              snapshot: {
                source: 'desk_portal_month_creation',
                computedAt: timestamp,
                schemaVersion: 'v4',
                requestId,
                actorUid: text(identity.uid),
                actorName: text(identity.name)
              }
            },
            [keys.monthIndex]: monthIndexDocument(month, timestamp, 'tuition_month_creation'),
            [keys.payments]: { monthName: month, payments: [], seeded: true, updatedAt: timestamp },
            [keys.followups]: { monthName: month, rows: [], seeded: true, updatedAt: timestamp },
            [keys.charges]: { monthName: month, rows: [], seeded: true, updatedAt: timestamp }
          },
          result: { created: true }
        };
      });
      const months = await loadMonths(store);
      const summary = await buildMonthSummary(store, { monthName: month, months });
      return { ...summary, created: result.created };
    },

    async getTuitionStudentMemoNotes(payload = {}) {
      const student = studentName(payload.studentName);
      if (!student) return failure('학생명이 없습니다.');
      const document = await store.get(key(COLLECTIONS.studentMemos, studentMemoId(student))) || {};
      const memos = memoList(document.memos, nowIso);
      return { success: true, studentName: student, memos, warning: memoWarning(memos) };
    },

    async getTuitionInactiveStudentCandidates(payload = {}) {
      const keyword = text(payload.keyword || payload.studentName).toLowerCase().replace(/\s+/g, '');
      if (!keyword) return { success: true, rows: [] };
      const seen = new Set();
      const rows = (await store.list('students', 1000)).filter(isInactiveStudent).map(studentMasterRow)
        .filter(Boolean)
        .filter(row => [row.name, row.school, row.grade, row.registrationStatus].join('').toLowerCase().replace(/\s+/g, '').includes(keyword))
        .filter(row => {
          const key = [row.name, row.school, row.grade, row.registrationStatus].join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .slice(0, 8);
      return { success: true, rows };
    },

    async getTuitionStudentMonthlyHistory(payload = {}) {
      const student = studentName(payload.studentName);
      if (!student) return failure('학생명이 없습니다.');
      const snapshots = await loadSnapshots(store);
      const rows = snapshots.map(snapshot => {
        const row = (snapshot.rows || []).find(item => studentName(item.studentName) === student) || {};
        const payments = (snapshot.payments || []).map(payment).filter(item => item && item.studentName === student);
        const guideAmount = Math.max(0, Math.round(number(row.guideAmount)));
        const collectedAmount = payments.length
          ? Math.round(payments.reduce((sum, item) => sum - number(item.amount), 0))
          : Math.round(number(row.collectedAmount));
        const outstandingAmount = Math.max(0, guideAmount - Math.max(0, collectedAmount));
        const status = resolveStatus(row.unpaidStatus, guideAmount, collectedAmount);
        return {
          monthName: snapshot.selectedMonth,
          guideAmount,
          collectedAmount,
          outstandingAmount,
          contactCount: Math.max(0, Math.trunc(number(row.contactCount))),
          lastContactAt: text(row.lastContactAt),
          lastContactMemo: text(row.lastContactMemo),
          contactChannel: contactChannel(row.contactChannel),
          lastUpdatedAt: text(row.lastUpdatedAt),
          paid: status === '납부완료' || status === '이월금',
          unpaidStatus: status,
          paidDates: [...new Set(payments.map(item => item.paidAt).filter(Boolean))].sort(),
          paymentRoutes: [...new Set(payments.map(item => routeLabel(item)).filter(Boolean))]
        };
      });
      const overview = rows.reduce((stats, row) => {
        stats.totalContacts += row.contactCount;
        if (row.contactCount > 0) stats.guidedMonths += 1;
        if (row.paid) stats.paidMonths += 1; else stats.unpaidMonths += 1;
        stats.totalGuideAmount += row.guideAmount;
        stats.totalCollectedAmount += Math.max(0, row.collectedAmount);
        stats.totalOutstandingAmount += row.outstandingAmount;
        stats.maxContacts = Math.max(stats.maxContacts, row.contactCount);
        return stats;
      }, { totalMonths: rows.length, guidedMonths: 0, totalContacts: 0, paidMonths: 0, unpaidMonths: 0, totalGuideAmount: 0, totalCollectedAmount: 0, totalOutstandingAmount: 0, maxContacts: 0 });
      return { success: true, studentName: student, overview, rows, reportIndex: reportSource(snapshots) };
    },

    async getTuitionGuideDashboard() {
      const snapshots = await loadSnapshots(store);
      const studentMap = new Map();
      const overview = { totalMonths: snapshots.length, activeMonths: 0, totalContacts: 0, contactedStudents: 0, maxContacts: 0, maxMonthName: '', maxStudentName: '' };
      const months = snapshots.map(snapshot => {
        const tracked = (snapshot.rows || []).map(row => ({
          studentName: studentName(row.studentName),
          contactCount: Math.max(0, Math.trunc(number(row.contactCount))),
          guideAmount: Math.max(0, Math.round(number(row.guideAmount))),
          unpaidStatus: unpaidStatus(row.unpaidStatus),
          lastContactAt: text(row.lastContactAt),
          lastContactMemo: text(row.lastContactMemo),
          contactChannel: contactChannel(row.contactChannel)
        })).filter(row => row.studentName);
        tracked.forEach(row => {
          const current = studentMap.get(row.studentName) || { studentName: row.studentName, totalContacts: 0, monthsGuided: 0, maxContacts: 0, latestMonthName: '' };
          if (row.contactCount > 0) {
            current.totalContacts += row.contactCount;
            current.monthsGuided += 1;
            if (row.contactCount >= current.maxContacts) { current.maxContacts = row.contactCount; current.latestMonthName = snapshot.selectedMonth; }
            overview.totalContacts += row.contactCount;
            if (row.contactCount > overview.maxContacts) { overview.maxContacts = row.contactCount; overview.maxMonthName = snapshot.selectedMonth; overview.maxStudentName = row.studentName; }
          }
          studentMap.set(row.studentName, current);
        });
        const contacted = tracked.filter(row => row.contactCount > 0);
        const totalContacts = contacted.reduce((sum, row) => sum + row.contactCount, 0);
        return {
          monthName: snapshot.selectedMonth,
          trackedStudents: tracked.length,
          contactedStudents: contacted.length,
          totalContacts,
          avgContacts: contacted.length ? Math.round((totalContacts / contacted.length) * 10) / 10 : 0,
          maxContacts: contacted.reduce((max, row) => Math.max(max, row.contactCount), 0),
          totalGuideAmount: Math.round(tracked.reduce((sum, row) => sum + row.guideAmount, 0)),
          topStudents: contacted.sort(compareContacts).slice(0, 5)
        };
      });
      overview.activeMonths = months.filter(item => item.totalContacts > 0).length;
      const studentLeaders = [...studentMap.values()].filter(item => item.totalContacts > 0).sort((a, b) => b.totalContacts - a.totalContacts || b.maxContacts - a.maxContacts || a.studentName.localeCompare(b.studentName, 'ko')).slice(0, 12);
      overview.contactedStudents = studentLeaders.length;
      return { success: true, overview, months, studentLeaders, reportIndex: reportSource(snapshots) };
    },

    async getTuitionMonthlySalesOverview() {
      const snapshots = await loadSnapshots(store);
      if (!snapshots.length) return failure('Firestore 수강료 월 인덱스가 비어 있습니다.');
      const rows = mergePayments(snapshots.flatMap(snapshot => snapshot.payments || []));
      const dueMap = new Map();
      const paidMap = new Map();
      const students = new Map();
      rows.forEach(row => {
        const delta = -number(row.amount);
        if (!delta) return;
        const due = monthLabel(row.sourceDueMonth || row.sourceMonth || row.originMonth);
        const paid = paidMonthLabel(row);
        if (due) dueMap.set(due, (dueMap.get(due) || 0) + delta);
        if (paid) {
          paidMap.set(paid, (paidMap.get(paid) || 0) + delta);
          if (!students.has(paid)) students.set(paid, new Map());
          const bucket = students.get(paid);
          bucket.set(row.studentName, (bucket.get(row.studentName) || 0) + delta);
        }
      });
      const labels = [...new Set([...dueMap.keys(), ...paidMap.keys()])].sort();
      const paidTop10ByMonth = {};
      let defaultTopMonth = labels.at(-1) || '';
      labels.forEach(label => {
        paidTop10ByMonth[label] = [...(students.get(label) || new Map()).entries()]
          .filter(([, amount]) => amount > 0)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
          .slice(0, 10)
          .map(([name, amount], index) => ({ rank: index + 1, studentName: name, amount: Math.round(amount) }));
        if (paidTop10ByMonth[label].length) defaultTopMonth = label;
      });
      return {
        success: true,
        labels,
        dueTotals: labels.map(label => Math.round(dueMap.get(label) || 0)),
        paidTotals: labels.map(label => Math.round(paidMap.get(label) || 0)),
        paidTop10ByMonth,
        defaultTopMonth,
        reportIndex: reportSource(snapshots)
      };
    },

    async saveTuitionStudentMemo(payload = {}, identity = {}) {
      const student = studentName(payload.studentName);
      const requestId = requiredRequestId(payload);
      if (!student) return failure('학생명이 없습니다.');
      if (!requestId) return failure('저장 요청 식별자가 없습니다. 다시 시도해 주세요.');
      const documentKey = key(COLLECTIONS.studentMemos, studentMemoId(student));
      return store.transaction([documentKey], documents => {
        const current = documents[documentKey] || {};
        const memoId = `memo_${requestId}`;
        const map = { ...(current.memos || {}) };
        if (map[memoId]) {
          const memos = memoList(map, nowIso);
          return { result: { success: true, duplicate: true, studentName: student, memo: map[memoId], memos, warning: memoWarning(memos) } };
        }
        const item = memo({ id: memoId, createdAt: nowIso(), memo: payload.memo, author: payload.author || identity.name }, memoId, nowIso);
        if (!item) return { result: failure('수강료 메모를 입력해 주세요.') };
        map[memoId] = item;
        const memos = memoList(map, nowIso);
        return {
          writes: { [documentKey]: { studentName: student, updatedAt: nowIso(), memos: map } },
          result: { success: true, studentName: student, memo: item, memos, warning: memoWarning(memos) }
        };
      });
    },

    async saveTuitionStatusOnly(payload = {}, identity = {}) {
      return saveFollowupMutation({ store, payload, identity, nowIso, incrementContact: false });
    },

    async saveTuitionFollowup(payload = {}, identity = {}) {
      return saveFollowupMutation({ store, payload, identity, nowIso, incrementContact: true });
    },

    async appendTuitionPaymentEntry(payload = {}, identity = {}) {
      const month = monthName(payload.monthName);
      const student = studentName(payload.studentName);
      const requestId = requiredRequestId(payload);
      const amount = Math.round(number(payload.amount));
      if (!month) return failure('월 정보가 없습니다.');
      if (!student) return failure('학생명이 없습니다.');
      if (!requestId) return failure('저장 요청 식별자가 없습니다. 다시 시도해 주세요.');
      if (!amount) return failure('금액이 0원일 수 없습니다.');
      if (!text(payload.paidAt)) return failure('납부일을 입력해 주세요.');
      if (!text(payload.paymentType)) return failure('결제구분을 입력해 주세요.');
      const date = nowDate();
      const record = payment({
        ...payload,
        studentName: student,
        amount,
        inputAt: formatInputAt(date, timeZone),
        originMonth: month,
        sourceMonth: month,
        sourceDueMonth: month,
        requestId,
        createdAt: date.toISOString(),
        updatedAt: date.toISOString(),
        source: 'desk_portal'
      });
      return mutatePayment({ store, action: 'append', month, record, requestId, identity, nowIso, nowDate });
    },

    async deleteTuitionPaymentEntry(payload = {}, identity = {}) {
      const requestedMonth = monthName(payload.monthName);
      const requested = payment(payload.payment);
      const requestId = requiredRequestId(payload);
      const reason = text(payload.reason, 300);
      if (!requestedMonth) return failure('월 정보가 없습니다.');
      if (!requested) return failure('삭제할 수납 내역을 찾을 수 없습니다.');
      if (!reason) return failure('삭제 사유를 입력해 주세요.');
      if (!requestId) return failure('삭제 요청 식별자가 없습니다. 다시 시도해 주세요.');
      return mutatePayment({ store, action: 'delete', month: requestedMonth, record: requested, requestId, reason, identity, nowIso, nowDate });
    },

    async saveTuitionAmountAdjustment(payload = {}, identity = {}) {
      return adjustAmounts({ store, payload, identity, nowDate, nowIso, timeZone });
    }
  };

  return Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [name, async (payload, identity) => {
    try { return await handler(payload, identity); }
    catch (error) { return failure(`${errorLabel(name)}: ${error.message}`); }
  }]));
}

async function buildMonthSummary(store, payload) {
  const month = monthName(payload.monthName);
  const months = payload.months || await loadMonths(store);
  const monthContext = payload.monthContext || await loadTuitionMonthContext(store, months);
  const snapshot = await store.get(key(COLLECTIONS.snapshots, snapshotId(month)));
  if (!snapshot?.success || !Array.isArray(snapshot.rows)) {
    return pendingSummary(month, months, 'summary-snapshot-missing', monthContext);
  }
  const previousMonth = previousMonthName(month);
  const [memoDocuments, studentDocuments, recent, monthPayments, previousMonthPayments, followups, charges] = await Promise.all([
    store.list(COLLECTIONS.studentMemos, 500),
    loadActiveStudentDocuments(store),
    store.get(key(COLLECTIONS.paymentIndexes, 'recent')),
    store.get(key(COLLECTIONS.paymentIndexes, monthPaymentIndexId(month))),
    previousMonth ? store.get(key(COLLECTIONS.paymentIndexes, monthPaymentIndexId(previousMonth))) : null,
    store.get(key(COLLECTIONS.monthlyIndexes, followupIndexId(month))),
    store.get(key(COLLECTIONS.monthlyIndexes, `charges_${month}`))
  ]);
  const warnings = Object.fromEntries(memoDocuments.map(document => {
    const student = studentName(document.studentName);
    return [student, memoWarning(memoList(document.memos))];
  }).filter(([student, warning]) => student && warning.hasWarning));
  const statusFilter = text(payload.statusFilter);
  const keyword = text(payload.keyword).toLowerCase().replace(/\s+/g, '');
  const masterRows = studentDocuments.filter(isActiveStudent).map(studentMasterTuitionRow).filter(Boolean);
  const previousMethods = previousPaymentMethodMap(previousMonthPayments?.payments || []);
  const rows = mergeStudentMasterRows(snapshot.rows, masterRows).filter(row => {
    if (statusFilter && statusFilter !== '전체' && unpaidStatus(row.unpaidStatus) !== statusFilter) return false;
    if (!keyword) return true;
    return [row.studentName, row.school, row.grade].join('').toLowerCase().replace(/\s+/g, '').includes(keyword);
  }).map(row => ({
    ...row,
    previousPaymentMethod: previousMethods[studentName(row.studentName)] || '',
    tuitionMemoWarning: warnings[studentName(row.studentName)] || memoWarning([])
  }));
  const allPayments = mergePayments(snapshot.allPayments || recent?.payments || []);
  const payments = mergePayments(snapshot.payments || monthPayments?.payments || []).filter(row => !keyword || row.studentName.toLowerCase().replace(/\s+/g, '').includes(keyword));
  const stats = summaryStats(rows.filter(row => !row.hiddenFromTuition), payments);
  const cache = { source: 'firestore-snapshot', documentId: snapshotId(month), computedAt: text(snapshot.snapshot?.computedAt) };
  return {
    ...structuredClone(snapshot),
    success: true,
    months,
    selectedMonth: month,
    rows,
    kpi: stats.kpi,
    chart: stats.chart,
    allPayments,
    payments,
    monthAvailability: monthContext.monthAvailability,
    briefingMonths: monthContext.briefingMonths,
    briefingRows: monthContext.briefingRows,
    briefingPayments: monthContext.briefingPayments,
    tuitionMemoWarnings: warnings,
    cache,
    indexStatus: buildIndexStatus(month, cache, recent, monthPayments, followups, charges)
  };
}

async function saveFollowupMutation({ store, payload, identity, nowIso, incrementContact }) {
  const month = monthName(payload.monthName);
  const student = studentName(payload.studentName);
  const requestId = requiredRequestId(payload);
  if (!month) return failure('월 정보가 없습니다.');
  if (!student) return failure('학생명이 없습니다.');
  if (!requestId) return failure('저장 요청 식별자가 없습니다. 다시 시도해 주세요.');
  const keys = followupMutationKeys(month, student, requestId, incrementContact);
  return store.transaction(Object.values(keys), documents => {
    const duplicateDocument = incrementContact ? documents[keys.contactLog] : documents[keys.statusHistory];
    if (duplicateDocument) return { result: { success: true, duplicate: true, status: duplicateDocument.nextStatus || duplicateDocument.unpaidStatus, contactAt: duplicateDocument.contactAt, contactCount: duplicateDocument.contactCount } };
    const current = followup(documents[keys.followup]) || {
      monthName: month, studentName: student, guideAmount: 0, unpaidStatus: '안내이전',
      lastContactAt: '', lastContactMemo: '', contactChannel: '', contactCount: 0, lastUpdatedAt: ''
    };
    const timestamp = nowIso();
    const guideAmount = Math.max(0, Math.round(number(payload.guideAmount || current.guideAmount)));
    const status = unpaidStatus(payload.unpaidStatus);
    const next = {
      ...current,
      guideAmount,
      unpaidStatus: status,
      hiddenFromTuition: incrementContact
        ? Boolean(current.hiddenFromTuition)
        : (Object.prototype.hasOwnProperty.call(payload, 'hiddenFromTuition')
            ? Boolean(payload.hiddenFromTuition)
            : Boolean(current.hiddenFromTuition)),
      lastContactAt: incrementContact ? timestamp : current.lastContactAt,
      lastContactMemo: incrementContact ? text(payload.memo, 1200) : current.lastContactMemo,
      contactChannel: incrementContact ? contactChannel(payload.contactChannel) : current.contactChannel,
      contactCount: current.contactCount + (incrementContact ? 1 : 0),
      lastUpdatedAt: timestamp
    };
    const writes = {
      [keys.followup]: { ...next, updatedAt: timestamp, source: 'desk_portal' },
      [keys.followupIndex]: updateFollowupIndex(documents[keys.followupIndex], next, timestamp),
      [keys.monthIndex]: monthIndexDocument(month, timestamp, incrementContact ? 'tuition_followup_write' : 'tuition_status_write'),
      [keys.guideHistory]: {
        monthName: month, studentName: student, previousGuideAmount: current.guideAmount,
        nextGuideAmount: guideAmount, unpaidStatus: status, changedAt: timestamp,
        requestId, reason: text(payload.reason, 300), actorUid: text(identity.uid), actorName: text(identity.name)
      }
    };
    if (incrementContact) {
      writes[keys.contactLog] = {
        monthName: month, studentName: student, guideAmount, unpaidStatus: status,
        memo: next.lastContactMemo, contactChannel: next.contactChannel, contactAt: timestamp, contactCount: next.contactCount,
        requestId, actorUid: text(identity.uid), actorName: text(identity.name), source: 'desk_portal'
      };
    } else {
      writes[keys.statusHistory] = {
        monthName: month, studentName: student, previousStatus: current.unpaidStatus,
        nextStatus: status, previousHiddenFromTuition: Boolean(current.hiddenFromTuition),
        nextHiddenFromTuition: Boolean(next.hiddenFromTuition), guideAmount, contactCount: next.contactCount, changedAt: timestamp,
        requestId, actorUid: text(identity.uid), actorName: text(identity.name), source: 'desk_portal'
      };
    }
    const snapshot = updateSnapshotFollowup(documents[keys.snapshot], student, next, timestamp);
    if (snapshot) writes[keys.snapshot] = snapshot;
    return {
      writes,
      deletes: [keys.guideReport, keys.studentReport],
      result: incrementContact
        ? { success: true, contactAt: timestamp, contactCount: next.contactCount, sheetMirrorWarning: '', snapshotWarning: snapshot ? '' : '월별 요약 스냅샷이 없어 원장만 갱신되었습니다.' }
        : { success: true, status, hiddenFromTuition: Boolean(next.hiddenFromTuition), sheetMirrorWarning: '', snapshotWarning: snapshot ? '' : '월별 요약 스냅샷이 없어 원장만 갱신되었습니다.' }
    };
  });
}

async function mutatePayment({ store, action, month, record, requestId, reason = '', identity, nowIso, nowDate }) {
  const normalized = payment(record);
  const targetId = paymentId(normalized);
  const targetKey = key(COLLECTIONS.payments, targetId);
  const auditKey = key(COLLECTIONS.deletions, `tdel_${requestId}`);
  const dailyId = dailyPaymentIndexId(paidDateKey(normalized));
  const keys = {
    payment: targetKey,
    audit: auditKey,
    recent: key(COLLECTIONS.paymentIndexes, 'recent'),
    monthPayments: key(COLLECTIONS.paymentIndexes, monthPaymentIndexId(month)),
    dailyPayments: dailyId ? key(COLLECTIONS.paymentIndexes, dailyId) : '',
    snapshot: key(COLLECTIONS.snapshots, snapshotId(month)),
    monthIndex: key(COLLECTIONS.monthIndex, monthIndexId(month)),
    monthlyReport: reportKey('monthly_sales', 'global'),
    studentReport: reportKey('student_history', normalized.studentName)
  };
  return store.transaction(Object.values(keys), documents => {
    if (action === 'append' && documents[keys.payment]) {
      return { result: paymentResult(documents[keys.payment], true, Boolean(documents[keys.snapshot])) };
    }
    if (action === 'delete' && documents[keys.audit]?.success) {
      return { result: { success: true, duplicate: true, deletedPayment: documents[keys.audit].deletedPayment } };
    }
    const stored = action === 'delete' ? payment(documents[keys.payment]) : normalized;
    if (action === 'delete' && !stored) return { result: failure('이미 삭제되었거나 수납 내역을 찾을 수 없습니다. 새로고침 후 확인해 주세요.') };
    if (action === 'delete' && paymentKey(stored) !== paymentKey(normalized)) return { result: failure('선택한 수납 내역이 변경되었습니다. 새로고침 후 다시 선택해 주세요.') };
    const timestamp = nowIso();
    const writes = { [keys.monthIndex]: monthIndexDocument(month, timestamp, action === 'append' ? 'tuition_payment_write' : 'tuition_payment_delete') };
    const deletes = [keys.monthlyReport, keys.studentReport];
    if (action === 'append') writes[keys.payment] = { ...stored, createdAt: stored.createdAt || timestamp, updatedAt: timestamp, source: stored.source || 'desk_portal' };
    else deletes.push(keys.payment);
    const recent = changePaymentIndex(documents[keys.recent], stored, action, 'payments', RECENT_LIMIT, timestamp, { seeded: documents[keys.recent]?.seeded === true });
    const monthly = changePaymentIndex(documents[keys.monthPayments], stored, action, 'payments', MONTH_LIMIT, timestamp, { monthName: month, seeded: documents[keys.monthPayments]?.seeded === true });
    if (recent) writes[keys.recent] = recent; else deletes.push(keys.recent);
    if (monthly) writes[keys.monthPayments] = monthly; else deletes.push(keys.monthPayments);
    if (keys.dailyPayments) {
      const daily = changePaymentIndex(documents[keys.dailyPayments], stored, action, 'payments', DAILY_LIMIT, timestamp, { dateKey: paidDateKey(stored) });
      if (daily) writes[keys.dailyPayments] = daily; else deletes.push(keys.dailyPayments);
    }
    const snapshot = changeSnapshotPayment(documents[keys.snapshot], stored, action, month, nowDate());
    if (snapshot) writes[keys.snapshot] = snapshot;
    if (action === 'delete') {
      writes[keys.audit] = {
        success: true, requestId, monthName: month, reason, deletedAt: timestamp,
        deletedPayment: stored, source: 'desk_portal', actorUid: text(identity.uid), actorName: text(identity.name)
      };
    }
    const sheetMirrorWarning = action === 'delete' && stored.source && !/^desk_portal(?:_adjustment)?$/.test(stored.source)
      ? 'Firebase 수납 원장만 삭제했습니다. 원본 시트에서 가져온 건은 원본 시트도 별도로 확인해 주세요.' : '';
    return {
      writes,
      deletes: [...new Set(deletes.filter(Boolean))],
      result: action === 'append'
        ? paymentResult(stored, false, Boolean(snapshot))
        : { success: true, deletedPayment: stored, indexWarning: '', snapshotWarning: snapshot ? '' : '월별 요약 스냅샷이 없어 원장과 인덱스만 갱신되었습니다.', sheetMirrorWarning }
    };
  });
}

async function adjustAmounts({ store, payload, identity, nowDate, nowIso, timeZone }) {
  const month = monthName(payload.monthName);
  const student = studentName(payload.studentName);
  const requestId = requiredRequestId(payload);
  const reason = text(payload.reason, 300);
  if (!month) return failure('월 정보가 없습니다.');
  if (!student) return failure('학생명이 없습니다.');
  if (!requestId) return failure('저장 요청 식별자가 없습니다. 다시 시도해 주세요.');
  if (!reason) return failure('수정 사유를 입력해 주세요.');
  const date = nowDate();
  const localDateKey = formatDateKey(date, timeZone);
  const dailyId = dailyPaymentIndexId(localDateKey);
  const adjustment = payment({
    dueDate: `${month.replace(/s$/, '')}-01`, studentName: student, itemName: '수강료 정정',
    amount: 0, paidAt: formatPaidAt(date, timeZone), business: text(payload.business || '반포'),
    paymentType: '수강료 정정', approvalNo: 'PORTAL-ADJ', inputAt: formatInputAt(date, timeZone),
    issueMemo: `[정산 금액 수정] ${reason}`, originMonth: month, sourceMonth: month,
    sourceDueMonth: month, requestId, source: 'desk_portal_adjustment', entryKind: 'adjustment',
    countsAsPayment: false, createdAt: date.toISOString()
  });
  const keys = followupMutationKeys(month, student, requestId, false);
  Object.assign(keys, {
    payment: key(COLLECTIONS.payments, paymentId(adjustment)),
    recent: key(COLLECTIONS.paymentIndexes, 'recent'),
    monthPayments: key(COLLECTIONS.paymentIndexes, monthPaymentIndexId(month)),
    dailyPayments: key(COLLECTIONS.paymentIndexes, dailyId),
    monthlyReport: reportKey('monthly_sales', 'global')
  });
  return store.transaction(Object.values(keys), documents => {
    if (documents[keys.guideHistory]) {
      const existing = payment(documents[keys.payment]);
      return { result: { success: true, duplicate: true, guideAmount: Math.max(0, Math.round(number(payload.guideAmount))), collectedAmount: Math.max(0, Math.round(number(payload.collectedAmount))), unpaidStatus: documents[keys.guideHistory].unpaidStatus, adjustmentPayment: existing, sheetMirrorWarning: '', indexWarning: '', snapshotWarning: '' } };
    }
    const snapshot = documents[keys.snapshot];
    const row = snapshot?.rows?.find(item => studentName(item.studentName) === student);
    const current = followup(documents[keys.followup]) || {
      monthName: month, studentName: student, guideAmount: Math.max(0, Math.round(number(row?.guideAmount))),
      unpaidStatus: unpaidStatus(row?.unpaidStatus), lastContactAt: text(row?.lastContactAt),
      lastContactMemo: text(row?.lastContactMemo), contactChannel: contactChannel(row?.contactChannel),
      contactCount: Math.max(0, Math.trunc(number(row?.contactCount))), lastUpdatedAt: ''
    };
    const currentCollected = row ? Math.round(number(row.collectedAmount)) : mergePayments(documents[keys.monthPayments]?.payments || []).filter(item => item.studentName === student).reduce((sum, item) => sum - number(item.amount), 0);
    const nextGuide = Math.max(0, Math.round(number(payload.guideAmount)));
    const nextCollected = Math.round(number(payload.collectedAmount));
    if (nextCollected < 0) return { result: failure('순수납액은 0원 이상으로 입력해 주세요.') };
    const delta = nextCollected - currentCollected;
    const timestamp = nowIso();
    const status = resolveStatus(current.unpaidStatus, nextGuide, nextCollected);
    const next = { ...current, guideAmount: nextGuide, unpaidStatus: status, lastUpdatedAt: timestamp };
    const writes = {
      [keys.followup]: { ...next, updatedAt: timestamp, source: 'desk_portal' },
      [keys.followupIndex]: updateFollowupIndex(documents[keys.followupIndex], next, timestamp),
      [keys.monthIndex]: monthIndexDocument(month, timestamp, 'tuition_amount_adjustment'),
      [keys.guideHistory]: {
        monthName: month, studentName: student, previousGuideAmount: current.guideAmount,
        nextGuideAmount: nextGuide, unpaidStatus: status, changedAt: timestamp, requestId, reason,
        actorUid: text(identity.uid), actorName: text(identity.name), source: 'desk_portal'
      }
    };
    let adjustmentPayment = null;
    if (delta !== 0) {
      const basePayment = mergePayments(documents[keys.monthPayments]?.payments || [])
        .filter(item => item.studentName === student && item.countsAsPayment !== false && item.entryKind !== 'adjustment')
        .sort(comparePaymentsDesc)[0] || null;
      adjustmentPayment = payment({
        ...adjustment,
        amount: -delta,
        adjustmentForRequestId: basePayment?.requestId || '',
        adjustmentForPaymentKey: basePayment ? paymentKey(basePayment) : '',
        updatedAt: timestamp
      });
      writes[keys.payment] = adjustmentPayment;
      writes[keys.monthPayments] = changePaymentIndex(documents[keys.monthPayments], adjustmentPayment, 'append', 'payments', MONTH_LIMIT, timestamp, { monthName: month, seeded: documents[keys.monthPayments]?.seeded === true });
      writes[keys.dailyPayments] = changePaymentIndex(documents[keys.dailyPayments], adjustmentPayment, 'append', 'payments', DAILY_LIMIT, timestamp, { dateKey: localDateKey });
    }
    const nextSnapshot = updateSnapshotAmount(snapshot, student, nextGuide, nextCollected, status, adjustmentPayment, date);
    if (nextSnapshot) writes[keys.snapshot] = nextSnapshot;
    return {
      writes,
      deletes: [keys.guideReport, keys.studentReport, keys.monthlyReport],
      result: { success: true, guideAmount: nextGuide, collectedAmount: nextCollected, unpaidStatus: status, adjustmentPayment, sheetMirrorWarning: '', indexWarning: '', snapshotWarning: nextSnapshot ? '' : '월별 요약 스냅샷이 없어 원장과 인덱스만 갱신되었습니다.' }
    };
  });
}

function followupMutationKeys(month, student, requestId, incrementContact) {
  return {
    followup: key(COLLECTIONS.followups, followupId(month, student)),
    followupIndex: key(COLLECTIONS.monthlyIndexes, followupIndexId(month)),
    snapshot: key(COLLECTIONS.snapshots, snapshotId(month)),
    monthIndex: key(COLLECTIONS.monthIndex, monthIndexId(month)),
    contactLog: incrementContact ? key(COLLECTIONS.contactLogs, `tl_${requestId}`) : '',
    statusHistory: incrementContact ? '' : key(COLLECTIONS.statusChanges, `ts_${requestId}`),
    guideHistory: key(COLLECTIONS.guideChanges, `tg_${requestId}`),
    guideReport: reportKey('guide_dashboard', 'global'),
    studentReport: reportKey('student_history', student)
  };
}

function changeSnapshotPayment(source, row, action, month, date) {
  if (!source?.success || !Array.isArray(source.rows)) return null;
  const snapshot = structuredClone(source);
  if (action === 'append') ensureSnapshotStudentRow(snapshot, row.studentName);
  const isTarget = item => paymentKey(item) === paymentKey(row);
  snapshot.allPayments = action === 'append' ? mergePayments(row, snapshot.allPayments || []) : (snapshot.allPayments || []).filter(item => !isTarget(item));
  snapshot.payments = action === 'append' ? mergePayments(row, snapshot.payments || []) : (snapshot.payments || []).filter(item => !isTarget(item));
  snapshot.rows = snapshot.rows.map(item => {
    if (studentName(item.studentName) !== row.studentName) return item;
    const copy = { ...item };
    const delta = action === 'append' ? -number(row.amount) : number(row.amount);
    copy.collectedAmount = Math.round(number(copy.collectedAmount) + delta);
    if (row.countsAsPayment !== false && row.entryKind !== 'adjustment') {
      copy.paymentCount = Math.max(0, Math.trunc(number(copy.paymentCount)) + (action === 'append' ? 1 : -1));
    }
    const remaining = snapshot.payments.filter(paymentRow =>
      studentName(paymentRow.studentName) === row.studentName &&
      paymentRow.countsAsPayment !== false && paymentRow.entryKind !== 'adjustment'
    ).sort(comparePaymentsDesc);
    const latest = remaining[0] || {};
    copy.latestPaidAt = text(latest.paidAt);
    copy.latestBusiness = text(latest.business);
    copy.latestMethod = text(latest.paymentType);
    copy.latestCardCompany = text(latest.cardCompany);
    copy.latestApprovalNo = text(latest.approvalNo);
    copy.latestInputAt = text(latest.inputAt);
    copy.outstandingAmount = Math.max(0, Math.round(number(copy.guideAmount) - Math.max(0, number(copy.collectedAmount))));
    copy.unpaidStatus = resolveStatus(action === 'delete' && unpaidStatus(copy.unpaidStatus) === '납부완료' ? '확인필요' : copy.unpaidStatus, copy.guideAmount, copy.collectedAmount);
    return copy;
  });
  refreshSnapshot(snapshot, month, date);
  return snapshot;
}

function updateSnapshotFollowup(source, student, next, timestamp) {
  if (!source?.success || !Array.isArray(source.rows)) return null;
  const snapshot = structuredClone(source);
  ensureSnapshotStudentRow(snapshot, student);
  snapshot.rows = snapshot.rows.map(row => studentName(row.studentName) === student ? {
    ...row,
    guideAmount: next.guideAmount,
    unpaidStatus: next.unpaidStatus,
    lastContactAt: next.lastContactAt,
    lastContactMemo: next.lastContactMemo,
    contactChannel: next.contactChannel,
    contactCount: next.contactCount,
    hiddenFromTuition: Boolean(next.hiddenFromTuition),
    lastUpdatedAt: timestamp,
    outstandingAmount: Math.max(0, next.guideAmount - Math.max(0, number(row.collectedAmount)))
  } : row);
  refreshSnapshot(snapshot, next.monthName, new Date(timestamp));
  return snapshot;
}

function updateSnapshotAmount(source, student, guideAmount, collectedAmount, status, adjustmentPayment, date) {
  if (!source?.success || !Array.isArray(source.rows)) return null;
  let snapshot = structuredClone(source);
  if (adjustmentPayment) snapshot = changeSnapshotPayment(snapshot, adjustmentPayment, 'append', adjustmentPayment.sourceDueMonth, date);
  ensureSnapshotStudentRow(snapshot, student);
  snapshot.rows = snapshot.rows.map(row => studentName(row.studentName) === student ? {
    ...row, guideAmount, collectedAmount, outstandingAmount: Math.max(0, guideAmount - collectedAmount), unpaidStatus: status
  } : row);
  refreshSnapshot(snapshot, adjustmentPayment?.sourceDueMonth || snapshot.selectedMonth, date);
  return snapshot;
}

function refreshSnapshot(snapshot, month, date) {
  const stats = summaryStats((snapshot.rows || []).filter(row => !row.hiddenFromTuition), snapshot.payments || []);
  snapshot.kpi = stats.kpi;
  snapshot.chart = stats.chart;
  const today = formatDateKey(date);
  snapshot.todayPayments = (snapshot.allPayments || []).filter(row => paidDateKey(row) === today);
  snapshot.selectedMonth = monthName(month) || snapshot.selectedMonth;
  snapshot.snapshot = { ...(snapshot.snapshot || {}), source: 'cloud-run-transaction', computedAt: date.toISOString(), schemaVersion: 'v4' };
}

function changePaymentIndex(source, row, action, field, limit, timestamp, extras = {}) {
  const current = source?.[field] || [];
  const rows = action === 'append' ? mergePayments(row, current) : current.map(payment).filter(item => item && paymentKey(item) !== paymentKey(row)).sort(comparePaymentsDesc);
  if (!rows.length && action === 'delete') return null;
  return { ...extras, [field]: rows.slice(0, limit), updatedAt: timestamp, source: 'desk_portal' };
}

function updateFollowupIndex(source, row, timestamp) {
  const rows = (source?.rows || []).map(followup).filter(Boolean).filter(item => !(item.monthName === row.monthName && item.studentName === row.studentName));
  rows.push(row);
  return { monthName: row.monthName, rows, seeded: source?.seeded === true, updatedAt: timestamp, source: 'desk_portal' };
}

function paymentResult(record, duplicate, snapshotUpdated) {
  return {
    success: true, duplicate, sheetMirrorWarning: '', indexWarning: '',
    snapshotWarning: snapshotUpdated ? '' : '월별 요약 스냅샷이 없어 원장과 인덱스만 갱신되었습니다.',
    storage: { firestore: true, sheetMirror: false, indexesUpdated: true, snapshotUpdated, snapshotDeferred: !snapshotUpdated },
    payment: payment(record)
  };
}

async function loadMonths(store) {
  const indexed = await store.list(COLLECTIONS.monthIndex, 120);
  let months = sortMonths(indexed.map(item => item.monthName));
  if (!months.length) {
    const snapshots = await store.list(COLLECTIONS.snapshots, 120);
    months = sortMonths(snapshots.map(item => item.selectedMonth || item.monthName));
  }
  return months;
}

async function loadSnapshots(store) {
  const months = await loadMonths(store);
  const snapshots = await Promise.all(months.map(async month => {
    const snapshot = await store.get(key(COLLECTIONS.snapshots, snapshotId(month)));
    return snapshot?.success ? { ...structuredClone(snapshot), selectedMonth: month } : null;
  }));
  return snapshots.filter(Boolean);
}

async function loadTuitionMonthContext(store, months) {
  const normalizedMonths = sortMonths(months);
  const records = await Promise.all(normalizedMonths.map(async month => {
    const [snapshot, paymentIndex] = await Promise.all([
      store.get(key(COLLECTIONS.snapshots, snapshotId(month))),
      store.get(key(COLLECTIONS.paymentIndexes, monthPaymentIndexId(month)))
    ]);
    const rows = snapshot?.success && Array.isArray(snapshot.rows) ? snapshot.rows : [];
    const payments = mergePayments(
      snapshot?.success && Array.isArray(snapshot.payments) ? snapshot.payments : [],
      paymentIndex?.payments || []
    ).map(row => ({ ...row, sourceMonth: monthName(row.sourceMonth) || month }));
    return {
      monthName: month,
      generated: true,
      hasData: rows.length > 0 || payments.length > 0,
      rowCount: rows.length,
      paymentCount: payments.length,
      rows: rows.map(row => ({ ...structuredClone(row), sourceMonth: month })),
      payments
    };
  }));
  const briefingRecords = records.slice(0, 2);
  return {
    monthAvailability: records.map(({ rows, payments, ...record }) => record),
    briefingMonths: briefingRecords.map(record => record.monthName),
    briefingRows: briefingRecords.flatMap(record => record.rows),
    briefingPayments: mergePayments(briefingRecords.flatMap(record => record.payments))
  };
}

function pendingSummary(month, months, reason, monthContext = {}) {
  const stats = summaryStats([], []);
  return {
    success: true,
    selectedMonth: month,
    months,
    ...stats,
    allPayments: [],
    todayPayments: [],
    rows: [],
    monthAvailability: monthContext.monthAvailability || [],
    briefingMonths: monthContext.briefingMonths || [],
    briefingRows: monthContext.briefingRows || [],
    briefingPayments: monthContext.briefingPayments || [],
    pendingSummary: true,
    pendingReason: reason,
    cache: { source: 'bootstrap-pending' },
    indexStatus: buildIndexStatus(month, { source: 'bootstrap-pending' })
  };
}

function buildIndexStatus(month, cache, recent, payments, followups, charges) {
  const compact = (label, document, field) => ({ label, ready: document?.seeded === true, count: Array.isArray(document?.[field]) ? document[field].length : 0, updatedAt: text(document?.updatedAt) });
  return {
    monthName: month,
    checkedAt: new Date().toISOString(),
    summary: { source: text(cache?.source || 'computed'), updatedAt: text(cache?.computedAt || cache?.updatedAt) },
    recentPayments: compact('최근 수납', recent, 'payments'),
    monthPayments: compact('월별 수납', payments, 'payments'),
    followups: compact('안내/연락', followups, 'rows'),
    charges: compact('안내금액', charges, 'rows')
  };
}

function reportSource(snapshots) {
  return { source: 'cloud-run-snapshots', version: snapshots.map(item => item.selectedMonth).join('|') };
}

function reportKey(kind, value) {
  return key(COLLECTIONS.monthlyIndexes, `report_${kind}_${Buffer.from(String(value || 'global'), 'utf8').toString('base64url').slice(0, 90)}`);
}

function followupIndexId(month) { return `followups_${monthName(month)}`; }
function monthPaymentIndexId(month) { return `payment_month_${monthName(month)}`; }
function dailyPaymentIndexId(dateKey) { return /^\d{4}-\d{2}-\d{2}$/.test(text(dateKey)) ? `daily_${dateKey.replaceAll('-', '_')}` : ''; }
function key(collection, id) { return id ? `${collection}/${id}` : ''; }
function requiredRequestId(payload) { return clientRequestId(payload.clientRequestId); }
function monthIndexDocument(month, timestamp, source) { return { monthName: month, updatedAt: timestamp, source }; }
function failure(message) { return { success: false, message }; }

function isInactiveStudent(document) {
  const status = text(document?.status || document?.registrationStatus || document?.enrollmentStatus).toUpperCase();
  if (/^(INACTIVE|DISABLED|DELETED|STOPPED|WITHDRAWN|PAUSED|중지|중지생|퇴원|퇴원생|휴원|휴원생|비활성|삭제)$/.test(status)) return true;
  return document?.active === false || document?.isActive === false;
}

function isActiveStudent(document) {
  if (isInactiveStudent(document)) return false;
  const status = text(document?.status || document?.registrationStatus || document?.enrollmentStatus).toUpperCase();
  return document?.active === true
    || document?.isActive === true
    || /^(ACTIVE|REGISTERED|ENROLLED|CURRENT|재원|재원생|등록)$/.test(status);
}

async function loadActiveStudentDocuments(store) {
  if (typeof store.listWhere !== 'function') return store.list(COLLECTIONS.students, 1000);
  const activeStatuses = ['ACTIVE', 'REGISTERED', 'ENROLLED', 'CURRENT', 'RETURNING', '재원', '등록'];
  const groups = await Promise.all([
    store.listWhere(COLLECTIONS.students, 'active', '==', true, 5000),
    store.listWhere(COLLECTIONS.students, 'isActive', '==', true, 5000),
    store.listWhere(COLLECTIONS.students, 'status', 'in', activeStatuses, 5000)
  ]);
  const documents = new Map();
  groups.flat().forEach(document => {
    const id = text(document?.id || document?.studentId || document?.canonicalStudentId);
    if (id && !documents.has(id)) documents.set(id, document);
  });
  return [...documents.values()];
}

function studentMasterTuitionRow(document) {
  const name = studentName(document?.studentName || document?.name || document?.displayName);
  if (!name) return null;
  return {
    ...baseTuitionRow(name),
    studentId: text(document?.studentId || document?.id),
    school: text(document?.school || document?.schoolName),
    grade: text(document?.grade || document?.gradeName),
    masterRegistrationStatus: text(document?.status || document?.registrationStatus || document?.enrollmentStatus),
    source: 'firestore-student-master'
  };
}

function baseTuitionRow(student) {
  return {
    studentName: studentName(student), school: '', grade: '', guideAmount: 0,
    collectedAmount: 0, outstandingAmount: 0, paymentCount: 0, unpaidStatus: '안내이전',
    contactCount: 0, lastContactAt: '', lastContactMemo: '', contactChannel: '', lastUpdatedAt: ''
  };
}

function ensureSnapshotStudentRow(snapshot, student) {
  const name = studentName(student);
  if (!name || snapshot.rows.some(row => studentName(row.studentName) === name)) return;
  snapshot.rows.push(baseTuitionRow(name));
}

function mergeStudentMasterRows(snapshotRows, masterRows) {
  const masterByName = new Map(masterRows.map(row => [studentName(row.studentName), row]));
  const merged = structuredClone(snapshotRows || []).map(row => {
    const master = masterByName.get(studentName(row.studentName));
    if (!master) return row;
    masterByName.delete(studentName(row.studentName));
    return {
      ...row,
      studentId: text(row.studentId) || master.studentId,
      school: text(row.school) || master.school,
      grade: text(row.grade) || master.grade,
      masterRegistrationStatus: master.masterRegistrationStatus || text(row.masterRegistrationStatus)
    };
  });
  return merged.concat([...masterByName.values()].sort((a, b) => a.studentName.localeCompare(b.studentName, 'ko')));
}

function studentMasterRow(document) {
  const name = studentName(document?.studentName || document?.name || document?.displayName);
  if (!name) return null;
  const registrationStatus = text(document?.status || document?.registrationStatus || document?.enrollmentStatus)
    || (document?.active === false || document?.isActive === false ? 'INACTIVE' : '');
  return {
    id: text(document?.studentId || document?.id),
    name,
    school: text(document?.school || document?.schoolName),
    grade: text(document?.grade || document?.gradeName),
    registrationStatus,
    inactive: true,
    source: 'firestore'
  };
}
function compareContacts(a, b) { return b.contactCount - a.contactCount || a.studentName.localeCompare(b.studentName, 'ko'); }
function routeLabel(row) { return text(row.paymentType) || (text(row.issueMemo).includes('현금') ? '현금' : '기타'); }

function previousMonthName(value) {
  const normalized = monthName(value);
  if (!normalized) return '';
  const [yearText, monthText] = normalized.replace(/s$/, '').split('-');
  const date = new Date(2000 + Number(yearText), Number(monthText) - 2, 1);
  return `${String(date.getFullYear()).slice(-2)}-${String(date.getMonth() + 1).padStart(2, '0')}s`;
}

function previousPaymentMethodMap(rows) {
  return mergePayments(rows || []).reduce((methods, row) => {
    const student = studentName(row.studentName);
    if (student && !methods[student] && text(row.paymentType)) methods[student] = text(row.paymentType);
    return methods;
  }, {});
}

function monthLabel(value) {
  const normalized = monthName(value);
  return normalized ? normalized.replace(/s$/, '') : '';
}

function paidMonthLabel(row) {
  const key = paidDateKey(row);
  return key ? key.slice(2, 7) : monthLabel(row.sourceDueMonth || row.sourceMonth);
}

function errorLabel(name) {
  const labels = {
    createTuitionMonth: '수강료 월 생성 오류',
    getTuitionBootstrapData: '수강료 초기 데이터 로드 오류', getTuitionMonthSummary: '수강료 요약 조회 오류',
    getTuitionStudentMonthlyHistory: '학생 월별 이력 조회 오류', getTuitionStudentMemoNotes: '수강료 메모 조회 오류',
    getTuitionGuideDashboard: '안내 대시보드 조회 오류', getTuitionMonthlySalesOverview: '월별 매출 집계 오류',
    saveTuitionStatusOnly: '상태 저장 오류', saveTuitionFollowup: '연락기록 저장 오류',
    saveTuitionStudentMemo: '수강료 메모 저장 오류', saveTuitionAmountAdjustment: '금액 수정 오류',
    appendTuitionPaymentEntry: '수납 입력 오류', deleteTuitionPaymentEntry: '수납 삭제 오류'
  };
  return labels[name] || '수강료 API 오류';
}
