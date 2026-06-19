'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/CurrencyInput';

export default function GoalsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositAccountId, setDepositAccountId] = useState<string>('');

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  });

  const { register, handleSubmit, reset, control } = useForm<any>();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/goals', { 
      ...data, 
      targetAmount: Number(data.targetAmount),
      currentAmount: Number(data.currentAmount || 0)
    }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['goals'] }); 
      toast.success('Meta criada!'); 
      reset(); 
      setShowForm(false); 
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar meta'),
  });

  const progressMutation = useMutation({
    mutationFn: ({ id, amount, accountId }: { id: string; amount: number; accountId?: string }) =>
      api.post(`/goals/${id}/progress`, { amount, accountId }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['goals'] }); 
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['recent-transactions-activity'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Aporte adicionado!'); 
      setDepositGoalId(null);
      setDepositAmount(0);
      setDepositAccountId('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao adicionar progresso'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['goals'] }); 
      toast.success('Meta removida.'); 
    },
  });

  // Calculate totals
  const totalAccumulated = (goals as any[]).reduce((sum, g) => sum + Number(g.currentAmount), 0);
  const totalTarget = (goals as any[]).reduce((sum, g) => sum + Number(g.targetAmount), 0);

  // Map database goals into display elements
  const mappedGoals = goals.map((g: any) => {
    const pct = g.targetAmount > 0 ? Math.min(100, Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100)) : 0;
    return {
      ...g,
      percentage: pct,
      icon: g.icon || (g.name.toLowerCase().includes('viagem') ? 'flight_takeoff' : g.name.toLowerCase().includes('casa') ? 'home' : 'shield'),
      color: g.color || '#006c49',
    };
  });

  // Generate dynamic activities based on real goals
  const recentActivities = goals.flatMap((g: any) => {
    const acts = [];
    
    // 1. Create activity
    acts.push({
      id: `create-${g.id}`,
      title: `Meta Criada: ${g.name}`,
      subtitle: `Definição de Objetivo • ${new Date(g.createdAt).toLocaleDateString('pt-BR')} às ${new Date(g.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      amount: Number(g.targetAmount),
      type: 'CREATE',
      isPositive: false,
      date: new Date(g.createdAt)
    });

    // 2. Deposit activity (if currentAmount > 0)
    if (Number(g.currentAmount) > 0) {
      acts.push({
        id: `deposit-${g.id}`,
        title: `Aporte em ${g.name}`,
        subtitle: `Aporte Financeiro • ${new Date(g.updatedAt).toLocaleDateString('pt-BR')} às ${new Date(g.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        amount: Number(g.currentAmount),
        type: 'DEPOSIT',
        isPositive: true,
        date: new Date(g.updatedAt)
      });
    }

    return acts;
  })
  .sort((a: any, b: any) => b.date.getTime() - a.date.getTime())
  .slice(0, 4); // Keep top 4 recent activities

  // Calculate dynamic average target years
  const calculateAverageTime = () => {
    const goalsWithDates = goals.filter((g: any) => g.targetDate);
    if (goalsWithDates.length === 0) return 'N/A';
    
    let totalYears = 0;
    const now = new Date();
    goalsWithDates.forEach((g: any) => {
      const target = new Date(g.targetDate);
      const diffTime = target.getTime() - now.getTime();
      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears > 0) totalYears += diffYears;
    });
    
    const avgYears = totalYears / goalsWithDates.length;
    return avgYears > 0 ? `${avgYears.toFixed(1)} Anos` : 'N/A';
  };

  return (
    <>
      {/* ─── DESKTOP GOALS VIEW ─── */}
      <div className="hidden md:block space-y-gutter">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-xl">
          <div className="text-left">
            <h2 className="font-display text-display-lg text-primary">Gestão de Metas</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">Acompanhe seu progresso financeiro e visualize o caminho para suas conquistas de longo prazo.</p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-xs bg-primary text-on-primary px-lg py-md rounded-lg font-label-sm text-label-sm hover:opacity-90 active:scale-95 transition-all shadow-md self-start md:self-auto font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Nova Meta
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant text-left mb-gutter">
            <h2 className="font-headline text-headline-md text-primary font-bold mb-4">Nova Meta Financeira</h2>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Nome da Meta *</label>
                <input 
                  {...register('name')} 
                  placeholder="Ex: Reserva de Emergência" 
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Valor Alvo (R$) *</label>
                <Controller
                  control={control}
                  name="targetAmount"
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
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Valor Inicial Acumulado</label>
                <Controller
                  control={control}
                  name="currentAmount"
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
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Data Limite</label>
                <input 
                  type="date" 
                  {...register('targetDate')} 
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Cor do Card</label>
                <input 
                  type="color" 
                  {...register('color')} 
                  defaultValue="#006c49" 
                  className="w-full h-10 bg-surface-container-low border-none rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary/20 outline-none text-on-surface cursor-pointer"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Ícone Ilustrativo</label>
                <select 
                  {...register('icon')} 
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface cursor-pointer"
                >
                  <option value="shield">Escudo (Segurança)</option>
                  <option value="flight_takeoff">Avião (Viagem)</option>
                  <option value="home">Casa (Imóveis)</option>
                  <option value="directions_car">Carro (Transporte)</option>
                  <option value="school">Capelo (Educação)</option>
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
                  {createMutation.isPending ? 'Criando...' : 'Criar Meta'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Dashboard Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl">
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2">Total Acumulado</p>
            <div className="flex items-baseline gap-xs">
              <span className="font-display text-display-lg text-primary font-bold">{formatCurrency(totalAccumulated)}</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2">Meta Global</p>
            <span className="font-display text-display-lg text-primary font-bold">{formatCurrency(totalTarget)}</span>
          </div>
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2">Tempo Médio Estimado</p>
            <span className="font-display text-display-lg text-primary font-bold">{calculateAverageTime()}</span>
          </div>
        </div>

        {/* Dynamic empty state vs bento grid */}
        {goals.length === 0 ? (
          <div className="bg-surface-container-lowest p-xl rounded-xl border border-dashed border-outline-variant text-center flex flex-col items-center justify-center min-h-[320px] shadow-sm">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3">track_changes</span>
            <p className="font-headline text-headline-md text-primary font-bold">Nenhuma Meta Cadastrada</p>
            <p className="font-body-md text-on-surface-variant text-sm mt-2 max-w-sm leading-relaxed">
              Defina seus objetivos financeiros (como reserva de emergência, viagens ou conquistas de longo prazo) para acompanhar seu progresso e poupar com foco.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 bg-primary text-on-primary px-lg py-md rounded-lg font-label-sm text-label-sm hover:opacity-90 active:scale-95 transition-all shadow-md font-bold"
            >
              Criar Minha Primeira Meta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-lg text-left">
            {/* Main Goal Card & Secondary list (col-span-8) */}
            <div className="col-span-12 lg:col-span-8 space-y-lg">
              {/* Primary Large Goal Card */}
              {mappedGoals.slice(0, 1).map((goal: any) => {
                const formattedDate = goal.targetDate 
                  ? new Date(goal.targetDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                  : 'Sem prazo determinado';
                return (
                  <div key={goal.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-xl flex flex-col justify-between relative overflow-hidden group min-h-[220px]">
                    <div 
                      className="absolute top-0 right-0 p-gutter opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none"
                      style={{ color: goal.color }}
                    >
                      <span className="material-symbols-outlined text-[130px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {goal.icon}
                      </span>
                    </div>
                    
                    <div className="relative z-10 w-full">
                      <div className="flex items-start justify-between mb-lg">
                        <div>
                          <span className="bg-secondary/15 text-secondary font-label-sm text-[10px] px-sm py-1 rounded-full mb-base inline-block font-bold uppercase tracking-wider">
                            Meta Principal
                          </span>
                          <h3 className="font-headline text-headline-md text-primary mt-2 font-bold">{goal.name}</h3>
                        </div>
                        <div className="text-right">
                          <p className="font-label-sm text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Estimativa</p>
                          <p className="font-numeric text-numeric-data text-primary font-bold capitalize">{formattedDate}</p>
                        </div>
                      </div>
                      
                      <div className="mb-xl">
                        <div className="flex justify-between items-end mb-sm">
                          <span className="font-display text-display-lg text-primary font-bold">{goal.percentage}%</span>
                          <div className="text-right">
                            <span className="font-body-md text-body-md text-on-surface-variant font-medium">{formatCurrency(Number(goal.currentAmount))} / </span>
                            <span className="font-body-md text-body-md font-bold text-primary">{formatCurrency(Number(goal.targetAmount))}</span>
                          </div>
                        </div>
                        <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-secondary rounded-full transition-all duration-1000" 
                            style={{ width: `${goal.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-md mt-auto relative z-10">
                      <button 
                        onClick={() => setDepositGoalId(goal.id)}
                        className="bg-primary text-on-primary px-lg py-sm rounded-lg font-body-md font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm"
                      >
                        Aportar Agora
                      </button>
                      <button 
                        onClick={() => { if (confirm('Remover esta meta?')) deleteMutation.mutate(goal.id); }}
                        className="text-error font-body-md font-bold px-md py-sm rounded-lg hover:bg-error-container/20 transition-all"
                      >
                        Excluir Meta
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Secondary Goals stack */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                {mappedGoals.slice(1).map((goal: any) => {
                  const hasImage = goal.name.toLowerCase().includes('casa') || goal.name.toLowerCase().includes('apto') || goal.name.toLowerCase().includes('apartamento');
                  
                  if (hasImage) {
                    return (
                      <div key={goal.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col group min-h-[300px] col-span-1 md:col-span-2">
                        <div className="h-44 relative bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 overflow-hidden flex items-center justify-center">
                          <div className="absolute inset-0 opacity-25">
                            <div className="absolute -top-10 -right-10 w-40 h-40 border-[20px] border-white/10 rounded-full"></div>
                            <div className="absolute -bottom-20 -left-10 w-60 h-60 border-[15px] border-white/5 rounded-full"></div>
                          </div>
                          <span className="material-symbols-outlined text-[90px] text-white/15 absolute right-6 bottom-2 select-none pointer-events-none">home</span>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>
                          <div className="absolute bottom-md left-md text-left">
                            <h3 className="text-white font-headline text-headline-md font-extrabold">{goal.name}</h3>
                            <p className="text-white/80 font-label-sm text-label-sm uppercase font-bold tracking-wider">Meta: {formatCurrency(Number(goal.targetAmount))}</p>
                          </div>
                        </div>
                        <div className="p-lg flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-sm">
                              <span className="font-display text-display-lg text-primary font-bold">{goal.percentage}%</span>
                              <span className="bg-primary/5 text-primary-dim font-label-sm text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">Longo Prazo</span>
                            </div>
                            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden mb-md">
                              <div 
                                className="h-full bg-primary rounded-full transition-all duration-1000" 
                                style={{ width: `${goal.percentage}%` }}
                              ></div>
                            </div>
                            <div className="space-y-sm text-left">
                              <div className="flex justify-between text-sm">
                                <span className="font-body-md text-on-surface-variant font-medium">Acumulado Atual</span>
                                <span className="font-numeric text-numeric-data text-primary font-bold">{formatCurrency(Number(goal.currentAmount))}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4 pt-4 border-t border-outline-variant/60">
                            <button 
                              onClick={() => setDepositGoalId(goal.id)}
                              className="flex-1 bg-primary text-on-primary py-sm rounded-lg font-body-md font-bold hover:opacity-90 active:scale-[0.98] transition-all text-center"
                            >
                              Aportar
                            </button>
                            <button 
                              onClick={() => { if (confirm('Excluir esta meta?')) deleteMutation.mutate(goal.id); }}
                              className="border border-error/30 text-error px-4 rounded-lg hover:bg-error-container/20 transition-colors flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Standard Goal Cards
                  return (
                    <div key={goal.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-lg flex flex-col justify-between min-h-[220px]">
                      <div>
                        <div className="flex justify-between items-start mb-md">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ 
                              backgroundColor: `${goal.color}1A`,
                              color: goal.color
                            }}
                          >
                            <span className="material-symbols-outlined text-[28px]">{goal.icon}</span>
                          </div>
                          <button 
                            onClick={() => { if (confirm('Excluir esta meta?')) deleteMutation.mutate(goal.id); }}
                            className="text-placeholder hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                        <h3 className="font-headline text-headline-md text-primary mb-1 font-bold">{goal.name}</h3>
                        <p className="font-body-md text-body-md text-on-surface-variant mb-lg">Objetivo de planejamento de recursos.</p>
                        
                        <div className="mb-md">
                          <div className="flex justify-between font-numeric text-numeric-data mb-xs text-sm">
                            <span className="font-bold">{goal.percentage}%</span>
                            <span className="text-on-surface-variant font-medium">{formatCurrency(Number(goal.currentAmount))} / {formatCurrency(Number(goal.targetAmount))}</span>
                          </div>
                          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-1000" 
                              style={{ 
                                width: `${goal.percentage}%`,
                                backgroundColor: goal.color
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setDepositGoalId(goal.id)}
                        className="w-full mt-4 bg-primary text-on-primary py-sm rounded-lg font-body-md font-bold hover:opacity-90 active:scale-[0.98] transition-all text-center"
                      >
                        Aportar Saldo
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Suggested Goal & Orbit Banner, and Recent contributors list (col-span-4) */}
            <div className="col-span-12 lg:col-span-4 space-y-gutter">
              {/* Suggested Goal (AI Orbit Banner) */}
              <div className="bg-gradient-to-br from-violet-950/20 via-surface-container-lowest to-surface-container-lowest border border-violet-500/20 rounded-xl shadow-md p-xl flex flex-col justify-between min-h-[300px] text-left relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl group-hover:bg-violet-600/15 transition-colors duration-500 pointer-events-none"></div>
                
                <div className="space-y-md relative z-10">
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 animate-pulse">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                    </div>
                    <div>
                      <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent font-bold text-[10px] uppercase tracking-widest block">Inteligência Artificial</span>
                      <h4 className="font-headline text-headline-sm font-bold text-primary">Acelere seus Objetivos</h4>
                    </div>
                  </div>
                  
                  <div className="bg-surface-container-low/40 border border-violet-500/10 rounded-xl p-md backdrop-blur-xs">
                    <p className="font-body-md text-on-surface-variant text-sm leading-relaxed">
                      Com base no seu perfil, uma realocação de 5% da sua conta corrente para o fundo <strong className="text-violet-400 font-bold">'Yield Prime'</strong> poderia reduzir o tempo para suas metas em <strong className="text-secondary font-bold">8 meses</strong>.
                    </p>
                  </div>
                </div>

                {/* Orbit Animation */}
                <div className="flex items-center justify-center my-6 relative z-10">
                  <div className="relative w-28 h-28 bg-white/5 rounded-full border border-white/10 flex items-center justify-center">
                    <div className="absolute inset-0 border border-dashed border-white/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-secondary rounded-full shadow-[0_0_10px_rgba(78,222,163,0.6)]"></div>
                    <span className="material-symbols-outlined text-[36px] text-white">bolt</span>
                  </div>
                </div>

                <button className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-md rounded-lg font-body-md font-bold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-violet-600/15 relative z-10">
                  Analisar Sugestão
                </button>
              </div>

              {/* Real dynamic activities list */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-lg">
                <div className="flex items-center justify-between mb-lg">
                  <h3 className="font-headline text-headline-md text-primary font-bold">Atividade Recente</h3>
                </div>
                {recentActivities.length === 0 ? (
                  <div className="py-xl text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-3xl mb-1 block">receipt_long</span>
                    <p className="text-sm">Nenhum aporte registrado ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-md">
                    {recentActivities.map((act) => (
                      <div key={act.id} className="flex items-center gap-md p-sm hover:bg-surface-container-low/20 rounded-lg transition-colors text-left">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          act.isPositive ? "bg-secondary/15 text-secondary" : "bg-primary/10 text-primary-dim"
                        )}>
                          <span className="material-symbols-outlined text-[20px] font-bold">
                            {act.isPositive ? 'payments' : 'add'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body-lg text-body-lg font-bold text-primary truncate">{act.title}</p>
                          <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{act.subtitle}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn(
                            "font-numeric text-numeric-data font-bold",
                            act.isPositive ? "text-secondary" : "text-primary"
                          )}>{act.isPositive ? '+' : ''}{formatCurrency(act.amount)}</p>
                          <p className="font-label-sm text-label-sm text-outline font-semibold">{act.isPositive ? 'Aporte' : 'Alvo'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── MOBILE GOALS VIEW ─── */}
      <div className="block md:hidden space-y-lg pb-12">
        {/* Welcome Section */}
        <section className="flex flex-col gap-xs text-left">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Metas</p>
          <h2 className="font-display-lg-mobile text-display-lg-mobile text-primary">Objetivos</h2>
        </section>

        {/* Global Summary */}
        <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">Total Acumulado</p>
          <p className="font-display-lg-mobile text-display-lg-mobile text-primary font-bold">{formatCurrency(totalAccumulated)}</p>
          <p className="text-[11px] text-on-surface-variant mt-1">Alvo total estimado: {formatCurrency(totalTarget)}</p>
        </section>

        {/* AI Insight Mobile */}
        <section className="bg-gradient-to-br from-violet-950/20 via-surface-container-lowest to-surface-container-lowest border border-violet-500/20 rounded-xl shadow-sm p-lg relative overflow-hidden flex flex-col justify-between text-left group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10 space-y-sm">
            <div className="flex items-center gap-md">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <div className="text-left">
                <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent font-bold text-[9px] uppercase tracking-widest block">Inteligência Artificial</span>
                <h4 className="font-headline text-headline-sm font-bold text-primary">Otimize suas Metas</h4>
              </div>
            </div>
            <div className="bg-surface-container-low/40 border border-violet-500/10 rounded-xl p-md backdrop-blur-xs mt-xs text-left">
              <p className="font-body-md text-on-surface-variant text-sm leading-relaxed">
                Com base no seu perfil, uma realocação de 5% da sua conta corrente para o fundo <strong className="text-violet-400 font-bold">'Yield Prime'</strong> poderia reduzir o tempo para suas metas em <strong className="text-secondary font-bold">8 meses</strong>.
              </p>
            </div>
          </div>
          <button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-md py-2.5 rounded-lg font-bold text-xs shadow-md shadow-violet-600/15 mt-md w-full text-center relative z-10 flex items-center justify-center gap-xs">
            Analisar Sugestão
          </button>
        </section>

        {/* List of metas */}
        <section className="space-y-md">
          <div className="flex justify-between items-center">
            <h3 className="font-headline text-headline-md text-primary font-bold">Metas Ativas</h3>
            <button 
              onClick={() => setShowForm(!showForm)}
              className="text-primary font-label-sm flex items-center gap-xs font-bold"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Criar Nova
            </button>
          </div>

          <div className="space-y-sm">
            {goals.length === 0 ? (
              <div className="bg-surface-container-lowest p-xl rounded-xl border border-dashed border-outline-variant text-center flex flex-col items-center justify-center min-h-[200px]">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2">track_changes</span>
                <p className="font-headline text-headline-sm text-primary font-bold">Nenhuma meta ativa</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 bg-primary text-on-primary px-md py-2 rounded-lg font-bold text-xs"
                >
                  Criar Primeira Meta
                </button>
              </div>
            ) : (
              mappedGoals.map((goal: any) => (
                <div key={goal.id} className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm text-left">
                  <div className="flex justify-between items-start mb-xs">
                    <div className="flex items-center gap-md">
                      <div 
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ 
                          backgroundColor: `${goal.color}1A`,
                          color: goal.color
                        }}
                      >
                        <span className="material-symbols-outlined text-[20px]">{goal.icon}</span>
                      </div>
                      <div>
                        <p className="font-label-sm text-on-surface font-bold truncate max-w-[130px]">{goal.name}</p>
                        <p className="text-on-surface-variant text-[10px] font-semibold">
                          {formatCurrency(Number(goal.currentAmount))} / {formatCurrency(Number(goal.targetAmount))}
                        </p>
                      </div>
                    </div>
                    <span className="font-numeric text-primary font-extrabold text-sm">{goal.percentage}%</span>
                  </div>
                  
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden my-2">
                    <div 
                      className="h-full" 
                      style={{ 
                        width: `${goal.percentage}%`,
                        backgroundColor: goal.color
                      }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-outline-variant/30">
                    <button 
                      onClick={() => setDepositGoalId(goal.id)}
                      className="text-xs bg-primary text-on-primary px-3 py-1.5 rounded-md font-bold"
                    >
                      Aportar
                    </button>
                    {goal.targetDate && (
                      <span className="text-[10px] text-on-surface-variant">Prazo: {new Date(goal.targetDate).toLocaleDateString('pt-BR')}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ─── MODAL APORTAR / DEPOSIT PROGRESS ─── */}
      {depositGoalId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border-base rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-left glass-card">
            <div className="p-5 border-b border-border-base flex justify-between items-center">
              <h3 className="font-headline text-headline-md text-primary font-bold">Aportar Saldo</h3>
              <button 
                onClick={() => {
                  setDepositGoalId(null);
                  setDepositAccountId('');
                }}
                className="p-1 hover:bg-surface-container rounded-full text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Valor do Aporte *</label>
                <CurrencyInput
                  value={depositAmount}
                  onChange={(val) => setDepositAmount(val)}
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface font-numeric font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Conta de Origem (Opcional)</label>
                <select
                  value={depositAccountId}
                  onChange={(e) => setDepositAccountId(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                >
                  <option value="">Apenas registrar progresso (sem deduzir de conta)</option>
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {formatCurrency(Number(acc.balance), acc.currency)})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-on-surface-variant/80 mt-1">
                  Se você selecionar uma conta, o valor do aporte será deduzido do saldo dela e uma transação de despesa será criada.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border-base">
                <button 
                  type="button" 
                  onClick={() => {
                    setDepositGoalId(null);
                    setDepositAccountId('');
                  }} 
                  className="px-4 py-2 text-sm border border-outline rounded-lg text-on-surface-variant hover:bg-surface-container transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    const amountVal = depositAmount;
                    if (amountVal > 0) {
                      progressMutation.mutate({ 
                        id: depositGoalId, 
                        amount: amountVal, 
                        accountId: depositAccountId || undefined 
                      });
                    } else {
                      toast.error('Informe um valor maior que zero');
                    }
                  }}
                  className="px-4 py-2 text-sm bg-secondary text-on-secondary rounded-lg hover:opacity-90 font-bold"
                >
                  Confirmar Aporte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
