# System Architecture

## Architecture Overview

The workspace is organized as a TypeScript monorepo with strict separation of concerns:

- `apps/web`: Next.js App Router frontend application.
- `apps/api`: Fastify REST API with layered architecture (Routes -> Middlewares/Handlers -> Services -> Repositories -> MongoDB).
- `packages/shared`: Pure domain models, contracts, and calculation engine. Business rules and pricing formulas are deterministic and shared across layers without external dependencies.

---

## Core System Features & Architecture

### 1. Authentication & Password Security

- **Password Hashing**: Uses **Argon2id** (via the `argon2` library) with recommended memory and iteration parameters. Passwords are never stored in plaintext or logged.
- **Signup & Login**: `/api/auth/signup` and `/api/auth/login` validate credentials with Zod (`email` normalized to lowercase/trimmed, `password` min 8 chars). Duplicate signups are rejected with HTTP 409 `EMAIL_IN_USE`.
- **Identity Retrieval**: `/api/auth/me` returns the authenticated user record (excluding password hash) for valid session bearer tokens.

### 2. Session Management

- **Token Representation**: Cryptographically secure 256-bit random tokens (`randomBytes(32).toString('base64url')`).
- **Storage & Invalidation**: Raw tokens are never stored in the database. The server hashes the token using `HMAC-SHA-256(SESSION_SECRET, token)` and persists session records (`userId`, `tokenHash`, `createdAt`, `expiresAt`) in MongoDB's `sessions` collection.
- **Lifecycle & Expiry**: Sessions are valid for 7 days. MongoDB TTL index (`{ expiresAt: 1 }, { expireAfterSeconds: 0 }`) automatically purges expired sessions, and application logic checks expiration on every request.
- **Logout**: `/api/auth/logout` explicitly deletes the session record from the repository, invalidating the token immediately.
- **Persistence**: Sessions survive server restarts because session state is persisted in MongoDB.

### 3. Repository Architecture & Dependency Injection

- **Contracts**: Repository interfaces are defined in [apps/api/src/repositories/contracts.ts](file:///c:/Users/habin/OneDrive/Desktop/multi-calci/apps/api/src/repositories/contracts.ts) (`UserRepository`, `SessionRepository`, `DocumentRepositoryContract`).
- **Production Runtime**: Production runs against real MongoDB collections via `MongoUserRepository`, `MongoSessionRepository`, and `DocumentRepository`. In [apps/api/src/server.ts](file:///c:/Users/habin/OneDrive/Desktop/multi-calci/apps/api/src/server.ts), MongoDB indexes are ensured at startup (`ensureIndexes()`) and repositories are injected into `buildApp(config, repositories)`.
- **Testing**: Unit tests and fast integration tests use `MemoryRepositories` matching the exact repository contracts. Comprehensive end-to-end repository tests run against a real MongoDB instance via `mongodb-memory-server` in [apps/api/test/mongodb-repositories.test.ts](file:///c:/Users/habin/OneDrive/Desktop/multi-calci/apps/api/test/mongodb-repositories.test.ts).

### 4. Per-User Document Ownership & Access Control

- **Strict Scoping**: Every document operation (read, list, create, update, delete, finalize) requires an authenticated session and is scoped strictly to the authenticated `ownerId`.
- **Enumeration Prevention**: If User B attempts to access, update, delete, or finalize a document owned by User A, the API returns `404 DOCUMENT_NOT_FOUND` rather than `403 Forbidden`, preventing resource enumeration or ownership leakage.
- **Listing Isolation**: `GET /api/documents` queries strictly by `ownerId` and returns only documents belonging to the authenticated user.

### 5. Server-Side Calculation Authority

- **Source of Truth**: The server ignores any client-supplied totals (e.g. `totals.grandTotalCents`).
- **Calculation Engine**: Raw line items are passed to `calculateLineItem` and `calculateDocumentTotals` in [packages/shared/src/calculation.ts](file:///c:/Users/habin/OneDrive/Desktop/multi-calci/packages/shared/src/calculation.ts).
- **Precision & Rounding**: Money amounts are parsed into integer cents; tax and discount percentages are parsed into basis points. Half-up rounding is applied per line item to prevent floating-point drift, and document totals are computed by summing the rounded line items.

### 6. Document Lifecycle & Finalization Immutability

- **Lifecycle States**: Documents are created in `draft` status. Calling `POST /api/documents/:id/finalize` transitions the document to `finalized` and records `finalizedAt`.
- **Immutability Enforcement**: Once finalized, documents cannot be mutated through any endpoint. Attempts to:
  - Update document metadata (`PUT` or `PATCH /api/documents/:id`)
  - Replace line items or document contents (`PUT` or `PATCH /api/documents/:id`)
  - Delete document (`DELETE /api/documents/:id`)
  - Re-finalize document (`POST /api/documents/:id/finalize`)
    all fail with HTTP 409 `DOCUMENT_FINALIZED`.
- **Atomic Operations**: In the MongoDB repository, updates and finalization use atomic queries filtering on `{ _id: id, ownerId: ownerId, status: 'draft' }`, preventing race conditions.

### 7. Reporting & Server-Side Aggregation

- **Endpoint**: `GET /api/reports/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- **Output**: Returns `{ report: { startDate, endDate, documentCount, totals: { subtotalCents, totalDiscountCents, totalTaxCents, grandTotalCents } } }`.
- **Validation**: Strict ISO `YYYY-MM-DD` calendar date validation and range check (`startDate <= endDate`).
- **Authoritative Aggregation**: Computed via MongoDB aggregation pipeline strictly matching `{ ownerId, issueDate: { $gte: startDate, $lte: endDate } }`.

### 8. MongoDB Indexing Rationale

1. **`users` collection**:
   - `{ email: 1 }` (unique): Ensures unique email per account and constant-time lookup during login and registration.
2. **`sessions` collection**:
   - `{ tokenHash: 1 }` (unique): Fast constant-time session retrieval and uniqueness guarantee for session tokens.
   - `{ expiresAt: 1 }` (`expireAfterSeconds: 0`): Native MongoDB TTL background worker for automatic cleanup of expired sessions.
3. **`documents` collection**:
   - `{ ownerId: 1, issueDate: -1 }`: Optimizes owner-scoped range filtering for date reports (`GET /api/reports/summary`) and sorting by issue date.
   - `{ ownerId: 1, status: 1, updatedAt: -1 }`: Optimizes owner-scoped document listing (`GET /api/documents`) and status-based draft/finalized queries.

### 9. Unified API Error Format

All errors follow a standard JSON envelope:

```json
{
  "error": {
    "code": "DOCUMENT_FINALIZED",
    "message": "Finalized documents cannot be changed.",
    "details": {}
  }
}
```

HTTP status codes strictly reflect the error type:

- `400 Bad Request`: Validation failure, malformed ID, invalid date range, or invalid financial amounts.
- `401 Unauthorized`: Missing, expired, or invalid session token, or wrong login credentials.
- `404 Not Found`: Non-existent or non-owned resource (prevents enumeration).
- `409 Conflict`: Email already in use, or mutation attempted on finalized document.
- `500 Internal Server Error`: Unexpected server error with sanitized payload.

### 10. Production Deployment & AWS Infrastructure (Stage 7)

- **Container Architecture**:
  - `Dockerfile.api`: Multi-stage Alpine container for the Fastify API exposing port 4000.
  - `Dockerfile.web`: Multi-stage Next.js frontend container.
- **AWS Target Options**:
  - **AWS App Runner** (`apprunner.yaml`): Fully managed container deployment with automatic TLS, scaling, and secrets integration via AWS Secrets Manager.
  - **AWS ECS Fargate / Elastic Beanstalk**: Reproducible container orchestration using `docker-compose.prod.yml`.
- **Health Checks**:
  - `GET /health` (root) and `GET /api/health` expose service uptime, timestamp, and live MongoDB ping status (`database: 'connected'`).
- **CORS Configuration**:
  - Supports multi-origin whitelisting via comma-separated `WEB_ORIGIN` string, rejecting unauthorized domains.
- **Continuous Integration**:
  - GitHub Actions workflow (`.github/workflows/ci.yml`) executes format checks, linting, typechecking, test suites, and production builds on all pushes and pull requests.
