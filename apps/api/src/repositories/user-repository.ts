import { randomUUID } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import type { UserRecord } from '../domain/user.js';
import type { UserRepository } from './contracts.js';
export class MongoUserRepository implements UserRepository {
  private readonly collection: Collection<UserRecord>;
  constructor(db: Db) {
    this.collection = db.collection<UserRecord>('users');
  }
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ email: 1 }, { unique: true, name: 'unique_email' });
  }
  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.collection.findOne({ email });
  }
  async findById(id: string): Promise<UserRecord | null> {
    return this.collection.findOne({ _id: id });
  }
  async create(email: string, passwordHash: string): Promise<UserRecord> {
    const user = { _id: randomUUID(), email, passwordHash, createdAt: new Date() };
    await this.collection.insertOne(user);
    return user;
  }
}
