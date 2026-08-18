export interface UserRecord {
  _id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}
export interface SessionRecord {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}
