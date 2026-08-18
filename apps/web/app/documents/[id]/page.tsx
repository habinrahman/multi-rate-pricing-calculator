'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Lock,
  Trash2,
  CheckCircle2,
  Printer,
  Calendar,
  Building,
} from 'lucide-react';
import { formatMoney } from '@multi-rate/shared';
import { useAuth } from '../../../lib/auth-context';
import { apiClient, ApiClientError, type Document } from '../../../lib/api-client';
import { AppShell } from '../../../components/layout/app-shell';
import { StatusBadge } from '../../../components/ui/status-badge';
import { LoadingState, ErrorState } from '../../../components/ui/async-state';
import { ConfirmModal } from '../../../components/ui/confirm-modal';

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      const doc = await apiClient.getDocument(resolvedParams.id);
      setDocument(doc);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'DOCUMENT_NOT_FOUND') {
        setError('Document not found or you do not have permission to view it.');
      } else {
        setError('Failed to load document.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else {
        loadDocument();
      }
    }
  }, [user, authLoading, resolvedParams.id]);

  const handleFinalize = async () => {
    if (!document) return;
    setActionLoading(true);
    try {
      const updated = await apiClient.finalizeDocument(document._id);
      setDocument(updated);
      setIsFinalizeModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize document.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!document) return;
    setActionLoading(true);
    try {
      await apiClient.deleteDocument(document._id);
      router.push('/documents');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document.');
      setIsDeleteModalOpen(false);
      setActionLoading(false);
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <AppShell>
        <LoadingState label="Loading document details…" />
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <LoadingState label="Loading document details…" />
      </AppShell>
    );
  }

  if (error || !document) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-4">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </Link>
          <ErrorState message={error || 'Document not found'} onRetry={loadDocument} />
        </div>
      </AppShell>
    );
  }

  const isDraft = document.status === 'draft';

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/documents"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {document.title}
                </h1>
                <StatusBadge status={document.status} />
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">ID: {document._id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>

            {isDraft ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
                <Link
                  href={`/documents/${document._id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
                >
                  <Edit className="h-4 w-4" />
                  Edit Draft
                </Link>
                <button
                  type="button"
                  onClick={() => setIsFinalizeModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finalize Document
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
                <Lock className="h-3.5 w-3.5" />
                Locked & Immutable
              </span>
            )}
          </div>
        </div>

        {/* Finalized Banner */}
        {!isDraft && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950">
                This document is finalized and permanently locked.
              </p>
              <p className="mt-0.5 text-xs text-emerald-800">
                Finalized at{' '}
                {document.finalizedAt
                  ? new Date(document.finalizedAt).toLocaleString()
                  : new Date(document.updatedAt).toLocaleString()}
                . Server immutability prevents any further modifications.
              </p>
            </div>
          </div>
        )}

        {/* Metadata Details Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Building className="h-3.5 w-3.5" />
              Customer
            </div>
            <p className="text-base font-semibold text-slate-900">{document.customer}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Calendar className="h-3.5 w-3.5" />
              Issue Date
            </div>
            <p className="text-base font-mono font-medium text-slate-900">
              {new Date(document.issueDate).toISOString().split('T')[0]}
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Created / Updated
            </div>
            <p className="text-xs text-slate-600">
              Created: {new Date(document.createdAt).toLocaleDateString()}
              <br />
              Updated: {new Date(document.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Itemized Breakdown</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Item Description</th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3 text-right">Unit Price</th>
                  <th className="py-3 px-3 text-right">Subtotal</th>
                  <th className="py-3 px-3 text-right">Discount</th>
                  <th className="py-3 px-3 text-right">Tax Rate & Amt</th>
                  <th className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {document.lineItems.map((line, idx) => {
                  const discountLabel =
                    line.discount.type === 'fixed'
                      ? `-$${formatMoney(line.discount.amountCents)}`
                      : line.discount.type === 'percentage'
                        ? `${(line.discount.rateBasisPoints / 100).toFixed(2)}% (-$${formatMoney(line.discount.amountCents)})`
                        : '—';

                  const taxLabel =
                    line.taxRateBasisPoints > 0
                      ? `${(line.taxRateBasisPoints / 100).toFixed(2)}% (+$${formatMoney(line.taxCents)})`
                      : '0%';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {line.description || '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {line.quantity}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        ${formatMoney(line.unitPriceCents)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        ${formatMoney(line.subtotalCents)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 text-xs">
                        {discountLabel}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 text-xs">
                        {taxLabel}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        ${formatMoney(line.totalCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="flex justify-end">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
              Financial Summary
            </h3>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-medium text-slate-900">
                ${formatMoney(document.totals.subtotalCents)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Total Discounts:</span>
              <span className="font-mono font-medium text-slate-900">
                -${formatMoney(document.totals.totalDiscountCents)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Total Tax:</span>
              <span className="font-mono font-medium text-slate-900">
                +${formatMoney(document.totals.totalTaxCents)}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-slate-950">
              <span>Authoritative Total:</span>
              <span className="font-mono text-xl text-slate-900">
                ${formatMoney(document.totals.grandTotalCents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Finalize Confirmation Modal */}
      <ConfirmModal
        isOpen={isFinalizeModalOpen}
        title="Finalize Pricing Document"
        description="Are you sure you want to finalize this document? Once finalized, the document is locked permanently and cannot be modified, edited, or deleted."
        confirmText="Yes, Finalize Document"
        variant="primary"
        isLoading={actionLoading}
        onConfirm={handleFinalize}
        onCancel={() => setIsFinalizeModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Draft Document"
        description="Are you sure you want to delete this draft? This action cannot be undone."
        confirmText="Delete Document"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </AppShell>
  );
}
