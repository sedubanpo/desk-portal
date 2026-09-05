import { randomUUID } from 'node:crypto';

const WORKER_ALIASES = Object.freeze({ '이미현': '이민현' });
export const RETIRED_WORKERS = new Set(['인유빈', '유지연', '이창연']);
const HR_STATUSES = ['이력서 검토', '추천', '면접 조율', '면접 진행', '합격 안내', '불합격 안내'];
const HR_STATUS_ALIASES = Object.freeze({
  '미연락': '이력서 검토',
  '1차 연락': '추천',
  '재연락 필요': '면접 조율',
  '면접 조율중': '면접 조율',
  '면접 확정': '면접 진행',
  '종료': '불합격 안내'
});
const HR_REVIEW_DECISIONS = ['검토중', '추천', '보류', '제외'];

export function newId() {
  return randomUUID().replaceAll('-', '');
}

export function rtdbKey(value, maxLength = 300) {
  const key = String(value || '').trim();
  return key && key.length <= maxLength && !/[.#$\[\]\/\u0000-\u001f\u007f]/.test(key) ? key : '';
}

export function monthKey(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}$/.test(text) ? text : '';
}

export function dateKey(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

export function canonicalWorker(value) {
  const text = String(value || '').trim().normalize('NFC');
  return WORKER_ALIASES[text] || text;
}

export function workerKey(value) {
  return canonicalWorker(value).replace(/\s+/g, '').toLowerCase();
}

export function scheduleEntry(item = {}, fallbackId = '') {
  const entry = {
    id: String(item.id || fallbackId || newId()).trim(),
    date: String(item.date || '').trim(),
    worker: canonicalWorker(item.worker),
    role: String(item.role || '').trim(),
    start: String(item.start || '').trim(),
    end: String(item.end || '').trim(),
    resident: Boolean(item.resident || item.isResident),
    unavailable: Boolean(item.unavailable || item.isUnavailable),
    note: String(item.note || '').trim()
  };
  if (entry.resident || entry.unavailable) {
    entry.start = '';
    entry.end = '';
  }
  if (entry.unavailable) entry.resident = false;
  return entry;
}

export function compareScheduleEntries(left, right) {
  if (left.date !== right.date) return left.date.localeCompare(right.date);
  if (left.unavailable !== right.unavailable) return left.unavailable ? 1 : -1;
  if (left.resident !== right.resident) return left.resident ? -1 : 1;
  if (left.start !== right.start) return left.start.localeCompare(right.start);
  return left.worker.localeCompare(right.worker, 'ko');
}

export function dailyTask(item = {}, fallbackId = '', fallbackDateKey = '', now = new Date().toISOString()) {
  const completed = Boolean(item.completed);
  const deleted = Boolean(item.deleted);
  const requestedStatus = String(item.progressStatus || '').trim();
  const progressStatus = completed
    ? '완료'
    : (['대기', '진행 중', '확인 필요'].includes(requestedStatus) ? requestedStatus : (item.unresolvedReason ? '확인 필요' : '대기'));
  const task = {
    id: String(item.id || fallbackId || newId()).trim(),
    dateKey: dateKey(item.dateKey || fallbackDateKey),
    worker: canonicalWorker(item.worker),
    category: String(item.category || '일반').trim(),
    title: String(item.title || '').trim(),
    note: String(item.note || '').trim(),
    completed,
    deleted,
    progressStatus,
    unresolvedReason: String(item.unresolvedReason || '').trim(),
    nextAction: String(item.nextAction || '').trim(),
    ackWorkers: workerNames(item.ackWorkers),
    hiddenFromWorkerBand: Boolean(item.hiddenFromWorkerBand),
    sortOrder: finiteNumber(item.sortOrder),
    targetWorkers: workerNames(item.targetWorkers),
    createdAt: String(item.createdAt || now).trim(),
    createdByUid: String(item.createdByUid || '').trim(),
    createdByName: String(item.createdByName || '').trim(),
    updatedAt: String(item.updatedAt || item.createdAt || now).trim(),
    updatedByUid: String(item.updatedByUid || '').trim(),
    updatedByName: String(item.updatedByName || '').trim(),
    completedAt: String(item.completedAt || '').trim(),
    deletedAt: String(item.deletedAt || '').trim(),
    deletedByUid: String(item.deletedByUid || '').trim(),
    deletedByName: String(item.deletedByName || '').trim()
  };
  if (task.completed) {
    task.unresolvedReason = '';
    task.nextAction = '';
  }
  return task;
}

export function dailyMemo(item = {}, fallbackId = '', fallbackDateKey = '', now = new Date().toISOString()) {
  const stamp = String(item.createdAt || item.updatedAt || now).trim();
  return {
    id: String(item.id || fallbackId || newId()).trim(),
    dateKey: dateKey(item.dateKey || fallbackDateKey),
    worker: canonicalWorker(item.worker),
    text: String(item.text || '').trim(),
    category: String(item.category || item.type || item.memoType || '일반').trim() || '일반',
    mode: String(item.mode || 'report').trim() === 'record' ? 'record' : 'report',
    highlight: Boolean(item.highlight || item.important || item.major),
    createdAt: String(item.createdAt || now).trim(),
    updatedAt: String(item.updatedAt || item.createdAt || now).trim(),
    clientOrder: memoOrder(item.clientOrder, stamp)
  };
}

export function compareDailyTasks(left, right) {
  if (left.completed !== right.completed) return left.completed ? 1 : -1;
  if (left.category !== right.category) return left.category.localeCompare(right.category, 'ko');
  if (left.worker !== right.worker) return left.worker.localeCompare(right.worker, 'ko');
  return left.title.localeCompare(right.title, 'ko');
}

export function compareDailyMemos(left, right) {
  const leftStamp = String(left.createdAt || left.updatedAt || '');
  const rightStamp = String(right.createdAt || right.updatedAt || '');
  if (leftStamp !== rightStamp) return leftStamp.localeCompare(rightStamp);
  if (left.clientOrder !== right.clientOrder) return left.clientOrder - right.clientOrder;
  return left.id.localeCompare(right.id);
}

export function isSharedTask(task) {
  return String(task?.category || '').trim().startsWith('__shared__::') || workerKey(task?.worker) === workerKey('공동업무');
}

export const SUPPLY_BRANCHES = ['본관', '2관', '3관'];

const DEFAULT_CONSUMABLES = [
  {
    id: 'wet_tissue', itemName: '물티슈', productName: '데스크용 물티슈 100매', unit: '개', tags: ['#청소', '#데스크'],
    branchStocks: { '본관': { qty: 6, maxQty: 10, safetyQty: 4 }, '2관': { qty: 4, maxQty: 10, safetyQty: 4 }, '3관': { qty: 3, maxQty: 10, safetyQty: 4 } }
  },
  {
    id: 'box_tissue', itemName: '곽티슈', productName: '클리넥스 200매', unit: '개', tags: ['#상담', '#데스크'],
    branchStocks: { '본관': { qty: 12, maxQty: 20, safetyQty: 8 }, '2관': { qty: 8, maxQty: 20, safetyQty: 8 }, '3관': { qty: 6, maxQty: 20, safetyQty: 8 } }
  },
  {
    id: 'paper_cup', itemName: '종이컵', productName: '테이크아웃컵 1줄', unit: '줄', tags: ['#탕비', '#공용'],
    branchStocks: { '본관': { qty: 7, maxQty: 8, safetyQty: 3 }, '2관': { qty: 5, maxQty: 8, safetyQty: 3 }, '3관': { qty: 4, maxQty: 8, safetyQty: 3 } }
  },
  {
    id: 'trash_bag', itemName: '쓰레기봉투', productName: '20L 검정봉투', unit: '묶음', tags: ['#청소', '#분리수거'],
    branchStocks: { '본관': { qty: 4, maxQty: 6, safetyQty: 2 }, '2관': { qty: 3, maxQty: 6, safetyQty: 2 }, '3관': { qty: 3, maxQty: 6, safetyQty: 2 } }
  },
  {
    id: 'sanitizer', itemName: '손소독제', productName: '대용량 리필 500ml', unit: '병', tags: ['#위생', '#데스크'],
    branchStocks: { '본관': { qty: 2, maxQty: 5, safetyQty: 2 }, '2관': { qty: 3, maxQty: 5, safetyQty: 2 }, '3관': { qty: 1, maxQty: 5, safetyQty: 2 } }
  },
  {
    id: 'marker', itemName: '보드마카', productName: '화이트보드 마카 세트', unit: '세트', tags: ['#강의실', '#교구'],
    branchStocks: { '본관': { qty: 5, maxQty: 8, safetyQty: 3 }, '2관': { qty: 4, maxQty: 8, safetyQty: 3 }, '3관': { qty: 2, maxQty: 8, safetyQty: 3 } }
  }
];
const DEFAULT_ASSETS = [
  { id: 'asset_desktop_1', type: '데스크탑', branch: '본관', productName: 'DELL OptiPlex 데스크 PC', location: '반포관 데스크', manager: '데스크 공용', status: '정상', note: '학생 등록 및 결제 업무용' },
  { id: 'asset_tablet_1', type: '태블릿', branch: '2관', productName: 'iPad Air 5세대', location: '상담 테이블', manager: '상담용 공용', status: '정상', note: '학부모 상담 및 안내 자료' },
  { id: 'asset_printer_1', type: '프린터', branch: '3관', productName: 'HP LaserJet Pro', location: '데스크 뒤편', manager: '데스크 공용', status: '점검 필요', note: '토너 잔량 확인 필요' }
];

export function supplyStock(item = {}, fallback = {}) {
  const source = item && typeof item === 'object' ? item : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const fallbackMax = Math.max(1, supplyNumber(base.maxQty, 1));
  const maxQty = Math.max(1, supplyNumber(source.maxQty, fallbackMax));
  return {
    qty: clampNumber(supplyNumber(source.qty, supplyNumber(base.qty, 0)), 0, maxQty),
    maxQty,
    safetyQty: clampNumber(supplyNumber(source.safetyQty, supplyNumber(base.safetyQty, 0)), 0, maxQty)
  };
}

export function supplyConsumable(item = {}, fallbackId = '') {
  const source = item && typeof item === 'object' ? item : {};
  const branchStocks = source.branchStocks && typeof source.branchStocks === 'object'
    ? source.branchStocks
    : (source.stocks && typeof source.stocks === 'object' ? source.stocks : {});
  const sourceBranch = normalizeSupplyBranch(source.branch);
  const firstStock = Object.values(branchStocks).find(stock => stock && typeof stock === 'object') || source;
  const templateStock = supplyStock(firstStock);
  const missingStock = { qty: 0, maxQty: templateStock.maxQty, safetyQty: templateStock.safetyQty };
  return {
    id: String(source.id || fallbackId || `desk_supply_${newId().slice(0, 8)}`).trim(),
    itemName: String(source.itemName || '품목명').trim(),
    productName: String(source.productName || '제품명 미입력').trim(),
    unit: String(source.unit || '개').trim(),
    tags: normalizeSupplyTags(source.tags),
    favorite: source.favorite === true,
    changeHistory: normalizeSupplyChangeHistory(source.changeHistory),
    branchStocks: Object.fromEntries(SUPPLY_BRANCHES.map(branch => {
      const explicitStock = branchStocks[branch] || (!Object.keys(branchStocks).length && branch === sourceBranch ? source : missingStock);
      return [branch, supplyStock(explicitStock, missingStock)];
    }))
  };
}

function normalizeSupplyChangeHistory(value) {
  return (Array.isArray(value) ? value : []).map((entry, index) => {
    const source = entry && typeof entry === 'object' ? entry : {};
    const delta = Number(source.delta || 0);
    const beforeQty = Math.max(0, Number(source.beforeQty || 0));
    const afterQty = Math.max(0, Number(source.afterQty ?? source.quantity ?? beforeQty + delta));
    return {
      id: String(source.id || `supply_change_${index}`).trim(),
      itemName: String(source.itemName || '').trim(),
      branch: normalizeSupplyBranch(source.branch),
      delta,
      direction: delta < 0 ? 'decrease' : 'increase',
      beforeQty,
      afterQty,
      changedAt: String(source.changedAt || '').trim(),
      changedBy: String(source.changedBy || '계정 정보 없음').trim(),
      changedByUid: String(source.changedByUid || '').trim()
    };
  }).filter(entry => entry.delta && entry.changedAt).sort((a, b) => b.changedAt.localeCompare(a.changedAt)).slice(0, 50);
}

export function supplyAsset(item = {}, fallbackId = '') {
  return {
    id: String(item.id || fallbackId || newId()).trim(),
    type: String(item.type || '기타').trim(),
    branch: String(item.branch || '본관').trim() || '본관',
    productName: String(item.productName || '제품명 미입력').trim(),
    location: String(item.location || '-').trim(),
    manager: String(item.manager || '-').trim(),
    status: String(item.status || '정상').trim(),
    note: String(item.note || '').trim()
  };
}

function normalizeSupplyTags(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\s,]+/);
  return [...new Set(source.map(tag => String(tag || '').trim()).filter(Boolean).map(tag => tag.startsWith('#') ? tag : `#${tag}`))];
}

export function suppliesData(stored) {
  const data = stored && typeof stored === 'object' ? stored : {};
  const consumablesSource = Array.isArray(data.consumables) && data.consumables.length ? data.consumables : DEFAULT_CONSUMABLES;
  const assetsSource = Array.isArray(data.assets) && data.assets.length ? data.assets : DEFAULT_ASSETS;
  const consumables = normalizeSupplyConsumables(consumablesSource);
  const purchaseSelections = migrateSupplySelectionSource(data.purchaseSelections, consumablesSource, consumables);
  const assets = assetsSource.map((item, index) => supplyAsset(item, item?.id || `desk_asset_${index}`));
  return {
    consumables,
    assets,
    purchaseSelections: supplySelections(purchaseSelections, consumables),
    purchaseCustomRequests: Array.isArray(data.purchaseCustomRequests) ? structuredClone(data.purchaseCustomRequests) : [],
    purchaseRequestTarget: String(data.purchaseRequestTarget || '대표님').trim() || '대표님',
    purchaseRequestNote: String(data.purchaseRequestNote || '').trim()
  };
}

export function supplySelections(input, consumables) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.fromEntries(consumables.flatMap(item => SUPPLY_BRANCHES.map(branch => {
    const stock = supplyStock(item?.branchStocks?.[branch]);
    const key = supplyStockKey(item.id, branch);
    const current = source[key] && typeof source[key] === 'object'
      ? source[key]
      : (source[item.id] && typeof source[item.id] === 'object' ? source[item.id] : {});
    const recommended = Math.max(1, stock.maxQty - stock.qty);
    return [key, {
      selected: typeof current.selected === 'boolean' ? current.selected : stock.qty <= stock.safetyQty,
      requestQty: Math.max(1, supplyNumber(current.requestQty, recommended))
    }];
  })));
}

export function supplyStockKey(id, branch) {
  return `${String(id || '').trim()}:${normalizeSupplyBranch(branch)}`;
}

function migrateSupplySelectionSource(input, rawConsumables, consumables) {
  const source = input && typeof input === 'object' ? input : {};
  const migrated = { ...source };
  const canonicalIds = new Map(consumables.map(item => [supplyConsumableIdentity(item), item.id]));
  (rawConsumables || []).forEach((rawItem, index) => {
    const raw = rawItem && typeof rawItem === 'object' ? rawItem : {};
    const rawStocks = raw.branchStocks && typeof raw.branchStocks === 'object'
      ? raw.branchStocks
      : (raw.stocks && typeof raw.stocks === 'object' ? raw.stocks : null);
    if (rawStocks && Object.keys(rawStocks).length) return;

    const legacyId = String(raw.id || `desk_supply_${index}`).trim();
    const legacySelection = source[legacyId];
    if (!legacyId || !legacySelection || typeof legacySelection !== 'object') return;

    const normalized = supplyConsumable(raw, legacyId);
    const canonicalId = canonicalIds.get(supplyConsumableIdentity(normalized));
    const branchKey = supplyStockKey(canonicalId, normalizeSupplyBranch(raw.branch));
    if (canonicalId && !migrated[branchKey]) migrated[branchKey] = legacySelection;
    if (canonicalId) delete migrated[legacyId];
  });
  return migrated;
}

function normalizeSupplyConsumables(items) {
  const groups = new Map();
  (items || []).forEach((rawItem, index) => {
    const item = supplyConsumable(rawItem, rawItem?.id || `desk_supply_${index}`);
    const key = supplyConsumableIdentity(item);
    const explicitStocks = sourceSupplyStocks(rawItem);
    const group = groups.get(key) || {
      id: item.id,
      itemName: item.itemName,
      productName: item.productName,
      unit: item.unit,
      tags: [],
      favorite: false,
      changeHistory: [],
      branchStocks: {}
    };
    group.tags = normalizeSupplyTags([...group.tags, ...item.tags]);
    group.favorite = group.favorite || item.favorite;
    group.changeHistory = normalizeSupplyChangeHistory([...group.changeHistory, ...item.changeHistory]);
    SUPPLY_BRANCHES.forEach(branch => {
      if (!explicitStocks[branch]) return;
      group.branchStocks[branch] = group.branchStocks[branch]
        ? mergeSupplyStocks(group.branchStocks[branch], explicitStocks[branch])
        : explicitStocks[branch];
    });
    groups.set(key, group);
  });
  return [...groups.values()].map((item, index) => {
    const template = Object.values(item.branchStocks)[0] || supplyStock();
    const branchStocks = Object.fromEntries(SUPPLY_BRANCHES.map(branch => [
      branch,
      item.branchStocks[branch] || { qty: 0, maxQty: template.maxQty, safetyQty: template.safetyQty }
    ]));
    return supplyConsumable({ ...item, branchStocks }, item.id || `desk_supply_${index}`);
  });
}

function sourceSupplyStocks(item) {
  const source = item && typeof item === 'object' ? item : {};
  const branchStocks = source.branchStocks && typeof source.branchStocks === 'object'
    ? source.branchStocks
    : (source.stocks && typeof source.stocks === 'object' ? source.stocks : null);
  if (branchStocks) {
    return Object.fromEntries(SUPPLY_BRANCHES
      .filter(branch => branchStocks[branch] && typeof branchStocks[branch] === 'object')
      .map(branch => [branch, supplyStock(branchStocks[branch])]));
  }
  return { [normalizeSupplyBranch(source.branch)]: supplyStock(source) };
}

function mergeSupplyStocks(left, right) {
  const a = supplyStock(left);
  const b = supplyStock(right);
  const maxQty = Math.max(a.maxQty, b.maxQty);
  return supplyStock({
    qty: Math.max(a.qty, b.qty),
    maxQty,
    safetyQty: Math.max(a.safetyQty, b.safetyQty)
  });
}

function supplyConsumableIdentity(item) {
  return [item.itemName, item.productName, item.unit]
    .map(value => String(value || '').replace(/\s+/g, '').toLocaleLowerCase('ko'))
    .join('\u0001');
}

function normalizeSupplyBranch(value) {
  const branch = String(value || '').trim();
  return SUPPLY_BRANCHES.includes(branch) ? branch : SUPPLY_BRANCHES[0];
}

function supplyNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function recruitingApplicant(item = {}, fallbackId = '', now = new Date().toISOString()) {
  const roleType = String(item.roleType || '강사').trim() || '강사';
  const subject = String(item.subject || '').trim();
  let status = HR_STATUS_ALIASES[String(item.pipelineStatus || item.status || '이력서 검토').trim()] || String(item.pipelineStatus || item.status || '이력서 검토').trim();
  if (!HR_STATUSES.includes(status)) status = '이력서 검토';
  let reviewDecision = String(item.reviewDecision || '검토중').trim();
  if (!HR_REVIEW_DECISIONS.includes(reviewDecision)) reviewDecision = '검토중';
  const id = String(item.id || fallbackId || newId()).trim();
  return {
    id,
    storageId: String(item.storageId || fallbackId || id).trim(),
    applicantName: String(item.applicantName || item.name || '').trim(),
    roleType,
    subject: subject || (roleType === '데스크 직원' ? '데스크' : ''),
    subjectDetail: subject === '과학' ? String(item.subjectDetail || '').trim() : '',
    school: String(item.school || '').trim(), major: String(item.major || '').trim(), birthYear: String(item.birthYear || '').trim(), gender: String(item.gender || '').trim(), platform: String(item.platform || '').trim(),
    status, pipelineStatus: status, reviewDecision,
    resumeReportedAt: dateKey(item.resumeReportedAt), directorRequestedAt: dateKey(item.directorRequestedAt), interviewDate: dateKey(item.interviewDate),
    interviewTime: String(item.interviewTime || '').trim(), lastContactAt: dateKey(item.lastContactAt), nextContactAt: dateKey(item.nextContactAt),
    contactChannel: String(item.contactChannel || '전화').trim() || '전화',
    contactLogs: Array.isArray(item.contactLogs) ? item.contactLogs.map(log => ({ at: String(log?.at || '').trim(), channel: String(log?.channel || '').trim(), summary: String(log?.summary || '').trim() })).filter(log => log.at || log.channel || log.summary) : [],
    guidanceTemplates: normalizeGuidanceTemplates(item.guidanceTemplates),
    comments: normalizeRecruitingComments(item.comments),
    jobPostTitle: String(item.jobPostTitle || '').trim(), note: String(item.note || '').trim(),
    createdAt: String(item.createdAt || now).trim(), updatedAt: String(item.updatedAt || item.createdAt || now).trim()
  };
}

export function recruitingComment(item = {}, fallbackId = '', now = new Date().toISOString()) {
  return {
    id: String(item.id || fallbackId || newId()).trim(),
    createdAt: String(item.createdAt || now).trim(),
    content: String(item.content || item.memo || '').trim().slice(0, 1000),
    authorUid: String(item.authorUid || '').trim().slice(0, 160),
    authorName: String(item.authorName || item.author || '').trim().slice(0, 120)
  };
}

function normalizeRecruitingComments(input) {
  const source = Array.isArray(input) ? input : Object.entries(input && typeof input === 'object' ? input : {}).map(([id, item]) => ({ id, ...item }));
  return source.map((item, index) => recruitingComment(item, `comment_${index}`))
    .filter(item => item.content)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 100);
}

export function compareApplicants(left, right) {
  const leftDate = String(left.interviewDate || left.nextContactAt || left.updatedAt || '');
  const rightDate = String(right.interviewDate || right.nextContactAt || right.updatedAt || '');
  if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
  if (left.interviewTime !== right.interviewTime) return left.interviewTime.localeCompare(right.interviewTime);
  return left.applicantName.localeCompare(right.applicantName, 'ko');
}

function workerNames(input) {
  const seen = new Set();
  return (Array.isArray(input) ? input : []).map(canonicalWorker).filter(name => {
    const key = workerKey(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function memoOrder(value, stamp) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  const parsed = Date.parse(String(stamp || ''));
  return Number.isFinite(parsed) ? parsed * 1000 : 0;
}

function normalizeGuidanceTemplates(input) {
  return (Array.isArray(input) ? input : []).map((template, index) => {
    let stage = HR_STATUS_ALIASES[String(template?.stage || template?.title || '면접 조율').trim()] || String(template?.stage || template?.title || '면접 조율').trim();
    if (!HR_STATUSES.includes(stage)) stage = '면접 조율';
    return { id: String(template?.id || `template_${index}`).trim(), title: String(template?.title || '안내 멘트').trim() || '안내 멘트', stage, channel: String(template?.channel || '문자').trim() || '문자', message: String(template?.message || '').trim() };
  }).filter(template => template.message);
}
