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

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then((r) => r.data),
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
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post(`/goals/${id}/progress`, { amount }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['goals'] }); 
      toast.success('Progresso adicionado!'); 
      setDepositGoalId(null);
      setDepositAmount(0);
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

  const hasRealGoals = goals.length > 0;
  const displayAccumulated = hasRealGoals ? totalAccumulated : 145200.00;
  const displayTarget = hasRealGoals ? totalTarget : 450000.00;

  // Map database goals into display elements
  const mappedGoals = hasRealGoals ? goals.map((g: any) => {
    const pct = Math.min(100, Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100));
    return {
      ...g,
      percentage: pct,
      icon: g.icon || (g.name.toLowerCase().includes('viagem') ? 'flight_takeoff' : g.name.toLowerCase().includes('casa') ? 'home' : 'shield')
    };
  }) : [
    { 
      id: 'g1', 
      name: 'Reserva de Emergência', 
      targetAmount: 50000.00, 
      currentAmount: 42500.00, 
      percentage: 85, 
      priority: 'Alta Prioridade', 
      targetDate: '2024-12-31T00:00:00.000Z', 
      icon: 'shield', 
      color: '#006c49',
      description: 'Garantia de 6 meses de custos essenciais' 
    },
    { 
      id: 'g2', 
      name: 'Viagem: Europa 2025', 
      targetAmount: 25000.00, 
      currentAmount: 8000.00, 
      percentage: 32, 
      targetDate: '2025-08-31T00:00:00.000Z', 
      icon: 'flight_takeoff', 
      color: '#ffb3ad',
      description: 'Tour gastronômico na Itália e França.' 
    },
    { 
      id: 'g3', 
      name: 'Casa Própria', 
      targetAmount: 350000.00, 
      currentAmount: 75320.00, 
      percentage: 21.5, 
      priority: 'Longo Prazo', 
      targetDate: '2029-08-31T00:00:00.000Z', 
      icon: 'home', 
      color: '#031632',
      monthlyContribution: 2500.00, 
      imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
      description: 'Entrada do apartamento de 3 dormitórios' 
    }
  ];

  // Activities list
  const recentActivities = [
    { id: 'a1', title: 'Aporte em Reserva de Emergência', subtitle: 'Transferência Automática • Hoje, 09:41', amount: 85000, current: 42500, type: 'DEPOSIT', isPositive: true },
    { id: 'a2', title: 'Nova Meta Criada: Viagem Europa', subtitle: 'Definição de Objetivo • Ontem, 14:20', amount: 25000, current: 0, type: 'CREATE', isPositive: false }
  ];

  return (
    <>
      {/* ─── DESKTOP GOALS VIEW ─── */}
      <div className="hidden md:block space-y-gutter">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-xl">
          <div>
            <h2 className="font-display text-display-lg text-primary">Gestão de Metas</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">Acompanhe seu progresso financeiro e visualize o caminho para suas conquistas de longo prazo.</p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-xs bg-secondary text-on-secondary px-lg py-sm rounded-xl font-body-md font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md self-start md:self-auto"
          >
            <span className="material-symbols-outlined">add_circle</span>
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
                  placeholder="Ex: Viagem para o Japão" 
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
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
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Cor</label>
                <input 
                  type="color" 
                  {...register('color')} 
                  defaultValue="#006c49" 
                  className="w-full h-10 bg-surface-container-low border-none rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Ícone</label>
                <select 
                  {...register('icon')} 
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
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
              <span className="font-display text-display-lg text-primary font-bold">{formatCurrency(displayAccumulated)}</span>
              <span className="font-numeric text-numeric-data text-secondary flex items-center font-bold">
                <span className="material-symbols-outlined text-[16px] mr-[2px]">arrow_upward</span> 12%
              </span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2">Meta Global</p>
            <span className="font-display text-display-lg text-primary font-bold">{formatCurrency(displayTarget)}</span>
          </div>
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-2">Tempo Médio</p>
            <span className="font-display text-display-lg text-primary font-bold">2.4 Anos</span>
          </div>
        </div>

        {/* Goals Bento Layout Grid */}
        <div className="grid grid-cols-12 gap-lg text-left">
          {/* Main Goal Card & Secondary list (col-span-8) */}
          <div className="col-span-12 lg:col-span-8 space-y-lg">
            {/* Find and render emergency fund (or the first meta) as the primary large horizontal card */}
            {mappedGoals.slice(0, 1).map((goal: any) => {
              const isReal = goals.length > 0;
              const formattedDate = goal.targetDate 
                ? new Date(goal.targetDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                : 'Dezembro, 2024';
              return (
                <div key={goal.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-xl flex flex-col justify-between relative overflow-hidden group min-h-[220px]">
                  <div 
                    className="absolute top-0 right-0 p-gutter opacity-10 group-hover:scale-110 transition-transform duration-500"
                    style={{ color: goal.color || 'var(--primary)' }}
                  >
                    <span className="material-symbols-outlined text-[130px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {goal.icon}
                    </span>
                  </div>
                  
                  <div className="relative z-10 w-full">
                    <div className="flex items-start justify-between mb-lg">
                      <div>
                        <span className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-sm py-1 rounded-full mb-base inline-block font-bold">
                          {goal.priority || 'Meta Principal'}
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
                      className="bg-primary text-on-primary px-lg py-sm rounded-lg font-body-md font-bold hover:opacity-90 active:scale-95 transition-opacity shadow-sm"
                    >
                      Aportar Agora
                    </button>
                    {isReal && (
                      <button 
                        onClick={() => { if (confirm('Remover esta meta?')) deleteMutation.mutate(goal.id); }}
                        className="text-error font-body-md font-bold px-md py-sm rounded-lg hover:bg-error-container/20 transition-all"
                      >
                        Excluir Meta
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Other goals cards in a 2-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              {mappedGoals.slice(1).map((goal: any) => {
                const isReal = goals.length > 0;
                // If it is the "Casa Própria" (tall/medium image style card)
                const hasImage = goal.imageUrl || goal.name.toLowerCase().includes('casa');
                const img = goal.imageUrl || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80';
                
                if (hasImage) {
                  return (
                    <div key={goal.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col group min-h-[300px] col-span-1 md:col-span-2">
                      <div className="h-44 relative">
                        <img 
                          alt="Visualização da meta" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-50" 
                          src={img}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-md left-md text-left">
                          <h3 className="text-white font-headline text-headline-md font-extrabold">{goal.name}</h3>
                          <p className="text-white/80 font-label-sm text-label-sm uppercase font-bold tracking-wider">Meta: {formatCurrency(Number(goal.targetAmount))}</p>
                        </div>
                      </div>
                      <div className="p-lg flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-sm">
                            <span className="font-display text-display-lg text-primary font-bold">{goal.percentage}%</span>
                            <span className="bg-surface-container text-on-surface-variant font-label-sm text-label-sm px-2 py-1 rounded font-bold uppercase tracking-wider">Longo Prazo</span>
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
                            <div className="flex justify-between text-sm">
                              <span className="font-body-md text-on-surface-variant font-medium">Aporte Mensal Recom.</span>
                              <span className="font-numeric text-numeric-data text-primary font-bold">{formatCurrency(goal.monthlyContribution || 2500)}</span>
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
                          {isReal && (
                            <button 
                              onClick={() => { if (confirm('Excluir esta meta?')) deleteMutation.mutate(goal.id); }}
                              className="border border-error/30 text-error px-4 rounded-lg hover:bg-error-container/20 transition-colors flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Standard visual card (e.g. Viagem Europa)
                return (
                  <div key={goal.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-lg flex flex-col justify-between min-h-[220px]">
                    <div>
                      <div className="flex justify-between items-start mb-md">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ 
                            backgroundColor: `${goal.color || '#75777e'}1A`,
                            color: goal.color || '#75777e'
                          }}
                        >
                          <span className="material-symbols-outlined text-[28px]">{goal.icon}</span>
                        </div>
                        {isReal && (
                          <button 
                            onClick={() => { if (confirm('Excluir esta meta?')) deleteMutation.mutate(goal.id); }}
                            className="text-placeholder hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                      <h3 className="font-headline text-headline-md text-primary mb-1 font-bold">{goal.name}</h3>
                      <p className="font-body-md text-body-md text-on-surface-variant mb-lg">{goal.description || 'Meta de médio prazo'}</p>
                      
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
                              backgroundColor: goal.color || 'var(--secondary)'
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
            <div className="bg-primary-container text-on-primary-container rounded-xl shadow-md p-xl flex flex-col justify-between min-h-[300px]">
              <div className="space-y-md">
                <h3 className="font-headline text-headline-md font-bold text-white">Acelere seus Objetivos</h3>
                <p className="font-body-md text-body-md text-white/80">
                  Com base no seu perfil, uma realocação de 5% da sua conta corrente para o fundo 'Yield Prime' poderia reduzir o tempo para sua meta de Casa Própria em 8 meses.
                </p>
              </div>

              {/* Orbit Animation placeholder styled with CSS */}
              <div className="flex items-center justify-center my-6">
                <div className="relative w-32 h-32 bg-white/5 rounded-full border border-white/10 flex items-center justify-center">
                  <div className="absolute inset-0 border border-dashed border-white/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-secondary rounded-full shadow-[0_0_10px_rgba(78,222,163,0.6)]"></div>
                  <span className="material-symbols-outlined text-[48px] text-white">bolt</span>
                </div>
              </div>

              <button className="w-full bg-secondary text-on-secondary py-md rounded-lg font-body-md font-bold hover:opacity-90 active:scale-95 transition-all">
                Analisar Sugestão
              </button>
            </div>

            {/* Recent contributors activity list */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-lg">
              <div className="flex items-center justify-between mb-lg">
                <h3 className="font-headline text-headline-md text-primary font-bold">Atividade Recente</h3>
              </div>
              <div className="space-y-md">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex items-center gap-md p-sm hover:bg-surface-container-low/20 rounded-lg transition-colors text-left">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      act.isPositive ? "bg-secondary/15 text-secondary" : "bg-primary-container text-on-primary-container"
                    )}>
                      <span className="material-symbols-outlined text-[20px] font-extrabold">
                        {act.isPositive ? 'add' : 'star'}
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
                      )}>{act.isPositive ? '+' : ''}{formatCurrency(act.amount / 100)}</p>
                      <p className="font-label-sm text-label-sm text-outline font-semibold">Aporte</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
          <p className="font-display-lg-mobile text-display-lg-mobile text-primary font-bold">{formatCurrency(displayAccumulated)}</p>
          <p className="text-[11px] text-on-surface-variant mt-1">Alvo total estimado: {formatCurrency(displayTarget)}</p>
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
            {mappedGoals.map((goal: any) => (
              <div key={goal.id} className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm text-left">
                <div className="flex justify-between items-start mb-xs">
                  <div className="flex items-center gap-md">
                    <div 
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ 
                        backgroundColor: `${goal.color || '#75777e'}1A`,
                        color: goal.color || '#75777e'
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
                      backgroundColor: goal.color || 'var(--secondary)'
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
            ))}
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
                onClick={() => setDepositGoalId(null)}
                className="p-1 hover:bg-surface-container rounded-full text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Valor do Aporte (R$)</label>
                <CurrencyInput
                  value={depositAmount}
                  onChange={(val) => setDepositAmount(val)}
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface font-numeric font-semibold"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-border-base">
                <button 
                  type="button" 
                  onClick={() => setDepositGoalId(null)} 
                  className="px-4 py-2 text-sm border border-outline rounded-lg text-on-surface-variant hover:bg-surface-container transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    const amountVal = depositAmount;
                    if (amountVal > 0) {
                      progressMutation.mutate({ id: depositGoalId, amount: amountVal });
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
