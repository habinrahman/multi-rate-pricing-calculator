import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';
import { MongoDatabase } from './database/mongo.js';
import { DocumentRepository } from './repositories/document-repository.js';
import { MongoSessionRepository } from './repositories/session-repository.js';
import { MongoUserRepository } from './repositories/user-repository.js';

const config = loadConfig();
const database = new MongoDatabase(config);
const db = await database.connect();
const documents = new DocumentRepository(db);
const users = new MongoUserRepository(db);
const sessions = new MongoSessionRepository(db);

await Promise.all([documents.ensureIndexes(), users.ensureIndexes(), sessions.ensureIndexes()]);

const pingDb = async (): Promise<boolean> => {
  try {
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
};

const app = await buildApp(config, { documents, users, sessions }, pingDb);

const shutdown = async (): Promise<void> => {
  await app.close();
  await database.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: '0.0.0.0' });
