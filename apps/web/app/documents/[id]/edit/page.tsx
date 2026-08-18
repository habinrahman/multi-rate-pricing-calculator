'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Lock } from 'lucide-react';
import { formatMoney } from '@multi-rate/shared';
import { useAuth } from '../../../../lib/auth-context';
import {
  apiClient,
  ApiClientError,
  type Document,
  type DocumentCreateInput,
} from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import {
  LineItemsEditor,
  type FormLineItem,
} from '../../../../components/documents/line-items-editor';
import { LoadingState, ErrorState } from '../../../../components/ui/async-state';

export default function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [customer, setCustomer] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [lineItems, setLineItems] = useState<FormLineItem[]>([]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      const doc = await apiClient.getDocument(resolvedParams.id);
      setDocument(doc);
      setTitle(doc.title);
      setCustomer(doc.customer);
      setIssueDate(new Date(doc.issueDate).toISOString().split('T')[0]!);

      setLineItems(
        doc.lineItems.map((line) => ({
          id: crypto.randomUUID(),
          description: line.description,
          quantity: line.quantity,
          unitPrice: formatMoney(line.unitPriceCents),
          discountType: line.discount.type,
          discountValue:
            line.discount.type === 'fixed'
              ? formatMoney(line.discount.amountCents)
              : line.discount.type === 'percentage'
                ? (line.discount.rateBasisPoints / 100).toString()
                : '',
          taxRate: line.taxRateBasisPoints > 0 ? (line.taxRateBasisPoints / 100).toString() : '0',
        })),
      );
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'DOCUMENT_NOT_FOUND') {
        setError('Document not found or you do not have permission to edit it.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!document) return;

    if (document.status === 'finalized') {
      setError('Finalized documents cannot be edited.');
      return;
    }

    if (!title.trim() || !customer.trim()) {
      setError('Title and customer name are required.');
      return;
    }

    if (lineItems.length === 0) {
      setError('At least one line item is required.');
      return;
    }

    setSaving(true);
    try {
      const payload: DocumentCreateInput = {
        title: title.trim(),
        customer: customer.trim(),
        issueDate,
        lineItems: lineItems.map((item) => ({
          description: item.description.trim() || 'Item',
          quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
          unitPrice: item.unitPrice || '0.00',
          discount:
            item.discountType === 'fixed'
              ? { fixed: item.discountValue || '0.00' }
              : item.discountType === 'percentage'
                ? { percentage: item.discountValue || '0' }
                : undefined,
          taxRate: item.taxRate || '0',
        })),
      };

      await apiClient.updateDocument(document._id, payload);
      router.push(`/documents/${document._id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to save document changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || (!user && loading)) {
    return (
      <AppShell>
        <LoadingState label="Loading document editor…" />
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <LoadingState label="Loading document editor…" />
      </AppShell>
    );
  }

  if (error && !document) {
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
          <ErrorState message={error} onRetry={loadDocument} />
        </div>
      </AppShell>
    );
  }

  if (document?.status === 'finalized') {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-amber-600" />
              <div>
                <h2 className="text-base font-bold">Document Is Finalized</h2>
                <p className="text-sm mt-1">
                  This document was finalized on{' '}
                  {new Date(document.finalizedAt || document.updatedAt).toLocaleDateString()} and is
                  immutable. Finalized documents cannot be edited.
                </p>
              </div>
            </div>
          </div>
          <Link
            href={`/documents/${document._id}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            View Document
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href={`/documents/${resolvedParams.id}`}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Edit Draft Document
              </h1>
              <p className="text-sm text-slate-500 mt-0.5 font-mono">ID: {resolvedParams.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/documents/${resolvedParams.id}`}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>

        {error && <ErrorState message={error} />}

        {/* Document Metadata */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            General Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label
                htmlFor="title"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Document Title
              </label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-1">
              <label
                htmlFor="customer"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Customer / Client
              </label>
              <input
                id="customer"
                type="text"
                required
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-1">
              <label
                htmlFor="issueDate"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Issue Date (YYYY-MM-DD)
              </label>
              <input
                id="issueDate"
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Line Items Editor */}
        <LineItemsEditor items={lineItems} onChange={setLineItems} />
      </form>
    </AppShell>
  );
}
