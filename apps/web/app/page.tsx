'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Plus, ArrowRight, TrendingUp, FileCheck2, Clock, BarChart3 } from 'lucide-react';
import { formatMoney } from '@multi-rate/shared';
import { useAuth } from '../lib/auth-context';
import { apiClient, type Document } from '../lib/api-client';
import { AppShell } from '../components/layout/app-shell';
import { StatusBadge } from '../components/ui/status-badge';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/async-state';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await apiClient.getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else {
        loadData();
      }
    }
  }, [user, authLoading, router]);

  if (authLoading || (!user && loading)) {
    return (
      <AppShell>
        <LoadingState label="Loading workspace…" />
      </AppShell>
    );
  }

  // Summary Metrics
  const totalCount = documents.length;
  const draftCount = documents.filter((d) => d.status === 'draft').length;
  const finalizedCount = documents.filter((d) => d.status === 'finalized').length;
  const totalValueCents = documents.reduce((sum, d) => sum + d.totals.grandTotalCents, 0);

  const recentDocs = documents.slice(0, 5);

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              Financial document overview and pricing operations for {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              Reports
            </Link>
            <Link
              href="/documents/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Document
            </Link>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={loadData} />}

        {loading ? (
          <LoadingState label="Loading dashboard metrics…" />
        ) : (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Value
                  </span>
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-slate-900">
                  ${formatMoney(totalValueCents)}
                </div>
                <div className="mt-1 text-xs text-slate-500">Sum across all documents</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Documents
                  </span>
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-3 text-2xl font-bold text-slate-900">{totalCount}</div>
                <div className="mt-1 text-xs text-slate-500">Active pricing records</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Finalized</span>
                  <FileCheck2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="mt-3 text-2xl font-bold text-slate-900">{finalizedCount}</div>
                <div className="mt-1 text-xs text-emerald-600 font-medium">Locked & immutable</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Drafts</span>
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div className="mt-3 text-2xl font-bold text-slate-900">{draftCount}</div>
                <div className="mt-1 text-xs text-amber-600 font-medium">Editable</div>
              </div>
            </div>

            {/* Recent Documents Section */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Recent Documents</h2>
                {totalCount > 0 && (
                  <Link
                    href="/documents"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
                  >
                    View all ({totalCount})
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>

              {totalCount === 0 ? (
                <EmptyState
                  title="No documents yet"
                  description="Create your first pricing document to calculate line rates, taxes, and discounts."
                  action={
                    <Link
                      href="/documents/new"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Create Document
                    </Link>
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
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {recentDocs.map((doc) => (
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
                          <td className="py-3.5 px-4 text-right">
                            <Link
                              href={`/documents/${doc._id}`}
                              className="text-xs font-semibold text-slate-700 hover:text-slate-950 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
