'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
} from 'recharts';

type Tab = 'overview' | 'investments' | 'transactions' | 'budgets';

const INV_LABELS: Record<string, string> = {
  STOCK: 'Ações BR', STOCK_US: 'Ações EUA', FUND: 'FIIs',
  BOND: 'Renda Fixa', CRYPTO: 'Cripto', SAVINGS: 'Poupança',
};
const INV_COLORS: Record<string, string> = {
  STOCK: '#10b981', STOCK_US: '#8b5cf6', FUND: '#3b82f6',
  BOND: '#f59e0b', CRYPTO: '#f97316', SAVINGS: '#6b7280',
};

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',     label: 'Visão Geral',       icon: 'dashboard' },
  { id: 'investments',  label: 'Investimentos',      icon: 'trending_up' },
  { id: 'transactions', label: 'Transações',         icon: 'receipt_long' },
  { id: 'budgets',      label: 'Orçamentos & Metas', icon: 'savings' },
];

export default function ReportsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const monthLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [page, setPage]           = useState(1);
  const [sortBy, setSortBy]       = useState<'date' | 'amount' | 'description' | 'isPaid' | 'category' | 'account'>('date');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');
  const [activeCatIdx, setActiveCatIdx] = useState(-1);
  const [activeInvIdx, setActiveInvIdx] = useState(-1);
  const limit = 10;

  function handleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  }

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: cashFlow = [] } = useQuery({
    queryKey: ['cash-flow-report'],
    queryFn: () => api.get('/api/reports/cash-flow?months=12').then(r => r.data),
  });

  const { data: byCategory = [] } = useQuery({
    queryKey: ['expenses-by-category', monthStart],
    queryFn: () => api.get(`/api/reports/expenses-by-category?startDate=${monthStart}&endDate=${monthEnd}`).then(r => r.data),
  });

  const { data: netWorth } = useQuery({
    queryKey: ['net-worth-report'],
    queryFn: () => api.get('/api/reports/net-worth').then(r => r.data),
  });

  const { data: annualSummary } = useQuery({
    queryKey: ['annual-summary-report'],
    queryFn: () => api.get('/api/reports/annual-summary').then(r => r.data),
  });

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio-report'],
    queryFn: () => api.get('/api/investments/portfolio').then(r => r.data),
    enabled: activeTab === 'investments' || activeTab === 'overview',
  });

  const { data: proventosData } = useQuery({
    queryKey: ['proventos-report', now.getFullYear()],
    queryFn: () => api.get(`/api/proventos?year=${now.getFullYear()}`).then(r => r.data),
    enabled: activeTab === 'investments',
  });

  const { data: transactionsRes } = useQuery({
    queryKey: ['transactions-report', page, sortBy, sortDir],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page), limit: String(limit),
        sortBy, sortDir,
        startDate: monthStart, endDate: monthEnd,
      });
      return api.get(`/api/transactions?${params}`).then(r => r.data);
    },
    enabled: activeTab === 'transactions',
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets-report', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => api.get(`/api/budgets?month=${now.getMonth() + 1}&year=${now.getFullYear()}`).then(r => r.data),
    enabled: activeTab === 'budgets',
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals-report'],
    queryFn: () => api.get('/api/goals').then(r => r.data),
    enabled: activeTab === 'budgets',
  });

  // ─── Derived ───────────────────────────────────────────────────────────────
  const displayCashFlow = cashFlow.map((f: any) => ({
    label: f.label || f.month,
    income: Number(f.income),
    expense: Number(f.expenses),
  }));
  const hasCashFlowData = displayCashFlow.some((d: any) => d.income > 0 || d.expense > 0);
  const totalExpenses = byCategory.reduce((s: number, c: any) => s + Number(c.total), 0);

  const lastMonth = displayCashFlow[displayCashFlow.length - 1];
  const monthIncome  = lastMonth?.income  ?? 0;
  const monthExpense = lastMonth?.expense ?? 0;
  const savingsRate  = monthIncome > 0 ? Math.round(((monthIncome - monthExpense) / monthIncome) * 100) : 0;

  // Portfolio grouped by type for donut chart
  const portfolioByType = (() => {
    if (!portfolio?.investments?.length) return [];
    const map: Record<string, number> = {};
    for (const inv of portfolio.investments) {
      map[inv.type] = (map[inv.type] || 0) + inv.current;
    }
    return Object.entries(map)
      .map(([type, value]) => ({ type, label: INV_LABELS[type] || type, value, color: INV_COLORS[type] || '#6b7280' }))
      .sort((a, b) => b.value - a.value);
  })();

  const transactionsData = transactionsRes?.data || [];
  const totalTxsCount   = transactionsRes?.total || 0;
  const totalPages       = transactionsRes?.pages || 1;

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function downloadPdf() {
    fetch('/api/reports/export/summary.pdf', { credentials: 'include' })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Erro ao exportar PDF'));
  }

  function downloadCsv() {
    const params = new URLSearchParams({ startDate: monthStart, endDate: monthEnd });
    fetch(`/api/reports/export/transactions.csv?${params}`, { credentials: 'include' })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `lancamentos-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Erro ao exportar CSV'));
  }

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 5}
      startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.95} />;
  };

  const xAxisFormatter = (v: string) => {
    const s = String(v);
    const y = (s.match(/(\d{4})/) || [])[1]?.slice(-2) || '';
    const m = s.split(/[\s/\-.]/)[0].replace(/\.$/, '').slice(0, 3);
    const mCap = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    return y ? `${mCap}/${y}` : mCap;
  };

  const tooltipStyle = {
    backgroundColor: 'var(--surface-container-high)',
    borderRadius: '10px',
    border: '1px solid var(--outline-variant)',
    color: 'var(--on-surface)',
    fontSize: '12px',
  };

  // ─── Reusable sub-components ───────────────────────────────────────────────
  const DonutCenter = ({ idx, items, total }: { idx: number; items: any[]; total: number }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      {idx >= 0 && items[idx] ? (
        <>
          <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-wider truncate max-w-[76px]">{items[idx].name || items[idx].label}</span>
          <span className="font-numeric text-[15px] text-primary font-bold">{formatCurrency(items[idx].total ?? items[idx].value)}</span>
        </>
      ) : (
        <>
          <span className="font-numeric text-[17px] text-primary font-bold">{formatCurrency(total)}</span>
          <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-wider">Total</span>
        </>
      )}
    </div>
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══════════════════ DESKTOP ══════════════════ */}
      <div className="hidden md:block space-y-gutter">

        {/* Header */}
        <div className="flex justify-between items-end mb-xl">
          <div>
            <h2 className="font-display text-display-lg text-primary">Central de Relatórios</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Análise completa da sua saúde financeira.</p>
          </div>
          <div className="flex gap-md">
            <button onClick={downloadPdf} className="flex items-center gap-xs px-md py-sm bg-surface-container-high text-primary font-label-sm text-label-sm rounded-lg hover:bg-surface-container-highest transition-colors border border-outline-variant/60 shadow-sm">
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>Exportar PDF
            </button>
            <button onClick={downloadCsv} className="flex items-center gap-xs px-md py-sm bg-secondary text-on-secondary font-label-sm text-label-sm rounded-lg hover:opacity-90 transition-opacity shadow-md">
              <span className="material-symbols-outlined text-[18px]">table_chart</span>Exportar CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-xs border-b border-outline-variant mb-xl">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-xs px-lg py-md font-label-sm text-label-sm font-bold border-b-2 transition-all -mb-[1px]',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-primary hover:border-outline'
              )}>
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* ── VISÃO GERAL ── */}
        {activeTab === 'overview' && (
          <div className="space-y-xl">
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-lg">
              {[
                { label: 'Patrimônio Total',  value: netWorth?.netWorth,  icon: 'account_balance', color: 'text-primary' },
                { label: 'Receitas do Mês',   value: monthIncome,          icon: 'arrow_circle_up', color: 'text-secondary' },
                { label: 'Despesas do Mês',   value: monthExpense,         icon: 'arrow_circle_down', color: 'text-error' },
                { label: 'Taxa de Economia',  raw: `${savingsRate}%`,      icon: 'savings', color: savingsRate >= 0 ? 'text-secondary' : 'text-error' },
              ].map((kpi, i) => (
                <div key={i} className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/50 shadow-sm">
                  <div className="flex items-center gap-xs mb-sm">
                    <span className={cn('material-symbols-outlined text-[20px]', kpi.color)}>{kpi.icon}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{kpi.label}</span>
                  </div>
                  <span className={cn('font-numeric text-[22px] font-bold tracking-tight', kpi.color)}>
                    {(kpi as any).raw ?? ((kpi as any).value != null ? formatCurrency((kpi as any).value) : '—')}
                  </span>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-12 gap-lg">
              {/* Cash Flow */}
              <div className="col-span-8 bg-surface-container-lowest p-xl rounded-xl shadow-sm border border-outline-variant/50 h-[360px] flex flex-col">
                <div className="flex justify-between items-start mb-md">
                  <div>
                    <h3 className="font-headline text-headline-md text-primary font-bold">Fluxo de Caixa — 12 Meses</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">Receitas vs. Despesas lançadas</p>
                  </div>
                  <div className="flex gap-md">
                    <div className="flex items-center gap-xs"><span className="w-3 h-3 rounded-full bg-secondary"/><span className="font-label-sm text-label-sm text-on-surface-variant">Entradas</span></div>
                    <div className="flex items-center gap-xs"><span className="w-3 h-3 rounded-full bg-error"/><span className="font-label-sm text-label-sm text-on-surface-variant">Saídas</span></div>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  {!hasCashFlowData ? (
                    <div className="h-full flex flex-col items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-[36px] text-outline mb-xs">analytics</span>
                      <p className="font-body-lg">Nenhum lançamento nos últimos 12 meses</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={displayCashFlow}>
                        <defs>
                          <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--error)" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="var(--error)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} axisLine={false} tickLine={false} tickFormatter={xAxisFormatter} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} width={42} />
                        <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name === 'income' ? 'Receitas' : 'Despesas']} labelFormatter={xAxisFormatter} contentStyle={tooltipStyle} itemStyle={{ color: 'var(--on-surface)' }} labelStyle={{ color: 'var(--on-surface-variant)', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="income" stroke="var(--secondary)" strokeWidth={2.5} fillOpacity={1} fill="url(#gInc)" />
                        <Area type="monotone" dataKey="expense" stroke="var(--error)" strokeWidth={2.5} fillOpacity={1} fill="url(#gExp)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Expenses Donut */}
              <div className="col-span-4 bg-surface-container-lowest p-xl rounded-xl shadow-sm border border-outline-variant/50 h-[360px] flex flex-col">
                <div className="mb-md">
                  <h3 className="font-headline text-headline-md text-primary font-bold">Despesas por Categoria</h3>
                  <p className="text-[11px] text-on-surface-variant capitalize">{monthLabel}</p>
                </div>
                <div className="flex-1 flex flex-col justify-center items-center min-h-0">
                  {byCategory.length === 0 ? (
                    <div className="flex flex-col items-center text-outline text-xs text-center">
                      <span className="material-symbols-outlined text-[36px] mb-xs">pie_chart</span>Sem despesas no período
                    </div>
                  ) : (
                    <>
                      <div className="w-40 h-40 relative flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={byCategory} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={68} paddingAngle={2.5}
                              activeIndex={activeCatIdx} activeShape={renderActiveShape}
                              onMouseEnter={(_: any, i: number) => setActiveCatIdx(i)} onMouseLeave={() => setActiveCatIdx(-1)}>
                              {byCategory.map((e: any, i: number) => <Cell key={i} fill={e.color || '#6b7280'} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <DonutCenter idx={activeCatIdx} items={byCategory} total={totalExpenses} />
                      </div>
                      <div className="w-full space-y-xs mt-sm overflow-y-auto max-h-[110px] pr-xs">
                        {byCategory.map((cat: any) => (
                          <div key={cat.name} className="flex justify-between items-center text-[11px] py-[2px] border-b border-outline-variant/20 last:border-0">
                            <div className="flex items-center gap-xs"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}/><span className="text-on-surface font-medium">{cat.name}</span></div>
                            <div className="flex gap-md"><span className="text-on-surface-variant font-numeric">{formatCurrency(cat.total)}</span><span className="font-numeric text-primary font-bold w-8 text-right">{cat.percentage}%</span></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Accounts + Annual Summary */}
            <div className="grid grid-cols-2 gap-lg">
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant/50 shadow-sm">
                <h3 className="font-headline text-headline-md text-primary font-bold mb-lg">Contas Bancárias</h3>
                <div className="space-y-sm">
                  {(netWorth?.accounts ?? []).length === 0
                    ? <p className="text-xs text-outline text-center py-md">Nenhuma conta cadastrada.</p>
                    : (netWorth?.accounts ?? []).map((acc: any) => (
                      <div key={acc.name} className="flex justify-between items-center py-xs border-b border-outline-variant/20 last:border-0">
                        <span className="font-body-md text-body-md text-on-surface">{acc.name}</span>
                        <span className={cn('font-numeric font-bold', Number(acc.balance) >= 0 ? 'text-secondary' : 'text-error')}>{formatCurrency(Number(acc.balance))}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant/50 shadow-sm">
                <h3 className="font-headline text-headline-md text-primary font-bold mb-lg">Resumo Anual ({now.getFullYear()})</h3>
                <div className="space-y-sm">
                  {([
                    { label: 'Receitas Recebidas',  value: annualSummary?.incomePaid,      color: 'text-secondary' },
                    { label: 'Receitas Pendentes',  value: annualSummary?.incomePending,   color: 'text-secondary/60' },
                    { label: 'Despesas Pagas',      value: annualSummary?.expensesPaid,    color: 'text-error' },
                    { label: 'Despesas Pendentes',  value: annualSummary?.expensesPending, color: 'text-error/60' },
                  ] as { label: string; value: number | undefined; color: string }[]).map((row, i) => (
                    <div key={i} className="flex justify-between items-center py-xs border-b border-outline-variant/20 last:border-0">
                      <span className="font-body-md text-body-md text-on-surface">{row.label}</span>
                      <span className={cn('font-numeric font-bold', row.color)}>{row.value != null ? formatCurrency(row.value) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── INVESTIMENTOS ── */}
        {activeTab === 'investments' && (
          <div className="space-y-xl">
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-lg">
              {[
                { label: 'Valor Atual',      value: portfolio?.totalCurrent, icon: 'payments',      color: 'text-primary' },
                { label: 'Custo Total',      value: portfolio?.totalCost,    icon: 'shopping_cart', color: 'text-on-surface-variant' },
                { label: 'Ganho / Perda',    value: portfolio?.totalGain,    icon: 'show_chart',    color: (portfolio?.totalGain ?? 0) >= 0 ? 'text-secondary' : 'text-error' },
                { label: 'Rentabilidade',    raw: portfolio ? `${(portfolio.totalGainPct ?? 0) >= 0 ? '+' : ''}${(portfolio.totalGainPct ?? 0).toFixed(2)}%` : '—', icon: 'percent', color: (portfolio?.totalGainPct ?? 0) >= 0 ? 'text-secondary' : 'text-error' },
              ].map((kpi, i) => (
                <div key={i} className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/50 shadow-sm">
                  <div className="flex items-center gap-xs mb-sm">
                    <span className={cn('material-symbols-outlined text-[20px]', kpi.color)}>{kpi.icon}</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{kpi.label}</span>
                  </div>
                  <span className={cn('font-numeric text-[22px] font-bold tracking-tight', kpi.color)}>
                    {(kpi as any).raw ?? ((kpi as any).value != null ? formatCurrency((kpi as any).value) : '—')}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-12 gap-lg">
              {/* Composição donut */}
              <div className="col-span-4 bg-surface-container-lowest p-xl rounded-xl border border-outline-variant/50 shadow-sm h-[340px] flex flex-col">
                <h3 className="font-headline text-headline-md text-primary font-bold mb-md">Composição da Carteira</h3>
                <div className="flex-1 flex flex-col justify-center items-center min-h-0">
                  {portfolioByType.length === 0 ? (
                    <div className="flex flex-col items-center text-outline text-xs text-center">
                      <span className="material-symbols-outlined text-[36px] mb-xs">pie_chart</span>Nenhum ativo cadastrado
                    </div>
                  ) : (
                    <>
                      <div className="w-40 h-40 relative flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={portfolioByType} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={52} outerRadius={68} paddingAngle={2.5}
                              activeIndex={activeInvIdx} activeShape={renderActiveShape}
                              onMouseEnter={(_: any, i: number) => setActiveInvIdx(i)} onMouseLeave={() => setActiveInvIdx(-1)}>
                              {portfolioByType.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <DonutCenter idx={activeInvIdx} items={portfolioByType} total={portfolio?.totalCurrent ?? 0} />
                      </div>
                      <div className="w-full space-y-xs mt-sm overflow-y-auto max-h-[110px]">
                        {portfolioByType.map(p => (
                          <div key={p.type} className="flex justify-between items-center text-[11px] py-[2px] border-b border-outline-variant/20 last:border-0">
                            <div className="flex items-center gap-xs"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}/><span className="text-on-surface font-medium">{p.label}</span></div>
                            <div className="flex gap-md">
                              <span className="font-numeric text-on-surface-variant">{formatCurrency(p.value)}</span>
                              <span className="font-numeric text-primary font-bold w-9 text-right">{portfolio?.totalCurrent > 0 ? Math.round((p.value / portfolio.totalCurrent) * 100) : 0}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Assets table */}
              <div className="col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant/50 shadow-sm overflow-hidden flex flex-col h-[340px]">
                <div className="px-xl py-md border-b border-outline-variant/30 bg-surface-container-low/20 flex-shrink-0">
                  <h3 className="font-headline text-headline-md text-primary font-bold">Ativos</h3>
                </div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low/50 sticky top-0">
                      <tr className="border-b border-outline-variant/40">
                        {['Ativo', 'Tipo', 'Qtd.', 'Preço Médio', 'Valor Atual', 'Rent.'].map(h => (
                          <th key={h} className="px-lg py-sm font-label-sm text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {(portfolio?.investments ?? []).length === 0 ? (
                        <tr><td colSpan={6} className="px-xl py-8 text-center text-on-surface-variant text-sm">Nenhum ativo cadastrado.</td></tr>
                      ) : (portfolio?.investments ?? []).map((inv: any) => (
                        <tr key={inv.id ?? `${inv.type}-${inv.ticker}`} className="hover:bg-surface-container-low/10 transition-colors">
                          <td className="px-lg py-sm">
                            <div className="font-body-md text-body-md text-primary font-medium">{inv.ticker || inv.name}</div>
                            {inv.ticker && inv.name !== inv.ticker && <div className="text-[10px] text-on-surface-variant truncate max-w-[120px]">{inv.name}</div>}
                          </td>
                          <td className="px-lg py-sm">
                            <span className="px-xs py-[2px] rounded text-[10px] font-bold uppercase tracking-wider"
                              style={{ backgroundColor: `${INV_COLORS[inv.type] || '#6b7280'}20`, color: INV_COLORS[inv.type] || '#6b7280' }}>
                              {INV_LABELS[inv.type] || inv.type}
                            </span>
                          </td>
                          <td className="px-lg py-sm font-numeric text-on-surface-variant text-sm">{Number(inv.quantity)}</td>
                          <td className="px-lg py-sm font-numeric text-on-surface-variant text-sm">{formatCurrency(inv.cost / Math.max(Number(inv.quantity), 1))}</td>
                          <td className="px-lg py-sm font-numeric font-bold text-primary text-sm">{formatCurrency(inv.current)}</td>
                          <td className={cn('px-lg py-sm font-numeric font-bold text-sm', inv.gainPct >= 0 ? 'text-secondary' : 'text-error')}>
                            {inv.gainPct >= 0 ? '+' : ''}{(inv.gainPct ?? 0).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Proventos */}
            <div className="grid grid-cols-3 gap-lg">
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant/50 shadow-sm">
                <div className="flex items-center gap-xs mb-sm">
                  <span className="material-symbols-outlined text-[20px] text-secondary">payments</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Proventos Recebidos ({now.getFullYear()})</span>
                </div>
                <span className="font-numeric text-[24px] font-bold text-secondary">{formatCurrency(proventosData?.totalRecebido ?? 0)}</span>
              </div>
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant/50 shadow-sm">
                <div className="flex items-center gap-xs mb-sm">
                  <span className="material-symbols-outlined text-[20px] text-primary">schedule</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Proventos a Receber</span>
                </div>
                <span className="font-numeric text-[24px] font-bold text-primary">{formatCurrency(proventosData?.totalAReceber ?? 0)}</span>
              </div>
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant/50 shadow-sm">
                <div className="flex items-center gap-xs mb-sm">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant">event</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Próximos Proventos</span>
                </div>
                <div className="space-y-xs mt-xs max-h-[80px] overflow-y-auto">
                  {(proventosData?.proventos ?? []).filter((p: any) => p.status === 'A_RECEBER').slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex justify-between text-xs gap-md">
                      <span className="text-primary font-medium font-numeric">{p.ticker}</span>
                      <span className="text-on-surface-variant">{new Date(p.dataPagamento).toLocaleDateString('pt-BR')}</span>
                      <span className="font-numeric font-bold text-secondary">{formatCurrency(p.valorTotal)}</span>
                    </div>
                  ))}
                  {(proventosData?.proventos ?? []).filter((p: any) => p.status === 'A_RECEBER').length === 0 && (
                    <p className="text-xs text-outline">Nenhum provento a receber.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSAÇÕES ── */}
        {activeTab === 'transactions' && (
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden shadow-sm">
            <div className="px-xl py-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low/20">
              <h3 className="font-headline text-headline-md text-primary font-bold">Detalhamento — {monthLabel}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low/50">
                  <tr className="border-b border-outline-variant/40">
                    {([
                      { label: 'Data',      col: 'date',        align: 'left'  },
                      { label: 'Descrição', col: 'description', align: 'left'  },
                      { label: 'Categoria', col: 'category',    align: 'left'  },
                      { label: 'Conta',     col: 'account',     align: 'left'  },
                      { label: 'Valor',     col: 'amount',      align: 'right' },
                      { label: 'Status',    col: 'isPaid',      align: 'left'  },
                    ] as { label: string; col: typeof sortBy; align: 'left' | 'right' }[]).map(({ label, col, align }) => (
                      <th key={col} onClick={() => handleSort(col)} className="px-xl py-md font-label-sm text-label-sm uppercase tracking-wider font-bold cursor-pointer select-none">
                        <span className={cn('flex items-center gap-1 transition-colors', align === 'right' ? 'justify-end' : 'justify-start', sortBy === col ? 'text-primary' : 'text-on-surface-variant hover:text-primary')}>
                          {label}
                          <span className="material-symbols-outlined text-[14px]">{sortBy === col ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {transactionsData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-xl py-12 text-center text-on-surface-variant">
                        <div className="flex flex-col items-center">
                          <span className="material-symbols-outlined text-[32px] text-outline mb-xs">search_off</span>
                          <p className="font-body-lg">Nenhuma transação no período</p>
                        </div>
                      </td>
                    </tr>
                  ) : transactionsData.map((tx: any) => {
                    const isIncome   = tx.type === 'INCOME';
                    const isTransfer = tx.type === 'TRANSFER';
                    const isOverdue  = !tx.isPaid && new Date(tx.date) < new Date();
                    const formattedDate = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                    return (
                      <tr key={tx.id} className="hover:bg-surface-container-low/10 transition-colors">
                        <td className="px-xl py-md font-numeric text-numeric-data">{formattedDate}</td>
                        <td className="px-xl py-md font-body-lg text-body-lg text-primary font-medium">{tx.description}</td>
                        <td className="px-xl py-md">
                          {(() => {
                            const display = tx.displayCategory || tx.category;
                            const isSub   = tx.category?.parentId && tx.displayCategory?.id !== tx.category?.id;
                            return (
                              <div className="flex flex-col gap-[2px]">
                                <span className="px-xs py-[2px] rounded font-label-sm text-[11px] uppercase font-bold tracking-wider self-start"
                                  style={{ backgroundColor: `${display?.color || '#75777e'}15`, color: display?.color || '#75777e' }}>
                                  {display?.name || (isTransfer ? 'Transferência' : 'Geral')}
                                </span>
                                {isSub && <span className="text-[10px] text-on-surface-variant pl-[2px]">{tx.category.name}</span>}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-xl py-md font-body-md text-body-md text-on-surface-variant">{tx.account?.name || 'Carteira'}</td>
                        <td className={cn('px-xl py-md font-numeric text-numeric-data text-right font-bold whitespace-nowrap',
                          isIncome ? 'text-secondary' : isTransfer ? 'text-blue-500' : 'text-error')}>
                          {isTransfer ? formatCurrency(Number(tx.amount)) : `${isIncome ? '+' : '-'}${formatCurrency(Number(tx.amount))}`}
                        </td>
                        <td className="px-xl py-md">
                          <span className={cn('flex items-center gap-xs font-label-sm text-[11px] font-bold uppercase',
                            tx.isPaid ? (isIncome ? 'text-secondary' : 'text-on-surface-variant') : isOverdue ? 'text-error' : 'text-on-surface-variant')}>
                            <span className="material-symbols-outlined text-[16px]">{tx.isPaid ? 'check_circle' : isOverdue ? 'warning' : 'schedule'}</span>
                            {tx.isPaid ? (isIncome ? 'Recebido' : isTransfer ? 'Transferido' : 'Pago') : isOverdue ? 'Atrasado' : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-xl py-md border-t border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest">
                <span className="font-body-md text-body-md text-on-surface-variant">Mostrando {transactionsData.length} de {totalTxsCount} lançamentos</span>
                <div className="flex gap-xs">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border border-outline-variant rounded hover:bg-surface-container transition-colors disabled:opacity-50"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                  <button className="w-8 h-8 flex items-center justify-center bg-primary text-on-primary rounded font-label-sm text-label-sm font-bold">{page}</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 border border-outline-variant rounded hover:bg-surface-container transition-colors disabled:opacity-50"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── ORÇAMENTOS & METAS ── */}
        {activeTab === 'budgets' && (
          <div className="space-y-xl">
            {/* Budgets */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 shadow-sm overflow-hidden">
              <div className="px-xl py-lg border-b border-outline-variant bg-surface-container-low/20">
                <h3 className="font-headline text-headline-md text-primary font-bold">Orçamentos — {monthLabel}</h3>
              </div>
              <div className="p-xl space-y-lg">
                {budgets.length === 0 ? (
                  <div className="py-8 text-center text-outline text-sm">Nenhum orçamento cadastrado para este mês.</div>
                ) : budgets.map((b: any) => {
                  const spent = Number((byCategory.find((c: any) => c.name === (b.category?.name || b.name)) as any)?.total ?? 0);
                  const pct   = b.limit > 0 ? Math.min(Math.round((spent / b.limit) * 100), 100) : 0;
                  const over  = spent > b.limit;
                  return (
                    <div key={b.id}>
                      <div className="flex justify-between items-center mb-xs">
                        <div className="flex items-center gap-xs">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: b.category?.color || '#6b7280' }}/>
                          <span className="font-body-md text-body-md text-on-surface font-medium">{b.name || b.category?.name}</span>
                        </div>
                        <div className="flex gap-lg text-sm">
                          <span className={cn('font-numeric font-bold', over ? 'text-error' : 'text-on-surface')}>{formatCurrency(spent)}</span>
                          <span className="text-on-surface-variant">/ {formatCurrency(b.limit)}</span>
                          <span className={cn('font-numeric font-bold w-10 text-right', over ? 'text-error' : pct >= 80 ? 'text-[#f59e0b]' : 'text-secondary')}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: over ? 'var(--error)' : pct >= 80 ? '#f59e0b' : 'var(--secondary)' }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Goals */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 shadow-sm overflow-hidden">
              <div className="px-xl py-lg border-b border-outline-variant bg-surface-container-low/20">
                <h3 className="font-headline text-headline-md text-primary font-bold">Metas</h3>
              </div>
              <div className="p-xl grid grid-cols-2 gap-lg">
                {goals.length === 0 ? (
                  <div className="col-span-2 py-8 text-center text-outline text-sm">Nenhuma meta cadastrada.</div>
                ) : goals.map((g: any) => {
                  const pct = g.targetAmount > 0 ? Math.min(Math.round(((g.currentAmount ?? 0) / g.targetAmount) * 100), 100) : 0;
                  return (
                    <div key={g.id} className="bg-surface-container-low/30 p-lg rounded-xl border border-outline-variant/30">
                      <div className="flex justify-between items-start mb-md">
                        <div>
                          <div className="font-body-lg text-body-lg text-primary font-medium">{g.name}</div>
                          {g.targetDate && <div className="text-[11px] text-on-surface-variant">Prazo: {new Date(g.targetDate).toLocaleDateString('pt-BR')}</div>}
                        </div>
                        <span className={cn('font-numeric font-bold text-lg', pct >= 100 ? 'text-secondary' : 'text-primary')}>{pct}%</span>
                      </div>
                      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden mb-sm">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? 'var(--secondary)' : 'var(--primary)' }}/>
                      </div>
                      <div className="flex justify-between text-xs text-on-surface-variant">
                        <span className="font-numeric">{formatCurrency(g.currentAmount ?? 0)}</span>
                        <span className="font-numeric">{formatCurrency(g.targetAmount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════ MOBILE ══════════════════ */}
      <div className="block md:hidden space-y-lg pb-12">
        <section className="flex flex-col gap-xs text-left">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Relatórios</p>
          <h2 className="font-display-lg-mobile text-display-lg-mobile text-primary">Análise Financeira</h2>
        </section>

        {/* Mobile tab chips */}
        <div className="flex overflow-x-auto gap-xs pb-xs -mx-sm px-sm">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-xs px-md py-sm rounded-full font-label-sm text-label-sm font-bold whitespace-nowrap border transition-all flex-shrink-0',
                activeTab === tab.id ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant'
              )}>
              <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* Mobile — Visão Geral */}
        {activeTab === 'overview' && (
          <div className="space-y-lg">
            <div className="grid grid-cols-2 gap-md">
              {[
                { label: 'Patrimônio', value: netWorth?.netWorth, icon: 'account_balance', color: 'text-primary' },
                { label: 'Receitas',   value: monthIncome,         icon: 'arrow_circle_up', color: 'text-secondary' },
                { label: 'Despesas',   value: monthExpense,        icon: 'arrow_circle_down', color: 'text-error' },
                { label: 'Economia',   raw: `${savingsRate}%`,     icon: 'savings', color: savingsRate >= 0 ? 'text-secondary' : 'text-error' },
              ].map((kpi, i) => (
                <div key={i} className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/50">
                  <div className="flex items-center gap-xs mb-xs">
                    <span className={cn('material-symbols-outlined text-[16px]', kpi.color)}>{kpi.icon}</span>
                    <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">{kpi.label}</span>
                  </div>
                  <span className={cn('font-numeric text-[16px] font-bold', kpi.color)}>
                    {(kpi as any).raw ?? ((kpi as any).value != null ? formatCurrency((kpi as any).value) : '—')}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/50 shadow-sm flex flex-col items-center">
              <h3 className="font-headline text-headline-md text-primary mb-md font-bold text-left w-full">Gasto por Categoria</h3>
              {byCategory.length === 0 ? <div className="py-8 text-center text-outline text-xs">Sem despesas registradas.</div> : (
                <>
                  <div className="w-36 h-36 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byCategory} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={58} paddingAngle={2}
                          activeIndex={activeCatIdx} activeShape={renderActiveShape}
                          onMouseEnter={(_: any, i: number) => setActiveCatIdx(i)} onMouseLeave={() => setActiveCatIdx(-1)}>
                          {byCategory.map((e: any, i: number) => <Cell key={i} fill={e.color || '#6b7280'} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <DonutCenter idx={activeCatIdx} items={byCategory} total={totalExpenses} />
                  </div>
                  <div className="w-full space-y-xs pt-md border-t border-outline-variant/40">
                    {byCategory.map((cat: any) => (
                      <div key={cat.name} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-xs"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}/><span className="text-on-surface font-medium">{cat.name}</span></div>
                        <span className="font-numeric text-primary font-bold">{cat.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/50 shadow-sm">
              <h3 className="font-headline text-headline-md text-primary mb-md font-bold">Fluxo Mensal (12m)</h3>
              <div className="h-36 relative">
                {!hasCashFlowData ? <div className="absolute inset-0 flex items-center justify-center text-xs text-outline">Sem dados.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayCashFlow}>
                      <defs><linearGradient id="mGInc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.15}/><stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--outline)' }} axisLine={false} tickLine={false} tickFormatter={xAxisFormatter} />
                      <Area type="monotone" dataKey="income" stroke="var(--secondary)" strokeWidth={2} fillOpacity={1} fill="url(#mGInc)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile — Investimentos */}
        {activeTab === 'investments' && (
          <div className="space-y-lg">
            <div className="grid grid-cols-2 gap-md">
              {[
                { label: 'Valor Atual',   value: portfolio?.totalCurrent, icon: 'payments',     color: 'text-primary' },
                { label: 'Rentabilidade', raw: portfolio ? `${(portfolio.totalGainPct ?? 0) >= 0 ? '+' : ''}${(portfolio.totalGainPct ?? 0).toFixed(2)}%` : '—', icon: 'show_chart', color: (portfolio?.totalGainPct ?? 0) >= 0 ? 'text-secondary' : 'text-error' },
                { label: 'Proventos',     value: proventosData?.totalRecebido,  icon: 'attach_money', color: 'text-secondary' },
                { label: 'A Receber',     value: proventosData?.totalAReceber,  icon: 'schedule',     color: 'text-on-surface-variant' },
              ].map((kpi, i) => (
                <div key={i} className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/50">
                  <div className="flex items-center gap-xs mb-xs"><span className={cn('material-symbols-outlined text-[16px]', kpi.color)}>{kpi.icon}</span><span className="text-[10px] text-on-surface-variant uppercase tracking-wider">{kpi.label}</span></div>
                  <span className={cn('font-numeric text-[16px] font-bold', kpi.color)}>{(kpi as any).raw ?? ((kpi as any).value != null ? formatCurrency((kpi as any).value) : '—')}</span>
                </div>
              ))}
            </div>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden">
              <div className="px-lg py-md border-b border-outline-variant/30 bg-surface-container-low/20"><h3 className="font-headline text-headline-md text-primary font-bold">Ativos</h3></div>
              <div className="divide-y divide-outline-variant/20">
                {(portfolio?.investments ?? []).length === 0
                  ? <div className="py-8 text-center text-outline text-xs">Nenhum ativo.</div>
                  : (portfolio?.investments ?? []).map((inv: any) => (
                    <div key={inv.id ?? `${inv.type}-${inv.ticker}`} className="px-lg py-md flex justify-between items-center">
                      <div>
                        <div className="font-body-md text-body-md text-primary font-medium">{inv.ticker || inv.name}</div>
                        <div className="text-[10px]" style={{ color: INV_COLORS[inv.type] || '#6b7280' }}>{INV_LABELS[inv.type] || inv.type}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-numeric font-bold text-sm text-primary">{formatCurrency(inv.current)}</div>
                        <div className={cn('font-numeric text-xs font-bold', inv.gainPct >= 0 ? 'text-secondary' : 'text-error')}>{inv.gainPct >= 0 ? '+' : ''}{(inv.gainPct ?? 0).toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile — Transações */}
        {activeTab === 'transactions' && (
          <div className="space-y-md">
            {transactionsData.length === 0
              ? <div className="py-8 text-center text-outline text-sm">Sem transações no período.</div>
              : transactionsData.map((tx: any) => {
                const isIncome   = tx.type === 'INCOME';
                const isTransfer = tx.type === 'TRANSFER';
                return (
                  <div key={tx.id} className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/50 flex justify-between items-center gap-md">
                    <div className="flex flex-col gap-[2px] min-w-0">
                      <span className="font-body-md text-body-md text-primary font-medium text-sm truncate">{tx.description}</span>
                      <span className="text-[10px] text-on-surface-variant">{new Date(tx.date).toLocaleDateString('pt-BR')} · {tx.account?.name}</span>
                    </div>
                    <span className={cn('font-numeric font-bold text-sm flex-shrink-0', isIncome ? 'text-secondary' : isTransfer ? 'text-blue-500' : 'text-error')}>
                      {isTransfer ? '' : isIncome ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                    </span>
                  </div>
                );
              })}
            {totalPages > 1 && (
              <div className="flex justify-center gap-xs pt-md">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border border-outline-variant rounded disabled:opacity-50"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                <span className="w-8 h-8 flex items-center justify-center bg-primary text-on-primary rounded font-label-sm font-bold">{page}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 border border-outline-variant rounded disabled:opacity-50"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
              </div>
            )}
          </div>
        )}

        {/* Mobile — Orçamentos & Metas */}
        {activeTab === 'budgets' && (
          <div className="space-y-lg">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden">
              <div className="px-lg py-md border-b border-outline-variant/30 bg-surface-container-low/20"><h3 className="font-body-lg text-body-lg text-primary font-bold">Orçamentos — {monthLabel}</h3></div>
              <div className="p-lg space-y-lg">
                {budgets.length === 0
                  ? <div className="py-4 text-center text-outline text-xs">Sem orçamentos cadastrados.</div>
                  : budgets.map((b: any) => {
                    const spent = Number((byCategory.find((c: any) => c.name === (b.category?.name || b.name)) as any)?.total ?? 0);
                    const pct   = b.limit > 0 ? Math.min(Math.round((spent / b.limit) * 100), 100) : 0;
                    const over  = spent > b.limit;
                    return (
                      <div key={b.id}>
                        <div className="flex justify-between text-xs mb-xs">
                          <span className="text-on-surface font-medium">{b.name || b.category?.name}</span>
                          <span className={cn('font-numeric font-bold', over ? 'text-error' : 'text-on-surface-variant')}>{pct}%</span>
                        </div>
                        <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: over ? 'var(--error)' : pct >= 80 ? '#f59e0b' : 'var(--secondary)' }}/>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="space-y-md">
              {goals.length === 0
                ? <div className="py-4 text-center text-outline text-xs">Sem metas cadastradas.</div>
                : goals.map((g: any) => {
                  const pct = g.targetAmount > 0 ? Math.min(Math.round(((g.currentAmount ?? 0) / g.targetAmount) * 100), 100) : 0;
                  return (
                    <div key={g.id} className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/50">
                      <div className="flex justify-between items-center mb-sm">
                        <span className="font-body-md text-body-md text-primary font-medium">{g.name}</span>
                        <span className={cn('font-numeric font-bold text-sm', pct >= 100 ? 'text-secondary' : 'text-primary')}>{pct}%</span>
                      </div>
                      <div className="h-2 bg-surface-container-high rounded-full overflow-hidden mb-xs">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? 'var(--secondary)' : 'var(--primary)' }}/>
                      </div>
                      <div className="flex justify-between text-xs text-on-surface-variant">
                        <span className="font-numeric">{formatCurrency(g.currentAmount ?? 0)}</span>
                        <span className="font-numeric">{formatCurrency(g.targetAmount)}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Mobile actions */}
        <section className="grid grid-cols-2 gap-md pt-2">
          <button onClick={downloadPdf} className="flex items-center justify-center gap-xs bg-primary text-white py-lg rounded-xl font-label-sm shadow-md active:opacity-85 transition-opacity font-bold text-xs">
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>Baixar PDF
          </button>
          <button onClick={downloadCsv} className="flex items-center justify-center gap-xs bg-surface-container-lowest border border-outline-variant text-primary py-lg rounded-xl font-label-sm active:bg-surface-container transition-colors font-bold text-xs">
            <span className="material-symbols-outlined text-[18px]">table_chart</span>Exportar CSV
          </button>
        </section>
      </div>

      {/* FAB PDF */}
      <div className="fixed bottom-24 right-md z-40 hidden md:block">
        <button onClick={downloadPdf} className="h-14 w-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all group overflow-hidden">
          <span className="material-symbols-outlined text-[24px]">file_download</span>
          <span className="max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-300 font-label-sm text-label-sm whitespace-nowrap px-0 group-hover:px-md font-bold">Exportar PDF</span>
        </button>
      </div>
    </>
  );
}
