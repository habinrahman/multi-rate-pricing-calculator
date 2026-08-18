export type DocumentStatus = 'draft' | 'finalized';

export * from './calculation.js';

export interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface DocumentIndexRecord {
  ownerId: string;
  issueDate: Date;
  status: DocumentStatus;
}

export interface ReportSummary {
  startDate: string;
  endDate: string;
  documentCount: number;
  totals: import('./calculation.js').DocumentTotals;
}
