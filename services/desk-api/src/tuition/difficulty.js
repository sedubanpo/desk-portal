import { combineLessons } from '../payroll/intranet.js';
import { createReadCache } from '../payroll/read-cache.js';
import { number, studentName } from './normalizers.js';

// A weekly slot has the same weight in months with four or five occurrences
// of its weekday. Extra lessons and changed times still affect the comparison.
function profiles(month, lessons) {
  const days = new Date(Date.parse(month + '-01T00:00:00Z')).getUTCDay();
  const [year, m] = month.split('-').map(Number);
  const length = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const students = new Map();
  for (const lesson of lessons) {
    if (!lesson.date?.startsWith(month + '-') || lesson.kind === 'study' || !lesson.studentId || !lesson.start || !lesson.end) continue;
    const weekday = new Date(lesson.date + 'T00:00:00Z').getUTCDay();
    if (!Number.isFinite(weekday)) continue;
    const key = JSON.stringify([weekday, lesson.start, lesson.end, lesson.teacher, lesson.className]);
    const slots = students.get(lesson.studentId) || new Map();
    const occurrences = 1 + Math.floor((length - 1 - (weekday - days + 7) % 7) / 7);
    slots.set(key, (slots.get(key) || 0) + 1 / occurrences);
    students.set(lesson.studentId, slots);
  }
  return students;
}

export function gradeDifficulty(amount, previous, current) {
  if (!amount) return {reason:'전월 수강료 기록이 없습니다.'};
  if (!previous?.size) return {reason:'전월 시간표가 없습니다.'};
  if (!current?.size) return {reason:'선택한 달의 시간표가 없습니다.'};
  let common = 0, total = 0;
  for (const key of new Set([...previous.keys(), ...current.keys()])) {
    const a = previous.get(key) || 0, b = current.get(key) || 0;
    common += Math.min(a,b);
    total += Math.max(a,b);
  }
  const change = 1 - common / total;
  const score = 40 * Math.min(amount / 2000000, 1) + 60 * change;
  return {grade:score >= 75 ? 'S' : score >= 50 ? 'A' : score >= 25 ? 'B' : 'C'};
}

export function createScheduleProfiles(store) {
  const cache = createReadCache({ttlMs:60000, maxEntries:6});
  return async (month, forceRefresh) => (await cache.read(month, async () => {
    const sources = await Promise.all(['intranetStudentPeriods','intranetLegacyPeriods','intranetLessonDrafts'].map(
      collection => store.listWhere(collection, 'month', '==', month, 5001)));
    if (sources.some(rows => rows.length > 5000)) throw Error('시간표 조회 한도 초과');
    return profiles(month, combineLessons(...sources));
  }, {forceRefresh})).value;
}

export function difficultyByName(rows, students, links, previous, current) {
  const ids = new Map();
  for (const student of students) {
    const name = studentName(student.name || student.studentName);
    const id = student.canonicalId || student.id;
    if (!ids.has(name)) ids.set(name, id);
    else if (ids.get(name) !== id) ids.set(name, null);
  }
  const manual = new Map(links.map(link => [studentName(link.studentName), link.studentId]));
  return Object.fromEntries(rows.map(row => {
    const name = studentName(row.studentName);
    const id = manual.get(name) || row.studentId || ids.get(name);
    const fee = Math.max(0, number(row.guideAmount)) || Math.max(0, number(row.collectedAmount));
    return [name, !id && fee ? {reason:'시간표의 학생 정보를 연결할 수 없습니다.'} : gradeDifficulty(fee, previous.get(id), current.get(id))];
  }));
}
