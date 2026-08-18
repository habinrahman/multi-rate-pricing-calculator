'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Calendar, TrendingUp, Percent, Receipt, Search } from 'lucide-react';
import { formatMoney, type ReportSummary } from '@multi-rate/shared';
import { useAuth } from '../../lib/auth-context';
import { apiClient, ApiClientError } from '../../lib/api-client';
import { AppShell } from '../../components/layout/app-shell';
import { LoadingState, ErrorState } from '../../components/ui/async-state';

export default function ReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Initialize with current month
  const today = new Date();
  const firstDayOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString()
    .split('T')[0]!;
  const todayStr = today.toISOString().split('T')[0]!;

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (start: string, end: string) => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiClient.getReportSummary(start, end);
      setReport(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to generate report.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else {
        fetchReport(startDate, endDate);
      }
    }
  }, [user, authLoading, router, fetchReport, startDate, endDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport(startDate, endDate);
  };

  const applyPreset = (preset: 'month' | '30days' | 'ytd' | 'year') => {
    const now = new Date();
    const end = now.toISOString().split('T')[0]!;
    let start = '';

    if (preset === 'month') {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        .toISOString()
        .split('T')[0]!;
    } else if (preset === '30days') {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 30);
      start = d.toISOString().split('T')[0]!;
    } else if (preset === 'ytd') {
      start = `${now.getUTCFullYear()}-01-01`;
    } else if (preset === 'year') {
      const d = new Date(now);
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      start = d.toISOString().split('T')[0]!;
    }

    setStartDate(start);
    setEndDate(end);
    fetchReport(start, end);
  };

  if (authLoading || (!user && loading)) {
    return (
      <AppShell>
        <LoadingState label="Loading reporting tools…" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Aggregate revenue, tax, and discount reports filtered by issue-date range.
          </p>
        </div>

        {/* Date Filter Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3 flex-1">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Start Date
                </label>
                <input
                  id="startDate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="endDate"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  End Date
                </label>
                <input
                  id="endDate"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm disabled:opacity-50 transition-colors"
              >
                <Search className="h-4 w-4" />
                Run Report
              </button>
            </form>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('month')}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset('30days')}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => applyPreset('ytd')}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                YTD
              </button>
            </div>
          </div>
        </div>

        {error && <ErrorState message={error} />}

        {loading ? (
          <LoadingState label="Computing authoritative financial aggregates…" />
        ) : report ? (
          <div className="space-y-6">
            {/* Active Range Header */}
            <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-100/70 px-4 py-2.5 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span>
                  Reporting Period:{' '}
                  <strong className="text-slate-900 font-mono">{report.startDate}</strong> to{' '}
                  <strong className="text-slate-900 font-mono">{report.endDate}</strong>
                </span>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {report.documentCount} document{report.documentCount === 1 ? '' : 's'} included
              </span>
            </div>

            {/* Aggregated Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Grand Total
                  </span>
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-slate-900">
                  ${formatMoney(report.totals.grandTotalCents)}
                </div>
                <div className="mt-1 text-xs text-slate-500">Net revenue value</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Subtotal
                  </span>
                  <Receipt className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-slate-900">
                  ${formatMoney(report.totals.subtotalCents)}
                </div>
                <div className="mt-1 text-xs text-slate-500">Before discounts & tax</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Tax</span>
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-slate-900">
                  ${formatMoney(report.totals.totalTaxCents)}
                </div>
                <div className="mt-1 text-xs text-slate-500">Collected tax</div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Discounts
                  </span>
                  <Percent className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-3 text-2xl font-bold font-mono text-slate-900">
                  ${formatMoney(report.totals.totalDiscountCents)}
                </div>
                <div className="mt-1 text-xs text-slate-500">Discounts granted</div>
              </div>
            </div>

            {/* Breakdown Summary Table */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                Period Summary Breakdown
              </h3>
              <div className="mt-4 divide-y divide-slate-100 text-sm">
                <div className="py-3 flex justify-between">
                  <span className="text-slate-600">Total Documents:</span>
                  <span className="font-semibold text-slate-900">{report.documentCount}</span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-600">Base Subtotal:</span>
                  <span className="font-mono font-medium text-slate-900">
                    ${formatMoney(report.totals.subtotalCents)}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-600">Total Discounts Applied:</span>
                  <span className="font-mono font-medium text-slate-900">
                    -${formatMoney(report.totals.totalDiscountCents)}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-600">Total Taxes Calculated:</span>
                  <span className="font-mono font-medium text-slate-900">
                    +${formatMoney(report.totals.totalTaxCents)}
                  </span>
                </div>
                <div className="py-3 flex justify-between font-bold text-base border-t border-slate-200 pt-3">
                  <span className="text-slate-900">Authoritative Grand Total:</span>
                  <span className="font-mono text-lg text-slate-950">
                    ${formatMoney(report.totals.grandTotalCents)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
