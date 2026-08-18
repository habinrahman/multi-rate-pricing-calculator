export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  database?: 'connected' | 'disconnected';
}

export class HealthService {
  constructor(private readonly pingDb?: () => Promise<boolean>) {}

  async getHealth(): Promise<HealthResponse> {
    let databaseStatus: 'connected' | 'disconnected' | undefined = undefined;
    if (this.pingDb) {
      try {
        const isOk = await this.pingDb();
        databaseStatus = isOk ? 'connected' : 'disconnected';
      } catch {
        databaseStatus = 'disconnected';
      }
    }

    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      ...(databaseStatus ? { database: databaseStatus } : {}),
    };
  }
}
