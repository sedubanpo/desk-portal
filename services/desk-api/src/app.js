import express from 'express';
import { createRequireStaff } from './auth.js';
import { MIGRATION_STATE } from './contracts.js';
import { DESK_METHODS, DESK_WRITE_METHODS } from './desk/handlers.js';
import { ApiError } from './http.js';
import {
  createCorsMiddleware,
  errorHandler,
  notFound,
  requestContext,
  securityHeaders
} from './http.js';

export function createApp({ config, verifyIdToken, loadAccount, deskHandlers = {}, runIdempotent = async (_context, operation) => operation() }) {
  const app = express();
  const requireStaff = createRequireStaff({ verifyIdToken, loadAccount });

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

  app.post('/v1/desk/:method', requireStaff, async (req, res, next) => {
    const method = String(req.params.method || '').trim();
    if (!DESK_METHODS.has(method) || typeof deskHandlers[method] !== 'function') {
      return next(new ApiError(404, 'desk_method_not_found', '아직 Cloud Run으로 이전되지 않은 데스크 기능입니다.'));
    }
    const execute = () => deskHandlers[method](req.body?.payload ?? req.body ?? {});
    try {
      const response = DESK_WRITE_METHODS.has(method)
        ? await runIdempotent({ uid: req.identity.uid, method, key: req.get('x-idempotency-key') }, execute)
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
