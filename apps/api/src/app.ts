import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config/env.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import type { Repositories } from './repositories/contracts.js';
import { registerAuthRoutes } from './routes/auth-routes.js';
import { registerDocumentRoutes } from './routes/document-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { registerReportRoutes } from './routes/report-routes.js';
import { AuthService } from './services/auth-service.js';
import { DocumentService } from './services/document-service.js';
import { HealthService } from './services/health-service.js';
import { ReportService } from './services/report-service.js';

export async function buildApp(
  config: Pick<AppConfig, 'LOG_LEVEL' | 'WEB_ORIGIN' | 'SESSION_SECRET'>,
  repositories?: Repositories,
  pingDb?: () => Promise<boolean>,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    bodyLimit: 1_048_576,
  });

  registerErrorHandler(app);

  const allowedOrigins = config.WEB_ORIGIN.split(',').map((origin) => origin.trim());
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow server-to-server or requests without Origin header (e.g. mobile, curl)
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true);
        return;
      }
      cb(new Error('Origin not allowed by CORS.'), false);
    },
    credentials: true,
  });

  const healthService = new HealthService(pingDb);
  // Expose health check both at root /health and /api/health
  await app.register(registerHealthRoutes, { prefix: '', healthService });
  await app.register(registerHealthRoutes, { prefix: '/api', healthService });

  if (repositories) {
    const auth = new AuthService(repositories, config.SESSION_SECRET);
    const documents = new DocumentService(repositories.documents);
    const reports = new ReportService(repositories.documents);
    await app.register(registerAuthRoutes, { prefix: '/api/auth', service: auth });
    await app.register(registerDocumentRoutes, { prefix: '/api/documents', auth, documents });
    await app.register(registerReportRoutes, { prefix: '/api/reports', auth, reports });
  }

  return app;
}
