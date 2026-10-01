import { dailyTask, dateKey, isSharedTask, newId, rtdbKey, workerKey } from './normalizers.js';

const TRACKED = [
  'worker', 'title', 'note', 'category', 'progressStatus', 'completed', 'deleted',
  'unresolvedReason', 'nextAction', 'ackWorkers', 'targetWorkers',
  'hiddenFromWorkerBand', 'sortOrder'
];
const fail = message => ({ success: false, message });
const snapshot = task => Object.fromEntries(TRACKED.map(key => [key, task[key]]));
const allowed = identity => ['ADMIN', 'STAFF', 'DESK'].includes(identity.role);

function permission(before, task, identity) {
  if (identity.role === 'ADMIN') return '';
  const own = workerKey(identity.name);
  if (!own) return '계정 근무자 정보를 확인해 주세요.';
  if (before && isSharedTask(before)) {
    const protectedFields = TRACKED.filter(key => key !== 'ackWorkers');
    if (protectedFields.some(key => JSON.stringify(before[key]) !== JSON.stringify(task[key]))) {
      return '공지 수정은 관리자만 할 수 있습니다.';
    }
    const others = list => (list || []).filter(name => workerKey(name) !== own).map(workerKey).sort();
    if (JSON.stringify(others(before.ackWorkers)) !== JSON.stringify(others(task.ackWorkers))) {
      return '본인의 확인 상태만 변경할 수 있습니다.';
    }
    return '';
  }
  if (!before && isSharedTask(task)) return '';
  if (workerKey(before?.worker || task.worker) !== own) {
    return '본인에게 배정된 업무만 만들거나 변경할 수 있습니다.';
  }
  if (isSharedTask(task) || task.dateKey === '2099-12-31' || task.targetWorkers.some(name => workerKey(name) !== own)) {
    return '본인의 개인 업무만 추가할 수 있습니다.';
  }
  if (before) {
    const editableSelf = before.selfCreated && before.createdByUid && before.createdByUid === identity.uid;
    const protectedFields = [
      'worker', 'category', 'targetWorkers', 'hiddenFromWorkerBand', 'sortOrder',
      ...(editableSelf ? [] : ['title', 'note'])
    ];
    if (protectedFields.some(key => JSON.stringify(before[key]) !== JSON.stringify(task[key]))) {
      return '업무 배정 수정은 관리자만 할 수 있습니다.';
    }
  }
  return '';
}

export function createJournalTaskMethods({ store, now, journalPath, pendingPath }) {
  async function persist(payload, identity, removing = false) {
    if (!allowed(identity)) return fail('인증된 데스크 계정이 필요합니다.');
    const key = dateKey(payload.dateKey || payload.task?.dateKey);
    const input = payload.task || {};
    const suppliedId = removing ? payload.id : input.id;
    const id = suppliedId ? rtdbKey(suppliedId) : newId();
    if (!key || !id) return fail('업무 날짜 또는 ID가 올바르지 않습니다.');
    if (removing && identity.role !== 'ADMIN') return fail('업무 삭제는 관리자만 할 수 있습니다.');
    const stamp = now();
    const eventId = newId();
    let error = '';
    let saved;
    await store.transaction(`${journalPath}/${key}`, current => {
      error = '';
      saved = undefined;
      const day = { ...(current || {}) };
      const existing = day.tasks?.[id];
      // Returning the unchanged value lets RTDB check the server after a cold/stale
      // cache callback. Returning undefined here would abort before that check.
      const reject = message => { error = message; return current ?? null; };
      if (existing?.deleted) return reject('삭제된 업무입니다. 새로고침 후 확인해 주세요.');
      if (removing && !existing) return reject('삭제할 업무를 찾을 수 없습니다.');
      const before = existing ? dailyTask(existing, id, key, '') : null;
      const task = dailyTask({
        ...(existing || {}), ...input, id, ...(removing ? { deleted: true } : {})
      }, id, key, stamp);
      if (task.dateKey !== key) return reject('업무 날짜는 변경할 수 없습니다.');
      if (!removing && task.deleted !== Boolean(before?.deleted)) {
        return reject('업무 삭제는 관리자용 삭제 기능을 이용해 주세요.');
      }
      const denied = removing ? '' : permission(before, task, identity);
      if (denied) return reject(denied);
      if (!task.worker || !task.title || task.title.length > 500 ||
          task.note.length > 10000 || task.unresolvedReason.length > 10000 || task.nextAction.length > 10000) {
        return reject('업무 제목(500자 이내)과 담당자를 확인해 주세요.');
      }
      if (!before && isSharedTask(task) && identity.role !== 'ADMIN') {
        task.ackWorkers = [];
        task.completed = false;
        task.progressStatus = '대기';
      }
      task.selfCreated = before ? before.selfCreated : (
        !isSharedTask(task) && workerKey(task.worker) === workerKey(identity.name) &&
        (identity.role !== 'ADMIN' || Boolean(input.selfCreated))
      );
      task.createdAt = before ? before.createdAt : stamp;
      task.createdByUid = before ? before.createdByUid : String(identity.uid || '');
      task.createdByName = before ? before.createdByName : String(identity.name || '');
      const changes = TRACKED.filter(field => JSON.stringify(before?.[field]) !== JSON.stringify(task[field]));
      if (before && !changes.length) {
        saved = before;
        return current ?? null;
      }
      const requestedVersion = removing ? payload.version : input.version;
      if (before && requestedVersion !== undefined && requestedVersion !== before.version) {
        return reject('다른 변경이 먼저 저장되었습니다. 새로고침 후 다시 확인해 주세요.');
      }
      task.version = (before?.version || 0) + 1;
      task.updatedAt = stamp;
      task.updatedByUid = String(identity.uid || '');
      task.updatedByName = String(identity.name || '');
      task.completedAt = task.completed ? (before?.completedAt || stamp) : '';
      task.deletedAt = removing ? stamp : '';
      task.deletedByUid = removing ? String(identity.uid || '') : '';
      task.deletedByName = removing ? String(identity.name || '') : '';
      const event = {
        id: eventId,
        version: task.version,
        action: removing ? 'DELETED' : !before ? 'CREATED' :
          before.progressStatus !== task.progressStatus ? 'STATUS_CHANGED' : 'UPDATED',
        createdAt: stamp,
        actorUid: String(identity.uid || ''),
        actorName: String(identity.name || '계정 정보 없음'),
        changes,
        before: before ? snapshot(before) : null,
        after: snapshot(task)
      };
      day.tasks = { ...(day.tasks || {}), [id]: task };
      day.taskHistory = {
        ...(day.taskHistory || {}),
        [id]: { ...(day.taskHistory?.[id] || {}), [eventId]: event }
      };
      saved = task;
      return day;
    });
    if (error) return fail(error);
    // Retry-safe index repair. Canonical journal wins over a stale index.
    await store.update('', {
      [`${pendingPath}/${id}`]: saved.completed || saved.deleted ? null : saved
    });
    return { success: true, dateKey: key, ...(removing ? { id } : {}), task: saved };
  }

  return {
    saveDeskDailyJournalTask: (payload = {}, identity = {}) => persist(payload, identity),
    deleteDeskDailyJournalTask: (payload = {}, identity = {}) => persist(payload, identity, true),
    async getDeskDailyJournalTaskHistory(payload = {}, identity = {}) {
      if (!allowed(identity)) return fail('인증된 데스크 계정이 필요합니다.');
      const key = dateKey(payload.dateKey);
      const id = rtdbKey(payload.id);
      if (!key || !id) return fail('업무 날짜 또는 ID가 올바르지 않습니다.');
      const day = await store.get(`${journalPath}/${key}`) || {};
      const raw = day.tasks?.[id];
      if (!raw) return fail('업무를 찾을 수 없습니다.');
      const task = dailyTask(raw, id, key, '');
      if (identity.role !== 'ADMIN' && workerKey(task.worker) !== workerKey(identity.name)) {
        return fail('본인 업무의 이력만 확인할 수 있습니다.');
      }
      const entries = Object.values(day.taskHistory?.[id] || {}).sort((a, b) => b.version - a.version);
      const before = Number(payload.beforeVersion) || Infinity;
      const available = entries.filter(event => event.version < before);
      const history = available.slice(0, 30);
      return {
        success: true, task, history,
        nextBeforeVersion: available.length > history.length ? history.at(-1).version : null,
        legacy: entries.length === 0
      };
    }
  };
}
