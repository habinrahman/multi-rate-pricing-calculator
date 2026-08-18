import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DocumentRecord } from '../src/domain/document.js';
import type { SessionRecord, UserRecord } from '../src/domain/user.js';
import { buildApp } from '../src/app.js';
import type { Repositories } from '../src/repositories/contracts.js';

class MemoryRepositories implements Repositories {
  users = {
    values: [] as UserRecord[],
    ensureIndexes: async () => {},
    findByEmail: async (email: string) =>
      this.users.values.find((user) => user.email === email) ?? null,
    findById: async (id: string) => this.users.values.find((user) => user._id === id) ?? null,
    create: async (email: string, passwordHash: string) => {
      const user = { _id: randomUUID(), email, passwordHash, createdAt: new Date() };
      this.users.values.push(user);
      return user;
    },
  };
  sessions = {
    values: [] as SessionRecord[],
    ensureIndexes: async () => {},
    create: async (session: SessionRecord) => {
      this.sessions.values.push(session);
    },
    findByTokenHash: async (tokenHash: string) =>
      this.sessions.values.find((session) => session.tokenHash === tokenHash) ?? null,
    deleteByTokenHash: async (tokenHash: string) => {
      this.sessions.values = this.sessions.values.filter(
        (session) => session.tokenHash !== tokenHash,
      );
    },
  };
  documents = {
    values: [] as DocumentRecord[],
    ensureIndexes: async () => {},
    create: async (document: DocumentRecord) => {
      this.documents.values.push(document);
      return document;
    },
    listByOwner: async (ownerId: string) =>
      this.documents.values.filter((document) => document.ownerId === ownerId),
    findByIdAndOwner: async (id: string, ownerId: string) =>
      this.documents.values.find(
        (document) => document._id === id && document.ownerId === ownerId,
      ) ?? null,
    replaceDraft: async (id: string, ownerId: string, value: DocumentRecord) => {
      const index = this.documents.values.findIndex(
        (document) =>
          document._id === id && document.ownerId === ownerId && document.status === 'draft',
      );
      if (index < 0) return null;
      this.documents.values[index] = value;
      return value;
    },
    deleteDraft: async (id: string, ownerId: string) => {
      const index = this.documents.values.findIndex(
        (document) =>
          document._id === id && document.ownerId === ownerId && document.status === 'draft',
      );
      if (index < 0) return false;
      this.documents.values.splice(index, 1);
      return true;
    },
    finalizeDraft: async (id: string, ownerId: string, finalizedAt: Date) => {
      const document = this.documents.values.find(
        (value) => value._id === id && value.ownerId === ownerId && value.status === 'draft',
      );
      if (!document) return null;
      document.status = 'finalized';
      document.finalizedAt = finalizedAt;
      document.updatedAt = finalizedAt;
      return document;
    },
    getReportSummary: async (
      ownerId: string,
      startDate: Date,
      endDate: Date,
      startDateStr: string,
      endDateStr: string,
    ) => {
      const docs = this.documents.values.filter(
        (document) =>
          document.ownerId === ownerId &&
          document.issueDate.getTime() >= startDate.getTime() &&
          document.issueDate.getTime() <= endDate.getTime(),
      );
      if (docs.length === 0) {
        return {
          startDate: startDateStr,
          endDate: endDateStr,
          documentCount: 0,
          totals: {
            subtotalCents: 0,
            totalDiscountCents: 0,
            totalTaxCents: 0,
            grandTotalCents: 0,
          },
        };
      }
      return {
        startDate: startDateStr,
        endDate: endDateStr,
        documentCount: docs.length,
        totals: {
          subtotalCents: docs.reduce((sum, d) => sum + d.totals.subtotalCents, 0),
          totalDiscountCents: docs.reduce((sum, d) => sum + d.totals.totalDiscountCents, 0),
          totalTaxCents: docs.reduce((sum, d) => sum + d.totals.totalTaxCents, 0),
          grandTotalCents: docs.reduce((sum, d) => sum + d.totals.grandTotalCents, 0),
        },
      };
    },
  };
}

const payload = {
  title: 'Invoice',
  customer: 'Acme',
  issueDate: '2026-08-10',
  lineItems: [
    {
      description: 'Work',
      quantity: 2,
      unitPrice: '100.00',
      discount: { percentage: '10' },
      taxRate: '5',
    },
  ],
};
const json = (body: unknown) => JSON.stringify(body);
const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const jsonAuth = (token: string) => ({ ...auth(token), 'content-type': 'application/json' });

describe('authentication and document lifecycle', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });
  async function start() {
    app = await buildApp(
      {
        LOG_LEVEL: 'error',
        WEB_ORIGIN: 'http://localhost:3000',
        SESSION_SECRET: 'a-very-long-test-session-secret-value-min-32-chars',
      },
      new MemoryRepositories(),
    );
  }
  async function signup(email: string, password = 'safe-password-123') {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: json({ email, password }),
    });
    return response.json() as { token: string; user: { id: string; email: string } };
  }

  describe('Authentication & Session', () => {
    it('signs up, logs in, retrieves the authenticated user, and logs out', async () => {
      await start();
      const registered = await signup('user@example.com');
      expect(registered.user.email).toBe('user@example.com');
      expect(registered).not.toHaveProperty('passwordHash');

      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: json({ email: 'user@example.com', password: 'safe-password-123' }),
      });
      expect(login.statusCode).toBe(200);
      const token = (login.json() as { token: string }).token;

      expect(
        (await app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(token) })).json(),
      ).toMatchObject({ user: { email: 'user@example.com' } });

      expect(
        (await app.inject({ method: 'POST', url: '/api/auth/logout', headers: auth(token) }))
          .statusCode,
      ).toBe(204);

      expect(
        (await app.inject({ method: 'GET', url: '/api/auth/me', headers: auth(token) })).statusCode,
      ).toBe(401);
    });

    it('rejects duplicate signup with 409 EMAIL_IN_USE', async () => {
      await start();
      await signup('duplicate@example.com');
      const second = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        headers: { 'content-type': 'application/json' },
        payload: json({ email: 'DUPLICATE@example.com', password: 'password-123' }),
      });
      expect(second.statusCode).toBe(409);
      expect((second.json() as { error: { code: string } }).error.code).toBe('EMAIL_IN_USE');
    });

    it('rejects invalid credentials on login', async () => {
      await start();
      await signup('user@example.com', 'correct-password');
      const wrongPass = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: json({ email: 'user@example.com', password: 'wrong-password' }),
      });
      expect(wrongPass.statusCode).toBe(401);

      const nonExistent = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: json({ email: 'nonexistent@example.com', password: 'password-123' }),
      });
      expect(nonExistent.statusCode).toBe(401);
    });

    it('rejects unauthenticated requests to protected endpoints', async () => {
      await start();
      expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/documents' })).statusCode).toBe(401);
      expect(
        (await app.inject({ method: 'GET', url: '/api/auth/me', headers: auth('invalid-token') }))
          .statusCode,
      ).toBe(401);
    });
  });

  describe('Document CRUD & Server-Side Calculations', () => {
    it('ignores client-supplied totals and recalculates authoritatively', async () => {
      await start();
      const user = await signup('user@example.com');
      const maliciousPayload = {
        title: 'Authoritative Test',
        customer: 'Client Corp',
        issueDate: '2026-08-10',
        lineItems: [
          {
            description: 'Item 1',
            quantity: 2,
            unitPrice: '100.00',
            discount: { percentage: '10' },
            taxRate: '5',
          },
        ],
        totals: {
          subtotalCents: 1,
          grandTotalCents: 1,
        },
      };

      const created = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json(maliciousPayload),
      });
      expect(created.statusCode).toBe(201);
      const doc = (created.json() as { document: DocumentRecord }).document;
      // 2 * 10000 = 20000; 10% disc = 2000; discounted = 18000; 5% tax = 900; total = 18900
      expect(doc.totals.subtotalCents).toBe(20000);
      expect(doc.totals.totalDiscountCents).toBe(2000);
      expect(doc.totals.totalTaxCents).toBe(900);
      expect(doc.totals.grandTotalCents).toBe(18900);
    });

    it('supports document updates via both PUT and PATCH', async () => {
      await start();
      const user = await signup('user@example.com');
      const created = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json(payload),
      });
      const id = (created.json() as { document: DocumentRecord }).document._id;

      // PUT update
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/documents/${id}`,
        headers: jsonAuth(user.token),
        payload: json({ ...payload, title: 'PUT Title' }),
      });
      expect(putRes.statusCode).toBe(200);
      expect((putRes.json() as { document: DocumentRecord }).document.title).toBe('PUT Title');

      // PATCH update
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${id}`,
        headers: jsonAuth(user.token),
        payload: json({ ...payload, title: 'PATCH Title' }),
      });
      expect(patchRes.statusCode).toBe(200);
      expect((patchRes.json() as { document: DocumentRecord }).document.title).toBe('PATCH Title');
    });

    it('rejects invalid document inputs', async () => {
      await start();
      const user = await signup('user@example.com');

      // Invalid quantity (0)
      const badQty = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({ ...payload, lineItems: [{ ...payload.lineItems[0], quantity: 0 }] }),
      });
      expect(badQty.statusCode).toBe(400);

      // Invalid issue date format
      const badDate = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({ ...payload, issueDate: '08-10-2026' }),
      });
      expect(badDate.statusCode).toBe(400);

      // Conflicting fixed and percentage discounts
      const badDiscount = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({
          ...payload,
          lineItems: [
            {
              ...payload.lineItems[0],
              discount: { fixed: '10.00', percentage: '10' },
            },
          ],
        }),
      });
      expect(badDiscount.statusCode).toBe(400);

      // Fixed discount exceeding subtotal
      const overDiscount = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({
          ...payload,
          lineItems: [
            {
              description: 'Item',
              quantity: 1,
              unitPrice: '10.00',
              discount: { fixed: '20.00' },
            },
          ],
        }),
      });
      expect(overDiscount.statusCode).toBe(400);

      // Percentage discount > 100%
      const overPercentage = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({
          ...payload,
          lineItems: [
            {
              description: 'Item',
              quantity: 1,
              unitPrice: '10.00',
              discount: { percentage: '110' },
            },
          ],
        }),
      });
      expect(overPercentage.statusCode).toBe(400);
    });
  });

  describe('Document Ownership & Cross-User Authorization', () => {
    it('blocks all cross-user access safely with 404', async () => {
      await start();
      const a = await signup('a@example.com');
      const b = await signup('b@example.com');
      const created = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(a.token),
        payload: json(payload),
      });
      const id = (created.json() as { document: DocumentRecord }).document._id;

      // GET document A by user B
      expect(
        (await app.inject({ method: 'GET', url: `/api/documents/${id}`, headers: auth(b.token) }))
          .statusCode,
      ).toBe(404);

      // PUT document A by user B
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/documents/${id}`,
            headers: jsonAuth(b.token),
            payload: json(payload),
          })
        ).statusCode,
      ).toBe(404);

      // PATCH document A by user B
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/documents/${id}`,
            headers: jsonAuth(b.token),
            payload: json(payload),
          })
        ).statusCode,
      ).toBe(404);

      // Add line to document A by user B
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/documents/${id}`,
            headers: jsonAuth(b.token),
            payload: json({
              ...payload,
              lineItems: [
                ...payload.lineItems,
                { description: 'Added Line', quantity: 1, unitPrice: '50.00' },
              ],
            }),
          })
        ).statusCode,
      ).toBe(404);

      // Delete line from document A by user B
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/documents/${id}`,
            headers: jsonAuth(b.token),
            payload: json({
              ...payload,
              lineItems: [{ description: 'Only Line', quantity: 1, unitPrice: '10.00' }],
            }),
          })
        ).statusCode,
      ).toBe(404);

      // DELETE document A by user B
      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: `/api/documents/${id}`,
            headers: auth(b.token),
          })
        ).statusCode,
      ).toBe(404);

      // Finalize document A by user B
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/documents/${id}/finalize`,
            headers: auth(b.token),
          })
        ).statusCode,
      ).toBe(404);

      // User B document list does not contain document A
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/documents',
        headers: auth(b.token),
      });
      expect(listRes.statusCode).toBe(200);
      expect((listRes.json() as { documents: DocumentRecord[] }).documents).toHaveLength(0);
    });
  });

  describe('Document Finalization & Immutability', () => {
    it('makes finalized documents immutable through EVERY mutation path', async () => {
      await start();
      const user = await signup('user@example.com');
      const created = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json(payload),
      });
      const id = (created.json() as { document: DocumentRecord }).document._id;

      // Finalize document
      const finalized = await app.inject({
        method: 'POST',
        url: `/api/documents/${id}/finalize`,
        headers: auth(user.token),
      });
      expect(finalized.statusCode).toBe(200);
      expect((finalized.json() as { document: DocumentRecord }).document.status).toBe('finalized');

      // 1. Metadata update (PUT) rejected
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/documents/${id}`,
            headers: jsonAuth(user.token),
            payload: json({ ...payload, title: 'New Title' }),
          })
        ).statusCode,
      ).toBe(409);

      // 2. Metadata update (PATCH) rejected
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/api/documents/${id}`,
            headers: jsonAuth(user.token),
            payload: json({ ...payload, customer: 'New Customer' }),
          })
        ).statusCode,
      ).toBe(409);

      // 3. Complete document update rejected
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/documents/${id}`,
            headers: jsonAuth(user.token),
            payload: json(payload),
          })
        ).statusCode,
      ).toBe(409);

      // 4. Add line rejected
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/documents/${id}`,
            headers: jsonAuth(user.token),
            payload: json({
              ...payload,
              lineItems: [
                ...payload.lineItems,
                { description: 'Extra', quantity: 1, unitPrice: '10.00' },
              ],
            }),
          })
        ).statusCode,
      ).toBe(409);

      // 5. Update line rejected
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/documents/${id}`,
            headers: jsonAuth(user.token),
            payload: json({
              ...payload,
              lineItems: [{ description: 'Modified Line', quantity: 5, unitPrice: '200.00' }],
            }),
          })
        ).statusCode,
      ).toBe(409);

      // 6. Delete line rejected
      expect(
        (
          await app.inject({
            method: 'PUT',
            url: `/api/documents/${id}`,
            headers: jsonAuth(user.token),
            payload: json({
              ...payload,
              lineItems: [payload.lineItems[0]],
            }),
          })
        ).statusCode,
      ).toBe(409);

      // 7. Delete document rejected
      expect(
        (
          await app.inject({
            method: 'DELETE',
            url: `/api/documents/${id}`,
            headers: auth(user.token),
          })
        ).statusCode,
      ).toBe(409);

      // 8. Repeated finalize rejected
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/documents/${id}/finalize`,
            headers: auth(user.token),
          })
        ).statusCode,
      ).toBe(409);
    });
  });

  describe('Reporting & Aggregation', () => {
    it('returns empty report when no documents exist in range', async () => {
      await start();
      const user = await signup('reporter@example.com');
      const res = await app.inject({
        method: 'GET',
        url: '/api/reports/summary?startDate=2026-08-01&endDate=2026-08-31',
        headers: auth(user.token),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        report: {
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          documentCount: 0,
          totals: {
            subtotalCents: 0,
            totalDiscountCents: 0,
            totalTaxCents: 0,
            grandTotalCents: 0,
          },
        },
      });
    });

    it('aggregates multiple documents accurately across date range with inclusive boundaries', async () => {
      await start();
      const user = await signup('reporter@example.com');

      // Document 1: on 2026-08-01 (start boundary)
      // Line: qty 1 * 100.00 = 10000, 10% disc = 1000, 5% tax = 450 -> total = 9450
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({
          title: 'Doc 1',
          customer: 'Customer 1',
          issueDate: '2026-08-01',
          lineItems: [
            {
              description: 'Item 1',
              quantity: 1,
              unitPrice: '100.00',
              discount: { percentage: '10' },
              taxRate: '5',
            },
          ],
        }),
      });

      // Document 2: on 2026-08-15 (inside range)
      // Line: qty 2 * 50.00 = 10000, fixed disc 20.00 = 2000, 10% tax = 800 -> total = 8800
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({
          title: 'Doc 2',
          customer: 'Customer 2',
          issueDate: '2026-08-15',
          lineItems: [
            {
              description: 'Item 2',
              quantity: 2,
              unitPrice: '50.00',
              discount: { fixed: '20.00' },
              taxRate: '10',
            },
          ],
        }),
      });

      // Document 3: on 2026-08-31 (end boundary)
      // Line: qty 1 * 200.00 = 20000, no disc = 0, 8.25% tax on 20000 = 1650 -> total = 21650
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({
          title: 'Doc 3',
          customer: 'Customer 3',
          issueDate: '2026-08-31',
          lineItems: [{ description: 'Item 3', quantity: 1, unitPrice: '200.00', taxRate: '8.25' }],
        }),
      });

      // Document 4: on 2026-09-01 (outside range, should NOT be counted)
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({
          title: 'Doc 4',
          customer: 'Customer 4',
          issueDate: '2026-09-01',
          lineItems: [{ description: 'Item 4', quantity: 1, unitPrice: '500.00' }],
        }),
      });

      const reportRes = await app.inject({
        method: 'GET',
        url: '/api/reports/summary?startDate=2026-08-01&endDate=2026-08-31',
        headers: auth(user.token),
      });
      expect(reportRes.statusCode).toBe(200);
      const { report } = reportRes.json() as {
        report: { documentCount: number; totals: Record<string, number> };
      };

      // Subtotals: 10000 + 10000 + 20000 = 40000
      // Discounts: 1000 + 2000 + 0 = 3000
      // Taxes: 450 + 800 + 1650 = 2900
      // Grand Total: 9450 + 8800 + 21650 = 39900
      expect(report.documentCount).toBe(3);
      expect(report.totals.subtotalCents).toBe(40000);
      expect(report.totals.totalDiscountCents).toBe(3000);
      expect(report.totals.totalTaxCents).toBe(2900);
      expect(report.totals.grandTotalCents).toBe(39900);
    });

    it('enforces cross-user isolation for reports', async () => {
      await start();
      const userA = await signup('usera@example.com');
      const userB = await signup('userb@example.com');

      // User A creates a document in range
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(userA.token),
        payload: json({
          title: 'User A Doc',
          customer: 'Cust A',
          issueDate: '2026-08-10',
          lineItems: [{ description: 'A', quantity: 1, unitPrice: '100.00' }],
        }),
      });

      // User B queries report for same date range
      const reportB = await app.inject({
        method: 'GET',
        url: '/api/reports/summary?startDate=2026-08-01&endDate=2026-08-31',
        headers: auth(userB.token),
      });
      expect(reportB.statusCode).toBe(200);
      expect((reportB.json() as { report: { documentCount: number } }).report.documentCount).toBe(
        0,
      );
    });

    it('validates report query parameters and rejects invalid inputs', async () => {
      await start();
      const user = await signup('reporter@example.com');

      // Missing parameters
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/reports/summary',
            headers: auth(user.token),
          })
        ).statusCode,
      ).toBe(400);

      // Invalid date format
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/reports/summary?startDate=2026/08/01&endDate=2026-08-31',
            headers: auth(user.token),
          })
        ).statusCode,
      ).toBe(400);

      // Non-existent calendar date (e.g. Feb 30)
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/reports/summary?startDate=2026-02-30&endDate=2026-03-15',
            headers: auth(user.token),
          })
        ).statusCode,
      ).toBe(400);

      // startDate > endDate
      const invalidRange = await app.inject({
        method: 'GET',
        url: '/api/reports/summary?startDate=2026-08-20&endDate=2026-08-10',
        headers: auth(user.token),
      });
      expect(invalidRange.statusCode).toBe(400);
      expect((invalidRange.json() as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR',
      );
    });
  });

  describe('Hostile Security & Adversarial Attack Audit Suite', () => {
    it('strictly isolates cross-user access and prevents enumeration (User A vs User B)', async () => {
      await start();
      const userA = await signup('alice@example.com');
      const userB = await signup('bob@example.com');

      // User A creates a document
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(userA.token),
        payload: json({
          title: "Alice's Secret Pricing",
          customer: 'Private Client',
          issueDate: '2026-08-10',
          lineItems: [{ description: 'Item 1', quantity: 1, unitPrice: '500.00' }],
        }),
      });
      expect(createRes.statusCode).toBe(201);
      const docId = (createRes.json() as { document: { _id: string } }).document._id;

      // User B attempts to GET Alice's document -> 404 (no enumeration)
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/documents/${docId}`,
        headers: auth(userB.token),
      });
      expect(getRes.statusCode).toBe(404);
      expect((getRes.json() as { error: { code: string } }).error.code).toBe('DOCUMENT_NOT_FOUND');

      // User B attempts to PUT Alice's document -> 404
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/documents/${docId}`,
        headers: jsonAuth(userB.token),
        payload: json({
          title: 'Hacked',
          customer: 'Hacked',
          issueDate: '2026-08-10',
          lineItems: [{ description: 'Item 1', quantity: 1, unitPrice: '1.00' }],
        }),
      });
      expect(putRes.statusCode).toBe(404);

      // User B attempts to PATCH Alice's document -> 404
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${docId}`,
        headers: jsonAuth(userB.token),
        payload: json({
          title: 'Hacked',
          customer: 'Hacked',
          issueDate: '2026-08-10',
          lineItems: [{ description: 'Item 1', quantity: 1, unitPrice: '1.00' }],
        }),
      });
      expect(patchRes.statusCode).toBe(404);

      // User B attempts to DELETE Alice's document -> 404
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/documents/${docId}`,
        headers: auth(userB.token),
      });
      expect(deleteRes.statusCode).toBe(404);

      // User B attempts to FINALIZE Alice's document -> 404
      const finalizeRes = await app.inject({
        method: 'POST',
        url: `/api/documents/${docId}/finalize`,
        headers: auth(userB.token),
      });
      expect(finalizeRes.statusCode).toBe(404);
    });

    it('enforces total immutability on finalized documents against all mutation paths', async () => {
      await start();
      const user = await signup('owner@example.com');

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: jsonAuth(user.token),
        payload: json({
          title: 'Pricing Contract',
          customer: 'Enterprise Client',
          issueDate: '2026-08-10',
          lineItems: [{ description: 'Item', quantity: 2, unitPrice: '100.00' }],
        }),
      });
      const docId = (createRes.json() as { document: { _id: string } }).document._id;

      // Finalize document
      const finalizeRes = await app.inject({
        method: 'POST',
        url: `/api/documents/${docId}/finalize`,
        headers: auth(user.token),
      });
      expect(finalizeRes.statusCode).toBe(200);

      // Attempt repeat finalize -> 409
      const repeatFinalize = await app.inject({
        method: 'POST',
        url: `/api/documents/${docId}/finalize`,
        headers: auth(user.token),
      });
      expect(repeatFinalize.statusCode).toBe(409);
      expect((repeatFinalize.json() as { error: { code: string } }).error.code).toBe(
        'DOCUMENT_FINALIZED',
      );

      // Attempt PUT -> 409
      const putRes = await app.inject({
        method: 'PUT',
        url: `/api/documents/${docId}`,
        headers: jsonAuth(user.token),
        payload: json({
          title: 'Modified',
          customer: 'Modified',
          issueDate: '2026-08-10',
          lineItems: [{ description: 'Item', quantity: 2, unitPrice: '100.00' }],
        }),
      });
      expect(putRes.statusCode).toBe(409);

      // Attempt PATCH -> 409
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${docId}`,
        headers: jsonAuth(user.token),
        payload: json({
          title: 'Modified',
          customer: 'Modified',
          issueDate: '2026-08-10',
          lineItems: [{ description: 'Item', quantity: 2, unitPrice: '100.00' }],
        }),
      });
      expect(patchRes.statusCode).toBe(409);

      // Attempt DELETE -> 409
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/documents/${docId}`,
        headers: auth(user.token),
      });
      expect(deleteRes.statusCode).toBe(409);
    });

    it('handles malformed JSON syntax with standard error envelope', async () => {
      await start();
      const user = await signup('json-tester@example.com');

      const badJsonRes = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: {
          authorization: `Bearer ${user.token}`,
          'content-type': 'application/json',
        },
        payload: '{ "brokenJson": ',
      });

      expect(badJsonRes.statusCode).toBe(400);
      const body = badJsonRes.json() as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(typeof body.error.code).toBe('string');
      expect(typeof body.error.message).toBe('string');
    });

    it('rejects invalid UUID route parameters with standard validation error', async () => {
      await start();
      const user = await signup('uuid-tester@example.com');

      const badUuidRes = await app.inject({
        method: 'GET',
        url: '/api/documents/invalid-uuid-12345',
        headers: auth(user.token),
      });

      expect(badUuidRes.statusCode).toBe(400);
      expect((badUuidRes.json() as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR',
      );
    });
  });
});
