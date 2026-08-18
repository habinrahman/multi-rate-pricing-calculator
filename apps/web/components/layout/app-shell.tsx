'use client';

import React, { type ReactNode } from 'react';
import { Header } from './header';

export function AppShell({
  children,
  maxWidth = 'max-w-7xl',
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />
      <main className={`flex-1 mx-auto w-full ${maxWidth} px-4 sm:px-6 lg:px-8 py-8`}>
        {children}
      </main>
    </div>
  );
}
