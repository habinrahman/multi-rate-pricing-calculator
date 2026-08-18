import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HealthService } from '../services/health-service.js';

export function createHealthHandler(service: HealthService) {
  return async function healthHandler(_request: FastifyRequest, reply: FastifyReply) {
    const health = await service.getHealth();
    return reply.status(200).send(health);
  };
}
