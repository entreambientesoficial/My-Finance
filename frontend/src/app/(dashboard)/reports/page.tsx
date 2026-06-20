'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function ReportsPage() {
  const [period, setPeriod] = useState('30');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10; // Increased limit for desktop

  // Active filters applied on click
  const [appliedFilters, setAppliedFilters] = useState({
    period: '30',
    categoryId: '',
    accountId: '',
  });

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  });

  // Reactive Cash Flow Query
  const { data: cashFlow = [], isLoading: loadingCashFlow } = useQuery({
    queryKey: ['cash-flow-report', appliedFilters.accountId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('months', '12');
      if (appliedFilters.accountId) {
        params.set('accountId', appliedFilters.accountId);
      }
      return api.get(`/reports/cash-flow?${params.toString()}`).then((r) => r.data);
    },
  });

  // Reactive Category Query
  const { data: byCategory = [], isLoading: loadingCategory } = useQuery({
    queryKey: ['expenses-by-category', appliedFilters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (appliedFilters.period && appliedFilters.period !== 'all') {
        const d = new Date();
        d.setDate(d.getDate() - Number(appliedFilters.period));
        params.set('startDate', d.toISOString().slice(0, 10));
        params.set('endDate', new Date().toISOString().slice(0, 10));
      }
      if (appliedFilters.accountId) {
        params.set('accountId', appliedFilters.accountId);
      }
      return api.get(`/reports/expenses-by-category?${params.toString()}`).then((r) => r.data);
    },
  });

  // Reactive Transactions Query
  const transactionsQueryKey = ['transactions-report', page, appliedFilters];
  const { data: transactionsRes, isLoading: loadingTxs } = useQuery({
    queryKey: transactionsQueryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (appliedFilters.categoryId) params.set('categoryId', appliedFilters.categoryId);
      if (appliedFilters.accountId) params.set('accountId', appliedFilters.accountId);
      
      if (appliedFilters.period && appliedFilters.period !== 'all') {
        const d = new Date();
        d.setDate(d.getDate() - Number(appliedFilters.period));
        params.set('startDate', d.toISOString());
      }
      return api.get(`/transactions?${params.toString()}`).then((r) => r.data);
    },
  });

  const transactionsData = transactionsRes?.data || [];
  const totalTxsCount = transactionsRes?.meta?.total || transactionsData.length;
  const totalPages = transactionsRes?.meta?.pages || 1;

  function handleFilter() {
    setPage(1);
    setAppliedFilters({
      period,
      categoryId: selectedCategory,
      accountId: selectedAccount,
    });
  }

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
      .catch(() => toast.error('Erro ao exportar PDF'));
  }

  function downloadCsv() {
    const token = localStorage.getItem('accessToken');
    const params = new URLSearchParams();
    if (appliedFilters.period && appliedFilters.period !== 'all') {
      const d = new Date();
      d.setDate(d.getDate() - Number(appliedFilters.period));
      params.set('startDate', d.toISOString().slice(0, 10));
      params.set('endDate', new Date().toISOString().slice(0, 10));
    }
    const url = `${process.env.NEXT_PUBLIC_API_URL}/reports/export/transactions.csv?${params.toString()}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `lancamentos-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Erro ao exportar CSV'));
  }

  // Formatting data for display
  const displayCashFlow = cashFlow.map((flow: any) => ({
    label: flow.label || flow.month,
    income: Number(flow.income),
    expense: Number(flow.expenses),
  }));

  const hasCashFlowData = displayCashFlow.some((d) => d.income > 0 || d.expense > 0);

  const totalExpenses = byCategory.reduce((sum: number, c: any) => sum + Number(c.total), 0);

  return (
    <>
      {/* ─── DESKTOP REPORTS VIEW ─── */}
      <div className="hidden md:block space-y-gutter">
        {/* Page Header */}
        <div className="flex justify-between items-end mb-xl">
          <div className="text-left">
            <h2 className="font-display text-display-lg text-primary">Central de Relatórios</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Analise sua saúde financeira com precisão e exporte dados estruturados.</p>
          </div>
          <div className="flex gap-md">
            <button
              onClick={downloadPdf}
              className="flex items-center gap-xs px-md py-sm bg-surface-container-high text-primary font-label-sm text-label-sm rounded-lg hover:bg-surface-container-highest transition-colors border border-outline-variant/60 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Exportar PDF Resumido
            </button>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-xs px-md py-sm bg-secondary text-on-secondary font-label-sm text-label-sm rounded-lg hover:opacity-90 transition-opacity shadow-md"
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              Exportar CSV Filtrado
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <section className="grid grid-cols-12 gap-lg mb-xl">
          <div className="col-span-12 bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/50 flex flex-wrap gap-md items-end justify-between">
            <div className="flex flex-wrap gap-md flex-1">
              <div className="w-56 text-left">
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs">Período de Transações</label>
                <select 
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-sm px-md font-body-md text-body-md focus:ring-2 focus:ring-primary/20 outline-none text-on-surface transition-all"
                >
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Último trimestre</option>
                  <option value="365">Último ano</option>
                  <option value="all">Todo o período</option>
                </select>
              </div>
              <div className="w-56 text-left">
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs">Filtrar por Categoria</label>
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-sm px-md font-body-md text-body-md focus:ring-2 focus:ring-primary/20 outline-none text-on-surface transition-all"
                >
                  <option value="">Todas as Categorias</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-56 text-left">
                <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs">Filtrar por Conta / Carteira</label>
                <select 
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-sm px-md font-body-md text-body-md focus:ring-2 focus:ring-primary/20 outline-none text-on-surface transition-all"
                >
                  <option value="">Todas as Contas</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button 
              onClick={handleFilter}
              className="bg-primary text-on-primary px-xl py-sm rounded-lg font-label-sm text-label-sm hover:opacity-95 transition-opacity h-10 font-bold shadow-sm"
            >
              Aplicar Filtros
            </button>
          </div>
        </section>

        {/* Charts Grid */}
        <div className="grid grid-cols-12 gap-lg mb-xl">
          {/* Cash Flow Line/Area Chart */}
          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest p-xl rounded-xl shadow-sm border border-outline-variant/50 flex flex-col justify-between h-[400px]">
            <div className="flex justify-between items-start mb-md">
              <div className="text-left">
                <h3 className="font-headline text-headline-md text-primary font-bold">Fluxo de Caixa Consolidado</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">Comparativo de Receitas vs. Despesas (últimos 12 meses)</p>
              </div>
              <div className="flex gap-md">
                <div className="flex items-center gap-xs">
                  <span className="w-3 h-3 rounded-full bg-secondary"></span>
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface-variant">Entradas</span>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="w-3 h-3 rounded-full bg-error"></span>
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface-variant">Saídas</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[220px] mt-4 relative">
              {loadingCashFlow ? (
                <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant font-body-md">
                  Carregando dados do gráfico...
                </div>
              ) : !hasCashFlowData ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-md bg-surface-container-low/20 rounded-lg border border-dashed border-outline-variant">
                  <span className="material-symbols-outlined text-[36px] text-outline mb-xs">analytics</span>
                  <p className="font-body-lg text-on-surface-variant">Nenhum fluxo de caixa registrado para esta conta.</p>
                  <p className="text-xs text-outline">Os dados do gráfico serão exibidos assim que você tiver lançamentos confirmados.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayCashFlow}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--error)" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="var(--error)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'var(--surface-container-high)', borderRadius: '12px', border: '1px solid var(--outline-variant)' }} />
                    <Area type="monotone" dataKey="income" stroke="var(--secondary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="expense" stroke="var(--error)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Expenses Pie Chart */}
          <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest p-xl rounded-xl shadow-sm border border-outline-variant/50 flex flex-col justify-between h-[400px]">
            <h3 className="font-headline text-headline-md text-primary mb-md font-bold text-left">Gasto Real por Categoria</h3>
            
            <div className="relative flex-1 flex flex-col justify-center items-center my-sm min-h-[160px]">
              {loadingCategory ? (
                <div className="text-on-surface-variant font-body-md">Carregando categorias...</div>
              ) : byCategory.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-md bg-surface-container-low/20 rounded-lg border border-dashed border-outline-variant w-full h-full">
                  <span className="material-symbols-outlined text-[36px] text-outline mb-xs">pie_chart</span>
                  <p className="font-body-md text-on-surface-variant font-medium">Sem despesas registradas</p>
                  <p className="text-[11px] text-outline px-sm">Tente mudar o período de busca ou selecionar outra conta bancária.</p>
                </div>
              ) : (
                <div className="w-44 h-44 flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={byCategory} 
                        dataKey="total" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={58} 
                        outerRadius={74} 
                        paddingAngle={2.5}
                      >
                        {byCategory.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color || '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'var(--surface-container-high)', borderRadius: '12px', border: '1px solid var(--outline-variant)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute text-center flex flex-col justify-center items-center pointer-events-none">
                    <span className="block font-numeric text-[18px] text-primary font-bold tracking-tight">{formatCurrency(totalExpenses)}</span>
                    <span className="font-label-sm text-[9px] text-on-surface-variant uppercase font-bold tracking-wider">Total</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-xs mt-2 overflow-y-auto max-h-[120px] pr-xs custom-scrollbar">
              {byCategory.map((cat: any) => (
                <div key={cat.name} className="flex justify-between items-center font-label-sm text-[12px] py-1 border-b border-outline-variant/20 last:border-b-0">
                  <div className="flex items-center gap-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-on-surface font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-md">
                    <span className="text-on-surface-variant font-numeric">{formatCurrency(cat.total)}</span>
                    <span className="font-numeric text-primary font-bold w-10 text-right">{cat.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Table Section */}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden shadow-sm">
          <div className="px-xl py-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low/20">
            <h3 className="font-headline text-headline-md text-primary font-bold text-left">Detalhamento das Transações do Período</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low/50">
                <tr className="border-b border-outline-variant/40">
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Data</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Descrição</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Categoria</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Conta</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right font-bold">Valor</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {loadingTxs ? (
                  <tr>
                    <td colSpan={6} className="px-xl py-12 text-center text-on-surface-variant">Carregando transações...</td>
                  </tr>
                ) : transactionsData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-xl py-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-[32px] text-outline mb-xs">search_off</span>
                        <p className="font-body-lg">Nenhuma transação encontrada</p>
                        <p className="text-xs text-outline">Tente ajustar seus filtros de categoria ou período de busca.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactionsData.map((tx: any) => {
                    const isIncome = tx.type === 'INCOME';
                    const formattedDate = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                    return (
                      <tr key={tx.id} className="hover:bg-surface-container-low/10 transition-colors">
                        <td className="px-xl py-md font-numeric text-numeric-data">{formattedDate}</td>
                        <td className="px-xl py-md font-body-lg text-body-lg text-primary font-medium text-left">{tx.description}</td>
                        <td className="px-xl py-md text-left">
                          <span 
                            className="px-xs py-1 rounded font-label-sm text-[11px] uppercase font-bold tracking-wider"
                            style={{ 
                              backgroundColor: `${tx.category?.color || '#75777e'}15`,
                              color: tx.category?.color || '#75777e'
                            }}
                          >
                            {tx.category?.name || 'Geral'}
                          </span>
                        </td>
                        <td className="px-xl py-md font-body-md text-body-md text-on-surface-variant text-left">{tx.account?.name || 'Carteira'}</td>
                        <td className={cn(
                          "px-xl py-md font-numeric text-numeric-data text-right font-bold",
                          isIncome ? "text-secondary" : "text-error"
                        )}>
                          {isIncome ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                        </td>
                        <td className="px-xl py-md text-left">
                          <span className={cn(
                            "flex items-center gap-xs font-label-sm text-[11px] font-bold uppercase",
                            tx.isPaid ? "text-secondary" : "text-on-surface-variant"
                          )}>
                            <span className="material-symbols-outlined text-[16px]">
                              {tx.isPaid ? 'check_circle' : 'schedule'}
                            </span>
                            {tx.isPaid ? (isIncome ? 'Recebido' : 'Pago') : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-xl py-md border-t border-outline-variant/30 flex items-center justify-between bg-surface-container-lowest">
              <span className="font-body-md text-body-md text-on-surface-variant">
                Mostrando {transactionsData.length} de {totalTxsCount} lançamentos
              </span>
              <div className="flex gap-xs">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border border-outline-variant rounded hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <button className="w-8 h-8 flex items-center justify-center bg-primary text-on-primary rounded font-label-sm text-label-sm font-bold">
                  {page}
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 border border-outline-variant rounded hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ─── MOBILE REPORTS VIEW ─── */}
      <div className="block md:hidden space-y-lg pb-12">
        {/* Welcome Section */}
        <section className="flex flex-col gap-xs text-left">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Relatórios</p>
          <h2 className="font-display-lg-mobile text-display-lg-mobile text-primary">Análise Financeira</h2>
        </section>

        {/* Mobile Filters Trigger */}
        <section className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/50 flex flex-col gap-sm">
          <div className="grid grid-cols-1 gap-xs text-left">
            <span className="text-[11px] font-bold text-on-surface-variant">Período</span>
            <select 
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg py-xs px-sm text-sm"
            >
              <option value="30">Últimos 30 dias</option>
              <option value="90">Último trimestre</option>
              <option value="365">Último ano</option>
              <option value="all">Todo o período</option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-xs text-left">
            <span className="text-[11px] font-bold text-on-surface-variant">Conta</span>
            <select 
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg py-xs px-sm text-sm"
            >
              <option value="">Todas as Contas</option>
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleFilter}
            className="bg-primary text-on-primary py-sm rounded-lg font-bold text-xs"
          >
            Atualizar Gráficos
          </button>
        </section>

        {/* Mobile Charts stack */}
        <section className="space-y-lg">
          {/* Donut Chart Box */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/50 shadow-sm flex flex-col items-center">
            <h3 className="font-headline text-headline-md text-primary mb-md font-bold text-left w-full">Gasto por Categoria</h3>
            
            {loadingCategory ? (
              <div className="py-8 text-on-surface-variant">Carregando...</div>
            ) : byCategory.length === 0 ? (
              <div className="py-8 text-center text-outline text-xs">Sem despesas registradas no período.</div>
            ) : (
              <>
                <div className="w-36 h-36 flex items-center justify-center relative my-md">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={byCategory} 
                        dataKey="total" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={46} 
                        outerRadius={58} 
                        paddingAngle={2}
                      >
                        {byCategory.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color || '#6b7280'} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute text-center flex flex-col justify-center items-center pointer-events-none">
                    <span className="block font-numeric text-xs font-bold text-primary">{formatCurrency(totalExpenses)}</span>
                    <span className="font-label-sm text-[8px] text-on-surface-variant uppercase font-bold tracking-wider">Total</span>
                  </div>
                </div>
                
                <div className="w-full space-y-xs pt-md border-t border-outline-variant/40">
                  {byCategory.map((cat: any) => (
                    <div key={cat.name} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-xs">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-on-surface font-medium">{cat.name}</span>
                      </div>
                      <span className="font-numeric text-primary font-bold">{cat.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Evolution Chart Box */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant/50 shadow-sm">
            <h3 className="font-headline text-headline-md text-primary mb-md font-bold text-left">Fluxo Mensal (12m)</h3>
            <div className="h-36 mt-4 relative">
              {loadingCashFlow ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs">Carregando...</div>
              ) : !hasCashFlowData ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-outline">Sem dados de fluxo de caixa.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayCashFlow}>
                    <defs>
                      <linearGradient id="mColorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--outline)' }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="income" stroke="var(--secondary)" strokeWidth={2} fillOpacity={1} fill="url(#mColorIncome)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* Mobile actions */}
        <section className="grid grid-cols-2 gap-md pt-2">
          <button 
            onClick={downloadPdf}
            className="flex items-center justify-center gap-xs bg-primary text-white py-lg rounded-xl font-label-sm shadow-md active:opacity-85 transition-opacity font-bold text-xs"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Baixar PDF
          </button>
          <button 
            onClick={downloadCsv}
            className="flex items-center justify-center gap-xs bg-surface-container-lowest border border-outline-variant text-primary py-lg rounded-xl font-label-sm active:bg-surface-container transition-colors font-bold text-xs"
          >
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            Exportar CSV
          </button>
        </section>
      </div>

      {/* FAB for Quick PDF export */}
      <div className="fixed bottom-24 right-md z-40 hidden md:block">
        <button 
          onClick={downloadPdf}
          className="h-14 w-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all group overflow-hidden"
        >
          <span className="material-symbols-outlined text-[24px]">file_download</span>
          <span className="max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-300 font-label-sm text-label-sm whitespace-nowrap px-0 group-hover:px-md font-bold">Exportar PDF</span>
        </button>
      </div>
    </>
  );
}
