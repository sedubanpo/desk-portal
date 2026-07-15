import { randomUUID } from 'node:crypto';
import { GoogleAuth, Impersonated } from 'google-auth-library';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const WORKSPACE_SCOPES = Object.freeze([SHEETS_SCOPE, CALENDAR_SCOPE]);

function quoteSheetTitle(value) {
  return `'${String(value || '').replaceAll("'", "''")}'`;
}

function dateKey(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function calendarRange(key) {
  const start = new Date(`${key}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function clock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

function normalizeCalendarEvent(event = {}) {
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = event.start?.dateTime || (event.start?.date ? `${event.start.date}T00:00:00+09:00` : '');
  const end = event.end?.dateTime || (event.end?.date ? `${event.end.date}T00:00:00+09:00` : '');
  const title = String(event.summary || '제목 없음').trim();
  if (!title || /에스학원\s*대치관/.test(title)) return null;
  return {
    id: `calendar_${String(event.id || randomUUID()).replace(/[^\w-]/g, '_')}`,
    source: 'calendar',
    sourceLabel: '반포관 데스크',
    title,
    start,
    end,
    allDay,
    timeLabel: allDay ? '종일' : `${clock(start)} - ${clock(end)}`
  };
}

function compareEvents(a, b) {
  if (Boolean(a.allDay) !== Boolean(b.allDay)) return a.allDay ? -1 : 1;
  return String(a.start || '').localeCompare(String(b.start || '')) || String(a.title || '').localeCompare(String(b.title || ''), 'ko');
}

function apiError(error, label) {
  const status = error?.response?.status || error?.code || 0;
  const detail = error?.response?.data?.error?.message || error?.message || String(error);
  const wrapped = new Error(`${label}: ${detail}`);
  wrapped.status = Number(status) || 0;
  return wrapped;
}

export function createGoogleWorkspaceReader({
  spreadsheetId,
  calendarId,
  serviceAccountEmail,
  auth = createWorkspaceAuth(serviceAccountEmail)
}) {
  if (!spreadsheetId) throw new TypeError('spreadsheetId is required.');

  let clientPromise;
  const client = () => {
    if (!clientPromise) clientPromise = auth.getClient();
    return clientPromise;
  };

  async function request(url, params = {}) {
    try {
      const authorized = await client();
      const response = await authorized.request({ url, params });
      return response.data || {};
    } catch (error) {
      throw apiError(error, 'Google Workspace 조회 오류');
    }
  }

  return {
    async listPayrollMonths() {
      const data = await request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`, {
        fields: 'sheets.properties.title'
      });
      return (data.sheets || [])
        .map(item => String(item?.properties?.title || '').trim())
        .filter(title => /^(\d{2}|\d{4})-(\d{2})$/.test(title))
        .sort((a, b) => b.localeCompare(a));
    },

    async readPayrollMonth(monthName) {
      const range = `${quoteSheetTitle(monthName)}!A:M`;
      const data = await request(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
        { valueRenderOption: 'FORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING', majorDimension: 'ROWS' }
      );
      const values = Array.isArray(data.values) ? data.values : [];
      return {
        range: data.range || range,
        headers: (values[0] || []).map(value => String(value || '').replace(/\s+/g, '').toLowerCase()),
        values: values.slice(1)
      };
    },

    async getDeskCalendarEvents(payload = {}) {
      const requestedDate = dateKey(payload.dateKey);
      if (!requestedDate) return { success: false, message: 'dateKey가 올바르지 않습니다.' };
      if (!calendarId) return { success: true, dateKey: requestedDate, sources: { calendar: 0, source: 'none' }, warnings: ['캘린더 ID가 설정되어 있지 않습니다.'], events: [] };
      const range = calendarRange(requestedDate);
      const data = await request(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
        timeZone: 'Asia/Seoul'
      });
      const events = (data.items || []).map(normalizeCalendarEvent).filter(Boolean).sort(compareEvents);
      return {
        success: true,
        dateKey: requestedDate,
        sources: { calendar: events.length, source: 'calendarApi' },
        warnings: [],
        events
      };
    }
  };
}

function createWorkspaceAuth(serviceAccountEmail) {
  const targetPrincipal = String(serviceAccountEmail || '').trim();
  if (!targetPrincipal) return new GoogleAuth({ scopes: WORKSPACE_SCOPES });
  const sourceAuth = new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
  return {
    async getClient() {
      return new Impersonated({
        sourceClient: await sourceAuth.getClient(),
        targetPrincipal,
        targetScopes: WORKSPACE_SCOPES,
        lifetime: 3600
      });
    }
  };
}
