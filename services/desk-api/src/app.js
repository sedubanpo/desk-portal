import express from 'express';
import { createRequireStaff } from './auth.js';
import { MIGRATION_STATE } from './contracts.js';
import {
  createCorsMiddleware,
  errorHandler,
  notFound,
  requestContext,
  securityHeaders
} from './http.js';

export function createApp({ config, verifyIdToken, loadAccount }) {
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

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
