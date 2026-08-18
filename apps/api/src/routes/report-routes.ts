import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { createAuthenticate, type AuthenticatedRequest } from '../middleware/authentication.js';
import type { AuthService } from '../services/auth-service.js';
import type { ReportService } from '../services/report-service.js';
import { reportQuerySchema } from '../validation/schemas.js';
import { validate } from '../validation/validate.js';

export async function registerReportRoutes(
  app: FastifyInstance,
  options: { auth: AuthService; reports: ReportService },
): Promise<void> {
  const authenticate = createAuthenticate(options.auth);
  const owner = (request: unknown) => (request as AuthenticatedRequest).user.id;

  app.get('/summary', { preHandler: authenticate }, async (request) => {
    const query = validate<z.infer<typeof reportQuerySchema>>(reportQuerySchema, request.query);
    const report = await options.reports.getSummary(owner(request), query);
    return { report };
  });
}
