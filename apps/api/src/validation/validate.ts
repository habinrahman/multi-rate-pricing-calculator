import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

export function validate<T>(schema: z.ZodTypeAny, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', {
      issues: result.error.issues,
    });
  return result.data as T;
}
