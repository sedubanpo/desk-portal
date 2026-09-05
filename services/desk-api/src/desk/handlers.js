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
  newId,
  recruitingComment,
  recruitingApplicant,
  RETIRED_WORKERS,
  rtdbKey,
  scheduleEntry,
  SUPPLY_BRANCHES,
  suppliesData,
  supplyAsset,
  supplyConsumable,
  supplySelections,
  workerKey
} from './normalizers.js';
import { ApiError } from '../http.js';

const PATHS = Object.freeze({
  schedule: 'desk_portal/monthly_schedule',
  scheduleHistory: 'desk_portal/monthly_schedule_history',
  attendance: 'desk_portal/staff_attendance',
  attendanceRequests: 'desk_portal/staff_attendance_requests',
  attendanceAudit: 'desk_portal/staff_attendance_audit',
  journal: 'desk_portal/daily_journal',
  pending: 'desk_portal/daily_pending_tasks',
  supplies: 'desk_portal/supplies',
  recruiting: 'desk_portal/hr_recruiting/applicants',
  dailyConfig: 'desk_portal/daily_config',
  tuitionConfig: 'desk_portal/tuition_config'
});

export const DESK_READ_METHODS = new Set([
  'getDeskScheduleMonthData',
  'getDeskScheduleDayHistory',
  'getDeskAttendanceMonthData',
  'getDeskCalendarEvents',
  'getDeskDailyJournalData',
  'getDeskDailyJournalPendingTasks',
  'getDeskDailyJournalTaskLedger',
  'getDeskStaffDirectory',
  'getDeskSuppliesData',
  'getDeskRecruitingApplicantsData',
  'getDeskPortalConfig'
]);

export const DESK_WRITE_METHODS = new Set([
  'saveDeskScheduleEntry', 'deleteDeskScheduleEntry', 'batchUpdateDeskScheduleEntries',
  'saveDeskAttendancePunch', 'saveDeskAttendanceCorrectionRequest', 'saveDeskAttendanceCorrectionDecision',
  'saveDeskDailyJournalTask', 'deleteDeskDailyJournalTask', 'saveDeskDailyJournalMemo', 'deleteDeskDailyJournalMemo',
  'adjustDeskSupplyConsumable', 'saveDeskSupplyConsumable', 'deleteDeskSupplyConsumable',
  'saveDeskSupplyAsset', 'deleteDeskSupplyAsset', 'saveDeskSupplyPurchaseState', 'saveDeskSuppliesSnapshot',
  'saveDeskRecruitingApplicant', 'addDeskRecruitingApplicantComment', 'deleteDeskRecruitingApplicant',
  'saveDeskPortalConfig'
]);

export const DESK_SCHEDULE_WRITE_METHODS = new Set([
  'saveDeskScheduleEntry', 'deleteDeskScheduleEntry', 'batchUpdateDeskScheduleEntries'
]);

export const DESK_ATTENDANCE_ADMIN_METHODS = new Set(['saveDeskAttendanceCorrectionDecision']);

export const DESK_METHODS = new Set([...DESK_READ_METHODS, ...DESK_WRITE_METHODS]);

export function createDeskHandlers({ store, now = () => new Date().toISOString(), loadStaffDirectory = async () => [] }) {
  if (!store) throw new TypeError('desk store is required.');

  const handlers = {
    async getDeskStaffDirectory() {
      const staff = (await loadStaffDirectory()).map(item => ({
        uid: String(item?.uid || '').trim(),
        name: String(item?.name || '').trim(),
        staffPosition: String(item?.staffPosition || '').trim()
      })).filter(item => item.name && item.staffPosition)
        .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
      return { success: true, staff };
    },

    async getDeskScheduleMonthData(payload = {}) {
      const key = monthKey(payload.monthKey);
      if (!key) return failure('monthKey가 올바르지 않습니다.');
      const stored = await store.get(`${PATHS.schedule}/${key}`);
      const source = stored?.entries && typeof stored.entries === 'object' ? stored.entries : stored;
      const seeded = !source || typeof source !== 'object' || !Object.keys(source).length;
      const entriesMap = seeded ? Object.fromEntries(buildScheduleSeed(key).map(item => [item.id, item])) : source;
      const entries = Object.entries(entriesMap).map(([id, item]) => scheduleEntry(item, id))
        .filter(item => !RETIRED_WORKERS.has(item.worker)).sort(compareScheduleEntries);
      const history = await store.get(`${PATHS.scheduleHistory}/${key}`) || {};
      return { success: true, monthKey: key, seeded, entries, latestVersions: latestScheduleVersions(history) };
    },

    async getDeskScheduleDayHistory(payload = {}) {
      const day = dateKey(payload.dateKey);
      if (!day) return failure('dateKey가 올바르지 않습니다.');
      const history = await store.get(`${PATHS.scheduleHistory}/${day.slice(0, 7)}/${day}`) || {};
      const versions = Object.entries(history)
        .map(([id, item]) => scheduleHistoryVersion(item, id))
        .filter(item => item.id && item.createdAt)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      return { success: true, dateKey: day, versions };
    },

    async getDeskAttendanceMonthData(payload = {}, identity = {}) {
      const key = monthKey(payload.monthKey);
      if (!key) return failure('monthKey가 올바르지 않습니다.');
      const [recordTree, requestTree, auditTree] = await Promise.all([
        store.get(`${PATHS.attendance}/${key}`),
        store.get(`${PATHS.attendanceRequests}/${key}`),
        store.get(`${PATHS.attendanceAudit}/${key}`)
      ]);
      const admin = identity.role === 'ADMIN';
      const ownUid = String(identity.uid || '').trim();
      const records = flattenAttendanceRecords(recordTree, key).filter(item => admin || item.uid === ownUid);
      const requests = Object.entries(requestTree || {}).map(([id, item]) => attendanceRequest(item, id, key))
        .filter(item => item.id && (admin || item.uid === ownUid)).sort(compareAttendanceRecords);
      const audits = flattenAttendanceAudits(auditTree, key).filter(item => admin || item.uid === ownUid);
      return { success: true, monthKey: key, records, requests, audits, summary: buildAttendanceSummary(records) };
    },

    async saveDeskAttendancePunch(payload = {}, identity = {}) {
      const today = seoulDateKey(now());
      const day = dateKey(payload.dateKey || today);
      const type = payload.type === 'clockOut' ? 'clockOut' : payload.type === 'clockIn' ? 'clockIn' : '';
      if (!day) return failure('근태 일자가 올바르지 않습니다.');
      if (day !== today) return failure('출퇴근 기록은 오늘 날짜에만 입력할 수 있습니다. 정정이 필요하면 정정 요청을 등록해 주세요.');
      if (!type) return failure('출근 또는 퇴근 유형이 필요합니다.');
      const uid = String(identity.uid || '').trim();
      if (!uid) return failure('로그인 계정을 확인할 수 없습니다.');
      const path = `${PATHS.attendance}/${day.slice(0, 7)}/${day}/${uid}`;
      const before = attendanceRecord(await store.get(path), uid, day);
      if (before[type]) return failure(type === 'clockIn' ? '이미 출근 기록이 있습니다.' : '이미 퇴근 기록이 있습니다.');
      const schedule = await attendanceScheduleForWorker(store, day, identity);
      const stamp = now();
      const after = attendanceRecord({
        ...before,
        uid,
        name: identity.name || before.name,
        role: identity.jobTitle || identity.position || before.role,
        dateKey: day,
        scheduledStart: schedule.start || before.scheduledStart,
        scheduledEnd: schedule.end || before.scheduledEnd,
        [type]: stamp,
        updatedAt: stamp,
        updatedByUid: uid,
        updatedByName: identity.name || identity.email || '계정 정보 없음',
        source: 'SELF_PUNCH'
      }, uid, day);
      const audit = buildAttendanceAudit({ action: type === 'clockIn' ? 'CLOCK_IN' : 'CLOCK_OUT', before, after, identity, now: stamp });
      await store.update('', {
        [path]: after,
        [`${PATHS.attendanceAudit}/${day.slice(0, 7)}/${day}/${audit.id}`]: audit
      });
      return { success: true, record: after, audit };
    },

    async saveDeskAttendanceCorrectionRequest(payload = {}, identity = {}) {
      const day = dateKey(payload.dateKey);
      const requestedClockIn = normalizeTime(payload.requestedClockIn);
      const requestedClockOut = normalizeTime(payload.requestedClockOut);
      const reason = String(payload.reason || '').trim();
      if (!day) return failure('정정 일자가 올바르지 않습니다.');
      if (!requestedClockIn && !requestedClockOut) return failure('정정할 출근 또는 퇴근 시간을 입력해 주세요.');
      if (!reason) return failure('정정 사유를 입력해 주세요.');
      const uid = String(identity.uid || '').trim();
      const id = `attendance_request_${newId()}`;
      const stamp = now();
      const request = attendanceRequest({
        id, uid, name: identity.name || identity.email || '계정 정보 없음', dateKey: day,
        requestedClockIn, requestedClockOut, reason, status: 'PENDING',
        createdAt: stamp, updatedAt: stamp, createdByUid: uid
      }, id, day.slice(0, 7));
      const audit = buildAttendanceAudit({ action: 'CORRECTION_REQUESTED', before: {}, after: request, identity, now: stamp, reason });
      await store.update('', {
        [`${PATHS.attendanceRequests}/${day.slice(0, 7)}/${id}`]: request,
        [`${PATHS.attendanceAudit}/${day.slice(0, 7)}/${day}/${audit.id}`]: audit
      });
      return { success: true, request, audit };
    },

    async saveDeskAttendanceCorrectionDecision(payload = {}, identity = {}) {
      const key = monthKey(payload.monthKey || String(payload.dateKey || '').slice(0, 7));
      const requestId = rtdbKey(payload.requestId);
      const decision = payload.decision === 'REJECTED' ? 'REJECTED' : payload.decision === 'APPROVED' ? 'APPROVED' : '';
      if (!key || !requestId || !decision) return failure('정정 요청과 처리 결과를 확인해 주세요.');
      const requestPath = `${PATHS.attendanceRequests}/${key}/${requestId}`;
      const stored = await store.get(requestPath);
      if (!stored) return failure('정정 요청을 찾을 수 없습니다.');
      const request = attendanceRequest(stored, requestId, key);
      if (request.status !== 'PENDING') return failure('이미 처리된 정정 요청입니다.');
      const stamp = now();
      const adminNote = String(payload.adminNote || '').trim();
      const decided = { ...request, status: decision, adminNote, decidedAt: stamp, updatedAt: stamp, decidedByUid: identity.uid || '', decidedByName: identity.name || identity.email || '관리자' };
      const updates = { [requestPath]: decided };
      let record = null;
      let before = {};
      if (decision === 'APPROVED') {
        const recordPath = `${PATHS.attendance}/${key}/${request.dateKey}/${request.uid}`;
        before = attendanceRecord(await store.get(recordPath), request.uid, request.dateKey);
        record = attendanceRecord({
          ...before,
          uid: request.uid,
          name: request.name || before.name,
          dateKey: request.dateKey,
          clockIn: request.requestedClockIn ? seoulLocalTimeIso(request.dateKey, request.requestedClockIn) : before.clockIn,
          clockOut: request.requestedClockOut ? seoulLocalTimeIso(request.dateKey, request.requestedClockOut) : before.clockOut,
          corrected: true,
          correctionRequestId: request.id,
          correctionReason: request.reason,
          updatedAt: stamp,
          updatedByUid: identity.uid || '',
          updatedByName: identity.name || identity.email || '관리자',
          source: 'CORRECTION_APPROVED'
        }, request.uid, request.dateKey);
        updates[recordPath] = record;
      }
      const audit = buildAttendanceAudit({ action: decision === 'APPROVED' ? 'CORRECTION_APPROVED' : 'CORRECTION_REJECTED', before, after: record || decided, identity, now: stamp, reason: request.reason, requestId });
      updates[`${PATHS.attendanceAudit}/${key}/${request.dateKey}/${audit.id}`] = audit;
      await store.update('', updates);
      return { success: true, request: decided, record, audit };
    },

    async saveDeskScheduleEntry(payload = {}, identity = {}) {
      const entry = scheduleEntry(payload.entry, payload.entry?.id);
      const key = monthKey(payload.monthKey || entry.date.slice(0, 7));
      if (!rtdbKey(entry.id)) return failure('일정 ID가 올바르지 않습니다.');
      const invalid = validateSchedule(entry, key);
      if (invalid) return failure(invalid);
      const current = await scheduleEntriesMap(store, key);
      const before = scheduleEntriesForDate(current, entry.date);
      current[entry.id] = entry;
      const after = scheduleEntriesForDate(current, entry.date);
      const version = buildScheduleVersion({ date: entry.date, before, after, identity, now: now() });
      await store.update('', {
        [`${PATHS.schedule}/${key}/entries/${entry.id}`]: entry,
        [`${PATHS.scheduleHistory}/${key}/${entry.date}/${version.id}`]: version
      });
      return { success: true, monthKey: key, entry, latestVersion: compactScheduleVersion(version) };
    },

    async deleteDeskScheduleEntry(payload = {}, identity = {}) {
      const key = monthKey(payload.monthKey);
      const id = rtdbKey(payload.id);
      if (!key) return failure('monthKey가 올바르지 않습니다.');
      if (!id) return failure('삭제할 일정 ID가 없습니다.');
      const current = await scheduleEntriesMap(store, key);
      const existing = current[id];
      if (!existing) return failure('삭제할 근무 일정을 찾을 수 없습니다.');
      const before = scheduleEntriesForDate(current, existing.date);
      delete current[id];
      const after = scheduleEntriesForDate(current, existing.date);
      const version = buildScheduleVersion({ date: existing.date, before, after, identity, now: now() });
      await store.update('', {
        [`${PATHS.schedule}/${key}/entries/${id}`]: null,
        [`${PATHS.scheduleHistory}/${key}/${existing.date}/${version.id}`]: version
      });
      return { success: true, monthKey: key, id, latestVersion: compactScheduleVersion(version) };
    },

    async batchUpdateDeskScheduleEntries(payload = {}, identity = {}) {
      const key = monthKey(payload.monthKey);
      if (!key) return failure('monthKey가 올바르지 않습니다.');
      const requestedDeleteIds = (Array.isArray(payload.deleteIds) ? payload.deleteIds : [])
        .map(id => String(id || '').trim()).filter(Boolean);
      const deleteIds = requestedDeleteIds.map(id => rtdbKey(id));
      if (deleteIds.some(id => !id)) return failure('삭제할 일정 ID가 올바르지 않습니다.');
      const entries = (Array.isArray(payload.entries) ? payload.entries : []).map(item => scheduleEntry(item, item?.id)).filter(item => !RETIRED_WORKERS.has(item.worker));
      for (const entry of entries) {
        if (!rtdbKey(entry.id)) return failure('일정 ID가 올바르지 않습니다.');
        const invalid = validateSchedule(entry, key);
        if (invalid) return failure(invalid);
      }
      const current = await scheduleEntriesMap(store, key);
      const affectedDates = new Set();
      deleteIds.forEach(id => {
        if (current[id]?.date) affectedDates.add(current[id].date);
      });
      entries.forEach(entry => affectedDates.add(entry.date));
      const beforeByDate = Object.fromEntries([...affectedDates].map(day => [day, scheduleEntriesForDate(current, day)]));
      deleteIds.forEach(id => delete current[id]);
      entries.forEach(entry => { current[entry.id] = entry; });
      const updates = {};
      deleteIds.forEach(id => { updates[`${PATHS.schedule}/${key}/entries/${id}`] = null; });
      entries.forEach(entry => { updates[`${PATHS.schedule}/${key}/entries/${entry.id}`] = entry; });
      const latestVersions = {};
      affectedDates.forEach(day => {
        const version = buildScheduleVersion({
          date: day,
          before: beforeByDate[day] || [],
          after: scheduleEntriesForDate(current, day),
          identity,
          now: now()
        });
        updates[`${PATHS.scheduleHistory}/${key}/${day}/${version.id}`] = version;
        latestVersions[day] = compactScheduleVersion(version);
      });
      if (Object.keys(updates).length) await store.update('', updates);
      return { success: true, monthKey: key, entries, deletedIds: deleteIds, latestVersions };
    },

    async getDeskDailyJournalData(payload = {}) {
      const key = dateKey(payload.dateKey);
      if (!key) return failure('dateKey가 올바르지 않습니다.');
      const stored = await store.get(`${PATHS.journal}/${key}`) || {};
      const tasks = Object.entries(stored.tasks || {}).map(([id, item]) => dailyTask(item, id, key, now())).filter(item => !item.deleted).sort(compareDailyTasks);
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
        if (!task.id || seen.has(task.id) || !task.dateKey || task.dateKey >= before || task.completed || task.deleted) return;
        if (!isSharedTask(task) && workers.size && !workers.has(workerKey(task.worker))) return;
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

    async getDeskDailyJournalTaskLedger(payload = {}) {
      const stored = await store.get(PATHS.journal) || {};
      const includeShared = Boolean(payload.includeShared);
      const includeRoutine = Boolean(payload.includeRoutine);
      const tasks = [];
      for (const [storedDate, day] of Object.entries(stored)) {
        for (const [id, raw] of Object.entries(day?.tasks || {})) {
          const task = dailyTask(raw, id, storedDate, now());
          if (!includeShared && isSharedTask(task)) continue;
          if (!includeRoutine && (task.dateKey === '2099-12-31' || workerKey(task.worker) === workerKey('루틴업무'))) continue;
          tasks.push(task);
        }
      }
      tasks.sort((left, right) => {
        const leftStamp = String(left.updatedAt || left.createdAt || left.dateKey);
        const rightStamp = String(right.updatedAt || right.createdAt || right.dateKey);
        return rightStamp.localeCompare(leftStamp) || right.id.localeCompare(left.id);
      });
      return {
        success: true,
        tasks,
        summary: {
          total: tasks.length,
          pending: tasks.filter(item => !item.completed && !item.deleted).length,
          completed: tasks.filter(item => item.completed && !item.deleted).length,
          deleted: tasks.filter(item => item.deleted).length,
          needsFollowup: tasks.filter(item => !item.completed && !item.deleted && (item.progressStatus === '확인 필요' || item.unresolvedReason || item.nextAction)).length
        }
      };
    },

    async saveDeskDailyJournalTask(payload = {}, identity = {}) {
      const key = dateKey(payload.dateKey || payload.task?.dateKey);
      if (!key) return failure('dateKey가 올바르지 않습니다.');
      const stamp = now();
      const requestedId = payload.task?.id ? rtdbKey(payload.task.id) : '';
      if (payload.task?.id && !requestedId) return failure('업무 ID가 올바르지 않습니다.');
      const existing = requestedId ? await store.get(`${PATHS.journal}/${key}/tasks/${requestedId}`) : null;
      const task = dailyTask({ ...(existing || {}), ...(payload.task || {}) }, payload.task?.id, key, stamp);
      if (!rtdbKey(task.id)) return failure('업무 ID가 올바르지 않습니다.');
      if (!task.worker) return failure('업무 대상 근무자가 필요합니다.');
      if (!task.title) return failure('업무 제목을 입력해 주세요.');
      task.createdAt = String(existing?.createdAt || task.createdAt || stamp);
      task.createdByUid = String(existing?.createdByUid || task.createdByUid || identity.uid || '');
      task.createdByName = String(existing?.createdByName || task.createdByName || identity.name || '');
      task.updatedAt = stamp;
      task.updatedByUid = String(identity.uid || task.updatedByUid || '');
      task.updatedByName = String(identity.name || task.updatedByName || '');
      task.completedAt = task.completed ? String(existing?.completedAt || stamp) : '';
      task.deleted = false;
      task.deletedAt = '';
      task.deletedByUid = '';
      task.deletedByName = '';
      const updates = { [`${PATHS.journal}/${key}/tasks/${task.id}`]: task, [`${PATHS.pending}/${task.id}`]: task.completed ? null : task };
      await store.update('', updates);
      return { success: true, dateKey: key, task };
    },

    async deleteDeskDailyJournalTask(payload = {}, identity = {}) {
      const key = dateKey(payload.dateKey);
      const id = rtdbKey(payload.id);
      if (!key) return failure('dateKey가 올바르지 않습니다.');
      if (!id) return failure('삭제할 업무 ID가 없습니다.');
      const existing = await store.get(`${PATHS.journal}/${key}/tasks/${id}`);
      if (!existing) return failure('삭제할 업무를 찾을 수 없습니다.');
      const stamp = now();
      const task = dailyTask({
        ...existing,
        deleted: true,
        deletedAt: stamp,
        deletedByUid: String(identity.uid || ''),
        deletedByName: String(identity.name || ''),
        updatedAt: stamp,
        updatedByUid: String(identity.uid || ''),
        updatedByName: String(identity.name || '')
      }, id, key, stamp);
      await store.update('', { [`${PATHS.journal}/${key}/tasks/${id}`]: task, [`${PATHS.pending}/${id}`]: null });
      return { success: true, dateKey: key, id, task };
    },

    async saveDeskDailyJournalMemo(payload = {}) {
      const key = dateKey(payload.dateKey || payload.memo?.dateKey);
      if (!key) return failure('dateKey가 올바르지 않습니다.');
      const memo = dailyMemo(payload.memo, payload.memo?.id, key, now());
      if (!rtdbKey(memo.id)) return failure('기록 ID가 올바르지 않습니다.');
      if (!memo.worker) return failure('기록 근무자 이름이 필요합니다.');
      if (!memo.text) return failure('기록 내용을 입력해 주세요.');
      await store.set(`${PATHS.journal}/${key}/memos/${memo.id}`, memo);
      return { success: true, dateKey: key, memo };
    },

    async deleteDeskDailyJournalMemo(payload = {}) {
      const key = dateKey(payload.dateKey);
      const id = rtdbKey(payload.id);
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

    async adjustDeskSupplyConsumable(payload = {}, identity = {}) {
      const id = String(payload.id || '').trim();
      const itemName = String(payload.itemName || '').trim();
      const productName = String(payload.productName || '').trim();
      const unit = String(payload.unit || '').trim();
      const branch = String(payload.branch || '').trim();
      const delta = Number(payload.delta || 0);
      if (!id) return failure('품목 ID가 없습니다.');
      if (!SUPPLY_BRANCHES.includes(branch)) return failure('조정할 관 정보가 올바르지 않습니다.');
      if (!delta) return failure('조정 수량이 없습니다.');
      let missing = false;
      const stored = await store.transaction(PATHS.supplies, current => {
        const data = suppliesData(current);
        const target = data.consumables.find(item => item.id === id) || data.consumables.find(item => (
          itemName && productName && unit &&
          item.itemName === itemName && item.productName === productName && item.unit === unit
        ));
        const stock = target?.branchStocks?.[branch];
        if (!target || !stock) { missing = true; return; }
        const beforeQty = Number(stock.qty || 0);
        const afterQty = Math.max(0, Math.min(stock.maxQty, beforeQty + delta));
        const appliedDelta = afterQty - beforeQty;
        stock.qty = afterQty;
        if (appliedDelta) {
          target.changeHistory = [{
            id: `supply_change_${newId().slice(0, 12)}`,
            itemName: target.itemName,
            branch,
            delta: appliedDelta,
            direction: appliedDelta < 0 ? 'decrease' : 'increase',
            beforeQty,
            afterQty,
            changedAt: now(),
            changedBy: String(identity.name || identity.email || '계정 정보 없음').trim(),
            changedByUid: String(identity.uid || '').trim()
          }, ...(target.changeHistory || [])].slice(0, 50);
        }
        data.purchaseSelections = supplySelections(data.purchaseSelections, data.consumables);
        return data;
      });
      if (missing) return failure('조정할 품목을 찾을 수 없습니다.');
      return { success: true, data: suppliesData(stored) };
    },

    async saveDeskSupplyConsumable(payload = {}) {
      let item = supplyConsumable(payload.item, payload.item?.id);
      if (!item.itemName) return failure('품목명을 입력해 주세요.');
      if (!item.productName) return failure('제품명을 입력해 주세요.');
      const stored = await mutateSupplies(store, data => {
        const existing = data.consumables.find(entry => entry.id === item.id);
        if (existing) {
          item = supplyConsumable({
            ...item,
            favorite: typeof payload.item?.favorite === 'boolean' ? item.favorite : existing.favorite,
            changeHistory: Array.isArray(payload.item?.changeHistory) ? item.changeHistory : existing.changeHistory
          }, item.id);
        }
        data.consumables = [item, ...data.consumables.filter(existingItem => existingItem.id !== item.id)];
      });
      return { success: true, data: stored, item };
    },

    async deleteDeskSupplyConsumable(payload = {}) {
      const id = String(payload.id || '').trim();
      if (!id) return failure('삭제할 품목 ID가 없습니다.');
      const stored = await mutateSupplies(store, data => {
        data.consumables = data.consumables.filter(item => item.id !== id);
        Object.keys(data.purchaseSelections || {}).forEach(key => {
          if (key === id || key.startsWith(`${id}:`)) delete data.purchaseSelections[key];
        });
      });
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
      if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
        return failure('저장할 소모품 데이터가 없습니다. 새로고침 후 다시 시도해 주세요.');
      }
      if (!payload.expectedData || typeof payload.expectedData !== 'object' || Array.isArray(payload.expectedData)) {
        throw supplySnapshotConflict('소모품 데이터가 최신 상태인지 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요.');
      }
      const expectedData = suppliesData(payload.expectedData);
      const data = suppliesData(payload.data);
      let conflict = false;
      const stored = await store.transaction(PATHS.supplies, current => {
        conflict = false;
        if (canonicalJson(suppliesData(current)) !== canonicalJson(expectedData)) {
          conflict = true;
          return current;
        }
        return data;
      });
      if (conflict) throw supplySnapshotConflict('다른 사용자가 소모품 데이터를 변경했습니다. 새로고침 후 다시 시도해 주세요.');
      return { success: true, data: suppliesData(stored) };
    },

    async getDeskRecruitingApplicantsData(payload = {}) {
      const key = monthKey(payload.monthKey);
      const stored = await store.get(PATHS.recruiting) || {};
      const applicants = Object.entries(stored).map(([id, item]) => recruitingApplicant({ ...item, storageId: id }, id, now())).filter(item => !key || [item.interviewDate, item.nextContactAt, item.resumeReportedAt, item.directorRequestedAt, item.createdAt].some(value => String(value || '').slice(0, 7) === key)).sort(compareApplicants);
      return { success: true, monthKey: key, applicants };
    },

    async getDeskPortalConfig(payload = {}) {
      const path = portalConfigPath(payload.scope, payload.key);
      if (!path) return failure('허용되지 않은 포털 설정 경로입니다.');
      return { success: true, scope: payload.scope, key: payload.key, value: await store.get(path) };
    },

    async saveDeskPortalConfig(payload = {}) {
      const path = portalConfigPath(payload.scope, payload.key);
      if (!path) return failure('허용되지 않은 포털 설정 경로입니다.');
      if (typeof payload.value === 'undefined') return failure('저장할 포털 설정 값이 없습니다.');
      if (!Object.hasOwn(payload, 'expectedValue') || typeof payload.expectedValue === 'undefined') {
        throw portalConfigConflict('포털 설정의 최신 상태를 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요.');
      }
      let conflict = false;
      const value = await store.transaction(path, current => {
        conflict = false;
        if (canonicalJson(current ?? null) !== canonicalJson(payload.expectedValue)) {
          conflict = true;
          return current;
        }
        return payload.value;
      });
      if (conflict) throw portalConfigConflict('다른 사용자가 포털 설정을 변경했습니다. 새로고침 후 다시 시도해 주세요.');
      return { success: true, scope: payload.scope, key: payload.key, value };
    },

    async saveDeskRecruitingApplicant(payload = {}) {
      const applicant = recruitingApplicant(payload.applicant, payload.applicant?.id, now());
      if (!applicant.applicantName) return failure('지원자명을 입력해 주세요.');
      const storageId = recruitingStorageId(applicant.storageId || applicant.id);
      if (!storageId) return failure('지원자 저장 키가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.');
      applicant.storageId = storageId;
      await store.set(`${PATHS.recruiting}/${storageId}`, applicant);
      return { success: true, applicant };
    },

    async addDeskRecruitingApplicantComment(payload = {}, identity = {}) {
      const id = String(payload.id || '').trim();
      const storageId = recruitingStorageId(payload.storageId || id);
      const content = String(payload.content || '').trim();
      if (!id) return failure('코멘트를 남길 지원자 ID가 없습니다.');
      if (!storageId) return failure('지원자 저장 키가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.');
      if (!content) return failure('코멘트 내용을 입력해 주세요.');
      if (content.length > 1000) return failure('코멘트는 1,000자 이내로 입력해 주세요.');
      const createdAt = now();
      const comment = recruitingComment({
        content,
        createdAt,
        authorUid: identity.uid,
        authorName: identity.name
      }, '', createdAt);
      const stored = await store.transaction(`${PATHS.recruiting}/${storageId}`, current => {
        if (!current || typeof current !== 'object') return;
        const applicant = recruitingApplicant(current, storageId, createdAt);
        applicant.storageId = storageId;
        applicant.comments = [comment, ...(applicant.comments || []).filter(item => item.id !== comment.id)].slice(0, 100);
        applicant.updatedAt = createdAt;
        return applicant;
      });
      if (!stored) return failure('지원자를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.');
      return { success: true, applicant: recruitingApplicant(stored, storageId, createdAt), comment };
    },

    async deleteDeskRecruitingApplicant(payload = {}) {
      const id = String(payload.id || '').trim();
      const storageId = recruitingStorageId(payload.storageId || id);
      if (!id) return failure('삭제할 지원자 ID가 없습니다.');
      if (!storageId) return failure('지원자 저장 키가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.');
      await store.remove(`${PATHS.recruiting}/${storageId}`);
      return { success: true, id, storageId };
    }
  };

  return Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [name, async (payload, identity) => {
    try { return await handler(payload, identity); }
    catch (error) {
      if (error instanceof ApiError) throw error;
      return failure(`${errorPrefix(name)}: ${error.message}`);
    }
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

function portalConfigPath(scopeValue, keyValue) {
  const scope = String(scopeValue || '').trim();
  const key = String(keyValue || '').trim().replace(/^\/+|\/+$/g, '');
  const dailyAllowed = /^(memoTemplates|memoTypes|responseGuides|messageTemplates|responseLogs(?:\/[A-Za-z0-9_.:-]{1,160})?)$/;
  const tuitionAllowed = /^(parentReplyTemplates|carryoverSuppressions\/\d{2}-\d{2}s?)$/;
  if (scope === 'daily' && dailyAllowed.test(key)) return `${PATHS.dailyConfig}/${key}`;
  if (scope === 'tuition' && tuitionAllowed.test(key)) return `${PATHS.tuitionConfig}/${key}`;
  return '';
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function supplySnapshotConflict(message) {
  return new ApiError(409, 'supplies_snapshot_conflict', message);
}

function portalConfigConflict(message) {
  return new ApiError(409, 'portal_config_conflict', message);
}

function recruitingStorageId(value) {
  return rtdbKey(value);
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

async function scheduleEntriesMap(store, key) {
  const stored = await store.get(`${PATHS.schedule}/${key}`);
  const source = stored?.entries && typeof stored.entries === 'object' ? stored.entries : stored;
  return Object.fromEntries(Object.entries(source || {}).map(([id, item]) => {
    const entry = scheduleEntry(item, id);
    return [entry.id, entry];
  }).filter(([, item]) => item.id && item.date));
}

function scheduleEntriesForDate(entriesMap, day) {
  return Object.values(entriesMap || {})
    .filter(item => item.date === day && !RETIRED_WORKERS.has(item.worker))
    .map(item => scheduleEntry(item, item.id))
    .sort(compareScheduleEntries);
}

function scheduleHistoryVersion(item = {}, fallbackId = '') {
  return {
    id: String(item.id || fallbackId || '').trim(),
    dateKey: dateKey(item.dateKey),
    createdAt: String(item.createdAt || '').trim(),
    actorUid: String(item.actorUid || '').trim(),
    actorName: String(item.actorName || '계정 정보 없음').trim(),
    summary: String(item.summary || '근무표 변경').trim(),
    entries: (Array.isArray(item.entries) ? item.entries : []).map(entry => scheduleEntry(entry, entry?.id)).sort(compareScheduleEntries),
    beforeEntries: (Array.isArray(item.beforeEntries) ? item.beforeEntries : []).map(entry => scheduleEntry(entry, entry?.id)).sort(compareScheduleEntries),
    changes: item.changes && typeof item.changes === 'object' ? item.changes : { added: [], updated: [], deleted: [] }
  };
}

function buildScheduleVersion({ date, before, after, identity = {}, now }) {
  const beforeMap = Object.fromEntries((before || []).map(item => [item.id, item]));
  const afterMap = Object.fromEntries((after || []).map(item => [item.id, item]));
  const added = (after || []).filter(item => !beforeMap[item.id]);
  const deleted = (before || []).filter(item => !afterMap[item.id]);
  const updated = (after || []).filter(item => beforeMap[item.id] && JSON.stringify(beforeMap[item.id]) !== JSON.stringify(item))
    .map(item => ({ before: beforeMap[item.id], after: item }));
  const total = added.length + updated.length + deleted.length;
  let summary = `근무 일정 ${total}건 변경`;
  if (total === 1 && added.length) summary = `${added[0].worker} 일정 추가`;
  if (total === 1 && updated.length) summary = `${updated[0].after.worker} 일정 수정`;
  if (total === 1 && deleted.length) summary = `${deleted[0].worker} 일정 삭제`;
  return scheduleHistoryVersion({
    id: newId(),
    dateKey: date,
    createdAt: String(now || new Date().toISOString()),
    actorUid: String(identity.uid || '').trim(),
    actorName: String(identity.name || identity.email || '계정 정보 없음').trim(),
    summary,
    entries: after,
    beforeEntries: before,
    changes: { added, updated, deleted }
  });
}

function compactScheduleVersion(version) {
  return {
    id: version.id,
    dateKey: version.dateKey,
    createdAt: version.createdAt,
    actorUid: version.actorUid,
    actorName: version.actorName,
    summary: version.summary,
    entryCount: version.entries.length
  };
}

function normalizeTime(value) {
  const time = String(value || '').trim();
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '';
}

function seoulDateKey(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function seoulLocalTimeIso(day, time) {
  const normalized = normalizeTime(time);
  return normalized ? new Date(`${day}T${normalized}:00+09:00`).toISOString() : '';
}

function attendanceRecord(item = {}, fallbackUid = '', fallbackDate = '') {
  const source = item && typeof item === 'object' ? item : {};
  return {
    uid: String(source.uid || fallbackUid || '').trim(),
    name: String(source.name || '').trim(),
    role: String(source.role || '').trim(),
    dateKey: dateKey(source.dateKey || fallbackDate),
    scheduledStart: normalizeTime(source.scheduledStart),
    scheduledEnd: normalizeTime(source.scheduledEnd),
    clockIn: String(source.clockIn || '').trim(),
    clockOut: String(source.clockOut || '').trim(),
    corrected: Boolean(source.corrected),
    correctionRequestId: String(source.correctionRequestId || '').trim(),
    correctionReason: String(source.correctionReason || '').trim(),
    source: String(source.source || '').trim(),
    updatedAt: String(source.updatedAt || '').trim(),
    updatedByUid: String(source.updatedByUid || '').trim(),
    updatedByName: String(source.updatedByName || '').trim()
  };
}

function attendanceRequest(item = {}, fallbackId = '', fallbackMonth = '') {
  const source = item && typeof item === 'object' ? item : {};
  return {
    id: String(source.id || fallbackId || '').trim(),
    uid: String(source.uid || '').trim(),
    name: String(source.name || '').trim(),
    dateKey: dateKey(source.dateKey || `${fallbackMonth}-01`),
    requestedClockIn: normalizeTime(source.requestedClockIn),
    requestedClockOut: normalizeTime(source.requestedClockOut),
    reason: String(source.reason || '').trim(),
    status: ['PENDING', 'APPROVED', 'REJECTED'].includes(source.status) ? source.status : 'PENDING',
    adminNote: String(source.adminNote || '').trim(),
    createdAt: String(source.createdAt || '').trim(),
    updatedAt: String(source.updatedAt || '').trim(),
    createdByUid: String(source.createdByUid || '').trim(),
    decidedAt: String(source.decidedAt || '').trim(),
    decidedByUid: String(source.decidedByUid || '').trim(),
    decidedByName: String(source.decidedByName || '').trim()
  };
}

function compareAttendanceRecords(left, right) {
  return String(right.dateKey || right.createdAt || '').localeCompare(String(left.dateKey || left.createdAt || '')) || String(left.name || '').localeCompare(String(right.name || ''), 'ko');
}

function flattenAttendanceRecords(tree, key) {
  const records = [];
  for (const [day, workers] of Object.entries(tree || {})) {
    for (const [uid, item] of Object.entries(workers || {})) {
      const record = attendanceRecord(item, uid, day);
      if (record.uid && record.dateKey?.startsWith(key)) records.push(record);
    }
  }
  return records.sort(compareAttendanceRecords);
}

function flattenAttendanceAudits(tree, key) {
  const audits = [];
  for (const [day, entries] of Object.entries(tree || {})) {
    for (const [id, item] of Object.entries(entries || {})) {
      if (!item || typeof item !== 'object') continue;
      audits.push({ ...item, id: String(item.id || id), dateKey: dateKey(item.dateKey || day) });
    }
  }
  return audits.filter(item => item.dateKey?.startsWith(key)).sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
}

function isoMinutes(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date).split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function timeMinutes(value) {
  const time = normalizeTime(value);
  if (!time) return null;
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function buildAttendanceSummary(records) {
  const grouped = new Map();
  records.forEach(record => {
    const current = grouped.get(record.uid) || { uid: record.uid, name: record.name, days: 0, completedDays: 0, lateDays: 0, earlyLeaveDays: 0, correctedDays: 0, workedMinutes: 0 };
    current.name = record.name || current.name;
    current.days += 1;
    if (record.clockIn && record.clockOut) current.completedDays += 1;
    if (record.corrected) current.correctedDays += 1;
    const clockIn = isoMinutes(record.clockIn);
    const clockOut = isoMinutes(record.clockOut);
    const scheduledStart = timeMinutes(record.scheduledStart);
    const scheduledEnd = timeMinutes(record.scheduledEnd);
    if (clockIn !== null && scheduledStart !== null && clockIn > scheduledStart) current.lateDays += 1;
    if (clockOut !== null && scheduledEnd !== null && clockOut < scheduledEnd) current.earlyLeaveDays += 1;
    if (clockIn !== null && clockOut !== null && clockOut >= clockIn) current.workedMinutes += clockOut - clockIn;
    grouped.set(record.uid, current);
  });
  return [...grouped.values()].sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'ko'));
}

async function attendanceScheduleForWorker(store, day, identity) {
  const entries = Object.values(await scheduleEntriesMap(store, day.slice(0, 7)));
  const names = [identity.name, identity.displayName].map(workerKey).filter(Boolean);
  return entries.find(item => item.date === day && !item.resident && !item.unavailable && names.includes(workerKey(item.worker))) || {};
}

function buildAttendanceAudit({ action, before = {}, after = {}, identity = {}, now, reason = '', requestId = '' }) {
  return {
    id: `attendance_audit_${newId()}`,
    action: String(action || '').trim(),
    dateKey: dateKey(after.dateKey || before.dateKey),
    uid: String(after.uid || before.uid || '').trim(),
    name: String(after.name || before.name || '').trim(),
    before,
    after,
    reason: String(reason || '').trim(),
    requestId: String(requestId || after.id || '').trim(),
    actorUid: String(identity.uid || '').trim(),
    actorName: String(identity.name || identity.email || '계정 정보 없음').trim(),
    createdAt: String(now || new Date().toISOString())
  };
}

function latestScheduleVersions(history) {
  return Object.fromEntries(Object.entries(history || {}).map(([day, versions]) => {
    const latest = Object.entries(versions || {}).map(([id, item]) => scheduleHistoryVersion(item, id))
      .filter(item => item.createdAt)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    return latest ? [day, compactScheduleVersion(latest)] : null;
  }).filter(Boolean));
}

function errorPrefix(name) {
  const labels = {
    getDeskScheduleMonthData: '근무표 조회 오류', getDeskScheduleDayHistory: '근무표 버전 이력 조회 오류', saveDeskScheduleEntry: '근무표 저장 오류', deleteDeskScheduleEntry: '근무표 삭제 오류', batchUpdateDeskScheduleEntries: '근무표 일괄 업데이트 오류',
    getDeskAttendanceMonthData: '근태 현황 조회 오류', saveDeskAttendancePunch: '출퇴근 기록 오류', saveDeskAttendanceCorrectionRequest: '출퇴근 정정 요청 오류', saveDeskAttendanceCorrectionDecision: '출퇴근 정정 처리 오류',
    getDeskStaffDirectory: '실무자 아이콘 연결 정보 조회 오류', getDeskDailyJournalData: '일일 업무일지 조회 오류', getDeskDailyJournalPendingTasks: '미해결 이월 업무 조회 오류', getDeskDailyJournalTaskLedger: '업무 배정 원장 조회 오류', saveDeskDailyJournalTask: '일일 업무 저장 오류', deleteDeskDailyJournalTask: '일일 업무 삭제 오류', saveDeskDailyJournalMemo: '근무 기록 저장 오류', deleteDeskDailyJournalMemo: '근무 기록 삭제 오류',
    getDeskSuppliesData: '소모품 데이터 조회 오류', adjustDeskSupplyConsumable: '소모품 수량 조정 오류', saveDeskSupplyConsumable: '소모품 저장 오류', deleteDeskSupplyConsumable: '소모품 삭제 오류', saveDeskSupplyAsset: '물품 저장 오류', deleteDeskSupplyAsset: '물품 삭제 오류', saveDeskSupplyPurchaseState: '구매 요청 상태 저장 오류',
    getDeskRecruitingApplicantsData: '인사 관리 조회 오류', saveDeskRecruitingApplicant: '지원자 저장 오류', addDeskRecruitingApplicantComment: '지원자 코멘트 저장 오류', deleteDeskRecruitingApplicant: '지원자 삭제 오류'
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
