'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTheme } from '@/lib/theme';

const getAvatarUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return '';
};

const navItems = [
  { href: '/dashboard',    icon: 'dashboard',        label: 'Dashboard'        },
  { href: '/accounts',     icon: 'account_balance',  label: 'Contas & Cartões' },
  { href: '/investments',  icon: 'trending_up',      label: 'Investimentos'    },
  { href: '/goals',        icon: 'flag',             label: 'Metas'            },
  { href: '/budgets',      icon: 'pie_chart',        label: 'Orçamento'        },
  { href: '/reports',      icon: 'bar_chart',        label: 'Relatórios'       },
  { href: '/transactions', icon: 'receipt_long',     label: 'Transações'       },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { theme } = useTheme();

  useEffect(() => {
    if (onClose) onClose();
  }, [pathname, onClose]);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/users/me').then((r) => r.data),
    retry: false,
    staleTime: 300_000,
  });

  async function logout() {
    try { await api.post('/api/auth/logout'); } catch {}
    window.location.href = '/login';
  }

  return (
    <aside className={cn(
      "w-60 min-h-screen bg-[#031632] dark:bg-[#010b1a] flex flex-col flex-shrink-0 border-r border-white/5 transition-transform duration-300",
      "fixed inset-y-0 left-0 z-50 md:static",
      isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10 relative flex items-center justify-center">
        <Image
          src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
          alt="MY-FINANCE"
          width={148}
          height={40}
          className="object-contain h-10 w-auto"
          priority
        />
        {onClose && (
          <button onClick={onClose} className="absolute right-3 p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white md:hidden">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            pathname.startsWith('/settings') ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
          )}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          Configurações
        </Link>

        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs text-slate-600">Tema</span>
          <ThemeToggle />
        </div>

        {me && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-[#006c49]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
              {me.avatarUrl && getAvatarUrl(me.avatarUrl)
                ? <img src={getAvatarUrl(me.avatarUrl)} alt={me.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : me.name?.charAt(0).toUpperCase() || <span className="material-symbols-outlined text-[16px]">person</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{me.name}</p>
              <p className="text-slate-500 text-xs truncate">{me.household?.name}</p>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Sair
        </button>
      </div>
    </aside>
  );
}
