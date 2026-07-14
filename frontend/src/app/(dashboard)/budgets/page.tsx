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
  const [editingCat, setEditingCat] = useState<any | null>(null);

  const { data: budgetsData, isLoading } = useQuery({
    queryKey: ['budgets-progress', month, year],
    queryFn: () => api.get(`/api/budgets/progress?month=${month}&year=${year}`).then((r) => r.data),
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/categories?type=EXPENSE').then((r) => r.data),
  });

  const income: number = budgetsData?.income ?? 0;
  const totalSpent: number = budgetsData?.totalSpent ?? 0;
  const categories: any[] = budgetsData?.categories ?? [];
  const monthlyHistory: any[] = budgetsData?.monthlyHistory ?? [];
  const topTransactions: any[] = budgetsData?.topTransactions ?? [];
  const categoryMap: Record<string, any> = budgetsData?.categoryMap ?? {};

  const available = income - totalSpent;
  const spentPercent = income > 0 ? Math.min(150, Math.round((totalSpent / income) * 100)) : 0;
  const maxChartVal = Math.max(...monthlyHistory.map((h: any) => h.actual), 1);

  const { handleSubmit, reset, control, register } = useForm<any>();

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      const categoryId = editingCat?.id ?? formData.categoryId;
      const existingBudgetId =
        editingCat?.budgetId ?? categories.find((c: any) => c.id === categoryId)?.budgetId;
      const amount = Number(formData.amount);
      if (existingBudgetId) {
        return api.patch(`/api/budgets/${existingBudgetId}`, { amount });
      }
      const catInfo = (allCategories as any[]).find((c: any) => c.id === categoryId);
      return api.post('/api/budgets', {
        name: catInfo?.name || 'Limite',
        categoryId,
        amount,
        month,
        year,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets-progress'] });
      toast.success('Limite salvo!');
      reset();
      setShowForm(false);
      setEditingCat(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao salvar limite'),
  });

  const deleteMutation = useMutation({
    mutationFn: (budgetId: string) => api.delete(`/api/budgets/${budgetId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets-progress'] });
      toast.success('Limite removido!');
    },
  });

  const openForm = (cat?: any) => {
    setEditingCat(cat ?? null);
    reset({ categoryId: cat?.id ?? '', amount: cat?.limit ?? '' });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCat(null);
    reset();
  };

  const topLevelCategories = (allCategories as any[]).filter((c: any) => !c.parentId);

  return (
    <>
      {/* ─── DESKTOP ─── */}
      <div className="hidden md:block space-y-gutter">

        {/* Header */}
        <section className="mb-xl flex justify-between items-end">
          <div className="text-left">
            <h2 className="font-display text-display-lg text-primary">Planejamento Orçamentário</h2>
            <p className="text-on-surface-variant font-body-lg">Acompanhe seus gastos por categoria e defina limites mensais.</p>
          </div>
          <button
            onClick={() => openForm()}
            className="bg-primary text-on-primary px-lg py-md rounded-lg font-label-sm text-label-sm hover:opacity-90 transition-all flex items-center gap-xs font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Definir Limite
          </button>
        </section>

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
            <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-md shadow-xl border border-outline-variant">
              <h3 className="font-headline text-headline-md text-primary font-bold mb-1">
                {editingCat ? `Editar limite — ${editingCat.name}` : 'Definir Limite por Categoria'}
              </h3>
              <p className="text-xs text-on-surface-variant mb-5">
                O limite é mensal. Você verá um alerta quando o gasto se aproximar do teto.
              </p>
              <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
                {!editingCat && (
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant block mb-1">Categoria</label>
                    <select
                      {...register('categoryId', { required: true })}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Selecione a categoria...</option>
                      {topLevelCategories.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Limite mensal (R$)</label>
                  <Controller
                    control={control}
                    name="amount"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm outline-none text-on-surface focus:ring-2 focus:ring-primary/20"
                      />
                    )}
                  />
                </div>
                <div className="flex gap-3 justify-end pt-3 border-t border-outline-variant">
                  <button type="button" onClick={closeForm}
                    className="px-4 py-2 text-sm border border-outline rounded-lg text-on-surface-variant hover:bg-surface-container transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saveMutation.isPending}
                    className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 disabled:opacity-60 font-bold">
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar Limite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Summary + Categories */}
        <div className="grid grid-cols-12 gap-lg mb-xl">

          {/* Visão Geral */}
          <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm flex flex-col gap-lg">
            <div className="flex justify-between items-start">
              <h3 className="font-headline text-headline-md text-primary font-bold">Visão Geral</h3>
              <span className="material-symbols-outlined text-primary">analytics</span>
            </div>

            <div className="text-left">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-1">Renda do mês</p>
              {income > 0 ? (
                <p className="font-display text-display-lg text-primary">{formatCurrency(income)}</p>
              ) : (
                <p className="text-on-surface-variant text-sm italic">Nenhuma receita paga registrada</p>
              )}
            </div>

            <div className="pt-md border-t border-outline-variant/60 text-left space-y-sm">
              <div className="flex justify-between">
                <span className="text-on-surface font-body-md font-medium">Total gasto</span>
                <span className={cn('font-numeric font-bold',
                  income > 0 && totalSpent > income ? 'text-error' : 'text-primary')}>
                  {formatCurrency(totalSpent)}
                </span>
              </div>
              {income > 0 && (
                <>
                  <div className="w-full bg-surface-container-high h-3 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full transition-all duration-700',
                        spentPercent >= 100 ? 'bg-error' : spentPercent >= 80 ? 'bg-amber-500' : 'bg-secondary')}
                      style={{ width: `${Math.min(100, spentPercent)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-on-surface-variant text-right italic">{spentPercent}% da renda</p>
                </>
              )}
            </div>

            {income > 0 && (
              <div className={cn('p-sm rounded-lg text-left', available >= 0 ? 'bg-secondary/10' : 'bg-error/10')}>
                <p className="text-on-surface-variant text-[10px] font-bold uppercase">
                  {available >= 0 ? 'Saldo disponível' : 'Déficit'}
                </p>
                <p className={cn('font-numeric text-body-lg font-bold', available >= 0 ? 'text-secondary' : 'text-error')}>
                  {available >= 0 ? '+' : ''}{formatCurrency(available)}
                </p>
              </div>
            )}
          </div>

          {/* Gastos por Categoria */}
          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
            <div className="text-left mb-xl">
              <h3 className="font-headline text-headline-md text-primary font-bold">Gastos por Categoria</h3>
              <p className="text-[12px] text-on-surface-variant mt-0.5">
                Despesas do mês (pagas e pendentes). Passe o mouse para editar ou definir limites.
              </p>
            </div>

            {isLoading ? (
              <p className="text-on-surface-variant text-sm py-8 text-center">Carregando...</p>
            ) : categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="material-symbols-outlined text-[40px] text-outline mb-sm">receipt_long</span>
                <p className="text-on-surface-variant text-sm">Nenhuma despesa registrada este mês.</p>
              </div>
            ) : (
              <div className="space-y-xl">
                {categories.map((cat: any) => {
                  const hasLimit = cat.limit !== null;
                  const pct = hasLimit ? Math.min(100, cat.percentage ?? 0) : 0;
                  const isOver = hasLimit && pct >= 100;
                  const isWarn = hasLimit && pct >= 80 && pct < 100;
                  return (
                    <div key={cat.id} className="group relative text-left">
                      <div className="flex justify-between items-center mb-sm">
                        <div className="flex items-center gap-md">
                          <div className="w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0"
                            style={{ backgroundColor: `${cat.color || '#75777e'}1A`, color: cat.color || '#75777e' }}>
                            <span className="material-symbols-outlined">{cat.icon || 'folder'}</span>
                          </div>
                          <p className="font-body-lg text-body-lg font-bold text-primary">{cat.name}</p>
                        </div>
                        <div className="flex items-center gap-md">
                          <div className="text-right">
                            <p className="font-numeric text-numeric-data text-primary">
                              {formatCurrency(cat.spent)}
                              {hasLimit && (
                                <span className="text-on-surface-variant font-normal"> / {formatCurrency(cat.limit)}</span>
                              )}
                            </p>
                            {hasLimit && (
                              <p className={cn('text-[12px] font-bold',
                                isOver ? 'text-error' : isWarn ? 'text-amber-500' : 'text-secondary')}>
                                {isOver ? `Excedido (${pct}%)` : isWarn ? `Atenção (${pct}%)` : `${pct}% do limite`}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-xs opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => openForm(cat)} title={hasLimit ? 'Editar limite' : 'Definir limite'}
                              className="text-on-surface-variant hover:text-primary transition-colors">
                              <span className="material-symbols-outlined text-[20px]">
                                {hasLimit ? 'edit' : 'add_circle'}
                              </span>
                            </button>
                            {hasLimit && (
                              <button
                                onClick={() => { if (confirm(`Remover limite de ${cat.name}?`)) deleteMutation.mutate(cat.budgetId); }}
                                title="Remover limite"
                                className="text-on-surface-variant hover:text-error transition-colors">
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {hasLimit ? (
                        <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full transition-all', isOver ? 'bg-error' : isWarn ? 'bg-amber-500' : 'bg-secondary')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-[1px] bg-outline-variant/30" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Histórico de Gastos */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm">
          <div className="text-left mb-xl">
            <h3 className="font-headline text-headline-md text-primary font-bold">Histórico de Gastos</h3>
            <p className="text-on-surface-variant text-label-sm">Despesas totais nos últimos 6 meses</p>
          </div>
          <div className="h-52 flex items-end justify-between px-md gap-4">
            {monthlyHistory.map((item: any, idx: number) => {
              const height = `${Math.min(100, maxChartVal > 0 ? (item.actual / maxChartVal) * 100 : 0)}%`;
              const isCurrent = idx === monthlyHistory.length - 1;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-xs">
                  <div className={cn('w-full flex items-end justify-center h-44',
                    isCurrent ? 'bg-surface-container-low rounded-lg p-1' : '')}>
                    <div
                      className={cn('w-8 rounded-t-sm transition-all',
                        isCurrent ? 'bg-secondary' : 'bg-secondary/40 hover:bg-secondary/65')}
                      style={{ height: item.actual > 0 ? height : '2px' }}
                      title={`${item.label}: ${formatCurrency(item.actual)}`}
                    />
                  </div>
                  <div className="text-center">
                    <span className={cn('text-label-sm uppercase font-bold',
                      isCurrent ? 'text-primary font-extrabold' : 'text-on-surface-variant')}>
                      {item.label}
                    </span>
                    {item.actual > 0 && (
                      <p className="text-[9px] text-on-surface-variant mt-[1px]">{formatCurrency(item.actual)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Movimentações de Impacto */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm text-left">
          <h3 className="font-headline text-headline-md text-primary font-bold mb-md">Movimentações de Impacto</h3>
          <div className="divide-y divide-outline-variant/30">
            {topTransactions.length === 0 ? (
              <p className="py-md text-on-surface-variant text-sm">Nenhuma movimentação registrada este mês.</p>
            ) : (
              topTransactions.map((tx: any) => {
                const cat = tx.resolvedCategoryId ? categoryMap[tx.resolvedCategoryId] : null;
                return (
                  <div key={tx.id} className="py-md flex justify-between items-center">
                    <div className="flex items-center gap-md">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cat?.color || '#ef4444'}22`, color: cat?.color || '#ef4444' }}>
                        <span className="material-symbols-outlined">{cat?.icon || 'payments'}</span>
                      </div>
                      <div>
                        <p className="font-body-lg text-body-lg font-bold text-primary">{tx.description}</p>
                        <p className="text-[12px] text-on-surface-variant">
                          {cat?.name || 'Sem categoria'} · {new Date(tx.date).toLocaleDateString('pt-BR')}
                          {!tx.isPaid && <span className="ml-1 text-amber-500">(pendente)</span>}
                        </p>
                      </div>
                    </div>
                    <p className="font-numeric text-numeric-data text-error font-bold whitespace-nowrap">
                      -{formatCurrency(Number(tx.amount))}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── MOBILE ─── */}
      <div className="block md:hidden space-y-lg pb-12">
        <section className="flex flex-col gap-xs text-left">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Orçamentos</p>
          <h2 className="font-display-lg-mobile text-display-lg-mobile text-primary">Planejamento</h2>
        </section>

        {/* Visão Geral Mobile */}
        <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left space-y-sm">
          <div className="flex justify-between items-baseline">
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Renda do mês</p>
              <p className="font-display-lg-mobile text-display-lg-mobile text-primary font-bold">
                {income > 0 ? formatCurrency(income) : '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Total gasto</p>
              <p className={cn('font-numeric text-body-lg font-bold',
                income > 0 && totalSpent > income ? 'text-error' : 'text-primary')}>
                {formatCurrency(totalSpent)}
              </p>
            </div>
          </div>
          {income > 0 && (
            <>
              <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                <div
                  className={cn('h-full', spentPercent >= 100 ? 'bg-error' : spentPercent >= 80 ? 'bg-amber-500' : 'bg-secondary')}
                  style={{ width: `${Math.min(100, spentPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-on-surface-variant">
                <span>{spentPercent}% da renda</span>
                <span className={cn('font-bold', available >= 0 ? 'text-secondary' : 'text-error')}>
                  {available >= 0 ? 'Sobra' : 'Déficit'}: {formatCurrency(Math.abs(available))}
                </span>
              </div>
            </>
          )}
        </section>

        {/* Categories Mobile */}
        <section className="space-y-md">
          <div className="flex justify-between items-center">
            <h3 className="font-headline text-headline-md text-primary font-bold">Por Categoria</h3>
            <button onClick={() => openForm()}
              className="text-primary font-label-sm flex items-center gap-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Definir Limite
            </button>
          </div>
          <div className="space-y-sm">
            {categories.map((cat: any) => {
              const hasLimit = cat.limit !== null;
              const pct = hasLimit ? Math.min(100, cat.percentage ?? 0) : 0;
              const isOver = hasLimit && pct >= 100;
              return (
                <div key={cat.id} className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm text-left">
                  <div className="flex items-center gap-md mb-xs">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${cat.color || '#75777e'}1A`, color: cat.color || '#75777e' }}>
                      <span className="material-symbols-outlined text-[18px]">{cat.icon || 'folder'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-sm text-on-surface font-bold truncate">{cat.name}</p>
                      <p className="text-[10px] text-on-surface-variant font-semibold">
                        {formatCurrency(cat.spent)}{hasLimit ? ` / ${formatCurrency(cat.limit)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-xs">
                      {hasLimit && (
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                          isOver ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container')}>
                          {isOver ? 'Excedido' : `${pct}%`}
                        </span>
                      )}
                      <button onClick={() => openForm(cat)} className="text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px]">{hasLimit ? 'edit' : 'add_circle'}</span>
                      </button>
                    </div>
                  </div>
                  {hasLimit && (
                    <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                      <div className={cn('h-full', isOver ? 'bg-error' : 'bg-secondary')}
                        style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Top Transactions Mobile */}
        {topTransactions.length > 0 && (
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm text-left">
            <h3 className="font-headline text-headline-md text-primary font-bold mb-md">Maiores Gastos</h3>
            <div className="space-y-sm">
              {topTransactions.map((tx: any) => {
                const cat = tx.resolvedCategoryId ? categoryMap[tx.resolvedCategoryId] : null;
                return (
                  <div key={tx.id} className="flex justify-between items-center py-xs">
                    <div className="flex items-center gap-sm min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cat?.color || '#ef4444'}22`, color: cat?.color || '#ef4444' }}>
                        <span className="material-symbols-outlined text-[16px]">{cat?.icon || 'payments'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-primary truncate">{tx.description}</p>
                        <p className="text-[10px] text-on-surface-variant">{cat?.name || 'Sem categoria'}</p>
                      </div>
                    </div>
                    <p className="text-[12px] font-bold text-error whitespace-nowrap ml-2">
                      -{formatCurrency(Number(tx.amount))}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Mobile form modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-[60]">
            <div className="bg-surface-container-lowest rounded-t-2xl p-6 w-full shadow-xl border-t border-outline-variant">
              <h3 className="font-headline text-headline-sm text-primary font-bold mb-4">
                {editingCat ? `Editar limite — ${editingCat.name}` : 'Definir Limite'}
              </h3>
              <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
                {!editingCat && (
                  <select
                    {...register('categoryId', { required: true })}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-3 text-sm outline-none text-on-surface"
                  >
                    <option value="">Selecione a categoria...</option>
                    {topLevelCategories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <Controller
                  control={control}
                  name="amount"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-3 text-sm outline-none text-on-surface"
                    />
                  )}
                />
                <div className="flex gap-3">
                  <button type="button" onClick={closeForm}
                    className="flex-1 py-3 text-sm border border-outline rounded-lg text-on-surface-variant">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saveMutation.isPending}
                    className="flex-1 py-3 text-sm bg-primary text-on-primary rounded-lg font-bold disabled:opacity-60">
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
