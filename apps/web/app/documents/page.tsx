'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter } from 'lucide-react';
import { formatMoney } from '@multi-rate/shared';
import { useAuth } from '../../lib/auth-context';
import { apiClient, type Document } from '../../lib/api-client';
import { AppShell } from '../../components/layout/app-shell';
import { StatusBadge } from '../../components/ui/status-badge';
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/async-state';

export default function DocumentsListPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'finalized'>('all');

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await apiClient.getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else {
        loadDocuments();
      }
    }
  }, [user, authLoading, router]);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesStatus = statusFilter === 'all' ? true : doc.status === statusFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === ''
          ? true
          : doc.title.toLowerCase().includes(query) || doc.customer.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [documents, statusFilter, searchQuery]);

  if (authLoading || (!user && loading)) {
    return (
      <AppShell>
        <LoadingState label="Loading documents…" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Documents</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage pricing proposals, invoices, and finalized pricing contracts.
            </p>
          </div>
          <Link
            href="/documents/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Document
          </Link>
        </div>

        {error && <ErrorState message={error} onRetry={loadDocuments} />}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title or customer…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 pl-9 pr-3.5 py-2 text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto">
            {(
              [
                { label: 'All', value: 'all' },
                { label: 'Drafts', value: 'draft' },
                { label: 'Finalized', value: 'finalized' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <LoadingState label="Loading document directory…" />
        ) : filteredDocs.length === 0 ? (
          <EmptyState
            title={
              searchQuery || statusFilter !== 'all'
                ? 'No matching documents'
                : 'No documents created'
            }
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Get started by creating your first pricing document.'
            }
            action={
              searchQuery || statusFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Clear Filters
                </button>
              ) : (
                <Link
                  href="/documents/new"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Create Document
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Title</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Issue Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Grand Total</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredDocs.map((doc) => (
                  <tr key={doc._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <Link
                        href={`/documents/${doc._id}`}
                        className="hover:underline text-slate-900 font-semibold"
                      >
                        {doc.title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{doc.customer}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-xs">
                      {new Date(doc.issueDate).toISOString().split('T')[0]}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900">
                      ${formatMoney(doc.totals.grandTotalCents)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <Link
                        href={`/documents/${doc._id}`}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-950 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        View
                      </Link>
                      {doc.status === 'draft' && (
                        <Link
                          href={`/documents/${doc._id}/edit`}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-950 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
