import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { createAuthenticate, type AuthenticatedRequest } from '../middleware/authentication.js';
import type { AuthService } from '../services/auth-service.js';
import { credentialsSchema } from '../validation/schemas.js';
import { validate } from '../validation/validate.js';
export async function registerAuthRoutes(
  app: FastifyInstance,
  options: { service: AuthService },
): Promise<void> {
  const authenticate = createAuthenticate(options.service);
  app.post('/signup', async (request, reply) => {
    const body = validate<z.infer<typeof credentialsSchema>>(credentialsSchema, request.body);
    return reply.status(201).send(await options.service.signup(body.email, body.password));
  });
  app.post('/login', async (request, reply) => {
    const body = validate<z.infer<typeof credentialsSchema>>(credentialsSchema, request.body);
    return reply.send(await options.service.login(body.email, body.password));
  });
  app.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    await options.service.logout((request as AuthenticatedRequest).token);
    return reply.status(204).send();
  });
  app.get('/me', { preHandler: authenticate }, async (request) => ({
    user: (request as AuthenticatedRequest).user,
  }));
}
