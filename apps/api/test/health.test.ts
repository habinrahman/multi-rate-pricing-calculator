import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('health endpoint', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('returns service status at /api/health and /health root', async () => {
    app = await buildApp(
      {
        LOG_LEVEL: 'error',
        WEB_ORIGIN: 'http://localhost:3000',
        SESSION_SECRET: 'a-very-long-test-session-secret-value',
      },
      undefined,
      async () => true,
    );

    // Root /health
    const rootRes = await app.inject({ method: 'GET', url: '/health' });
    expect(rootRes.statusCode).toBe(200);
    expect(rootRes.json()).toMatchObject({ status: 'ok', database: 'connected' });

    // API /api/health
    const apiRes = await app.inject({ method: 'GET', url: '/api/health' });
    expect(apiRes.statusCode).toBe(200);
    expect(apiRes.json()).toMatchObject({ status: 'ok', database: 'connected' });
  });
});
