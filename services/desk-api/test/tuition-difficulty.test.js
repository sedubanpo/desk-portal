import test from 'node:test';
import assert from 'node:assert/strict';
import {createTuitionHandlers} from '../src/tuition/handlers.js';
import {gradeDifficulty} from '../src/tuition/difficulty.js';

test('fees and changed slots independently affect difficulty', () => {
  const old = new Map([['morning', 1]]);
  const moved = new Map([['evening', 1]]);
  assert.equal(gradeDifficulty(500000, old, old).grade, 'C');
  assert.equal(gradeDifficulty(2000000, old, old).grade, 'B');
  assert.equal(gradeDifficulty(500000, old, moved).grade, 'A');
  assert.equal(gradeDifficulty(2000000, old, moved).grade, 'S');
  assert.match(gradeDifficulty(0, old, moved).reason, /전월 수강료/);
  assert.match(gradeDifficulty(500000, undefined, moved).reason, /전월 시간표/);
  assert.match(gradeDifficulty(500000, old, undefined).reason, /선택한 달/);
});

test('January compares December tuition and published schedules, respects draft deletion and links', async () => {
  const reads=[];
  const lesson = (id, date) => ({id,date,start:'09:00',end:'10:00',teacher:'강사',className:'수학'});
  const store = {
    async get(path) {
      assert.match(path,/26-12s$/);
      return {success:true,rows:[{studentName:'학생',collectedAmount:1000000},{studentName:'신규'}]};
    },
    async list() {return [{studentName:'학생',studentId:'one'}];},
    async listWhere(collection, field, op, month) {
      if (collection==='students') return [];
      reads.push(month);
      const dates = month==='2026-12' ? [7,14,21,28] : [4,11,18,25];
      const lessons=dates.map(day=>lesson(String(day),month+'-'+String(day).padStart(2,'0')));
      const extra=lesson('삭제',month+'-01');
      if(collection==='intranetStudentPeriods') return [{studentId:'one',lessons: month==='2027-01' ? [...lessons,extra] : lessons}];
      if(collection==='intranetLessonDrafts' && month==='2027-01') return [{lesson:{...extra,studentId:'one',deletedAt:'2027-01-01'}}];
      return [];
    }
  };
  const api=createTuitionHandlers({store});
  const data=await api.getTuitionDifficulty({monthName:'27-01s'});
  assert.equal(data.success,true, data.message);
  assert.deepEqual(data.grades['학생'],{grade:'C'});
  assert.match(data.grades['신규'].reason,/전월 수강료/);
  assert.deepEqual(new Set(reads),new Set(['2026-12','2027-01']));
});
