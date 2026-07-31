import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleWorkspaceReader } from '../src/google-workspace.js';

function fakeAuth() {
  return {
    async getClient() {
      return {
        async request({ url }) {
          if (url.includes('/values/')) {
            return { data: { range: "'26-07'!A:M", values: [['이름', '수업일'], ['학생A', '7/1']] } };
          }
          if (url.includes('/calendar/v3/')) {
            return { data: { items: [{ id: 'event-1', summary: '데스크 회의', start: { dateTime: '2026-07-15T10:00:00+09:00' }, end: { dateTime: '2026-07-15T11:00:00+09:00' } }] } };
          }
          return { data: { sheets: [{ properties: { title: '26-07' } }, { properties: { title: '2027-01' } }, { properties: { title: '메모' } }, { properties: { title: '26-12' } }, { properties: { title: '2025-12' } }, { properties: { title: '26-06' } }] } };
        }
      };
    }
  };
}

test('Google Workspace reader returns payroll months, rows, and normalized calendar events', async () => {
  const reader = createGoogleWorkspaceReader({ spreadsheetId: 'sheet-1', calendarId: 'calendar-1', auth: fakeAuth() });
  assert.deepEqual(await reader.listPayrollMonths(), ['2027-01', '26-12', '26-07', '26-06', '2025-12']);
  assert.deepEqual(await reader.readPayrollMonth('26-07'), {
    range: "'26-07'!A:M",
    headers: ['이름', '수업일'],
    values: [['학생A', '7/1']]
  });
  const calendar = await reader.getDeskCalendarEvents({ dateKey: '2026-07-15' });
  assert.equal(calendar.success, true);
  assert.equal(calendar.sources.source, 'calendarApi');
  assert.deepEqual(calendar.events.map(event => [event.title, event.timeLabel]), [['데스크 회의', '10:00 - 11:00']]);
});
