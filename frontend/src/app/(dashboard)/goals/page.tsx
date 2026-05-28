'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function GoalsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then((r) => r.data),
  });

  const { register, handleSubmit, reset } = useForm<any>();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/goals', { ...data, targetAmount: Number(data.targetAmount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast.success('Meta criada!'); reset(); setShowForm(false); },
  });

  const progressMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post(`/goals/${id}/progress`, { amount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast.success('Progresso adicionado!'); },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base">Metas Financeiras</h1>
          <p className="text-muted text-sm mt-1">{(goals as any[]).filter((g: any) => !g.isCompleted).length} metas ativas</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#031632] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a2550] transition-colors">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nova meta
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <h2 className="font-semibold text-base mb-4">Nova Meta</h2>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Nome da meta</label>
              <input {...register('name')} placeholder="Ex: Viagem para Europa" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Valor alvo (R$)</label>
              <input type="number" step="0.01" {...register('targetAmount')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Data alvo</label>
              <input type="date" {...register('targetDate')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Cor</label>
              <input type="color" {...register('color')} defaultValue="#006c49" className="w-full h-10 border border-md rounded-lg px-2 py-1.5" />
            </div>
            <div className="col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-md rounded-lg text-muted hover:bg-card-hover">Cancelar</button>
              <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm bg-[#006c49] text-white rounded-lg hover:bg-[#005a3d] disabled:opacity-60">
                {createMutation.isPending ? 'Salvando...' : 'Criar meta'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? <p className="text-placeholder text-sm">Carregando...</p> : (goals as any[]).map((goal: any) => {
          const pct = Math.min(100, Math.round((Number(goal.currentAmount) / Number(goal.targetAmount)) * 100));
          return (
            <div key={goal.id} className={`bg-card rounded-xl p-5 shadow-sm border ${goal.isCompleted ? 'border-[#006c49]/30' : 'border-base'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[24px]" style={{ color: goal.color || '#006c49' }}>{goal.icon || 'flag'}</span>
                  <p className="font-semibold text-base">{goal.name}</p>
                </div>
                {goal.isCompleted && (
                  <span className="text-xs bg-[#006c49] text-white px-2 py-0.5 rounded-full">Concluída!</span>
                )}
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">{formatCurrency(Number(goal.currentAmount))}</span>
                  <span className="font-medium text-base">{formatCurrency(Number(goal.targetAmount))}</span>
                </div>
                <div className="h-2 bg-subtle rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: goal.color || '#006c49' }} />
                </div>
                <p className="text-xs text-placeholder mt-1">{pct}% concluído</p>
              </div>

              {goal.targetDate && (
                <p className="text-xs text-placeholder mb-3">
                  Prazo: {new Date(goal.targetDate).toLocaleDateString('pt-BR')}
                </p>
              )}

              {!goal.isCompleted && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    id={`progress-${goal.id}`}
                    placeholder="Valor (R$)"
                    className="flex-1 border border-md rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#031632]"
                  />
                  <button
                    onClick={() => {
                      const el = document.getElementById(`progress-${goal.id}`) as HTMLInputElement;
                      const val = parseFloat(el.value);
                      if (val > 0) { progressMutation.mutate({ id: goal.id, amount: val }); el.value = ''; }
                    }}
                    className="text-xs bg-[#031632] text-white px-3 py-1.5 rounded-lg hover:bg-[#0a2550] transition-colors"
                  >
                    + Adicionar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
