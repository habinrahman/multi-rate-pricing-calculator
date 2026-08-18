import type { FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error.js';
import type { AuthService } from '../services/auth-service.js';
export interface AuthenticatedRequest extends FastifyRequest {
  user: { id: string; email: string; createdAt: Date };
  token: string;
}
export function createAuthenticate(service: AuthService) {
  return async (request: FastifyRequest): Promise<void> => {
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    const user = await service.authenticatedUser(token);
    Object.assign(request, { user, token });
  };
}
