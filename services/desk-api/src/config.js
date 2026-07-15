const DEFAULT_PRODUCTION_ORIGINS = ['https://sedubanpo.github.io'];

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
    allowedOrigins: configuredOrigins.length
      ? configuredOrigins
      : production
        ? DEFAULT_PRODUCTION_ORIGINS
        : [...DEFAULT_PRODUCTION_ORIGINS, 'http://localhost:3000', 'http://localhost:8080'],
    checkRevokedTokens: env.CHECK_REVOKED_TOKENS !== 'false'
  };
}
