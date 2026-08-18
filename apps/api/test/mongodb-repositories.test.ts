import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, type Db } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DocumentRepository } from '../src/repositories/document-repository.js';
import { MongoSessionRepository } from '../src/repositories/session-repository.js';
import { MongoUserRepository } from '../src/repositories/user-repository.js';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Real MongoDB Repository Integration', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let app: FastifyInstance;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test_db');

    const documentRepo = new DocumentRepository(db);
    const userRepo = new MongoUserRepository(db);
    const sessionRepo = new MongoSessionRepository(db);

    await Promise.all([
      documentRepo.ensureIndexes(),
      userRepo.ensureIndexes(),
      sessionRepo.ensureIndexes(),
    ]);

    app = await buildApp(
      {
        LOG_LEVEL: 'error',
        WEB_ORIGIN: 'http://localhost:3000',
        SESSION_SECRET: 'test-session-secret-32-chars-long-value',
      },
      {
        documents: documentRepo,
        users: userRepo,
        sessions: sessionRepo,
      },
    );
  }, 60000);

  afterAll(async () => {
    await app?.close();
    await client?.close();
    await mongod?.stop();
  });

  it('runs complete auth and document lifecycle against real MongoDB', async () => {
    // 1. Signup
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'mongo_user@example.com', password: 'securePassword123' }),
    });
    expect(signupRes.statusCode).toBe(201);
    const { token, user } = signupRes.json() as {
      token: string;
      user: { id: string; email: string };
    };
    expect(user.email).toBe('mongo_user@example.com');

    // 2. Duplicate signup fails with 409
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'mongo_user@example.com', password: 'securePassword123' }),
    });
    expect(dupRes.statusCode).toBe(409);

    // 3. /me with token
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect((meRes.json() as { user: { email: string } }).user.email).toBe('mongo_user@example.com');

    // 4. Create document
    const docPayload = {
      title: 'MongoDB Invoice',
      customer: 'Mongo Corp',
      issueDate: '2026-08-10',
      lineItems: [
        {
          description: 'Consulting',
          quantity: 3,
          unitPrice: '150.00',
          discount: { percentage: '10' },
          taxRate: '8.25',
        },
      ],
    };
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify(docPayload),
    });
    expect(createRes.statusCode).toBe(201);
    const createdDoc = (
      createRes.json() as {
        document: { _id: string; status: string; totals: { grandTotalCents: number } };
      }
    ).document;
    expect(createdDoc.status).toBe('draft');
    // 3 * 15000 = 45000; 10% discount = 4500; discounted = 40500; tax 8.25% on 40500 = 3341.25 -> 3341 cents; total = 43841
    expect(createdDoc.totals.grandTotalCents).toBe(43841);

    // 5. Update draft document
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/documents/${createdDoc._id}`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({
        ...docPayload,
        title: 'Updated MongoDB Invoice',
      }),
    });
    expect(updateRes.statusCode).toBe(200);
    expect((updateRes.json() as { document: { title: string } }).document.title).toBe(
      'Updated MongoDB Invoice',
    );

    // 6. Finalize document
    const finalizeRes = await app.inject({
      method: 'POST',
      url: `/api/documents/${createdDoc._id}/finalize`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(finalizeRes.statusCode).toBe(200);
    expect(
      (finalizeRes.json() as { document: { status: string; finalizedAt: string } }).document.status,
    ).toBe('finalized');

    // 7. Immutability on finalized document (PUT, PATCH, DELETE, re-finalize all return 409)
    const mutatePutRes = await app.inject({
      method: 'PUT',
      url: `/api/documents/${createdDoc._id}`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify(docPayload),
    });
    expect(mutatePutRes.statusCode).toBe(409);

    const mutatePatchRes = await app.inject({
      method: 'PATCH',
      url: `/api/documents/${createdDoc._id}`,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify(docPayload),
    });
    expect(mutatePatchRes.statusCode).toBe(409);

    const mutateDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${createdDoc._id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(mutateDeleteRes.statusCode).toBe(409);

    const reFinalizeRes = await app.inject({
      method: 'POST',
      url: `/api/documents/${createdDoc._id}/finalize`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reFinalizeRes.statusCode).toBe(409);

    // 8. Cross-user isolation against MongoDB
    const signupUser2 = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'user2@example.com', password: 'securePassword123' }),
    });
    const user2Token = (signupUser2.json() as { token: string }).token;

    const crossGet = await app.inject({
      method: 'GET',
      url: `/api/documents/${createdDoc._id}`,
      headers: { authorization: `Bearer ${user2Token}` },
    });
    expect(crossGet.statusCode).toBe(404);

    const crossPut = await app.inject({
      method: 'PUT',
      url: `/api/documents/${createdDoc._id}`,
      headers: { authorization: `Bearer ${user2Token}`, 'content-type': 'application/json' },
      payload: JSON.stringify(docPayload),
    });
    expect(crossPut.statusCode).toBe(404);

    const crossPatch = await app.inject({
      method: 'PATCH',
      url: `/api/documents/${createdDoc._id}`,
      headers: { authorization: `Bearer ${user2Token}`, 'content-type': 'application/json' },
      payload: JSON.stringify(docPayload),
    });
    expect(crossPatch.statusCode).toBe(404);

    const crossDelete = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${createdDoc._id}`,
      headers: { authorization: `Bearer ${user2Token}` },
    });
    expect(crossDelete.statusCode).toBe(404);

    const crossFinalize = await app.inject({
      method: 'POST',
      url: `/api/documents/${createdDoc._id}/finalize`,
      headers: { authorization: `Bearer ${user2Token}` },
    });
    expect(crossFinalize.statusCode).toBe(404);

    // 9. Report aggregation on real MongoDB
    const reportRes = await app.inject({
      method: 'GET',
      url: '/api/reports/summary?startDate=2026-08-01&endDate=2026-08-31',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reportRes.statusCode).toBe(200);
    const report = (
      reportRes.json() as { report: { documentCount: number; totals: { grandTotalCents: number } } }
    ).report;
    expect(report.documentCount).toBe(1);
    expect(report.totals.grandTotalCents).toBe(43841);

    // User 2 sees 0 documents in report
    const user2ReportRes = await app.inject({
      method: 'GET',
      url: '/api/reports/summary?startDate=2026-08-01&endDate=2026-08-31',
      headers: { authorization: `Bearer ${user2Token}` },
    });
    expect(user2ReportRes.statusCode).toBe(200);
    expect(
      (user2ReportRes.json() as { report: { documentCount: number } }).report.documentCount,
    ).toBe(0);
  });
});
