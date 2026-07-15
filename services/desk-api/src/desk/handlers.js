import {
  compareApplicants,
  compareDailyMemos,
  compareDailyTasks,
  compareScheduleEntries,
  dailyMemo,
  dailyTask,
  dateKey,
  isSharedTask,
  monthKey,
  recruitingApplicant,
  RETIRED_WORKERS,
  scheduleEntry,
  suppliesData,
  supplyAsset,
  supplyConsumable,
  supplySelections,
  workerKey
} from './normalizers.js';

const PATHS = Object.freeze({
  schedule: 'desk_portal/monthly_schedule',
  journal: 'desk_portal/daily_journal',
  pending: 'desk_portal/daily_pending_tasks',
  supplies: 'desk_portal/supplies',
  recruiting: 'desk_portal/hr_recruiting/applicants'
});

export const DESK_READ_METHODS = new Set([
  'getDeskScheduleMonthData',
  'getDeskDailyJournalData',
  'getDeskDailyJournalPendingTasks',
  'getDeskSuppliesData',
  'getDeskRecruitingApplicantsData'
]);

export const DESK_WRITE_METHODS = new Set([
  'saveDeskScheduleEntry', 'deleteDeskScheduleEntry', 'batchUpdateDeskScheduleEntries',
  'saveDeskDailyJournalTask', 'deleteDeskDailyJournalTask', 'saveDeskDailyJournalMemo', 'deleteDeskDailyJournalMemo',
  'adjustDeskSupplyConsumable', 'saveDeskSupplyConsumable', 'deleteDeskSupplyConsumable',
  'saveDeskSupplyAsset', 'deleteDeskSupplyAsset', 'saveDeskSupplyPurchaseState', 'saveDeskSuppliesSnapshot',
  'saveDeskRecruitingApplicant', 'deleteDeskRecruitingApplicant'
]);

export const DESK_METHODS = new Set([...DESK_READ_METHODS, ...DESK_WRITE_METHODS]);

export function createDeskHandlers({ store, now = () => new Date().toISOString() }) {
  if (!store) throw new TypeError('desk store is required.');

  const handlers = {
    async getDeskScheduleMonthData(payload = {}) {
      const key = monthKey(payload.monthKey);
      if (!key) return failure('monthKey가 올바르지 않습니다.');
      const stored = await store.get(`${PATHS.schedule}/${key}`);
      const source = stored?.entries && typeof stored.entries === 'object' ? stored.entries : stored;
      const seeded = !source || typeof source !== 'object' || !Object.keys(source).length;
      const entriesMap = seeded ? Object.fromEntries(buildScheduleSeed(key).map(item => [item.id, item])) : source;
      const entries = Object.entries(entriesMap).map(([id, item]) => scheduleEntry(item, id))
        .filter(item => !RETIRED_WORKERS.has(item.worker)).sort(compareScheduleEntries);
      return { success: true, monthKey: key, seeded, entries };
    },

    async saveDeskScheduleEntry(payload = {}) {
      const entry = scheduleEntry(payload.entry, payload.entry?.id);
      const key = monthKey(payload.monthKey || entry.date.slice(0, 7));
      const invalid = validateSchedule(entry, key);
      if (invalid) return failure(invalid);
      await store.set(`${PATHS.schedule}/${key}/entries/${entry.id}`, entry);
      return { success: true, monthKey: key, entry };
    },

    async deleteDeskScheduleEntry(payload = {}) {
      const key = monthKey(payload.monthKey);
      const id = String(payload.id || '').trim();
      if (!key) return failure('monthKey가 올바르지 않습니다.');
      if (!id) return failure('삭제할 일정 ID가 없습니다.');
      await store.remove(`${PATHS.schedule}/${key}/entries/${id}`);
      return { success: true, monthKey: key, id };
    },

    async batchUpdateDeskScheduleEntries(payload = {}) {
      const key = monthKey(payload.monthKey);
      if (!key) return failure('monthKey가 올바르지 않습니다.');
      const deleteIds = (Array.isArray(payload.deleteIds) ? payload.deleteIds : []).map(id => String(id || '').trim()).filter(Boolean);
      const entries = (Array.isArray(payload.entries) ? payload.entries : []).map(item => scheduleEntry(item, item?.id)).filter(item => !RETIRED_WORKERS.has(item.worker));
      for (const entry of entries) {
        const invalid = validateSchedule(entry, key);
        if (invalid) return failure(invalid);
      }
      const updates = Object.fromEntries(deleteIds.map(id => [id, null]));
      for (const entry of entries) updates[entry.id] = entry;
      if (Object.keys(updates).length) await store.update(`${PATHS.schedule}/${key}/entries`, updates);
      return { success: true, monthKey: key, entries, deletedIds: deleteIds };
    },

    async getDeskDailyJournalData(payload = {}) {
      const key = dateKey(payload.dateKey);
      if (!key) return failure('dateKey가 올바르지 않습니다.');
      const stored = await store.get(`${PATHS.journal}/${key}`) || {};
      const tasks = Object.entries(stored.tasks || {}).map(([id, item]) => dailyTask(item, id, key, now())).sort(compareDailyTasks);
      const memos = Object.entries(stored.memos || {}).map(([id, item]) => dailyMemo(item, id, key, now())).sort(compareDailyMemos);
      return { success: true, dateKey: key, tasks, memos };
    },

    async getDeskDailyJournalPendingTasks(payload = {}) {
      const before = dateKey(payload.beforeDateKey || payload.dateKey);
      if (!before) return failure('기준 날짜가 올바르지 않습니다.');
      const workers = new Set((Array.isArray(payload.workers) ? payload.workers : []).map(workerKey).filter(Boolean));
      const seen = new Set();
      const tasks = [];
      const add = (raw, id, fallbackDate) => {
        const task = dailyTask(raw, id, fallbackDate, now());
        if (!task.id || seen.has(task.id) || !task.dateKey || task.dateKey >= before || task.completed) return;
        if (!isSharedTask(task) && (!workers.size || !workers.has(workerKey(task.worker)))) return;
        seen.add(task.id);
        tasks.push(task);
      };
      const indexed = await store.get(PATHS.pending) || {};
      for (const [id, item] of Object.entries(indexed)) if (item && typeof item === 'object') add(item, id, item.dateKey);
      const days = Math.min(14, Math.max(0, Number(payload.legacyScanDays || 7)));
      const dates = Array.from({ length: days }, (_, index) => shiftDate(before, -(index + 1)));
      const legacyDays = await Promise.all(dates.map(key => store.get(`${PATHS.journal}/${key}/tasks`)));
      legacyDays.forEach((day, index) => Object.entries(day || {}).forEach(([id, item]) => add(item, id, dates[index])));
      tasks.sort(compareDailyTasks);
      return { success: true, beforeDateKey: before, includeSharedCarryover: true, tasks };
    },

    async saveDeskDailyJournalTask(payload = {}) {
      const key = dateKey(payload.dateKey || payload.task?.dateKey);
      if (!key) return failure('dateKey가 올바르지 않습니다.');
      const task = dailyTask(payload.task, payload.task?.id, key, now());
      if (!task.worker) return failure('업무 대상 근무자가 필요합니다.');
      if (!task.title) return failure('업무 제목을 입력해 주세요.');
      const updates = { [`${PATHS.journal}/${key}/tasks/${task.id}`]: task, [`${PATHS.pending}/${task.id}`]: task.completed ? null : task };
      await store.update('', updates);
      return { success: true, dateKey: key, task };
    },

    async deleteDeskDailyJournalTask(payload = {}) {
      const key = dateKey(payload.dateKey);
      const id = String(payload.id || '').trim();
      if (!key) return failure('dateKey가 올바르지 않습니다.');
      if (!id) return failure('삭제할 업무 ID가 없습니다.');
      await store.update('', { [`${PATHS.journal}/${key}/tasks/${id}`]: null, [`${PATHS.pending}/${id}`]: null });
      return { success: true, dateKey: key, id };
    },

    async saveDeskDailyJournalMemo(payload = {}) {
      const key = dateKey(payload.dateKey || payload.memo?.dateKey);
      if (!key) return failure('dateKey가 올바르지 않습니다.');
      const memo = dailyMemo(payload.memo, payload.memo?.id, key, now());
      if (!memo.worker) return failure('기록 근무자 이름이 필요합니다.');
      if (!memo.text) return failure('기록 내용을 입력해 주세요.');
      await store.set(`${PATHS.journal}/${key}/memos/${memo.id}`, memo);
      return { success: true, dateKey: key, memo };
    },

    async deleteDeskDailyJournalMemo(payload = {}) {
      const key = dateKey(payload.dateKey);
      const id = String(payload.id || '').trim();
      if (!key) return failure('dateKey가 올바르지 않습니다.');
      if (!id) return failure('삭제할 기록 ID가 없습니다.');
      await store.remove(`${PATHS.journal}/${key}/memos/${id}`);
      return { success: true, dateKey: key, id };
    },

    async getDeskSuppliesData() {
      const stored = await store.get(PATHS.supplies);
      const seeded = !stored || typeof stored !== 'object' || !Object.keys(stored).length;
      return { success: true, data: suppliesData(stored), seeded };
    },

    async adjustDeskSupplyConsumable(payload = {}) {
      const id = String(payload.id || '').trim();
      const delta = Number(payload.delta || 0);
      if (!id) return failure('품목 ID가 없습니다.');
      if (!delta) return failure('조정 수량이 없습니다.');
      let missing = false;
      const stored = await store.transaction(PATHS.supplies, current => {
        const data = suppliesData(current);
        const target = data.consumables.find(item => item.id === id);
        if (!target) { missing = true; return; }
        target.qty = Math.max(0, Math.min(target.maxQty, Number(target.qty || 0) + delta));
        data.purchaseSelections = supplySelections(data.purchaseSelections, data.consumables);
        return data;
      });
      if (missing) return failure('조정할 품목을 찾을 수 없습니다.');
      return { success: true, data: suppliesData(stored) };
    },

    async saveDeskSupplyConsumable(payload = {}) {
      const item = supplyConsumable(payload.item, payload.item?.id);
      if (!item.itemName) return failure('품목명을 입력해 주세요.');
      if (!item.productName) return failure('제품명을 입력해 주세요.');
      const stored = await mutateSupplies(store, data => { data.consumables = [item, ...data.consumables.filter(existing => existing.id !== item.id)]; });
      return { success: true, data: stored, item };
    },

    async deleteDeskSupplyConsumable(payload = {}) {
      const id = String(payload.id || '').trim();
      if (!id) return failure('삭제할 품목 ID가 없습니다.');
      const stored = await mutateSupplies(store, data => { data.consumables = data.consumables.filter(item => item.id !== id); delete data.purchaseSelections[id]; });
      return { success: true, data: stored, id };
    },

    async saveDeskSupplyAsset(payload = {}) {
      const asset = supplyAsset(payload.asset, payload.asset?.id);
      if (!asset.type) return failure('물품 분류가 필요합니다.');
      if (!asset.productName) return failure('제품명을 입력해 주세요.');
      const stored = await mutateSupplies(store, data => { data.assets = [asset, ...data.assets.filter(item => item.id !== asset.id)]; });
      return { success: true, data: stored, asset };
    },

    async deleteDeskSupplyAsset(payload = {}) {
      const id = String(payload.id || '').trim();
      if (!id) return failure('삭제할 물품 ID가 없습니다.');
      const stored = await mutateSupplies(store, data => { data.assets = data.assets.filter(item => item.id !== id); });
      return { success: true, data: stored, id };
    },

    async saveDeskSupplyPurchaseState(payload = {}) {
      const stored = await mutateSupplies(store, data => {
        if (payload.purchaseSelections && typeof payload.purchaseSelections === 'object') data.purchaseSelections = supplySelections(payload.purchaseSelections, data.consumables);
        if (typeof payload.purchaseRequestTarget !== 'undefined') data.purchaseRequestTarget = String(payload.purchaseRequestTarget || '대표님').trim() || '대표님';
        if (typeof payload.purchaseRequestNote !== 'undefined') data.purchaseRequestNote = String(payload.purchaseRequestNote || '').trim();
      });
      return { success: true, data: stored };
    },

    async saveDeskSuppliesSnapshot(payload = {}) {
      const data = suppliesData(payload.data || payload);
      await store.transaction(PATHS.supplies, () => data);
      return { success: true, data };
    },

    async getDeskRecruitingApplicantsData(payload = {}) {
      const key = monthKey(payload.monthKey);
      const stored = await store.get(PATHS.recruiting) || {};
      const applicants = Object.entries(stored).map(([id, item]) => recruitingApplicant(item, id, now())).filter(item => !key || [item.interviewDate, item.nextContactAt, item.resumeReportedAt, item.directorRequestedAt, item.createdAt].some(value => String(value || '').slice(0, 7) === key)).sort(compareApplicants);
      return { success: true, monthKey: key, applicants };
    },

    async saveDeskRecruitingApplicant(payload = {}) {
      const applicant = recruitingApplicant(payload.applicant, payload.applicant?.id, now());
      if (!applicant.applicantName) return failure('지원자명을 입력해 주세요.');
      await store.set(`${PATHS.recruiting}/${applicant.id}`, applicant);
      return { success: true, applicant };
    },

    async deleteDeskRecruitingApplicant(payload = {}) {
      const id = String(payload.id || '').trim();
      if (!id) return failure('삭제할 지원자 ID가 없습니다.');
      await store.remove(`${PATHS.recruiting}/${id}`);
      return { success: true, id };
    }
  };

  return Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [name, async payload => {
    try { return await handler(payload); }
    catch (error) { return failure(`${errorPrefix(name)}: ${error.message}`); }
  }]));
}

function validateSchedule(entry, key) {
  if (!key) return 'monthKey가 올바르지 않습니다.';
  if (!entry.date || entry.date.slice(0, 7) !== key) return '근무일과 monthKey가 일치하지 않습니다.';
  if (!entry.worker) return '근무자 이름이 필요합니다.';
  if (RETIRED_WORKERS.has(entry.worker)) return '퇴사자는 근무표에 저장할 수 없습니다.';
  if (!entry.resident && !entry.unavailable && (!entry.start || !entry.end)) return '시작/종료 시간이 필요합니다.';
  return '';
}

async function mutateSupplies(store, mutation) {
  const stored = await store.transaction(PATHS.supplies, current => {
    const data = suppliesData(current);
    mutation(data);
    data.purchaseSelections = supplySelections(data.purchaseSelections, data.consumables);
    return data;
  });
  return suppliesData(stored);
}

function failure(message) { return { success: false, message }; }

function errorPrefix(name) {
  const labels = {
    getDeskScheduleMonthData: '근무표 조회 오류', saveDeskScheduleEntry: '근무표 저장 오류', deleteDeskScheduleEntry: '근무표 삭제 오류', batchUpdateDeskScheduleEntries: '근무표 일괄 업데이트 오류',
    getDeskDailyJournalData: '일일 업무일지 조회 오류', getDeskDailyJournalPendingTasks: '미해결 이월 업무 조회 오류', saveDeskDailyJournalTask: '일일 업무 저장 오류', deleteDeskDailyJournalTask: '일일 업무 삭제 오류', saveDeskDailyJournalMemo: '근무 기록 저장 오류', deleteDeskDailyJournalMemo: '근무 기록 삭제 오류',
    getDeskSuppliesData: '소모품 데이터 조회 오류', adjustDeskSupplyConsumable: '소모품 수량 조정 오류', saveDeskSupplyConsumable: '소모품 저장 오류', deleteDeskSupplyConsumable: '소모품 삭제 오류', saveDeskSupplyAsset: '물품 저장 오류', deleteDeskSupplyAsset: '물품 삭제 오류', saveDeskSupplyPurchaseState: '구매 요청 상태 저장 오류',
    getDeskRecruitingApplicantsData: '인사 관리 조회 오류', saveDeskRecruitingApplicant: '지원자 저장 오류', deleteDeskRecruitingApplicant: '지원자 삭제 오류'
  };
  return labels[name] || '데스크 API 오류';
}

function shiftDate(key, days) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function buildScheduleSeed(key) {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return [];
  const rules = [
    { worker: '홍성우', role: '총괄 팀장', days: [0, 1, 2, 3, 4, 5, 6], resident: true, note: '근무시간 상주 · 운영 총괄' },
    { worker: '안종성', role: '오후 데스크', days: [2, 4, 5, 6], start: '14:00', end: '22:30', note: '상담/학부모 응대' },
    { worker: '이민현', role: '마감 담당', days: [1, 4, 5, 6], start: '16:00', end: '22:30', note: '마감 점검 및 정산' },
    { worker: '김유민', role: '오전 데스크', days: [2, 4], start: '09:30', end: '17:00', note: '접수 및 행정 처리' },
    { worker: '김유민', role: '야간 지원', days: [5], start: '17:30', end: '22:30', note: '금요일 마감 보조' }
  ];
  const firstWeekOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const entries = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const week = Math.floor((firstWeekOffset + day - 1) / 7) + 1;
    rules.forEach((rule, index) => {
      if (!rule.days.includes(weekday)) return;
      let start = rule.start || '';
      let end = rule.end || '';
      if (rule.role === '오후 데스크' && weekday === 6) { start = '13:30'; end = '21:00'; }
      entries.push(scheduleEntry({ id: `seed_${key}_${day}_${index}_${rule.worker}`.replace(/\s+/g, ''), date: `${key}-${String(day).padStart(2, '0')}`, worker: rule.worker, role: rule.role, start, end, resident: Boolean(rule.resident), note: rule.note || '', week }));
    });
  }
  return entries;
}
