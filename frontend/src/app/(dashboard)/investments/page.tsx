'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const TYPE_LABELS: Record<string, string> = {
  STOCK: 'Ações BR',
  STOCK_US: 'Ações EUA',
  FUND: 'FIIs',
  BOND: 'Renda Fixa',
  CRYPTO: 'Crypto',
  REAL_ESTATE: 'Imóvel',
  SAVINGS: 'Poupança',
  OTHER: 'Outro',
};

const TYPE_ICONS: Record<string, string> = {
  STOCK: 'equalizer',
  STOCK_US: 'attach_money',
  FUND: 'apartment',
  BOND: 'description',
  CRYPTO: 'currency_bitcoin',
  REAL_ESTATE: 'home_work',
  SAVINGS: 'savings',
  OTHER: 'folder',
};

const TYPE_COLORS: Record<string, string> = {
  STOCK: '#f97316',
  STOCK_US: '#0052cc',
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
  const [editingInvestment, setEditingInvestment] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.get('/api/investments/portfolio').then((r) => r.data),
  });

  const syncProventosMutation = useMutation({
    mutationFn: () => api.post('/api/proventos/sync').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proventos'] }),
  });

  const updatePricesMutation = useMutation({
    mutationFn: () => api.post('/api/investments/update-prices').then((r) => r.data),
    onSuccess: (result) => {
      if (result.updated > 0) {
        qc.invalidateQueries({ queryKey: ['portfolio'] });
        qc.invalidateQueries({ queryKey: ['household-summary'] });
        toast.success(`${result.updated} cotação(ões) atualizada(s)!`);
      }
      setLastUpdated(new Date());
      syncProventosMutation.mutate();
    },
    onError: () => toast.error('Não foi possível atualizar cotações agora'),
  });

  useEffect(() => {
    if (portfolio?.investments?.length > 0) {
      updatePricesMutation.mutate();
    }
  // Executa apenas quando o portfólio carrega pela primeira vez
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!portfolio]);

  const currentYear = new Date().getFullYear();
  const { data: proventosData } = useQuery({
    queryKey: ['proventos'],
    queryFn: () => api.get(`/api/proventos?year=${currentYear}`).then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/api/accounts').then((r) => r.data),
  });

  const { register, handleSubmit, reset, control } = useForm<any>({
    defaultValues: { type: 'STOCK' }
  });
  const watchedType = useWatch({ control, name: 'type' });
  const formIsUSD = watchedType === 'STOCK_US';
  const formIsBond = watchedType === 'BOND';

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/investments', {
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/api/investments/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Investimento atualizado!');
      reset();
      setEditingInvestment(null);
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao atualizar investimento'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/investments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['recent-transactions-activity'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Ativo removido!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao remover ativo'),
  });

  const handleEditInvestment = (inv: any) => {
    setEditingInvestment(inv);
    if (inv.type === 'BOND') {
      const bondInfo = inv.notes ? (() => { try { return JSON.parse(inv.notes); } catch { return {}; } })() : {};
      reset({
        name: inv.name,
        type: 'BOND',
        broker: inv.broker || '',
        tipoTitulo: bondInfo.tipoTitulo || 'CDB',
        indexador: bondInfo.indexador || 'CDI',
        taxa: bondInfo.taxa ?? '',
        forma: bondInfo.forma || 'Pós-fixado',
        valorInvestido: Number(inv.purchasePrice) || 0,
        liquidezDiaria: bondInfo.liquidezDiaria || false,
        purchaseDate: inv.purchaseDate ? inv.purchaseDate.slice(0, 10) : '',
        dataVencimento: bondInfo.dataVencimento ? bondInfo.dataVencimento.slice(0, 10) : '',
        isEmergencyFund: bondInfo.isEmergencyFund || false,
      });
    } else {
      const otherNotes = inv.notes ? (() => { try { return JSON.parse(inv.notes); } catch { return {}; } })() : {};
      reset({
        name: inv.name,
        type: inv.type,
        ticker: inv.ticker || '',
        quantity: inv.quantity ? Number(inv.quantity) : '',
        purchasePrice: Number(inv.purchasePrice) || 0,
        currentPrice: Number(inv.currentPrice) || 0,
        broker: inv.broker || '',
        purchaseDate: inv.purchaseDate ? inv.purchaseDate.slice(0, 10) : '',
        isEmergencyFund: otherNotes.isEmergencyFund || false,
      });
    }
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = (d: any) => {
    if (d.type === 'BOND') {
      const payload = {
        name: d.name,
        type: 'BOND',
        ticker: d.indexador ? `${d.indexador}${d.taxa ? ` ${d.taxa}%` : ''}` : undefined,
        quantity: 1,
        purchasePrice: Number(d.valorInvestido) || 0,
        currentPrice: editingInvestment ? undefined : (Number(d.valorInvestido) || 0),
        broker: d.broker || undefined,
        purchaseDate: d.purchaseDate || undefined,
        notes: JSON.stringify({
          tipoTitulo: d.tipoTitulo || 'CDB',
          indexador: d.indexador || 'CDI',
          taxa: d.taxa ? Number(d.taxa) : null,
          forma: d.forma || 'Pós-fixado',
          liquidezDiaria: !!d.liquidezDiaria,
          dataVencimento: d.dataVencimento || null,
          isEmergencyFund: !!d.isEmergencyFund,
        }),
      };
      if (editingInvestment) {
        updateMutation.mutate({ id: editingInvestment.id, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    } else {
      const payload = {
        name: d.name,
        type: d.type,
        ticker: d.ticker,
        quantity: d.quantity ? Number(d.quantity) : undefined,
        purchasePrice: d.purchasePrice ? Number(d.purchasePrice) : undefined,
        currentPrice: d.currentPrice ? Number(d.currentPrice) : undefined,
        broker: d.broker || undefined,
        accountId: d.accountId || undefined,
        purchaseDate: d.purchaseDate || undefined,
        notes: JSON.stringify({ isEmergencyFund: !!d.isEmergencyFund }),
      };
      if (editingInvestment) {
        updateMutation.mutate({ id: editingInvestment.id, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    }
  };

  const toggleCategory = (type: string) => {
    setExpandedCats(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const hasRealInvestments = portfolio?.investments?.length > 0;

  // Totals
  const displayTotalCurrent = hasRealInvestments ? Number(portfolio.totalCurrent) : 0;
  const displayTotalCost = hasRealInvestments ? Number(portfolio.totalCost) : 0;
  const displayTotalGain = hasRealInvestments ? Number(portfolio.totalGain) : 0;
  const displayTotalGainPct = hasRealInvestments ? Number(portfolio.totalGainPct) : 0;

  const allProventos: any[] = proventosData?.proventos ?? [];
  const displayDividends = Number(proventosData?.totalRecebido ?? 0);
  const displayAReceber = Number(proventosData?.totalAReceber ?? 0);
  const proventosAReceber = allProventos.filter((p) => p.status === 'A_RECEBER');
  const proventosPagos = allProventos.filter((p) => p.status === 'PAGO');

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

  // Build real evolution chart from purchaseDates
  const getEvolutionData = () => {
    if (!hasRealInvestments) return [];

    const allInvestments: any[] = portfolio.investments;
    const now = new Date();
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Find earliest purchase date across all investments
    const purchaseDates = allInvestments
      .map((inv: any) => inv.purchaseDate ? new Date(inv.purchaseDate) : null)
      .filter(Boolean) as Date[];

    // Build the last 12 months as { year, month } pairs
    const last12Months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last12Months.push({ year: d.getFullYear(), month: d.getMonth(), label: months[d.getMonth()] });
    }

    // For each month slot, sum the current value of all investments
    // whose purchaseDate is on or before the END of that month
    return last12Months.map(({ year, month, label }) => {
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59); // last moment of the month

      const valueAtMonth = allInvestments.reduce((sum: number, inv: any) => {
        const purchaseDate = inv.purchaseDate ? new Date(inv.purchaseDate) : null;

        // Only count this investment if it was bought on or before end of month
        if (!purchaseDate || purchaseDate > endOfMonth) return sum;

        const isUSD = inv.type === 'STOCK_US';
        const rate = isUSD ? (portfolio?.usdBrlRate || 5.75) : 1;
        const current = Number(inv.quantity || 0) * Number(inv.currentPrice || inv.purchasePrice || 0) * rate;
        return sum + current;
      }, 0);

      return { label, value: Math.round(valueAtMonth * 100) / 100 };
    });
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
          {lastUpdated && (
            <p className="text-xs text-placeholder mt-1">
              Cotações atualizadas às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={() => updatePricesMutation.mutate()}
            disabled={updatePricesMutation.isPending}
            className="flex items-center gap-xs border border-outline text-on-surface-variant px-lg py-md rounded-lg font-label-sm text-label-sm active:scale-95 transition-transform hover:bg-surface-container disabled:opacity-50"
            title="Atualizar cotações via brapi.dev"
          >
            <span className={cn('material-symbols-outlined text-[18px]', updatePricesMutation.isPending && 'animate-spin')}>
              {updatePricesMutation.isPending ? 'refresh' : 'sync'}
            </span>
            <span className="hidden sm:inline">Atualizar Cotações</span>
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-xs bg-primary text-on-primary px-lg py-md rounded-lg font-label-sm text-label-sm active:scale-95 transition-transform font-bold"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Adicionar Ativo
          </button>
        </div>
      </div>

      {/* Shared Create Form */}
      {showForm && (
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant text-left mb-gutter">
          <h2 className="font-headline text-headline-md text-primary font-bold mb-2">
            {editingInvestment ? 'Editar Investimento' : 'Adicionar Ativo à Carteira'}
          </h2>
          <p className="text-on-surface-variant text-xs mb-4 font-semibold">
            {formIsBond
              ? 'Registre uma aplicação em renda fixa com os detalhes do título.'
              : 'Cadastre a compra de um ativo. Você pode associá-lo a uma conta bancária para deduzir o valor da conta de origem.'}
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* ── Campo Nome + Tipo (sempre visíveis) ── */}
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Nome do Ativo *</label>
              <input {...register('name')} placeholder={formIsBond ? 'Ex: CDB Itaú 100% CDI' : 'Ex: Itaúsa'} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Tipo de Investimento</label>
              <select {...register('type')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface cursor-pointer">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* ── Campos específicos de RENDA FIXA ── */}
            {formIsBond ? (
              <>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Emissor / Banco *</label>
                  <input {...register('broker')} placeholder="Ex: Itaú, Nubank, XP" className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Tipo de Título</label>
                  <select {...register('tipoTitulo')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface cursor-pointer">
                    <option value="CDB">CDB</option>
                    <option value="RDB">RDB</option>
                    <option value="LCI">LCI</option>
                    <option value="LCA">LCA</option>
                    <option value="LC">LC</option>
                    <option value="LIG">LIG</option>
                    <option value="LF">LF</option>
                    <option value="Debenture">Debênture</option>
                    <option value="CRI">CRI</option>
                    <option value="CRA">CRA</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Indexador</label>
                  <select {...register('indexador')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface cursor-pointer">
                    <option value="CDI">CDI</option>
                    <option value="IPCA">IPCA</option>
                    <option value="SELIC">SELIC</option>
                    <option value="Prefixado">Prefixado</option>
                    <option value="IGPM">IGP-M</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Taxa (%)</label>
                  <input type="number" step="0.01" {...register('taxa')} placeholder="Ex: 100 (= 100% CDI)" className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Forma</label>
                  <select {...register('forma')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface cursor-pointer">
                    <option value="Pós-fixado">Pós-fixado</option>
                    <option value="Pré-fixado">Pré-fixado</option>
                    <option value="Híbrido">Híbrido (ex: IPCA+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Valor Investido (R$) *</label>
                  <Controller
                    control={control}
                    name="valorInvestido"
                    render={({ field }) => (
                      <CurrencyInput value={field.value} onChange={field.onChange} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" required />
                    )}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Data de Aplicação</label>
                  <input type="date" {...register('purchaseDate')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Data de Vencimento (Opcional)</label>
                  <input type="date" {...register('dataVencimento')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" />
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <input type="checkbox" id="liquidezDiaria" {...register('liquidezDiaria')} className="w-4 h-4 accent-primary rounded cursor-pointer" />
                  <label htmlFor="liquidezDiaria" className="text-sm font-semibold text-on-surface cursor-pointer">Liquidez diária</label>
                </div>
              </>
            ) : (
              /* ── Campos de AÇÕES / FIIs / CRYPTO / etc ── */
              <>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Ticker/Símbolo *</label>
                  <input {...register('ticker')} placeholder={formIsUSD ? 'Ex: MRVL' : 'Ex: ITSA4'} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Quantidade *</label>
                  <input type="number" step="0.000001" {...register('quantity')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Preço Médio de Compra ({formIsUSD ? 'US$' : 'R$'}) *</label>
                  <Controller
                    control={control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <CurrencyInput value={field.value} onChange={field.onChange} currency={formIsUSD ? 'USD' : 'BRL'} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" required />
                    )}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Preço de Cotação Atual ({formIsUSD ? 'US$' : 'R$'})</label>
                  <Controller
                    control={control}
                    name="currentPrice"
                    render={({ field }) => (
                      <CurrencyInput value={field.value} onChange={field.onChange} currency={formIsUSD ? 'USD' : 'BRL'} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" />
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
                      <option key={acc.id} value={acc.id}>{acc.name} (Saldo: {formatCurrency(Number(acc.balance), acc.currency)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Data de Aquisição</label>
                  <input type="date" {...register('purchaseDate')} className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface" />
                </div>
              </>
            )}

                    <div className="col-span-1 md:col-span-3 flex items-center gap-3 pt-2">
              <input type="checkbox" id="isEmergencyFund" {...register('isEmergencyFund')} className="w-4 h-4 accent-primary rounded cursor-pointer" />
              <label htmlFor="isEmergencyFund" className="text-sm font-semibold text-on-surface cursor-pointer">
                É Reserva de Emergência (Cofrinho)
              </label>
            </div>

    <div className="col-span-1 md:col-span-3 flex gap-2 justify-end pt-2 border-t border-border-base mt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingInvestment(null); reset(); }} className="px-4 py-2 text-sm border border-outline rounded-lg text-on-surface-variant hover:bg-surface-container transition-all">Cancelar</button>
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 disabled:opacity-60 font-bold">
                {(createMutation.isPending || updateMutation.isPending)
                  ? 'Salvando...'
                  : editingInvestment ? 'Salvar Alterações' : 'Adicionar Ativo'}
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
            <p className="text-on-surface-variant font-numeric text-numeric-data mt-xs font-semibold">
              Custo: {formatCurrency(displayTotalCost)}
            </p>
          </div>
          
          {/* Total Profit */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <div className="flex justify-between items-start mb-sm">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-bold">Resultado Consolidado</p>
              <span className="material-symbols-outlined text-secondary bg-secondary-container/20 p-1 rounded">payments</span>
            </div>
            <h2
              className="font-display text-display-lg font-bold"
              style={{ color: displayTotalGain >= 0 ? 'var(--secondary)' : 'var(--error)' }}
            >
              {formatCurrency(displayTotalGain)}
            </h2>
            <p className="text-on-surface-variant font-numeric text-numeric-data mt-xs font-semibold">Rentabilidade: {displayTotalGainPct.toFixed(1)}%</p>
          </div>

          {/* Proventos Recebidos */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <div className="flex justify-between items-start mb-sm">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-bold">Proventos Recebidos</p>
              <span className="material-symbols-outlined text-secondary bg-secondary-container/20 p-1 rounded">savings</span>
            </div>
            <h2 className="font-display text-display-lg text-secondary font-bold">{formatCurrency(displayDividends)}</h2>
            <p className="text-on-surface-variant font-numeric text-numeric-data mt-xs font-semibold">{currentYear}</p>
          </div>

          {/* Proventos a Receber */}
          <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm text-left">
            <div className="flex justify-between items-start mb-sm">
              <p className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider font-bold">Proventos a Receber</p>
              <span className="material-symbols-outlined text-primary bg-surface-container p-1 rounded">schedule</span>
            </div>
            <h2 className="font-display text-display-lg text-primary font-bold">{formatCurrency(displayAReceber)}</h2>
            <p className="text-on-surface-variant font-numeric text-numeric-data mt-xs font-semibold">Agendados {currentYear}</p>
          </div>
        </section>

        {/* Charts Section Evolution vs Asset Allocation */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-lg mt-gutter">
          {/* Evolution Chart */}
          <div className="lg:col-span-2 bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm h-[320px] flex flex-col justify-between text-left">
            <div className="flex justify-between items-center mb-lg">
              <h3 className="font-headline text-headline-md text-primary font-bold">Evolução do Patrimônio</h3>
              <span className="text-xs bg-surface-container-high px-3 py-1 rounded-full font-bold uppercase text-primary">Últimos 12 meses</span>
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
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Patrimônio']} contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)' }} />
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
              const categoryCost = list.reduce((sum: number, item: any) => sum + Number(item.cost || 0), 0);
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
                        <p className="text-on-surface-variant font-label-sm text-label-sm">{list.length} {list.length === 1 ? 'ativo' : 'ativos'}</p>
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
                        {typeKey === 'BOND' ? (
                          <>
                            <thead className="bg-surface-container-low font-label-sm text-label-sm uppercase font-bold">
                              <tr className="border-b border-outline-variant/60">
                                <th className="px-lg py-sm font-bold">Título</th>
                                <th className="px-lg py-sm font-bold">Emissor</th>
                                <th className="px-lg py-sm font-bold">Indexador / Taxa</th>
                                <th className="px-lg py-sm font-bold text-center">Liquidez</th>
                                <th className="px-lg py-sm font-bold text-right">Vencimento</th>
                                <th className="px-lg py-sm font-bold text-right">Valor Aplicado</th>
                                <th className="px-lg py-sm font-bold text-right">Valor Atual</th>
                                <th className="px-lg py-sm font-bold text-right">Resultado</th>
                                <th className="px-lg py-sm"></th>
                              </tr>
                            </thead>
                            <tbody className="font-numeric text-numeric-data text-on-surface-variant">
                              {list.map((inv: any) => {
                                const bondInfo = inv.notes ? (() => { try { return JSON.parse(inv.notes); } catch { return null; } })() : null;
                                const currentVal = Number(inv.current || 0);
                                const gain = Number(inv.gain || 0);
                                const gainPct = Number(inv.gainPct || 0);
                                const taxaLabel = bondInfo
                                  ? `${bondInfo.tipoTitulo} ${bondInfo.indexador}${bondInfo.taxa ? ` ${bondInfo.taxa}%` : ''}`
                                  : (inv.ticker || '—');
                                return (
                                  <tr key={inv.id} className="border-b border-outline-variant/40 hover:bg-surface-container-high/30 transition-colors">
                                    <td className="px-lg py-md text-primary font-bold">{inv.name}</td>
                                    <td className="px-lg py-md">{inv.broker || '—'}</td>
                                    <td className="px-lg py-md">{taxaLabel}</td>
                                    <td className="px-lg py-md text-center">
                                      {bondInfo?.liquidezDiaria
                                        ? <span className="text-secondary text-[11px] font-bold">Diária</span>
                                        : <span className="text-placeholder text-[11px]">No venc.</span>}
                                    </td>
                                    <td className="px-lg py-md text-right text-on-surface-variant">
                                      {bondInfo?.dataVencimento ? new Date(bondInfo.dataVencimento).toLocaleDateString('pt-BR') : '—'}
                                    </td>
                                    <td className="px-lg py-md text-right">{formatCurrency(Number(inv.purchasePrice))}</td>
                                    <td className="px-lg py-md text-right text-primary font-semibold">{formatCurrency(currentVal)}</td>
                                    <td className={cn("px-lg py-md text-right font-bold", gain >= 0 ? "text-secondary" : "text-error")}>
                                      {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                                    </td>
                                    <td className="px-lg py-md text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleEditInvestment(inv)} className="text-placeholder hover:text-primary transition-colors" title="Editar">
                                          <span className="material-symbols-outlined text-[18px]">edit</span>
                                        </button>
                                        <button onClick={() => { if (confirm('Excluir este ativo?')) deleteMutation.mutate(inv.id); }} className="text-placeholder hover:text-error transition-colors" title="Excluir">
                                          <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </>
                        ) : (
                          <>
                            <thead className="bg-surface-container-low font-label-sm text-label-sm uppercase font-bold">
                              <tr className="border-b border-outline-variant/60">
                                <th className="px-lg py-sm font-bold">Ativo</th>
                                <th className="px-lg py-sm font-bold text-right">Qtd</th>
                                <th className="px-lg py-sm font-bold text-right">Pço Médio</th>
                                <th className="px-lg py-sm font-bold text-right">Preço Atual</th>
                                <th className="px-lg py-sm font-bold text-right">Saldo (R$)</th>
                                <th className="px-lg py-sm font-bold text-right">Resultado</th>
                                <th className="px-lg py-sm"></th>
                              </tr>
                            </thead>
                            <tbody className="font-numeric text-numeric-data text-on-surface-variant">
                              {list.map((inv: any) => {
                                const isUSD = inv.type === 'STOCK_US' || inv.currency === 'USD';
                                const fmtPrice = (v: number) => formatCurrency(v, isUSD ? 'USD' : 'BRL');
                                const currentVal = Number(inv.current || 0);
                                const gain = Number(inv.gain || 0);
                                const gainPct = Number(inv.gainPct || 0);
                                return (
                                  <tr key={inv.id} className="border-b border-outline-variant/40 hover:bg-surface-container-high/30 transition-colors">
                                    <td className="px-lg py-md">
                                      <span className="text-primary font-bold">{inv.ticker || inv.name}</span>
                                      {isUSD && <span className="ml-1 text-[9px] bg-[#0052cc]/20 text-[#0052cc] font-bold px-1 py-0.5 rounded uppercase">USD</span>}
                                    </td>
                                    <td className="px-lg py-md text-right">{Number(inv.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 6 })}</td>
                                    <td className="px-lg py-md text-right">{fmtPrice(Number(inv.purchasePrice))}</td>
                                    <td className="px-lg py-md text-right">{fmtPrice(Number(inv.currentPrice || inv.purchasePrice))}</td>
                                    <td className="px-lg py-md text-right text-primary font-semibold">{formatCurrency(currentVal)}</td>
                                    <td className={cn("px-lg py-md text-right font-bold", gain >= 0 ? "text-secondary" : "text-error")}>
                                      {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                                    </td>
                                    <td className="px-lg py-md text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleEditInvestment(inv)} className="text-placeholder hover:text-primary transition-colors" title="Editar">
                                          <span className="material-symbols-outlined text-[18px]">edit</span>
                                        </button>
                                        <button onClick={() => { if (confirm('Excluir este ativo?')) deleteMutation.mutate(inv.id); }} className="text-placeholder hover:text-error transition-colors" title="Excluir">
                                          <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </>
                        )}
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* ─── PROVENTOS SECTION ─── */}
        {allProventos.length > 0 && (
          <section className="space-y-sm mt-gutter text-left">
            <div className="flex items-center justify-between px-sm">
              <h3 className="font-headline text-headline-md text-primary font-bold">Histórico de Proventos</h3>
              <div className="flex items-center gap-sm">
                {syncProventosMutation.isPending && (
                  <span className="text-xs text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                    Sincronizando...
                  </span>
                )}
                <span className="text-xs text-on-surface-variant">{currentYear}</span>
              </div>
            </div>

            {/* A Receber */}
            {proventosAReceber.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="flex items-center gap-sm px-lg py-sm bg-secondary/10 border-b border-outline-variant">
                  <span className="material-symbols-outlined text-secondary text-[18px]">schedule</span>
                  <h4 className="font-label-sm text-label-sm font-bold text-secondary uppercase tracking-wider">
                    A Receber — {formatCurrency(displayAReceber)}
                  </h4>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low font-label-sm text-label-sm uppercase font-bold">
                    <tr className="border-b border-outline-variant/60">
                      <th className="px-lg py-sm font-bold">Ativo</th>
                      <th className="px-lg py-sm font-bold">Tipo</th>
                      <th className="px-lg py-sm font-bold">Referência</th>
                      <th className="px-lg py-sm font-bold text-right">Data COM</th>
                      <th className="px-lg py-sm font-bold text-right">Pagamento</th>
                      <th className="px-lg py-sm font-bold text-right">R$/cota</th>
                      <th className="px-lg py-sm font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="font-numeric text-numeric-data text-on-surface-variant">
                    {proventosAReceber.map((p: any) => (
                      <tr key={p.id} className="border-b border-outline-variant/40 hover:bg-surface-container-high/30 transition-colors">
                        <td className="px-lg py-md text-primary font-bold">{p.ticker}</td>
                        <td className="px-lg py-md">{p.tipo}</td>
                        <td className="px-lg py-md text-on-surface-variant">{p.relatedTo || '—'}</td>
                        <td className="px-lg py-md text-right">{new Date(p.dataCom).toLocaleDateString('pt-BR')}</td>
                        <td className="px-lg py-md text-right font-semibold text-secondary">{new Date(p.dataPagamento).toLocaleDateString('pt-BR')}</td>
                        <td className="px-lg py-md text-right">{formatCurrency(Number(p.valorPorCota))}</td>
                        <td className="px-lg py-md text-right font-bold text-secondary">{formatCurrency(Number(p.valorTotal))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagos */}
            {proventosPagos.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="flex items-center gap-sm px-lg py-sm bg-surface-container-low border-b border-outline-variant">
                  <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                  <h4 className="font-label-sm text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">
                    Recebidos — {formatCurrency(displayDividends)}
                  </h4>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low font-label-sm text-label-sm uppercase font-bold">
                    <tr className="border-b border-outline-variant/60">
                      <th className="px-lg py-sm font-bold">Ativo</th>
                      <th className="px-lg py-sm font-bold">Tipo</th>
                      <th className="px-lg py-sm font-bold">Referência</th>
                      <th className="px-lg py-sm font-bold text-right">Data COM</th>
                      <th className="px-lg py-sm font-bold text-right">Pago em</th>
                      <th className="px-lg py-sm font-bold text-right">R$/cota</th>
                      <th className="px-lg py-sm font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="font-numeric text-numeric-data text-on-surface-variant">
                    {proventosPagos.map((p: any) => (
                      <tr key={p.id} className="border-b border-outline-variant/40 hover:bg-surface-container-high/30 transition-colors">
                        <td className="px-lg py-md text-primary font-bold">{p.ticker}</td>
                        <td className="px-lg py-md">{p.tipo}</td>
                        <td className="px-lg py-md text-on-surface-variant">{p.relatedTo || '—'}</td>
                        <td className="px-lg py-md text-right">{new Date(p.dataCom).toLocaleDateString('pt-BR')}</td>
                        <td className="px-lg py-md text-right">{new Date(p.dataPagamento).toLocaleDateString('pt-BR')}</td>
                        <td className="px-lg py-md text-right">{formatCurrency(Number(p.valorPorCota))}</td>
                        <td className="px-lg py-md text-right font-bold text-primary">{formatCurrency(Number(p.valorTotal))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {allProventos.length === 0 && !syncProventosMutation.isPending && (
              <div className="text-center py-xl text-on-surface-variant text-sm">
                Nenhum provento encontrado. Clique em "Atualizar Cotações" para sincronizar.
              </div>
            )}
          </section>
        )}
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
                        const isBond = inv.type === 'BOND';
                        const isUSD = inv.type === 'STOCK_US' || inv.currency === 'USD';
                        const fmtPrice = (v: number) => formatCurrency(v, isUSD ? 'USD' : 'BRL');
                        const currentVal = Number(inv.current || 0);
                        const gain = Number(inv.gain || 0);
                        const gainPct = Number(inv.gainPct || 0);
                        const bondInfo = isBond && inv.notes ? (() => { try { return JSON.parse(inv.notes); } catch { return null; } })() : null;
                        return (
                          <div key={inv.id} className="pt-sm first:pt-0 flex flex-col gap-xs text-xs">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-bold text-primary">{isBond ? inv.name : (inv.ticker || inv.name)}</span>
                                {isUSD && <span className="text-[9px] bg-[#0052cc]/20 text-[#0052cc] font-bold px-1 py-0.5 rounded uppercase">USD</span>}
                                {!isBond && inv.broker && <span className="text-[10px] text-on-surface-variant">({inv.broker})</span>}
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleEditInvestment(inv)} className="text-placeholder hover:text-primary transition-colors p-1" title="Editar">
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                                <button onClick={() => { if (confirm('Excluir este ativo?')) deleteMutation.mutate(inv.id); }} className="text-placeholder hover:text-error transition-colors p-1" title="Excluir">
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            </div>
                            {isBond ? (
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                                <div>
                                  <span className="block text-[9px] uppercase font-bold text-outline">Emissor / Título</span>
                                  <span className="font-medium">{inv.broker || '—'} {bondInfo?.tipoTitulo ? `— ${bondInfo.tipoTitulo}` : ''}</span>
                                </div>
                                <div className="text-right">
                                  <span className="block text-[9px] uppercase font-bold text-outline">Indexador / Taxa</span>
                                  <span className="font-medium">{bondInfo ? `${bondInfo.indexador}${bondInfo.taxa ? ` ${bondInfo.taxa}%` : ''}` : '—'}</span>
                                </div>
                                <div>
                                  <span className="block text-[9px] uppercase font-bold text-outline">Valor Aplicado</span>
                                  <span className="font-semibold text-primary">{formatCurrency(Number(inv.purchasePrice))}</span>
                                </div>
                                <div className="text-right">
                                  <span className="block text-[9px] uppercase font-bold text-outline">Resultado</span>
                                  <span className={cn("font-bold", gain >= 0 ? "text-secondary" : "text-error")}>
                                    {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                                <div>
                                  <span className="block text-[9px] uppercase font-bold text-outline">Qtd / Pço Médio</span>
                                  <span className="font-medium">{Number(inv.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 6 })} x {fmtPrice(Number(inv.purchasePrice))}</span>
                                </div>
                                <div className="text-right">
                                  <span className="block text-[9px] uppercase font-bold text-outline">Preço Atual</span>
                                  <span className="font-medium">{fmtPrice(Number(inv.currentPrice || inv.purchasePrice))}</span>
                                </div>
                                <div>
                                  <span className="block text-[9px] uppercase font-bold text-outline">Saldo Atual (R$)</span>
                                  <span className="font-semibold text-primary">{formatCurrency(currentVal)}</span>
                                </div>
                                <div className="text-right">
                                  <span className="block text-[9px] uppercase font-bold text-outline">Resultado</span>
                                  <span className={cn("font-bold", gain >= 0 ? "text-secondary" : "text-error")}>
                                    {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            )}
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
