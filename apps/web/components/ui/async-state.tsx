import React, { type ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Loader2 className="h-8 w-8 text-slate-400 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50/70 p-5 text-rose-900 my-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-rose-900">{title}</h4>
          <p className="mt-1 text-sm text-rose-700 leading-relaxed">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-xs font-semibold text-rose-700 bg-white border border-rose-200 px-3 py-1.5 rounded-md hover:bg-rose-50"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-16 px-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
