import React from 'react';
import type { DocumentStatus } from '@multi-rate/shared';

export function StatusBadge({ status }: { status: DocumentStatus }) {
  if (status === 'finalized') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Finalized
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Draft
    </span>
  );
}
