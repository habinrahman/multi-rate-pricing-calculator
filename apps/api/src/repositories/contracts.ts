import type { ReportSummary } from '@multi-rate/shared';
import type { DocumentRecord } from '../domain/document.js';
import type { SessionRecord, UserRecord } from '../domain/user.js';

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(email: string, passwordHash: string): Promise<UserRecord>;
  ensureIndexes(): Promise<void>;
}
export interface SessionRepository {
  create(session: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  ensureIndexes(): Promise<void>;
}
export interface DocumentRepositoryContract {
  create(document: DocumentRecord): Promise<DocumentRecord>;
  listByOwner(ownerId: string): Promise<DocumentRecord[]>;
  findByIdAndOwner(id: string, ownerId: string): Promise<DocumentRecord | null>;
  replaceDraft(
    id: string,
    ownerId: string,
    document: DocumentRecord,
  ): Promise<DocumentRecord | null>;
  deleteDraft(id: string, ownerId: string): Promise<boolean>;
  finalizeDraft(id: string, ownerId: string, finalizedAt: Date): Promise<DocumentRecord | null>;
  getReportSummary(
    ownerId: string,
    startDate: Date,
    endDate: Date,
    startDateStr: string,
    endDateStr: string,
  ): Promise<ReportSummary>;
  ensureIndexes(): Promise<void>;
}
export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  documents: DocumentRepositoryContract;
}
