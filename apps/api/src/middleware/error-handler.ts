import type { FastifyError, FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: { issues: error.issues },
        },
      });
    }

    // Fastify client-side error (malformed JSON, payload too large, invalid content-type, etc.)
    const statusCode = (error as FastifyError).statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: {
          code: (error as FastifyError).code || 'BAD_REQUEST',
          message: error.message || 'The request was invalid.',
          details: {},
        },
      });
    }

    request.log.error(error);
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
  });
}
