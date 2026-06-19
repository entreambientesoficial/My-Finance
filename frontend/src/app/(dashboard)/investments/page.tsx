'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const TYPE_LABELS: Record<string, string> = {
  STOCK: 'Ações',
  FUND: 'FIIs',
  BOND: 'Renda Fixa',
  CRYPTO: 'Crypto',
  REAL_ESTATE: 'Imóvel',
  SAVINGS: 'Poupança',
  OTHER: 'Outro',
};

const TYPE_ICONS: Record<string, string> = {
  STOCK: 'equalizer',
  FUND: 'apartment',
  BOND: 'description',
  CRYPTO: 'currency_bitcoin',
  REAL_ESTATE: 'home_work',
  SAVINGS: 'savings',
  OTHER: 'folder',
};

const TYPE_COLORS: Record<string, string> = {
  STOCK: '#031632',
  FUND: '#006c49',
  BOND: '#1a2b48',
  CRYPTO: '#FF6B00',
  REAL_ESTATE: '#8b5cf6',
  SAVINGS: '#0078A8',
  OTHER: '#75777e',
};

export default function InvestmentsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    STOCK: true,
    FUND: true,
    BOND: true,
  });

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.get('/investments/portfolio').then((r) => r.data),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions-dividends'],
    queryFn: () => api.get('/transactions?limit=100').then((r) => r.data?.data || r.data || []),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  });

  const { register, handleSubmit, reset, control } = useForm<any>({
    defaultValues: { type: 'STOCK' }
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/investments', {
      ...data,
      quantity: data.quantity ? Number(data.quantity) : undefined,
      purchasePrice: data.purchasePrice ? Number(data.purchasePrice) : undefined,
      currentPrice: data.currentPrice ? Number(data.currentPrice) : undefined,
      accountId: data.accountId || undefined,
      purchaseDate: data.purchaseDate || undefined,
    }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['portfolio'] }); 
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['recent-transactions-activity'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Investimento adicionado à carteira!'); 
      reset(); 
      setShowForm(false); 
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar investimento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/investments/${id}`),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['portfolio'] }); 
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['recent-transactions-activity'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Ativo removido!'); 
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao remover ativo'),
  });

  const toggleCategory = (type: string) => {
    setExpandedCats(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const hasRealInvestments = portfolio?.investments?.length > 0;

  // Totals
  const displayTotalCurrent = hasRealInvestments ? Number(portfolio.totalCurrent) : 0;
  const displayTotalCost = hasRealInvestments ? Number(portfolio.totalCost) : 0;
  const displayTotalGain = hasRealInvestments ? Number(portfolio.totalGain) : 0;
  const displayTotalGainPct = hasRealInvestments ? Number(portfolio.totalGainPct) : 0;

  // Calculate dividends dynamically from real transactions
  const displayDividends = transactions
    .filter((t: any) => 
      t.type === 'INCOME' && 
      (t.description?.toLowerCase().includes('dividendo') || 
       t.description?.toLowerCase().includes('rendimento') || 
       t.description?.toLowerCase().includes('provento') || 
       t.description?.toLowerCase().includes('jcp') ||
       t.account?.type === 'INVESTMENT')
    )
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  // Group investments by category/type
  const groupedInvestments = hasRealInvestments 
    ? portfolio.investments.reduce((acc: any, inv: any) => {
        if (!acc[inv.type]) acc[inv.type] = [];
        acc[inv.type].push(inv);
        return acc;
      }, {})
    : {};

  // Calculate allocation chart data
  const allocationData = Object.entries(groupedInvestments).map(([type, list]: [string, any]) => {
    const typeTotal = list.reduce((sum: number, item: any) => sum + Number(item.current || (item.quantity * item.currentPrice)), 0);
    const pct = displayTotalCurrent > 0 ? Math.round((typeTotal / displayTotalCurrent) * 100) : 0;
    return {
      name: TYPE_LABELS[type] || type,
      value: typeTotal,
      percentage: pct,
      color: TYPE_COLORS[type] || '#75777e'
    };
  });

  const finalAllocation = allocationData;

  // Dynamic evolution chart calculated relative to cost and current values
  const getEvolutionData = () => {
    if (displayTotalCurrent <= 0) return [];
    
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentMonthIdx = new Date().getMonth();
    
    const data = [];
    const baseValue = displayTotalCost;
    const gain = displayTotalCurrent - displayTotalCost;
    
    for (let i = 5; i >= 0; i--) {
      const idx = (currentMonthIdx - i + 12) % 12;
      const progress = (5 - i) / 5; // 0 to 1
      const val = baseValue + (gain * progress);
      data.push({
        label: months[idx],
        value: Math.round(val * 100) / 100
      });
    }
    return data;
  };

  const displayEvolution = getEvolutionData();

  // Dynamic yield vs CDI benchmark
  const cdiBenchmark = 5.2; // 6-month CDI approximation
  const yieldVsCdi = displayTotalCost > 0 ? (displayTotalGainPct / cdiBenchmark) * 100 : 0;
  const displayYieldVsCdi = yieldVsCdi > 0 ? `${yieldVsCdi.toFixed(1)}%` : '0.0%';
  const displayCDIProgress = Math.min(100, Math.round(yieldVsCdi));

  return (
    <>
      {/* ─── UNIFIED HEADER & FORM ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-xl text-left">
        <div>
          <h2 className="font-display text-display-lg text-primary">Gestão de Investimentos</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Acompanhe seu portfólio de ativos e analise a rentabilidade consolidada.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-xs bg-primary text-on-primary px-lg py-md rounded-lg font-label-sm text-label-sm active:scale-95 transition-transform font-bold"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Adicionar Ativo
        </button>
      </div>

      {/* Shared Create Form */}
      {showForm && (
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant text-left mb-gutter">
          <h2 className="font-headline text-headline-md text-primary font-bold mb-2">Adicionar Ativo à Carteira</h2>
          <p className="text-on-surface-variant text-xs mb-4 font-semibold">Cadastre a compra de um ativo. Você pode associá-lo a uma conta bancária para debitar o valor de aquisição automaticamente.</p>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Nome do Ativo *</label>
              <input {...register('name')} placeholder="Ex: Itaúsa" className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Tipo de Investimento</label>
              <select {...register('type')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface cursor-pointer">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Ticker/Símbolo *</label>
              <input {...register('ticker')} placeholder="Ex: ITSA4" className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Quantidade *</label>
              <input type="number" step="0.000001" {...register('quantity')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Preço Médio de Compra (R$) *</label>
              <Controller
                control={control}
                name="purchasePrice"
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                    required
                  />
                )}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Preço de Cotação Atual (R$)</label>
              <Controller
                control={control}
                name="currentPrice"
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  />
                )}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Corretora</label>
              <input {...register('broker')} placeholder="Ex: XP Investimentos" className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Conta de Origem (Opcional)</label>
              <select {...register('accountId')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface cursor-pointer">
                <option value="">Apenas registrar ativo (sem deduzir saldo)</option>
                {accounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (Saldo: {formatCurrency(Number(acc.balance), acc.currency)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Data de Aquisição</label>
              <input type="date" {...register('purchaseDate')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" />
            </div>
            <div className="col-span-1 md:col-span-3 flex gap-2 justify-end pt-2 border-t border-border-base mt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-outline rounded-lg text-on-surface-variant hover:bg-surface-container transition-all">Cancelar</button>
              <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 disabled:opacity-60 font-bold">
                {createMutation.isPending ? 'Adicionando...' : 'Adicionar Ativo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── DESKTOP INVESTMENTS VIEW ─── */}
      <div className="hidden md:block space-y-gutter">
        {/* Summary Stats Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
          {/* Total Patrimony */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <div className="flex justify-between items-start mb-sm">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-bold">Patrimônio Total</p>
              <span className="material-symbols-outlined text-primary bg-surface-container p-1 rounded">account_balance_wallet</span>
            </div>
            <h2 className="font-display text-display-lg text-primary font-bold">{formatCurrency(displayTotalCurrent)}</h2>
            <div className="flex items-center gap-xs mt-xs">
              <span className="material-symbols-outlined text-secondary text-sm">trending_up</span>
              <p className="text-secondary font-numeric text-numeric-data font-bold">+{formatCurrency(displayTotalGain)} acumulado</p>
            </div>
          </div>
          
          {/* Total Profit */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <div className="flex justify-between items-start mb-sm">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-bold">Resultado Consolidado</p>
              <span className="material-symbols-outlined text-secondary bg-secondary-container/20 p-1 rounded">payments</span>
            </div>
            <h2 className={cn("font-display text-display-lg font-bold", displayTotalGain >= 0 ? "text-secondary" : "text-error")}>
              {formatCurrency(displayTotalGain)}
            </h2>
            <p className="text-on-surface-variant font-numeric text-numeric-data mt-xs font-semibold">Rentabilidade: {displayTotalGainPct.toFixed(1)}%</p>
          </div>

          {/* Dividends */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <div className="flex justify-between items-start mb-sm">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-bold">Proventos Recebidos</p>
              <span className="material-symbols-outlined text-primary bg-surface-container p-1 rounded">savings</span>
            </div>
            <h2 className="font-display text-display-lg text-primary font-bold">{formatCurrency(displayDividends)}</h2>
            <p className="text-on-surface-variant font-numeric text-numeric-data mt-xs font-semibold">Média mensal: {formatCurrency(displayDividends / 12)}</p>
          </div>

          {/* Global Yield */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-sm">
                <p className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-bold">Rentabilidade vs CDI</p>
                <span className="material-symbols-outlined text-primary bg-surface-container p-1 rounded">show_chart</span>
              </div>
              <h2 className="font-display text-display-lg text-primary font-bold">{displayYieldVsCdi} <span className="text-label-sm font-label-sm text-on-surface-variant font-normal">vs CDI</span></h2>
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
              <div className="bg-secondary h-full" style={{ width: `${displayCDIProgress}%` }}></div>
            </div>
          </div>
        </section>

        {/* Charts Section Evolution vs Asset Allocation */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-lg mt-gutter">
          {/* Evolution Chart */}
          <div className="lg:col-span-2 bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm h-[320px] flex flex-col justify-between text-left">
            <div className="flex justify-between items-center mb-lg">
              <h3 className="font-headline text-headline-md text-primary font-bold">Evolução do Patrimônio</h3>
              <span className="text-xs bg-surface-container-high px-3 py-1 rounded-full font-bold uppercase text-primary">Últimos 6 meses</span>
            </div>
            
            <div className="flex-grow min-h-[180px] flex items-center justify-center">
              {displayEvolution.length === 0 ? (
                <div className="text-center text-on-surface-variant text-sm">
                  <span className="material-symbols-outlined text-3xl mb-1 block">show_chart</span>
                  Adicione ativos para visualizar a evolução do patrimônio.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayEvolution}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--outline)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--outline)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)' }} />
                    <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Allocation Pie Chart */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col justify-between h-[320px] text-left">
            <h3 className="font-headline text-headline-md text-primary mb-md font-bold">Alocação de Ativos</h3>
            <div className="flex-grow flex items-center justify-center relative">
              {finalAllocation.length === 0 ? (
                <div className="text-center text-on-surface-variant text-sm">
                  <span className="material-symbols-outlined text-3xl mb-1 block">pie_chart</span>
                  Alocação indisponível.
                </div>
              ) : (
                <div className="w-36 h-36 flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={finalAllocation} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={45} 
                        outerRadius={58} 
                        paddingAngle={2}
                      >
                        {finalAllocation.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute text-center">
                    <span className="block font-numeric text-[11px] text-primary font-bold">{formatCurrency(displayTotalCurrent)}</span>
                    <span className="font-label-sm text-[8px] text-on-surface-variant uppercase font-bold tracking-wider">Investido</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-xs overflow-y-auto max-h-[90px] custom-scrollbar mt-4">
              {finalAllocation.map((cat: any) => (
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
        </section>

        {/* Asset Categories collapsible list */}
        <section className="space-y-sm mt-gutter text-left">
          <div className="flex justify-between items-center px-sm">
            <h3 className="font-headline text-headline-md text-primary font-bold">Categorias de Ativos</h3>
          </div>

          {!isLoading && !hasRealInvestments ? (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-xl text-center flex flex-col items-center gap-md">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-[32px]">folder_open</span>
              </div>
              <div>
                <h4 className="font-headline text-headline-md text-primary font-bold">Nenhum ativo cadastrado</h4>
                <p className="text-on-surface-variant font-body-md text-body-md mt-xs">Adicione seus ativos para ver a alocação e o resultado consolidado da sua carteira.</p>
              </div>
              <button 
                onClick={() => setShowForm(true)}
                className="bg-primary text-on-primary px-lg py-md rounded-lg font-label-sm text-label-sm font-bold active:scale-95 transition-transform"
              >
                Cadastrar Meu Primeiro Ativo
              </button>
            </div>
          ) : (
            Object.entries(TYPE_LABELS).map(([typeKey, label]) => {
              const list = groupedInvestments[typeKey] || [];
              const isExpanded = !!expandedCats[typeKey];
              if (list.length === 0) return null;

              const categoryTotal = list.reduce((sum: number, item: any) => sum + Number(item.current || (item.quantity * item.currentPrice)), 0);
              const categoryPercent = displayTotalCurrent > 0 ? Math.round((categoryTotal / displayTotalCurrent) * 100) : 0;
              const categoryCost = list.reduce((sum: number, item: any) => sum + Number((item.quantity * item.purchasePrice) || 0), 0);
              const categoryGain = categoryTotal - categoryCost;
              const categoryGainPct = categoryCost > 0 ? (categoryGain / categoryCost) * 100 : 0;

              return (
                <div 
                  key={typeKey} 
                  className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden"
                >
                  <button 
                    onClick={() => toggleCategory(typeKey)}
                    className="w-full flex items-center justify-between p-lg hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-lg">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${TYPE_COLORS[typeKey]}1A`, color: TYPE_COLORS[typeKey] }}>
                        <span className="material-symbols-outlined text-2xl">{TYPE_ICONS[typeKey]}</span>
                      </div>
                      <div className="text-left">
                        <h4 className="font-headline text-headline-md text-primary font-bold">{label}</h4>
                        <p className="text-on-surface-variant font-label-sm text-label-sm">{list.length} ativos ativos</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-xl text-right">
                      <div className="hidden md:block">
                        <p className="text-on-surface-variant font-label-sm text-[10px] uppercase font-bold tracking-wider">Total Aplicado</p>
                        <p className="font-numeric text-numeric-data text-primary font-bold">{formatCurrency(categoryTotal)}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-on-surface-variant font-label-sm text-[10px] uppercase font-bold tracking-wider">Resultado</p>
                        <p className={cn("font-numeric text-numeric-data font-bold", categoryGain >= 0 ? "text-secondary" : "text-error")}>
                          {categoryGainPct >= 0 ? '+' : ''}{categoryGainPct.toFixed(1)}%
                        </p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-on-surface-variant font-label-sm text-[10px] uppercase font-bold tracking-wider">% Carteira</p>
                        <p className="font-numeric text-numeric-data text-primary font-bold">{categoryPercent}%</p>
                      </div>
                      <span className="material-symbols-outlined text-outline-variant transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        expand_more
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-outline-variant bg-surface-container-low/20">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-surface-container-low font-label-sm text-label-sm uppercase font-bold">
                          <tr className="border-b border-outline-variant/60">
                            <th className="px-lg py-sm font-bold">Ativo</th>
                            <th className="px-lg py-sm font-bold text-right">Qtd</th>
                            <th className="px-lg py-sm font-bold text-right">Pço Médio</th>
                            <th className="px-lg py-sm font-bold text-right">Preço Atual</th>
                            <th className="px-lg py-sm font-bold text-right">Saldo Atual</th>
                            <th className="px-lg py-sm font-bold text-right">Resultado</th>
                            <th className="px-lg py-sm"></th>
                          </tr>
                        </thead>
                        <tbody className="font-numeric text-numeric-data text-on-surface-variant">
                          {list.map((inv: any) => {
                            const cost = Number(inv.quantity) * Number(inv.purchasePrice);
                            const currentVal = Number(inv.current || (inv.quantity * inv.currentPrice));
                            const gain = currentVal - cost;
                            const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
                            return (
                              <tr key={inv.id} className="border-b border-outline-variant/40 hover:bg-surface-container-high/30 transition-colors">
                                <td className="px-lg py-md text-primary font-bold">{inv.ticker || inv.name}</td>
                                <td className="px-lg py-md text-right">{Number(inv.quantity).toLocaleString('pt-BR')}</td>
                                <td className="px-lg py-md text-right">{formatCurrency(Number(inv.purchasePrice))}</td>
                                <td className="px-lg py-md text-right">{formatCurrency(Number(inv.currentPrice || inv.purchasePrice))}</td>
                                <td className="px-lg py-md text-right text-primary font-semibold">{formatCurrency(currentVal)}</td>
                                <td className={cn(
                                  "px-lg py-md text-right font-bold",
                                  gain >= 0 ? "text-secondary" : "text-error"
                                )}>
                                  {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                                </td>
                                <td className="px-lg py-md text-right">
                                  <button 
                                    onClick={() => { if (confirm('Excluir este ativo?')) deleteMutation.mutate(inv.id); }}
                                    className="text-placeholder hover:text-error transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* ─── MOBILE INVESTMENTS VIEW ─── */}
      <div className="block md:hidden space-y-lg pb-12">
        {/* Consolidated Value Card */}
        <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Patrimônio Atual</p>
          <p className="font-display-lg-mobile text-display-lg-mobile text-primary font-bold">{formatCurrency(displayTotalCurrent)}</p>
          <div className="flex gap-2 items-center mt-2 pt-2 border-t border-outline-variant/30 text-xs">
            <span className={cn("font-bold", displayTotalGain >= 0 ? "text-secondary" : "text-error")}>
              Resultado: {formatCurrency(displayTotalGain)} ({displayTotalGainPct.toFixed(1)}%)
            </span>
          </div>
        </section>

        {/* Collapsible stack of assets */}
        <section className="space-y-md">
          <div className="flex justify-between items-center">
            <h3 className="font-headline text-headline-md text-primary font-bold">Meus Ativos</h3>
          </div>

          <div className="space-y-sm">
            {Object.entries(groupedInvestments).map(([typeKey, list]: [string, any]) => {
              if (list.length === 0) return null;
              const typeTotal = list.reduce((sum: number, item: any) => sum + Number(item.current || (item.quantity * item.currentPrice)), 0);
              const isExpanded = !!expandedCats[typeKey];
              return (
                <div key={typeKey} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden text-left">
                  <button 
                    onClick={() => toggleCategory(typeKey)}
                    className="w-full flex items-center justify-between p-md hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-md">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: TYPE_COLORS[typeKey] }}>
                        <span className="material-symbols-outlined text-[18px]">{TYPE_ICONS[typeKey]}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-label-sm text-on-surface font-bold">{TYPE_LABELS[typeKey]}</p>
                        <p className="text-[10px] text-on-surface-variant font-semibold">{list.length} ativos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <p className="font-numeric text-body-lg font-bold text-primary">{formatCurrency(typeTotal)}</p>
                      <span className="material-symbols-outlined text-outline-variant text-[18px] transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        expand_more
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-outline-variant/60 bg-surface-container-low/20 divide-y divide-outline-variant/30 px-md py-sm space-y-sm">
                      {list.map((inv: any) => {
                        const cost = Number(inv.quantity) * Number(inv.purchasePrice);
                        const currentVal = Number(inv.current || (inv.quantity * inv.currentPrice));
                        const gain = currentVal - cost;
                        const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
                        return (
                          <div key={inv.id} className="pt-sm first:pt-0 flex flex-col gap-xs text-xs">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-bold text-primary">{inv.ticker || inv.name}</span>
                                {inv.broker && <span className="text-[10px] text-on-surface-variant ml-2">({inv.broker})</span>}
                              </div>
                              <button 
                                onClick={() => { if (confirm('Excluir este ativo?')) deleteMutation.mutate(inv.id); }}
                                className="text-placeholder hover:text-error transition-colors p-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                              <div>
                                <span className="block text-[9px] uppercase font-bold text-outline">Qtd / Pço Médio</span>
                                <span className="font-medium">{Number(inv.quantity).toLocaleString('pt-BR')} x {formatCurrency(Number(inv.purchasePrice))}</span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[9px] uppercase font-bold text-outline">Preço Atual</span>
                                <span className="font-medium">{formatCurrency(Number(inv.currentPrice || inv.purchasePrice))}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] uppercase font-bold text-outline">Saldo Atual</span>
                                <span className="font-semibold text-primary">{formatCurrency(currentVal)}</span>
                              </div>
                              <div className="text-right">
                                <span className="block text-[9px] uppercase font-bold text-outline">Resultado</span>
                                <span className={cn("font-bold", gain >= 0 ? "text-secondary" : "text-error")}>
                                  {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
