import type { CalculatedLineItem, DocumentStatus, DocumentTotals } from '@multi-rate/shared';

export interface DocumentRecord {
  _id: string;
  ownerId: string;
  title: string;
  customer: string;
  issueDate: Date;
  status: DocumentStatus;
  lineItems: CalculatedLineItem[];
  totals: DocumentTotals;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt?: Date;
}
