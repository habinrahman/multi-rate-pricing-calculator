import {
  calculateDocumentTotals,
  calculateLineItem,
  CalculationError,
  type LineItemInput,
} from '@multi-rate/shared';
import type { DocumentRecord } from '../domain/document.js';
import { AppError } from '../errors/app-error.js';
import { newDocumentId } from '../repositories/document-repository.js';
import type { DocumentRepositoryContract } from '../repositories/contracts.js';

export interface DocumentInput {
  title: string;
  customer: string;
  issueDate: Date;
  lineItems: LineItemInput[];
}
export class DocumentService {
  constructor(private readonly documents: DocumentRepositoryContract) {}
  async create(ownerId: string, input: DocumentInput) {
    return this.documents.create(this.makeDocument(newDocumentId(), ownerId, input, new Date()));
  }
  async list(ownerId: string) {
    return this.documents.listByOwner(ownerId);
  }
  async get(id: string, ownerId: string) {
    const document = await this.documents.findByIdAndOwner(id, ownerId);
    if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
    return document;
  }
  async update(id: string, ownerId: string, input: DocumentInput) {
    const current = await this.get(id, ownerId);
    this.assertDraft(current);
    const updated = this.makeDocument(id, ownerId, input, current.createdAt, new Date());
    const result = await this.documents.replaceDraft(id, ownerId, updated);
    if (!result)
      throw new AppError(409, 'DOCUMENT_FINALIZED', 'Finalized documents cannot be changed.');
    return result;
  }
  async delete(id: string, ownerId: string): Promise<void> {
    const current = await this.get(id, ownerId);
    this.assertDraft(current);
    if (!(await this.documents.deleteDraft(id, ownerId)))
      throw new AppError(409, 'DOCUMENT_FINALIZED', 'Finalized documents cannot be deleted.');
  }
  async finalize(id: string, ownerId: string) {
    const current = await this.get(id, ownerId);
    this.assertDraft(current);
    const result = await this.documents.finalizeDraft(id, ownerId, new Date());
    if (!result) throw new AppError(409, 'DOCUMENT_FINALIZED', 'Document is already finalized.');
    return result;
  }
  private makeDocument(
    id: string,
    ownerId: string,
    input: DocumentInput,
    createdAt: Date,
    updatedAt = createdAt,
  ): DocumentRecord {
    try {
      const lineItems = input.lineItems.map(calculateLineItem);
      return {
        _id: id,
        ownerId,
        title: input.title,
        customer: input.customer,
        issueDate: input.issueDate,
        status: 'draft',
        lineItems,
        totals: calculateDocumentTotals(lineItems),
        createdAt,
        updatedAt,
      };
    } catch (error) {
      if (error instanceof CalculationError) throw new AppError(400, error.code, error.message);
      throw error;
    }
  }
  private assertDraft(document: DocumentRecord): void {
    if (document.status === 'finalized')
      throw new AppError(409, 'DOCUMENT_FINALIZED', 'Finalized documents cannot be changed.');
  }
}
