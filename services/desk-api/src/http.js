import { randomUUID } from 'node:crypto';

export class ApiError extends Error {
  constructor(status, code, message, options = {}) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function requestContext(req, res, next) {
  const inbound = String(req.get('x-request-id') || '').trim();
  req.requestId = inbound && inbound.length <= 128 ? inbound : randomUUID();
  res.set('x-request-id', req.requestId);
  next();
}

export function securityHeaders(_req, res, next) {
  res.set({
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY'
  });
  next();
}

export function createCorsMiddleware(allowedOrigins) {
  const allowed = new Set(allowedOrigins);

  return function cors(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    if (!allowed.has(origin)) {
      return next(new ApiError(403, 'origin_not_allowed', '허용되지 않은 요청 출처입니다.'));
    }

    res.set({
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'authorization, content-type, x-request-id',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'access-control-max-age': '600',
      vary: 'Origin'
    });

    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  };
}

export function notFound(req, _res, next) {
  next(new ApiError(404, 'route_not_found', `지원하지 않는 API 경로입니다: ${req.method} ${req.path}`));
}

export function errorHandler(error, req, res, _next) {
  const status = error instanceof ApiError ? error.status : 500;
  const code = error instanceof ApiError ? error.code : 'internal_error';
  const message = error instanceof ApiError ? error.message : '요청 처리 중 오류가 발생했습니다.';

  if (status >= 500) {
    console.error(JSON.stringify({
      severity: 'ERROR',
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      code,
      error: error?.message || String(error)
    }));
  }

  res.status(status).json({
    ok: false,
    error: { code, message },
    requestId: req.requestId
  });
}
