import type { ReportSummary } from '@multi-rate/shared';
import type { DocumentRepositoryContract } from '../repositories/contracts.js';

export interface ReportRangeInput {
  startDate: string;
  endDate: string;
}

export class ReportService {
  constructor(private readonly documents: DocumentRepositoryContract) {}

  async getSummary(ownerId: string, input: ReportRangeInput): Promise<ReportSummary> {
    const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${input.endDate}T23:59:59.999Z`);
    return this.documents.getReportSummary(
      ownerId,
      startDate,
      endDate,
      input.startDate,
      input.endDate,
    );
  }
}
