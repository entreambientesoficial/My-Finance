'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, getCurrentMonthYear, cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/CurrencyInput';

export default function BudgetsPage() {
  const qc = useQueryClient();
  const { month, year } = getCurrentMonthYear();
  const [showForm, setShowForm] = useState(false);

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets-progress', month, year],
    queryFn: () => api.get(`/budgets/progress?month=${month}&year=${year}`).then((r) => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories?type=EXPENSE').then((r) => r.data),
  });

  const { register, handleSubmit, reset, control } = useForm<any>();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/budgets', { ...data, amount: Number(data.amount), month, year }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets-progress'] });
      toast.success('Orçamento personalizado criado!');
      reset();
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar orçamento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['budgets-progress'] }); 
      toast.success('Orçamento personalizado removido!'); 
    },
  });

  const totalBudget = (budgets as any[]).reduce((s: number, b: any) => s + Number(b.amount), 0);
  const totalSpent = (budgets as any[]).reduce((s: number, b: any) => s + Number(b.spent || 0), 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 61.6;

  // Fallbacks if no data exists
  const hasRealBudgets = budgets.length > 0;
  const displayTotalBudget = hasRealBudgets ? totalBudget : 8500.00;
  const displayTotalSpent = hasRealBudgets ? totalSpent : 5240.00;
  const displayTotalRemaining = hasRealBudgets ? totalRemaining : 3260.00;

  const displayBudgets = hasRealBudgets ? budgets : [
    { id: 'b1', name: 'Moradia', amount: 3000, spent: 2800, remaining: 200, percentage: 93, category: { name: 'Moradia', icon: 'home', color: '#3b82f6' }, description: 'Média de R$ 3.000,00 nos últimos 3 meses.', isAutomatic: true },
    { id: 'b2', name: 'Alimentação', amount: 1200, spent: 1150, remaining: 50, percentage: 95.8, category: { name: 'Alimentação', icon: 'restaurant', color: '#006c49' }, description: 'Média de R$ 1.200,00 nos últimos 3 meses.', isAutomatic: true },
    { id: 'b3', name: 'Transporte', amount: 600, spent: 850, remaining: -250, percentage: 141, category: { name: 'Transporte', icon: 'directions_car', color: '#ef4444' }, description: 'Média de R$ 600,00 nos últimos 3 meses.', isAutomatic: true },
    { id: 'b4', name: 'Lazer', amount: 1500, spent: 440, remaining: 1060, percentage: 29.3, category: { name: 'Lazer', icon: 'theater_comedy', color: '#8b5cf6' }, description: 'Média de R$ 1.500,00 nos últimos 3 meses.', isAutomatic: true }
  ];

  const chartHistory = [
    { label: 'Jan', planned: 8000, actual: 7400 },
    { label: 'Fev', planned: 8500, actual: 9100 },
    { label: 'Mar', planned: 8500, actual: 8100 },
    { label: 'Abr', planned: 8500, actual: 7800 },
    { label: 'Mai', planned: 8500, actual: 8400 },
    { label: 'Jun', planned: displayTotalBudget, actual: displayTotalSpent }
  ];

  return (
    <>
      {/* ─── DESKTOP BUDGETS VIEW ─── */}
      <div className="hidden md:block space-y-gutter">
        {/* Header Section */}
        <section className="mb-xl flex justify-between items-end">
          <div className="text-left">
            <h2 className="font-display text-display-lg text-primary">Planejamento Orçamentário</h2>
            <p className="text-on-surface-variant font-body-lg">Limites automáticos baseados nos seus gastos e personalizações inteligentes.</p>
          </div>
          <div className="flex gap-sm">
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-primary text-on-primary px-lg py-md rounded-lg font-label-sm text-label-sm hover:opacity-90 transition-all flex items-center gap-xs font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              Personalizar Limite
            </button>
          </div>
        </section>

        {/* Form Modal/Collapsible */}
        {showForm && (
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant text-left mb-gutter">
            <h2 className="font-headline text-headline-md text-primary font-bold mb-2">Sobrescrever Limite Automático</h2>
            <p className="text-on-surface-variant text-xs mb-4">Defina um valor personalizado para uma categoria específica. Ele substituirá a média sugerida pela IA para este mês.</p>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Nome do Orçamento</label>
                <input 
                  {...register('name')} 
                  placeholder="Ex: Teto Alimentação" 
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Valor Personalizado (R$)</label>
                <Controller
                  control={control}
                  name="amount"
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
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Categoria Alvo</label>
                <select 
                  {...register('categoryId')} 
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  required
                >
                  <option value="">Selecione...</option>
                  {(categories as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-3 flex gap-3 justify-end pt-2 border-t border-border-base mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="px-4 py-2 text-sm border border-outline rounded-lg text-on-surface-variant hover:bg-surface-container transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending} 
                  className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 disabled:opacity-60 font-bold"
                >
                  {createMutation.isPending ? 'Salvando...' : 'Aplicar Limite'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-lg mb-xl">
          {/* Overall Summary Card (Left - 4 cols) */}
          <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-md">
              <h3 className="font-headline text-headline-md text-primary font-bold">Visão Geral</h3>
              <span className="material-symbols-outlined text-primary">analytics</span>
            </div>
            
            <div className="space-y-md">
              <div className="text-left">
                <p className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-1">Total Planejado</p>
                <p className="font-display text-display-lg text-primary">{formatCurrency(displayTotalBudget)}</p>
              </div>
              
              <div className="pt-md border-t border-outline-variant/60 text-left">
                <div className="flex justify-between mb-xs">
                  <span className="text-on-surface font-body-md font-medium">Utilizado</span>
                  <span className="text-primary font-numeric text-numeric-data font-bold">{formatCurrency(displayTotalSpent)}</span>
                </div>
                <div className="w-full bg-surface-container-high h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-secondary h-full transition-all duration-1000" 
                    style={{ width: `${overallPercent}%` }}
                  ></div>
                </div>
                <p className="text-on-surface-variant text-[12px] mt-2 italic text-right">
                  Restam {formatCurrency(displayTotalRemaining)} ({100 - overallPercent}%)
                </p>
              </div>
            </div>
            
            <div className="mt-xl grid grid-cols-2 gap-sm">
              <div className="bg-surface-container-low p-sm rounded-lg text-left">
                <p className="text-on-surface-variant text-[10px] font-bold uppercase">Economia Prevista</p>
                <p className="text-secondary font-numeric text-body-lg font-bold">+ {formatCurrency(displayTotalRemaining)}</p>
              </div>
              <div className="bg-surface-container-low p-sm rounded-lg text-left">
                <p className="text-on-surface-variant text-[10px] font-bold uppercase">Variância</p>
                <p className="text-error font-numeric text-body-lg font-bold">- 4.2% vs MM</p>
              </div>
            </div>
          </div>

          {/* Main Categories Budget Control (Right - 8 cols) */}
          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
            <div className="flex justify-between items-center mb-xl flex-wrap gap-sm">
              <div className="text-left">
                <h3 className="font-headline text-headline-md text-primary font-bold">Limites por Categoria</h3>
                <p className="text-on-surface-variant text-[12px] mt-0.5">Gastos atuais vs. limites sugeridos pela IA ou personalizados.</p>
              </div>
            </div>
            
            <div className="space-y-xl">
              {displayBudgets.map((budget: any) => {
                const percent = Math.min(100, budget.percentage || Math.round((Number(budget.spent) / Number(budget.amount)) * 100));
                const isOver = percent >= 100;
                const isWarning = percent >= 80 && percent < 100;
                
                return (
                  <div key={budget.id} className="group relative text-left">
                    <div className="flex justify-between items-center mb-sm">
                      <div className="flex items-center gap-md">
                        <div 
                          className="w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ 
                            backgroundColor: `${budget.category?.color || '#75777e'}1A`,
                            color: budget.category?.color || '#75777e'
                          }}
                        >
                          <span className="material-symbols-outlined">{budget.category?.icon || 'folder'}</span>
                        </div>
                        <div className="flex flex-col text-left">
                          <div className="flex items-center gap-xs flex-wrap">
                            <p className="font-body-lg text-body-lg font-bold text-primary">{budget.name}</p>
                            {budget.isAutomatic ? (
                              <span className="flex items-center gap-0.5 px-2 py-[2px] bg-primary/10 text-primary-dim rounded-full text-[9px] font-bold uppercase tracking-wider">
                                <span className="material-symbols-outlined text-[10px] fill-current">bolt</span>
                                Automático
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 px-2 py-[2px] bg-secondary/15 text-secondary rounded-full text-[9px] font-bold uppercase tracking-wider">
                                <span className="material-symbols-outlined text-[10px]">person</span>
                                Personalizado
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-on-surface-variant mt-0.5">{budget.description || (budget.category?.name || 'Geral')}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="font-numeric text-numeric-data text-primary">
                            {formatCurrency(Number(budget.spent))} <span className="text-on-surface-variant font-normal">/ {formatCurrency(Number(budget.amount))}</span>
                          </p>
                          <p className={cn(
                            "text-[12px] font-bold",
                            isOver ? "text-error" : isWarning ? "text-amber-500" : "text-secondary"
                          )}>
                            {isOver ? `Excedido (${percent}%)` : isWarning ? `Atenção (${percent}%)` : `Excelente (${percent}%)`}
                          </p>
                        </div>
                        {!budget.isAutomatic && (
                          <button
                            onClick={() => { if (confirm('Remover este orçamento personalizado?')) deleteMutation.mutate(budget.id); }}
                            className="opacity-0 group-hover:opacity-100 text-placeholder hover:text-error transition-all"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full progress-bar",
                          isOver ? "bg-error" : isWarning ? "bg-amber-500" : "bg-secondary"
                        )}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly Comparison Chart Section */}
        <div className="col-span-12 bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
          <div className="flex justify-between items-center mb-xl">
            <div className="text-left">
              <h3 className="font-headline text-headline-md text-primary font-bold">Histórico Comparativo</h3>
              <p className="text-on-surface-variant text-label-sm">Planejado vs. Realizado nos últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-md">
              <div className="flex items-center gap-xs">
                <span className="w-3 h-3 bg-primary rounded-full"></span>
                <span className="text-label-sm text-on-surface-variant font-bold">Planejado</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="w-3 h-3 bg-secondary rounded-full"></span>
                <span className="text-label-sm text-on-surface-variant font-bold">Realizado</span>
              </div>
            </div>
          </div>
          
          <div className="h-64 flex items-end justify-between px-md gap-4">
            {chartHistory.map((item: any, idx: number) => {
              const maxVal = 10000;
              const plannedHeight = `${Math.min(100, (item.planned / maxVal) * 100)}%`;
              const actualHeight = `${Math.min(100, (item.actual / maxVal) * 100)}%`;
              const isCurrent = idx === chartHistory.length - 1;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-xs group">
                  <div className={cn(
                    "w-full flex items-end justify-center gap-1 h-52",
                    isCurrent ? "bg-surface-container-low rounded-lg p-1" : ""
                  )}>
                    <div 
                      className="w-4 bg-primary/20 hover:bg-primary/45 transition-colors rounded-t-sm" 
                      style={{ height: plannedHeight }}
                      title={`Planejado: R$ ${item.planned}`}
                    ></div>
                    <div 
                      className={cn("w-4 rounded-t-sm", isCurrent ? "bg-secondary-fixed-dim" : "bg-secondary")} 
                      style={{ height: actualHeight }}
                      title={`Realizado: R$ ${item.actual}`}
                    ></div>
                  </div>
                  <span className={cn("text-label-sm uppercase font-bold", isCurrent ? "text-primary font-extrabold" : "text-on-surface-variant")}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tip/Alert & Movimentações Bento Row */}
        <div className="grid grid-cols-12 gap-lg mt-gutter">
          {/* Tip/Alert Section (AI Insight) */}
          <div className="col-span-12 lg:col-span-4 bg-gradient-to-br from-violet-950/20 via-surface-container-lowest to-surface-container-lowest rounded-xl border border-violet-500/20 p-lg shadow-[0_4px_30px_rgba(139,92,246,0.07)] relative overflow-hidden flex flex-col justify-between text-left group">
            {/* Ambient Glows */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl group-hover:bg-violet-600/15 transition-colors duration-500 pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10 space-y-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 animate-pulse">
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                  </div>
                  <div>
                    <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent font-bold text-[10px] uppercase tracking-widest block">Inteligência Artificial</span>
                    <h4 className="font-headline text-headline-sm font-bold text-primary">Insight de IA</h4>
                  </div>
                </div>
                <span className="px-md py-1 bg-violet-500/10 text-violet-400 rounded-full font-label-sm text-[10px] font-bold tracking-wide">Beta</span>
              </div>
              
              <div className="bg-surface-container-low/40 border border-violet-500/10 rounded-xl p-md space-y-sm backdrop-blur-xs">
                <p className="font-body-md text-on-surface-variant text-sm leading-relaxed">
                  Identificamos que você excedeu seu limite de <strong className="text-violet-400 font-bold">Transporte</strong> em <strong className="text-error font-bold">41%</strong> este mês. 
                </p>
                <p className="text-[12px] text-on-surface-variant/80 leading-relaxed">
                  💡 Considere readequar as despesas com viagens de aplicativos nos próximos 10 dias para equilibrar suas metas.
                </p>
              </div>
            </div>
            
            <button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-lg py-md rounded-lg font-bold text-xs transition-all duration-300 shadow-md shadow-violet-600/15 mt-6 w-full text-center relative z-10 flex items-center justify-center gap-xs">
              <span className="material-symbols-outlined text-[16px]">insights</span>
              Otimizar Orçamento
            </button>
          </div>

          {/* Recent Impact Transactions */}
          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm text-left">
            <h3 className="font-headline text-headline-md text-primary font-bold mb-md">Movimentações de Impacto</h3>
            <div className="divide-y divide-outline-variant/30">
              <div className="py-md flex justify-between items-center">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-full bg-error-container/20 text-error flex items-center justify-center">
                    <span className="material-symbols-outlined">car_repair</span>
                  </div>
                  <div>
                    <p className="font-body-lg text-body-lg font-bold text-primary">Manutenção Preventiva</p>
                    <p className="text-[12px] text-on-surface-variant">Transporte · Hoje às 14:30</p>
                  </div>
                </div>
                <p className="font-numeric text-numeric-data text-error font-bold">- R$ 450,00</p>
              </div>
              <div className="py-md flex justify-between items-center">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-full bg-secondary-container/20 text-on-secondary-container flex items-center justify-center">
                    <span className="material-symbols-outlined">shopping_basket</span>
                  </div>
                  <div>
                    <p className="font-body-lg text-body-lg font-bold text-primary">Supermercado Continental</p>
                    <p className="text-[12px] text-on-surface-variant">Alimentação · Ontem às 18:12</p>
                  </div>
                </div>
                <p className="font-numeric text-numeric-data text-error font-bold">- R$ 382,15</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MOBILE BUDGETS VIEW ─── */}
      <div className="block md:hidden space-y-lg pb-12">
        {/* Welcome Section */}
        <section className="flex flex-col gap-xs text-left">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Orçamentos</p>
          <h2 className="font-display-lg-mobile text-display-lg-mobile text-primary">Planejamento</h2>
        </section>

        {/* Visão Geral Card */}
        <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Gasto Acumulado</p>
          <div className="flex justify-between items-baseline mb-sm">
            <p className="font-display-lg-mobile text-display-lg-mobile text-primary font-bold">{formatCurrency(displayTotalSpent)}</p>
            <p className="text-[11px] text-on-surface-variant">Meta: {formatCurrency(displayTotalBudget)}</p>
          </div>
          <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-secondary h-full" 
              style={{ width: `${overallPercent}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-on-surface-variant italic mt-1 text-right">Restam {formatCurrency(displayTotalRemaining)}</p>
        </section>

        {/* AI Insight on Mobile */}
        <section className="bg-gradient-to-br from-violet-950/20 via-surface-container-lowest to-surface-container-lowest rounded-xl border border-violet-500/20 p-lg shadow-sm relative overflow-hidden flex flex-col justify-between text-left group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10 space-y-sm">
            <div className="flex items-center gap-md">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <div className="text-left">
                <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent font-bold text-[9px] uppercase tracking-widest block">Inteligência Artificial</span>
                <h4 className="font-headline text-headline-sm font-bold text-primary">Insight de IA</h4>
              </div>
            </div>
            <div className="bg-surface-container-low/40 border border-violet-500/10 rounded-xl p-md backdrop-blur-xs mt-xs text-left">
              <p className="font-body-md text-on-surface-variant text-sm leading-relaxed">
                Identificamos que você excedeu seu limite de <strong className="text-violet-400 font-bold">Transporte</strong> em <strong className="text-error font-bold">41%</strong> este mês. Considere readequar as despesas com viagens de aplicativos nos próximos 10 dias.
              </p>
            </div>
          </div>
          <button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-md py-2.5 rounded-lg font-bold text-xs shadow-md shadow-violet-600/15 mt-md w-full text-center relative z-10 flex items-center justify-center gap-xs">
            <span className="material-symbols-outlined text-[16px]">insights</span>
            Otimizar Orçamento
          </button>
        </section>

        {/* Categories budget stack */}
        <section className="space-y-md">
          <div className="flex justify-between items-center">
            <h3 className="font-headline text-headline-md text-primary font-bold">Limites por Categoria</h3>
            <button 
              onClick={() => setShowForm(!showForm)}
              className="text-primary font-label-sm flex items-center gap-xs font-bold"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              Personalizar
            </button>
          </div>

          <div className="space-y-sm">
            {displayBudgets.map((budget: any) => {
              const percent = Math.min(100, budget.percentage || Math.round((Number(budget.spent) / Number(budget.amount)) * 100));
              const isOver = percent >= 100;
              
              return (
                <div key={budget.id} className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm text-left">
                  <div className="flex items-center gap-md mb-xs">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ 
                        backgroundColor: `${budget.category?.color || '#75777e'}1A`,
                        color: budget.category?.color || '#75777e'
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]">{budget.category?.icon || 'folder'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-xs">
                        <p className="font-label-sm text-on-surface font-bold truncate">{budget.name}</p>
                        {budget.isAutomatic ? (
                          <span className="px-1.5 py-[1px] bg-primary/5 text-primary-dim rounded-full text-[8px] font-bold uppercase tracking-wider">
                            Auto
                          </span>
                        ) : (
                          <span className="px-1.5 py-[1px] bg-secondary/10 text-secondary rounded-full text-[8px] font-bold uppercase tracking-wider">
                            Pers
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-semibold">
                        {formatCurrency(Number(budget.spent))} / {formatCurrency(Number(budget.amount))}
                      </p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      isOver ? "bg-error-container text-on-error-container" : "bg-secondary-container text-on-secondary-container"
                    )}>
                      {isOver ? 'Excedido' : 'OK'}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full",
                        isOver ? "bg-error" : "bg-secondary"
                      )}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
