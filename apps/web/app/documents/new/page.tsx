'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { apiClient, ApiClientError, type DocumentCreateInput } from '../../../lib/api-client';
import { AppShell } from '../../../components/layout/app-shell';
import {
  LineItemsEditor,
  type FormLineItem,
} from '../../../components/documents/line-items-editor';
import { ErrorState } from '../../../components/ui/async-state';

export default function CreateDocumentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [customer, setCustomer] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]!);
  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unitPrice: '100.00',
      discountType: 'none',
      discountValue: '',
      taxRate: '0',
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authLoading && !user) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!title.trim()) {
      setError('Document title is required.');
      return;
    }
    if (!customer.trim()) {
      setError('Customer name is required.');
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

      const doc = await apiClient.createDocument(payload);
      router.push(`/documents/${doc._id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to create document.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/documents"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Create Pricing Document
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Draft a new proposal or quote with multi-rate calculations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/documents"
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
              Save Draft
            </button>
          </div>
        </div>

        {error && <ErrorState message={error} />}

        {/* Document Metadata Form */}
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
                placeholder="e.g. Q3 Software Services Proposal"
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
                placeholder="e.g. Acme Corp"
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
