import type { FastifyInstance } from 'fastify';
import { createHealthHandler } from '../handlers/health-handler.js';
import { HealthService } from '../services/health-service.js';

export async function registerHealthRoutes(
  app: FastifyInstance,
  options?: { healthService?: HealthService },
): Promise<void> {
  const service = options?.healthService ?? new HealthService();
  app.get('/health', createHealthHandler(service));
}
