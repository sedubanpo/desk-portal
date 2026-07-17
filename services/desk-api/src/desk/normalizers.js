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
  const task = {
    id: String(item.id || fallbackId || newId()).trim(),
    dateKey: dateKey(item.dateKey || fallbackDateKey),
    worker: canonicalWorker(item.worker),
    category: String(item.category || '일반').trim(),
    title: String(item.title || '').trim(),
    note: String(item.note || '').trim(),
    completed: Boolean(item.completed),
    unresolvedReason: String(item.unresolvedReason || '').trim(),
    ackWorkers: workerNames(item.ackWorkers),
    hiddenFromWorkerBand: Boolean(item.hiddenFromWorkerBand),
    sortOrder: finiteNumber(item.sortOrder),
    targetWorkers: workerNames(item.targetWorkers),
    createdAt: String(item.createdAt || now).trim(),
    updatedAt: String(item.updatedAt || item.createdAt || now).trim()
  };
  if (task.completed) task.unresolvedReason = '';
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

const DEFAULT_CONSUMABLES = [
  { id: 'wet_tissue', itemName: '물티슈', productName: '데스크용 물티슈 100매', qty: 6, maxQty: 10, safetyQty: 4, unit: '개' },
  { id: 'box_tissue', itemName: '곽티슈', productName: '클리넥스 200매', qty: 12, maxQty: 20, safetyQty: 8, unit: '개' },
  { id: 'paper_cup', itemName: '종이컵', productName: '테이크아웃컵 1줄', qty: 5, maxQty: 8, safetyQty: 3, unit: '줄' },
  { id: 'trash_bag', itemName: '쓰레기봉투', productName: '20L 검정봉투', qty: 3, maxQty: 6, safetyQty: 2, unit: '묶음' },
  { id: 'sanitizer', itemName: '손소독제', productName: '대용량 리필 500ml', qty: 2, maxQty: 5, safetyQty: 2, unit: '병' },
  { id: 'marker', itemName: '보드마카', productName: '화이트보드 마카 세트', qty: 4, maxQty: 8, safetyQty: 3, unit: '세트' }
];
const DEFAULT_ASSETS = [
  { id: 'asset_desktop_1', type: '데스크탑', productName: 'DELL OptiPlex 데스크 PC', location: '반포관 데스크', manager: '데스크 공용', status: '정상', note: '학생 등록 및 결제 업무용' },
  { id: 'asset_tablet_1', type: '태블릿', productName: 'iPad Air 5세대', location: '상담 테이블', manager: '상담용 공용', status: '정상', note: '학부모 상담 및 안내 자료' },
  { id: 'asset_printer_1', type: '프린터', productName: 'HP LaserJet Pro', location: '데스크 뒤편', manager: '데스크 공용', status: '점검 필요', note: '토너 잔량 확인 필요' }
];

export function supplyConsumable(item = {}, fallbackId = '') {
  const maxQty = Math.max(1, Number(item.maxQty || 1));
  return {
    id: String(item.id || fallbackId || `desk_supply_${newId().slice(0, 8)}`).trim(),
    itemName: String(item.itemName || '품목명').trim(),
    productName: String(item.productName || '제품명 미입력').trim(),
    qty: Math.max(0, Math.min(maxQty, Number(item.qty || 0))),
    maxQty,
    safetyQty: Math.max(0, Math.min(maxQty, Number(item.safetyQty || 0))),
    unit: String(item.unit || '개').trim()
  };
}

export function supplyAsset(item = {}, fallbackId = '') {
  return {
    id: String(item.id || fallbackId || newId()).trim(),
    type: String(item.type || '기타').trim(),
    productName: String(item.productName || '제품명 미입력').trim(),
    location: String(item.location || '-').trim(),
    manager: String(item.manager || '-').trim(),
    status: String(item.status || '정상').trim(),
    note: String(item.note || '').trim()
  };
}

export function suppliesData(stored) {
  const data = stored && typeof stored === 'object' ? stored : {};
  const consumablesSource = Array.isArray(data.consumables) && data.consumables.length ? data.consumables : DEFAULT_CONSUMABLES;
  const assetsSource = Array.isArray(data.assets) && data.assets.length ? data.assets : DEFAULT_ASSETS;
  const consumables = consumablesSource.map((item, index) => supplyConsumable(item, item?.id || `desk_supply_${index}`));
  const assets = assetsSource.map((item, index) => supplyAsset(item, item?.id || `desk_asset_${index}`));
  return {
    consumables,
    assets,
    purchaseSelections: supplySelections(data.purchaseSelections, consumables),
    purchaseCustomRequests: Array.isArray(data.purchaseCustomRequests) ? structuredClone(data.purchaseCustomRequests) : [],
    purchaseRequestTarget: String(data.purchaseRequestTarget || '대표님').trim() || '대표님',
    purchaseRequestNote: String(data.purchaseRequestNote || '').trim()
  };
}

export function supplySelections(input, consumables) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.fromEntries(consumables.map(item => {
    const current = source[item.id] && typeof source[item.id] === 'object' ? source[item.id] : {};
    const recommended = Math.max(1, Number(item.maxQty || 1) - Number(item.qty || 0));
    return [item.id, {
      selected: typeof current.selected === 'boolean' ? current.selected : Number(item.qty || 0) <= Number(item.safetyQty || 0),
      requestQty: Math.max(1, Number(current.requestQty || recommended))
    }];
  }));
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
