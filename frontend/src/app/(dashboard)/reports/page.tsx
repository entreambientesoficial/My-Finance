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
  const limit = 5;

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

  const { data: cashFlow } = useQuery({
    queryKey: ['cash-flow-report'],
    queryFn: () => api.get('/reports/cash-flow?months=12').then((r) => r.data),
  });

  const { data: byCategory } = useQuery({
    queryKey: ['expenses-by-category'],
    queryFn: () => api.get('/reports/expenses-by-category?month=6&year=2026').then((r) => r.data),
  });

  // Build query URL with active filters for transactions list
  const transactionsQueryKey = ['transactions-report', page, appliedFilters];
  const { data: transactionsRes, isLoading: loadingTxs } = useQuery({
    queryKey: transactionsQueryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (appliedFilters.categoryId) params.set('categoryId', appliedFilters.categoryId);
      if (appliedFilters.accountId) params.set('accountId', appliedFilters.accountId);
      
      // Calculate start date based on period
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
    const url = `${process.env.NEXT_PUBLIC_API_URL}/reports/export/transactions.csv`;
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

  // Fallbacks in case database is empty
  const displayCashFlow = cashFlow && cashFlow.length > 0 ? cashFlow.map((flow: any) => ({
    label: flow.label || flow.month,
    income: Number(flow.income),
    expense: Number(flow.expenses)
  })) : [
    { label: 'Sem 1', income: 4500, expense: 3200 },
    { label: 'Sem 2', income: 6800, expense: 4100 },
    { label: 'Sem 3', income: 5200, expense: 4900 },
    { label: 'Sem 4', income: 9100, expense: 6200 }
  ];

  const totalMonthlyExpenses = byCategory && byCategory.length > 0
    ? byCategory.reduce((sum: number, c: any) => sum + Number(c.total), 0)
    : 12450;

  const displayByCategory = byCategory && byCategory.length > 0 ? byCategory : [
    { name: 'Habitação', total: 5602.50, percentage: 45, color: '#FF6B00' },
    { name: 'Alimentação', total: 3735.00, percentage: 30, color: '#006c49' },
    { name: 'Lazer', total: 1867.50, percentage: 15, color: '#8b5cf6' },
    { name: 'Outros', total: 1245.00, percentage: 10, color: '#75777e' }
  ];

  const displayTransactions = transactionsData.length > 0 ? transactionsData : [
    { id: 't1', date: '2023-10-28T00:00:00.000Z', description: 'Aluguel Apartamento Centro', type: 'EXPENSE', amount: 3500.00, isPaid: true, account: { name: 'Banco Itaú' }, category: { name: 'Habitação', color: '#FF6B00' } },
    { id: 't2', date: '2023-10-25T00:00:00.000Z', description: 'Venda Consultoria UX', type: 'INCOME', amount: 8200.00, isPaid: true, account: { name: 'Investimentos XP' }, category: { name: 'Receita', color: '#6cf8bb' } },
    { id: 't3', date: '2023-10-24T00:00:00.000Z', description: 'Supermercado Pão de Açúcar', type: 'EXPENSE', amount: 452.30, isPaid: false, account: { name: 'Nubank Card' }, category: { name: 'Alimentação', color: '#006c49' } }
  ];

  return (
    <>
      {/* ─── DESKTOP REPORTS VIEW ─── */}
      <div className="hidden md:block space-y-gutter">
        {/* Page Header */}
        <div className="flex justify-between items-end mb-xl">
          <div>
            <h2 className="font-display text-display-lg text-primary">Central de Relatórios</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Analise sua saúde financeira com precisão e exporte dados estruturados.</p>
          </div>
          <div className="flex gap-md">
            <button
              onClick={downloadPdf}
              className="flex items-center gap-xs px-md py-sm bg-surface-container-high text-primary font-label-sm text-label-sm rounded-lg hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Exportar PDF
            </button>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-xs px-md py-sm bg-secondary text-on-secondary font-label-sm text-label-sm rounded-lg hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <section className="grid grid-cols-12 gap-lg mb-xl">
          <div className="col-span-12 bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant flex flex-wrap gap-md items-end">
            <div className="flex-1 min-w-[200px] text-left">
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs">Período</label>
              <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-sm px-md font-body-md text-body-md focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
              >
                <option value="30">Últimos 30 dias</option>
                <option value="90">Último trimestre</option>
                <option value="365">Ano atual</option>
                <option value="all">Todo o período</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px] text-left">
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs">Categoria</label>
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-sm px-md font-body-md text-body-md focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
              >
                <option value="">Todas as Categorias</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px] text-left">
              <label className="block font-label-sm text-label-sm text-on-surface-variant mb-xs">Conta</label>
              <select 
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg py-sm px-md font-body-md text-body-md focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
              >
                <option value="">Todas as Contas</option>
                {accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={handleFilter}
              className="bg-primary text-on-primary px-xl py-sm rounded-lg font-label-sm text-label-sm hover:opacity-90 transition-opacity h-10 font-bold"
            >
              Filtrar
            </button>
          </div>
        </section>

        {/* Charts Grid */}
        <div className="grid grid-cols-12 gap-lg mb-xl">
          {/* Cash Flow Line/Area Chart */}
          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest p-xl rounded-xl shadow-sm border border-outline-variant flex flex-col justify-between h-[360px]">
            <div className="flex justify-between items-start mb-md">
              <div className="text-left">
                <h3 className="font-headline text-headline-md text-primary font-bold">Fluxo de Caixa</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">Entradas vs. Saídas no período selecionado</p>
              </div>
              <div className="flex gap-md">
                <div className="flex items-center gap-xs">
                  <span className="w-3 h-3 rounded-full bg-secondary"></span>
                  <span className="font-label-sm text-label-sm font-bold">Entradas</span>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="w-3 h-3 rounded-full bg-error"></span>
                  <span className="font-label-sm text-label-sm font-bold">Saídas</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[200px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayCashFlow}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--error)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--error)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--outline)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--outline)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)' }} />
                  <Area type="monotone" dataKey="income" stroke="var(--secondary)" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expense" stroke="var(--error)" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expenses Pie Chart */}
          <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest p-xl rounded-xl shadow-sm border border-outline-variant flex flex-col justify-between h-[360px]">
            <h3 className="font-headline text-headline-md text-primary mb-lg font-bold text-left">Despesas por Categoria</h3>
            <div className="relative flex-1 flex flex-col justify-center items-center">
              <div className="w-40 h-40 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={displayByCategory} 
                      dataKey="total" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={55} 
                      outerRadius={70} 
                      paddingAngle={2}
                    >
                      {displayByCategory.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <span className="block font-numeric text-[20px] text-primary font-bold">{formatCurrency(totalMonthlyExpenses)}</span>
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Total</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-sm mt-4 overflow-y-auto max-h-[110px] custom-scrollbar">
              {displayByCategory.map((cat: any) => (
                <div key={cat.name} className="flex justify-between items-center font-label-sm text-label-sm">
                  <div className="flex items-center gap-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-on-surface font-medium">{cat.name}</span>
                  </div>
                  <span className="font-numeric text-primary font-bold">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Table Section */}
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
          <div className="px-xl py-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
            <h3 className="font-headline text-headline-md text-primary font-bold">Detalhamento das Transações</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low/70">
                <tr className="border-b border-outline-variant/60">
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Data</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Descrição</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Categoria</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Conta</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right font-bold">Valor</th>
                  <th className="px-xl py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {loadingTxs ? (
                  <tr>
                    <td colSpan={6} className="px-xl py-8 text-center text-placeholder">Carregando...</td>
                  </tr>
                ) : displayTransactions.map((tx: any) => {
                  const isIncome = tx.type === 'INCOME';
                  const formattedDate = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                  return (
                    <tr key={tx.id} className="hover:bg-surface-container-low/20 transition-colors">
                      <td className="px-xl py-md font-numeric text-numeric-data">{formattedDate}</td>
                      <td className="px-xl py-md font-body-lg text-body-lg text-primary font-medium">{tx.description}</td>
                      <td className="px-xl py-md">
                        <span 
                          className="px-xs py-1 rounded font-label-sm text-label-sm uppercase font-bold tracking-wider"
                          style={{ 
                            backgroundColor: `${tx.category?.color || '#6b7280'}1A`,
                            color: tx.category?.color || '#6b7280'
                          }}
                        >
                          {tx.category?.name || (isIncome ? 'Receita' : 'Geral')}
                        </span>
                      </td>
                      <td className="px-xl py-md font-body-md text-body-md text-on-surface-variant">{tx.account?.name || 'Carteira'}</td>
                      <td className={cn(
                        "px-xl py-md font-numeric text-numeric-data text-right font-bold",
                        isIncome ? "text-secondary" : "text-error"
                      )}>
                        {isIncome ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                      </td>
                      <td className="px-xl py-md">
                        <span className={cn(
                          "flex items-center gap-xs font-label-sm text-label-sm font-bold uppercase",
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
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-xl py-md border-t border-outline-variant flex items-center justify-between bg-surface-container-lowest">
            <span className="font-body-md text-body-md text-on-surface-variant">
              Mostrando {displayTransactions.length} de {totalTxsCount} lançamentos
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
        </section>
      </div>

      {/* ─── MOBILE REPORTS VIEW ─── */}
      <div className="block md:hidden space-y-lg pb-12">
        {/* Welcome Section */}
        <section className="flex flex-col gap-xs text-left">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Relatórios</p>
          <h2 className="font-display-lg-mobile text-display-lg-mobile text-primary">Análise Financeira</h2>
        </section>

        {/* Mobile Charts stack */}
        <section className="space-y-lg">
          {/* Donut Chart Box */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col items-center">
            <h3 className="font-headline text-headline-md text-primary mb-md font-bold text-left w-full">Gasto por Categoria</h3>
            <div className="w-36 h-36 flex items-center justify-center relative my-md">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={displayByCategory} 
                    dataKey="total" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={45} 
                    outerRadius={58} 
                    paddingAngle={2}
                  >
                    {displayByCategory.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color || '#6b7280'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="block font-numeric text-body-lg text-primary font-bold">{formatCurrency(totalMonthlyExpenses)}</span>
                <span className="font-label-sm text-[8px] text-on-surface-variant uppercase font-bold tracking-wider">Total</span>
              </div>
            </div>
            
            <div className="w-full space-y-xs pt-md border-t border-outline-variant/60">
              {displayByCategory.map((cat: any) => (
                <div key={cat.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-xs">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-on-surface font-medium">{cat.name}</span>
                  </div>
                  <span className="font-numeric text-primary font-bold">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Evolution Chart Box */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
            <h3 className="font-headline text-headline-md text-primary mb-md font-bold text-left">Fluxo Mensal</h3>
            <div className="h-36 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayCashFlow.slice(-4)}>
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
            </div>
          </div>
        </section>

        {/* Mobile actions */}
        <section className="grid grid-cols-2 gap-md pt-2">
          <button 
            onClick={downloadPdf}
            className="flex items-center justify-center gap-xs bg-primary text-white py-lg rounded-xl font-label-sm shadow-md active:opacity-80 transition-opacity font-bold"
          >
            <span className="material-symbols-outlined">picture_as_pdf</span>
            Baixar PDF
          </button>
          <button 
            onClick={downloadCsv}
            className="flex items-center justify-center gap-xs bg-surface-container-lowest border border-outline text-primary py-lg rounded-xl font-label-sm active:bg-surface-container transition-colors font-bold"
          >
            <span className="material-symbols-outlined">table_chart</span>
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
          <span className="max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-300 font-label-sm text-label-sm whitespace-nowrap px-0 group-hover:px-md font-bold">Exportar Tudo</span>
        </button>
      </div>
    </>
  );
}
