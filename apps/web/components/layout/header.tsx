'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Calculator, FileText, BarChart3, Plus, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Documents', href: '/documents', icon: FileText },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Main Nav */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-bold text-slate-900 tracking-tight hover:opacity-90 transition-opacity"
            >
              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-sm">
                <Calculator className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold">Multi-Rate</span>
            </Link>

            {user && (
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-4 w-4 text-slate-500" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/documents/new"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  <Plus className="h-4 w-4" />
                  New Document
                </Link>

                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">
                    {user.email}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-3.5 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 shadow-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
