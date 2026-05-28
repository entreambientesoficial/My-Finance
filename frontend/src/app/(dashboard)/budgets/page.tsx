'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, getCurrentMonthYear } from '@/lib/utils';

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

  const { register, handleSubmit, reset } = useForm<any>();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/budgets', { ...data, amount: Number(data.amount), month, year }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets-progress'] });
      toast.success('Orçamento criado!');
      reset();
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budgets-progress'] }); toast.success('Removido!'); },
  });

  const totalBudget = (budgets as any[]).reduce((s: number, b: any) => s + Number(b.amount), 0);
  const totalSpent = (budgets as any[]).reduce((s: number, b: any) => s + Number(b.spent || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base">Planejamento Orçamentário</h1>
          <p className="text-muted text-sm mt-1">
            {new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#031632] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a2550] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Novo orçamento
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-4 shadow-sm border border-base">
          <p className="text-xs text-muted">Orçamento Total</p>
          <p className="text-xl font-bold text-base">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm border border-base">
          <p className="text-xs text-muted">Gasto até agora</p>
          <p className="text-xl font-bold text-red-500">{formatCurrency(totalSpent)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm border border-base">
          <p className="text-xs text-muted">Disponível</p>
          <p className={`text-xl font-bold ${totalBudget - totalSpent >= 0 ? 'text-[#006c49]' : 'text-red-500'}`}>
            {formatCurrency(totalBudget - totalSpent)}
          </p>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <h2 className="font-semibold text-base mb-4">Novo Orçamento</h2>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Nome</label>
              <input {...register('name')} placeholder="Ex: Alimentação" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Valor (R$)</label>
              <input type="number" step="0.01" {...register('amount')} placeholder="500" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Categoria</label>
              <select {...register('categoryId')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                <option value="">Geral</option>
                {(categories as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-3 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-md rounded-lg text-muted hover:bg-card-hover">Cancelar</button>
              <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm bg-[#006c49] text-white rounded-lg hover:bg-[#005a3d] disabled:opacity-60">
                {createMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de orçamentos */}
      <div className="space-y-3">
        {isLoading ? <p className="text-placeholder text-sm">Carregando...</p> : (budgets as any[]).map((budget: any) => (
          <div key={budget.id} className="bg-card rounded-xl p-5 shadow-sm border border-base">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {budget.category && (
                  <span className="material-symbols-outlined text-[20px]" style={{ color: budget.category.color }}>{budget.category.icon}</span>
                )}
                <div>
                  <p className="font-medium text-base">{budget.name}</p>
                  {budget.category && <p className="text-xs text-placeholder">{budget.category.name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-base">{formatCurrency(budget.spent)} <span className="text-placeholder font-normal">/ {formatCurrency(Number(budget.amount))}</span></p>
                  <p className="text-xs text-placeholder">{formatCurrency(budget.remaining)} restante</p>
                </div>
                <button onClick={() => deleteMutation.mutate(budget.id)} className="text-placeholder hover:text-red-500 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
            <div className="h-2 bg-subtle rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${budget.percentage >= 100 ? 'bg-red-500' : budget.percentage >= 80 ? 'bg-amber-500' : 'bg-[#006c49]'}`}
                style={{ width: `${budget.percentage}%` }}
              />
            </div>
            <p className="text-xs text-placeholder mt-1">{budget.percentage}% utilizado</p>
          </div>
        ))}
      </div>
    </div>
  );
}
