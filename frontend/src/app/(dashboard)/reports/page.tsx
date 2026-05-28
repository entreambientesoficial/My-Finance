'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, getCurrentMonthYear } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function ReportsPage() {
  const { month, year } = getCurrentMonthYear();

  const { data: cashFlow } = useQuery({
    queryKey: ['cash-flow-report'],
    queryFn: () => api.get('/reports/cash-flow?months=12').then((r) => r.data),
  });

  const { data: byCategory } = useQuery({
    queryKey: ['expenses-by-category', month, year],
    queryFn: () => api.get(`/reports/expenses-by-category?month=${month}&year=${year}`).then((r) => r.data),
  });

  const { data: netWorth } = useQuery({
    queryKey: ['net-worth'],
    queryFn: () => api.get('/reports/net-worth').then((r) => r.data),
  });

  function downloadPdf() {
    const token = localStorage.getItem('accessToken');
    const url = `${process.env.NEXT_PUBLIC_API_URL}/reports/export/summary.pdf`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert('Erro ao exportar PDF'));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base">Central de Relatórios</h1>
          <p className="text-muted text-sm mt-1">Análise completa das suas finanças</p>
        </div>
        <button
          onClick={downloadPdf}
          className="flex items-center gap-2 border border-md text-muted px-4 py-2 rounded-lg text-sm hover:bg-card-hover transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          Exportar PDF
        </button>
      </div>

      {/* Patrimônio Líquido */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <p className="text-xs text-muted uppercase tracking-wide font-medium">Saldo em Contas</p>
          <p className="text-2xl font-bold text-base mt-1">{formatCurrency(netWorth?.bankBalance || 0)}</p>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <p className="text-xs text-muted uppercase tracking-wide font-medium">Patrimônio em Investimentos</p>
          <p className="text-2xl font-bold text-base mt-1">{formatCurrency(netWorth?.investmentValue || 0)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#031632] to-[#0a2550] rounded-xl p-5 shadow-sm">
          <p className="text-xs text-white/70 uppercase tracking-wide font-medium">Patrimônio Líquido Total</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(netWorth?.netWorth || 0)}</p>
        </div>
      </div>

      {/* Fluxo de caixa 12 meses */}
      <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
        <h2 className="text-sm font-semibold text-base mb-4">Fluxo de Caixa — últimos 12 meses</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={cashFlow || []} barGap={2}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="income" name="Receitas" fill="#006c49" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="balance" name="Saldo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Despesas por categoria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <h2 className="text-sm font-semibold text-base mb-4">Despesas por Categoria — Mês Atual</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byCategory || []} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                {(byCategory || []).map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.color || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <h2 className="text-sm font-semibold text-base mb-4">Breakdown por Categoria</h2>
          <div className="space-y-3 max-h-[220px] overflow-y-auto">
            {(byCategory || []).map((cat: any) => (
              <div key={cat.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm text-muted">{cat.name}</span>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-semibold text-base">{formatCurrency(cat.total)}</p>
                  <p className="text-xs text-placeholder">{cat.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
