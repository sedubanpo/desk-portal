import express from 'express';
import { createHash } from 'node:crypto';
import { createRequireStaff } from './auth.js';
import { MIGRATION_STATE } from './contracts.js';
import {
  DESK_ATTENDANCE_ADMIN_METHODS,
  DESK_METHODS,
  DESK_SCHEDULE_WRITE_METHODS,
  DESK_WRITE_METHODS
} from './desk/handlers.js';
import { ApiError } from './http.js';
import { TUITION_METHODS, TUITION_WRITE_METHODS } from './tuition/handlers.js';
import { PAYROLL_METHODS, PAYROLL_WRITE_METHODS } from './payroll/handlers.js';
import { createPayrollAccess } from './payroll/access.js';
import {
  createCorsMiddleware,
  errorHandler,
  notFound,
  requestContext,
  securityHeaders
} from './http.js';

function requestFingerprint(payload) {
  return createHash('sha256').update(JSON.stringify(canonicalJson(payload))).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
}

const SUPPORTED_METHODS = new Set([...DESK_METHODS, ...TUITION_METHODS, ...PAYROLL_METHODS]);
const WRITE_METHODS = new Set([...DESK_WRITE_METHODS, ...TUITION_WRITE_METHODS, ...PAYROLL_WRITE_METHODS]);

export function createApp({ config, verifyIdToken, loadAccount, deskHandlers = {}, runIdempotent = async (_context, operation) => operation(), payrollAccess }) {
  const app = express();
  const requireStaff = createRequireStaff({ verifyIdToken, loadAccount });
  const payrollGate = payrollAccess || createPayrollAccess({
    pin: config.payrollAccessPin,
    secret: config.payrollUnlockSecret,
    ttlSeconds: config.payrollUnlockTtlSeconds
  });

  function hasPayrollPermission(identity) {
    return identity.role === 'ADMIN' || identity.permissions?.canManagePayroll === true;
  }

  function hasSchedulePermission(identity) {
    return identity.role === 'ADMIN' || identity.permissions?.canManageSchedules === true;
  }

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestContext);
  app.use(securityHeaders);
  app.use(createCorsMiddleware(config.allowedOrigins));
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'desk-portal-api',
      revision: process.env.K_REVISION || 'local',
      environment: config.environment,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/v1/me', requireStaff, (req, res) => {
    res.json({ ok: true, user: req.identity });
  });

  app.get('/v1/migration', requireStaff, (_req, res) => {
    res.json({ ok: true, migration: MIGRATION_STATE });
  });

  app.post('/v1/payroll/unlock', requireStaff, (req, res, next) => {
    if (!hasPayrollPermission(req.identity)) {
      return next(new ApiError(403, 'payroll_access_required', '급여 정산 관리 권한이 필요합니다.'));
    }
    const key = `${req.identity.uid}:${req.ip || 'unknown'}`;
    const result = payrollGate.verifyPin(key, req.body?.pin);
    if (!result.ok) {
      if (result.lockedUntil) {
        return next(new ApiError(429, 'payroll_pin_locked', '입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요.'));
      }
      return next(new ApiError(401, 'payroll_pin_invalid', '비밀번호가 올바르지 않습니다.'));
    }
    const unlock = payrollGate.issue(req.identity.uid);
    return res.json({ ok: true, unlockToken: unlock.token, expiresAt: new Date(unlock.expiresAt).toISOString() });
  });

  app.post('/v1/desk/:method', requireStaff, async (req, res, next) => {
    const method = String(req.params.method || '').trim();
    if (!SUPPORTED_METHODS.has(method) || typeof deskHandlers[method] !== 'function') {
      return next(new ApiError(404, 'desk_method_not_found', '아직 Cloud Run으로 이전되지 않은 데스크 기능입니다.'));
    }
    if (PAYROLL_METHODS.includes(method) && !hasPayrollPermission(req.identity)) {
      return next(new ApiError(403, 'payroll_access_required', '급여 정산 관리 권한이 필요합니다.'));
    }
    if (DESK_SCHEDULE_WRITE_METHODS.has(method) && !hasSchedulePermission(req.identity)) {
      return next(new ApiError(403, 'schedule_access_required', '근무표 수정 권한이 필요합니다.'));
    }
    if (DESK_ATTENDANCE_ADMIN_METHODS.has(method) && req.identity.role !== 'ADMIN') {
      return next(new ApiError(403, 'attendance_admin_required', '출퇴근 정정 요청은 관리자만 처리할 수 있습니다.'));
    }
    if (PAYROLL_METHODS.includes(method) && !payrollGate.verify(req.identity.uid, req.get('x-payroll-unlock-token'))) {
      return next(new ApiError(401, 'payroll_unlock_required', '강사 시수 정산 잠금을 다시 풀어 주세요.'));
    }
    const payload = req.body?.payload ?? req.body ?? {};
    const execute = () => deskHandlers[method](payload, req.identity);
    try {
      const response = WRITE_METHODS.has(method)
        ? await runIdempotent({ uid: req.identity.uid, method, key: req.get('x-idempotency-key'), requestFingerprint: requestFingerprint(payload) }, execute)
        : await execute();
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
