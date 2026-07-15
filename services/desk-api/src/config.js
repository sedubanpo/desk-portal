const DEFAULT_PRODUCTION_ORIGINS = ['https://sedubanpo.github.io'];
const DEFAULT_PAYROLL_SPREADSHEET_ID = '1RelndJgXn0yMNSg41Pyy1yDV6zjehG2ljMuue5pod1E';
const DEFAULT_DESK_CALENDAR_ID = '1c960de1d4c701250e80f19416579958fc3e58d3b04effe3678a6b8643b0acbd@group.calendar.google.com';

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const configuredOrigins = splitCsv(env.ALLOWED_ORIGINS);

  return {
    environment: env.NODE_ENV || 'development',
    port: Number(env.PORT) || 8080,
    projectId: env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || '',
    legacyRtdbUrl: String(env.LEGACY_RTDB_URL || '').trim().replace(/\/+$/, ''),
    payrollSpreadsheetId: String(env.PAYROLL_SPREADSHEET_ID || DEFAULT_PAYROLL_SPREADSHEET_ID).trim(),
    deskCalendarId: String(env.DESK_CALENDAR_ID || DEFAULT_DESK_CALENDAR_ID).trim(),
    workspaceServiceAccountEmail: String(env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT || '').trim(),
    allowedOrigins: configuredOrigins.length
      ? configuredOrigins
      : production
        ? DEFAULT_PRODUCTION_ORIGINS
        : [...DEFAULT_PRODUCTION_ORIGINS, 'http://localhost:3000', 'http://localhost:8080'],
    checkRevokedTokens: env.CHECK_REVOKED_TOKENS !== 'false'
  };
}
