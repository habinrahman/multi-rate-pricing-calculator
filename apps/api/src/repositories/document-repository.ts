import { randomUUID } from 'node:crypto';
import type { Collection, Db } from 'mongodb';
import type { DocumentRecord } from '../domain/document.js';
import type { DocumentRepositoryContract } from './contracts.js';

export class DocumentRepository implements DocumentRepositoryContract {
  private readonly collection: Collection<DocumentRecord>;
  constructor(database: Db) {
    this.collection = database.collection<DocumentRecord>('documents');
  }
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ ownerId: 1, issueDate: -1 }, { name: 'owner_issue_date' });
    await this.collection.createIndex(
      { ownerId: 1, status: 1, updatedAt: -1 },
      { name: 'owner_status_updated' },
    );
  }
  async create(document: DocumentRecord): Promise<DocumentRecord> {
    await this.collection.insertOne(document);
    return document;
  }
  async listByOwner(ownerId: string): Promise<DocumentRecord[]> {
    return this.collection.find({ ownerId }).sort({ updatedAt: -1 }).toArray();
  }
  async findByIdAndOwner(id: string, ownerId: string): Promise<DocumentRecord | null> {
    return this.collection.findOne({ _id: id, ownerId });
  }
  async replaceDraft(
    id: string,
    ownerId: string,
    document: DocumentRecord,
  ): Promise<DocumentRecord | null> {
    return this.collection.findOneAndReplace({ _id: id, ownerId, status: 'draft' }, document, {
      returnDocument: 'after',
    });
  }
  async deleteDraft(id: string, ownerId: string): Promise<boolean> {
    return (
      (await this.collection.deleteOne({ _id: id, ownerId, status: 'draft' })).deletedCount === 1
    );
  }
  async finalizeDraft(
    id: string,
    ownerId: string,
    finalizedAt: Date,
  ): Promise<DocumentRecord | null> {
    return this.collection.findOneAndUpdate(
      { _id: id, ownerId, status: 'draft' },
      { $set: { status: 'finalized', finalizedAt, updatedAt: finalizedAt } },
      { returnDocument: 'after' },
    );
  }
  async getReportSummary(
    ownerId: string,
    startDate: Date,
    endDate: Date,
    startDateStr: string,
    endDateStr: string,
  ) {
    const result = await this.collection
      .aggregate<{
        _id: null;
        documentCount: number;
        subtotalCents: number;
        totalDiscountCents: number;
        totalTaxCents: number;
        grandTotalCents: number;
      }>([
        {
          $match: {
            ownerId,
            issueDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            documentCount: { $sum: 1 },
            subtotalCents: { $sum: '$totals.subtotalCents' },
            totalDiscountCents: { $sum: '$totals.totalDiscountCents' },
            totalTaxCents: { $sum: '$totals.totalTaxCents' },
            grandTotalCents: { $sum: '$totals.grandTotalCents' },
          },
        },
      ])
      .toArray();

    const [row] = result;
    if (!row) {
      return {
        startDate: startDateStr,
        endDate: endDateStr,
        documentCount: 0,
        totals: {
          subtotalCents: 0,
          totalDiscountCents: 0,
          totalTaxCents: 0,
          grandTotalCents: 0,
        },
      };
    }

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      documentCount: row.documentCount,
      totals: {
        subtotalCents: row.subtotalCents,
        totalDiscountCents: row.totalDiscountCents,
        totalTaxCents: row.totalTaxCents,
        grandTotalCents: row.grandTotalCents,
      },
    };
  }
}

export function newDocumentId(): string {
  return randomUUID();
}
