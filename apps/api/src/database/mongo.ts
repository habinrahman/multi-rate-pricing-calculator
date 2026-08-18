import { MongoClient, type Db } from 'mongodb';
import type { AppConfig } from '../config/env.js';

export class MongoDatabase {
  private readonly client: MongoClient;
  private readonly databaseName: string;

  constructor(config: Pick<AppConfig, 'MONGODB_URI' | 'MONGODB_DATABASE'>) {
    this.client = new MongoClient(config.MONGODB_URI);
    this.databaseName = config.MONGODB_DATABASE;
  }

  async connect(): Promise<Db> {
    await this.client.connect();
    return this.client.db(this.databaseName);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
