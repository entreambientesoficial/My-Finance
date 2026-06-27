'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTheme } from '@/lib/theme';
import { createClient } from '@/lib/supabase/client';


const desktopNavItems = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/accounts', icon: 'credit_card', label: 'Contas & Cartões' },
  { href: '/investments', icon: 'monitoring', label: 'Investimentos' },
  { href: '/goals', icon: 'flag', label: 'Metas' },
  { href: '/budgets', icon: 'pie_chart', label: 'Orçamentos' },
  { href: '/reports', icon: 'bar_chart', label: 'Relatórios' },
  { href: '/transactions', icon: 'swap_horiz', label: 'Transações' },
];

const mobileNavItems = [
  { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/transactions', icon: 'swap_horiz', label: 'Transações' },
  { href: '/accounts', icon: 'credit_card', label: 'Contas' },
  { href: '/investments', icon: 'monitoring', label: 'Investimentos' },
  { href: '/settings', icon: 'settings', label: 'Config' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme } = useTheme();

  const [authMeta, setAuthMeta] = useState<{ name?: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) {
        const m = data.user.user_metadata ?? {};
        setAuthMeta({
          name: m.full_name || m.name || data.user.email?.split('@')[0],
          avatarUrl: m.avatar_url || m.picture,
        });
      }
    });
  }, []);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/users/me').then((r) => r.data),
    retry: false,
    staleTime: 300_000,
  });

  async function logout() {
    try {
      await api.post('/api/auth/logout');
    } catch {}
    // Also clear client-side session so getSession() returns null on next login
    try {
      const { createClient: create } = await import('@/lib/supabase/client');
      await create().auth.signOut({ scope: 'local' });
    } catch {}
    window.location.href = '/login';
  }

  const userDisplayName = me?.name || authMeta?.name || '';
  const userRole = me?.household?.name || '';
  const userAvatarUrl = me?.avatarUrl || authMeta?.avatarUrl || '';
  const userInitials = userDisplayName.slice(0, 2).toUpperCase();

  const [showNotifications, setShowNotifications] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

  const { data: todayBillsData } = useQuery({
    queryKey: ['today-bills-layout', today],
    queryFn: () => api.get(`/api/transactions?type=EXPENSE&isPaid=false&startDate=${today}&endDate=${today}&limit=20`).then((r) => r.data?.data || []),
    retry: false,
    staleTime: 60_000,
  });

  const { data: overdueBillsData } = useQuery({
    queryKey: ['overdue-bills-layout', today],
    queryFn: () => api.get(`/api/transactions?type=EXPENSE&isPaid=false&startDate=${sixtyDaysAgo}&endDate=${yesterday}&limit=20`).then((r) => r.data?.data || []),
    retry: false,
    staleTime: 60_000,
  });

  const todayBills: any[] = todayBillsData || [];
  const overdueBills: any[] = overdueBillsData || [];
  const pendingBills = [...todayBills, ...overdueBills];

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md transition-colors overflow-x-hidden">
      
      {/* ─── DESKTOP LAYOUT SHELL ─── */}
      <div className="hidden md:block">
        {/* SideNavBar Shell */}
        <aside className="fixed left-0 top-0 h-full w-64 bg-surface border-r border-outline-variant/40 flex flex-col py-lg px-md z-50">
          <div className="mb-xl px-xs">
            <Image
              src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
              alt="MY-FINANCE"
              width={148}
              height={40}
              className="object-contain h-10 w-auto"
              priority
            />
          </div>
          
          <nav className="flex-grow flex flex-col gap-base">
            {desktopNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-md px-md py-sm rounded-lg transition-colors font-body-md text-body-md",
                    isActive
                      ? "text-primary font-bold border-r-4 border-primary bg-surface-container-high"
                      : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
                  )}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-base">
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-md px-md py-sm rounded-lg transition-colors font-body-md text-body-md",
                pathname.startsWith('/settings')
                  ? "text-primary font-bold border-r-4 border-primary bg-surface-container-high"
                  : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
              )}
            >
              <span className="material-symbols-outlined">settings</span>
              <span>Configurações</span>
            </Link>

            <button
              onClick={logout}
              className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-colors font-body-md text-body-md text-left w-full"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>Sair</span>
            </button>

            {/* Profile Section */}
            <div className="flex items-center gap-md mt-lg px-md pt-lg border-t border-outline-variant">
              {userAvatarUrl ? (
                <img
                  alt="Foto do perfil"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border border-outline-variant"
                  src={userAvatarUrl}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm">
                  {userInitials || <span className="material-symbols-outlined text-[18px]">person</span>}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-label-sm text-label-sm text-primary truncate">{userDisplayName}</p>
                <p className="text-[10px] text-on-surface-variant truncate">{userRole}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* TopNavBar Shell */}
        <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 bg-surface-container-lowest border-b border-outline-variant flex justify-between items-center px-gutter z-40 glass-header">
          <div className="flex items-center gap-md w-1/2">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full font-body-md text-body-md focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                placeholder="Buscar transações, contas ou ferramentas..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-lg relative">
            <div className="flex items-center gap-sm">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="hover:bg-surface-container rounded-full p-2 text-on-surface-variant transition-colors relative flex items-center"
              >
                <span className="material-symbols-outlined">notifications</span>
                {pendingBills.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-white dark:border-black"></span>
                )}
              </button>
            </div>
            <div className="h-8 w-[1px] bg-outline-variant"></div>
            <ThemeToggle />

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-card border border-border-base rounded-xl shadow-2xl z-50 p-md text-left text-sm max-h-[350px] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center pb-xs border-b border-outline-variant mb-sm">
                  <h4 className="font-bold text-primary">Notificações</h4>
                  <button onClick={() => setShowNotifications(false)} className="text-xs text-outline hover:text-primary">Fechar</button>
                </div>
                {pendingBills.length === 0 ? (
                  <p className="text-on-surface-variant text-center py-md text-xs">Sem notificações pendentes hoje.</p>
                ) : (
                  <div className="space-y-sm">
                    {todayBills.length > 0 && (
                      <>
                        <p className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider">Vence hoje:</p>
                        {todayBills.map((bill: any) => (
                          <div key={bill.id} className="p-xs bg-primary/5 border border-primary/20 rounded-lg flex justify-between items-center">
                            <div className="min-w-0 flex-1 pr-sm">
                              <p className="font-semibold text-xs text-primary truncate">{bill.description}</p>
                              <p className="text-[10px] text-outline">{new Date(bill.date).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <p className="font-numeric font-bold text-xs text-primary shrink-0">{formatCurrency(Number(bill.amount))}</p>
                          </div>
                        ))}
                      </>
                    )}
                    {overdueBills.length > 0 && (
                      <>
                        <p className="text-[11px] text-error font-semibold uppercase tracking-wider mt-sm">Em atraso:</p>
                        {overdueBills.map((bill: any) => (
                          <div key={bill.id} className="p-xs bg-error/5 border border-error/20 rounded-lg flex justify-between items-center">
                            <div className="min-w-0 flex-1 pr-sm">
                              <p className="font-semibold text-xs text-error truncate">{bill.description}</p>
                              <p className="text-[10px] text-outline">Venceu em {new Date(bill.date).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <p className="font-numeric font-bold text-xs text-error shrink-0">{formatCurrency(Number(bill.amount))}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="ml-64 pt-16 min-h-screen p-gutter">
          <div className="max-w-container-max mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ─── MOBILE LAYOUT SHELL ─── */}
      <div className="block md:hidden">
        {/* Top AppBar */}
        <header className="fixed top-0 left-0 right-0 z-40 bg-surface-container-lowest h-16 flex items-center px-md justify-between border-b border-outline-variant">
          <div className="flex items-center gap-xs">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[20px]">account_balance</span>
            </div>
            <h1 className="font-headline-md text-headline-md font-extrabold text-primary tracking-tight">My-Finance</h1>
          </div>
          <div className="flex items-center gap-sm">
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
            </button>
            {userAvatarUrl ? (
              <img
                alt="Foto do perfil"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-outline-variant"
                src={userAvatarUrl}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs">
                {userInitials || <span className="material-symbols-outlined text-[16px]">person</span>}
              </div>
            )}
            <button
              onClick={logout}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-error-container/20 transition-colors"
              title="Sair"
            >
              <span className="material-symbols-outlined text-on-surface-variant hover:text-error text-[22px]">logout</span>
            </button>
          </div>
        </header>

        {/* Main Content Scroll Area */}
        <main className="mt-16 px-md pt-lg pb-28 min-h-[calc(100vh-4rem)]">
          {children}
        </main>

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-surface dark:bg-inverse-surface border-t border-outline-variant/30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex items-center justify-around px-md z-50">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-[2px] transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-slate-400 dark:text-slate-400"
                )}
              >
                <div className={cn(
                  "px-5 py-1 rounded-full transition-colors",
                  isActive ? "bg-primary/15" : "bg-transparent"
                )}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {item.icon}
                  </span>
                </div>
                <span className="font-label-sm text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
