import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth-context';

export const metadata: Metadata = {
  title: 'Multi-Rate Pricing Calculator | Financial Operations',
  description: 'Deterministic pricing document management and revenue calculation system.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-950 antialiased selection:bg-slate-900 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
