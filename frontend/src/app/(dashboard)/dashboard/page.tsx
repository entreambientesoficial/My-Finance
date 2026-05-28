'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, getCurrentMonthYear } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const { month, year } = getCurrentMonthYear();

  const { data: summary } = useQuery({
    queryKey: ['household-summary'],
    queryFn: () => api.get('/households/mine/summary').then((r) => r.data),
  });

  const { data: monthlySummary } = useQuery({
    queryKey: ['monthly-summary', month, year],
    queryFn: () => api.get(`/transactions/summary/monthly?month=${month}&year=${year}`).then((r) => r.data),
  });

  const { data: cashFlow } = useQuery({
    queryKey: ['cash-flow'],
    queryFn: () => api.get('/reports/cash-flow?months=6').then((r) => r.data),
  });

  const { data: upcomingBills } = useQuery({
    queryKey: ['upcoming-bills'],
    queryFn: () => api.get('/reports/upcoming-bills?daysAhead=15').then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-base">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Cards de saldo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Saldo Total</p>
          <p className="text-2xl font-bold text-base mt-1">
            {formatCurrency(summary?.totalBalance || 0)}
          </p>
          <p className="text-xs text-placeholder mt-1">{summary?.accounts?.length || 0} contas ativas</p>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Receitas do Mês</p>
          <p className="text-2xl font-bold text-[#006c49] mt-1">
            {formatCurrency(monthlySummary?.income || 0)}
          </p>
          <p className="text-xs text-placeholder mt-1">competência atual</p>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">Despesas do Mês</p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            {formatCurrency(monthlySummary?.expenses || 0)}
          </p>
          <p className="text-xs text-placeholder mt-1">
            Saldo: {formatCurrency(monthlySummary?.balance || 0)}
          </p>
        </div>
      </div>

      {/* Gráfico de fluxo de caixa */}
      <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
        <h2 className="text-sm font-semibold text-base mb-4">Fluxo de Caixa — últimos 6 meses</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cashFlow || []} barGap={4}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="income" name="Receitas" fill="#006c49" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contas a pagar */}
        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <h2 className="text-sm font-semibold text-base mb-3">Próximas Contas a Pagar</h2>
          {upcomingBills?.length === 0 ? (
            <p className="text-placeholder text-sm">Nenhuma conta nos próximos 15 dias.</p>
          ) : (
            <div className="space-y-2">
              {(upcomingBills || []).slice(0, 5).map((bill: any) => (
                <div key={bill.id} className="flex items-center justify-between py-2 border-b border-base last:border-0">
                  <div>
                    <p className="text-sm font-medium text-base">{bill.description || 'Lançamento'}</p>
                    <p className="text-xs text-placeholder">
                      {new Date(bill.date).toLocaleDateString('pt-BR')} · {bill.category?.name}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-red-500">{formatCurrency(Number(bill.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gastos por categoria */}
        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <h2 className="text-sm font-semibold text-base mb-3">Gastos por Categoria</h2>
          <div className="space-y-2">
            {(monthlySummary?.byCategory || []).slice(0, 5).map((cat: any) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted">{cat.name}</span>
                  <span className="text-muted">{formatCurrency(cat.total)}</span>
                </div>
                <div className="h-1.5 bg-subtle rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (cat.total / (monthlySummary.expenses || 1)) * 100)}%`, backgroundColor: cat.color || '#006c49' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
