import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import type { UserRecord } from '../domain/user.js';
import { AppError } from '../errors/app-error.js';
import type { Repositories } from '../repositories/contracts.js';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;
const hashToken = (token: string, secret: string) =>
  createHash('sha256').update(`${secret}:${token}`).digest('hex');
const publicUser = (user: UserRecord) => ({
  id: user._id,
  email: user.email,
  createdAt: user.createdAt,
});

export class AuthService {
  constructor(
    private readonly repositories: Pick<Repositories, 'users' | 'sessions'>,
    private readonly secret: string,
  ) {}
  async signup(email: string, password: string) {
    const existing = await this.repositories.users.findByEmail(email);
    if (existing)
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    const passwordHash = await hashPassword(password);
    const user = await this.repositories.users.create(email, passwordHash);
    return { user: publicUser(user), token: await this.createSession(user._id) };
  }
  async login(email: string, password: string) {
    const user = await this.repositories.users.findByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash)))
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    return { user: publicUser(user), token: await this.createSession(user._id) };
  }
  async logout(token: string): Promise<void> {
    await this.repositories.sessions.deleteByTokenHash(hashToken(token, this.secret));
  }
  async authenticatedUser(token: string) {
    const session = await this.repositories.sessions.findByTokenHash(hashToken(token, this.secret));
    if (!session || session.expiresAt <= new Date())
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    const user = await this.repositories.users.findById(session.userId);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    return publicUser(user);
  }
  private async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.repositories.sessions.create({
      _id: randomUUID(),
      userId,
      tokenHash: hashToken(token, this.secret),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    });
    return token;
  }
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}
async function verifyPassword(password: string, record: string): Promise<boolean> {
  try {
    return await argon2.verify(record, password);
  } catch {
    return false;
  }
}
