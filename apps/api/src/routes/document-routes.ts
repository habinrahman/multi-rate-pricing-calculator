import type { FastifyInstance } from 'fastify';
import { createAuthenticate, type AuthenticatedRequest } from '../middleware/authentication.js';
import type { AuthService } from '../services/auth-service.js';
import type { DocumentService } from '../services/document-service.js';
import { documentSchema, idParamSchema } from '../validation/schemas.js';
import { validate } from '../validation/validate.js';

const idParams = (input: unknown): string => validate<{ id: string }>(idParamSchema, input).id;
export async function registerDocumentRoutes(
  app: FastifyInstance,
  options: { auth: AuthService; documents: DocumentService },
): Promise<void> {
  const authenticate = createAuthenticate(options.auth);
  const owner = (request: unknown) => (request as AuthenticatedRequest).user.id;
  app.get('/', { preHandler: authenticate }, async (request) => ({
    documents: await options.documents.list(owner(request)),
  }));
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const body = validate<Parameters<DocumentService['create']>[1]>(documentSchema, request.body);
    return reply
      .status(201)
      .send({ document: await options.documents.create(owner(request), body) });
  });
  app.get('/:id', { preHandler: authenticate }, async (request) => ({
    document: await options.documents.get(idParams(request.params), owner(request)),
  }));
  app.put('/:id', { preHandler: authenticate }, async (request) => {
    const body = validate<Parameters<DocumentService['update']>[2]>(documentSchema, request.body);
    return {
      document: await options.documents.update(idParams(request.params), owner(request), body),
    };
  });
  app.patch('/:id', { preHandler: authenticate }, async (request) => {
    const body = validate<Parameters<DocumentService['update']>[2]>(documentSchema, request.body);
    return {
      document: await options.documents.update(idParams(request.params), owner(request), body),
    };
  });
  app.delete('/:id', { preHandler: authenticate }, async (request, reply) => {
    await options.documents.delete(idParams(request.params), owner(request));
    return reply.status(204).send();
  });
  app.post('/:id/finalize', { preHandler: authenticate }, async (request) => ({
    document: await options.documents.finalize(idParams(request.params), owner(request)),
  }));
}
