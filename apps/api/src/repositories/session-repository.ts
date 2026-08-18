import type { Collection, Db } from 'mongodb';
import type { SessionRecord } from '../domain/user.js';
import type { SessionRepository } from './contracts.js';
export class MongoSessionRepository implements SessionRepository {
  private readonly collection: Collection<SessionRecord>;
  constructor(db: Db) {
    this.collection = db.collection<SessionRecord>('sessions');
  }
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex(
      { tokenHash: 1 },
      { unique: true, name: 'unique_token_hash' },
    );
    await this.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'session_expiry' },
    );
  }
  async create(session: SessionRecord): Promise<void> {
    await this.collection.insertOne(session);
  }
  async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.collection.findOne({ tokenHash });
  }
  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.collection.deleteOne({ tokenHash });
  }
}
