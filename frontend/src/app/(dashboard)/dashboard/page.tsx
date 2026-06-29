'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

export default function DashboardPage() {
  const [showInsight, setShowInsight] = useState(true);

  // Fetch real data from NestJS API
  const { data: summary } = useQuery({
    queryKey: ['household-summary'],
    queryFn: () => api.get('/api/households/mine/summary').then((r) => r.data),
  });

  const { data: cashFlow } = useQuery({
    queryKey: ['cash-flow'],
    queryFn: () => api.get('/api/reports/cash-flow?months=6').then((r) => r.data),
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  // Cards: mês calendário atual
  const { data: upcomingBills } = useQuery({
    queryKey: ['upcoming-bills', startOfMonth, endOfMonth],
    queryFn: () => api.get(`/api/reports/upcoming-bills?startDate=${startOfMonth}&endDate=${endOfMonth}`).then((r) => r.data),
  });

  // Lista "Próximas Contas": janela rolante de 30 dias
  const { data: nextBills } = useQuery({
    queryKey: ['next-bills-30'],
    queryFn: () => api.get('/api/reports/upcoming-bills?daysAhead=30').then((r) => r.data),
  });

  const { data: annualSummary } = useQuery({
    queryKey: ['annual-summary', currentYear],
    queryFn: () => api.get('/api/reports/annual-summary').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: expensesByCategory = [] } = useQuery({
    queryKey: ['expenses-by-category-dash', startOfMonth, endOfMonth],
    queryFn: () => api.get(`/api/reports/expenses-by-category?startDate=${startOfMonth}&endDate=${endOfMonth}`).then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: netWorth } = useQuery({
    queryKey: ['net-worth'],
    queryFn: () => api.get('/api/reports/net-worth').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: proventosData } = useQuery({
    queryKey: ['proventos'],
    queryFn: () => api.get(`/api/proventos?year=${currentYear}`).then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: incomeScheduled = [] } = useQuery({
    queryKey: ['income-scheduled'],
    queryFn: () => api.get('/api/transactions?type=INCOME&isPaid=false&limit=50').then((r) => r.data?.data || r.data || []),
    staleTime: 60_000,
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['recent-transactions-dash'],
    queryFn: () => api.get('/api/transactions?limit=4').then((r) => r.data?.data || r.data || []),
  });

  // Extract logged in user profile
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/api/users/me').then((r) => r.data),
  });

  // Fetch real investments portfolio
  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.get('/api/investments/portfolio').then((r) => r.data),
  });

  const userName = me?.name || 'Marcus';

  // Process dynamic account data
  const accounts = summary?.accounts || [];
  const investments = portfolio?.investments || [];

  // Helper to identify cofrinho/reserva — usa flag notes.isEmergencyFund; fallback por nome para compatibilidade
  const isEmergency = (item: { name: string; notes?: string }) => {
    if (item.notes) {
      try {
        const parsed = JSON.parse(item.notes);
        if (parsed.isEmergencyFund === true) return true;
      } catch {}
    }
    const name = (item.name || '').toLowerCase();
    return name.includes('cofrinho') || name.includes('reserva');
  };

  // 1. Caixa: sum CHECKING and CASH accounts that are NOT named "cofrinho" or "reserva"
  const checkingAndCash = accounts.filter(
    (a: any) => (a.type === 'CHECKING' || a.type === 'CASH') && !isEmergency(a)
  );
  const totalCaixa = checkingAndCash.reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);

  // 2. Reserva de Emergência: sum SAVINGS accounts + any accounts or investments with "cofrinho" or "reserva"
  const savingsAccounts = accounts.filter((a: any) => a.type === 'SAVINGS' || isEmergency(a));
  const emergencyInvestments = investments.filter((i: any) => isEmergency(i));
  
  const totalEmergencyAccounts = savingsAccounts.reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);
  const totalEmergencyInvestments = emergencyInvestments.reduce((sum: number, i: any) => {
    return sum + Number(i.current || 0);
  }, 0);
  const totalReserva = totalEmergencyAccounts + totalEmergencyInvestments;

  // 3. Investimentos: sum INVESTMENT accounts + investments that are NOT named "cofrinho" or "reserva"
  const investmentAccounts = accounts.filter((a: any) => a.type === 'INVESTMENT' && !isEmergency(a));
  const otherInvestments = investments.filter((i: any) => !isEmergency(i));

  const totalInvAccounts = investmentAccounts.reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);
  const totalInvPortfolio = otherInvestments.reduce((sum: number, i: any) => {
    return sum + Number(i.current || 0);
  }, 0);
  const totalInvestimentos = totalInvAccounts + totalInvPortfolio;

  // Real transactions and bills list (empty if no data, no mocks)
  const displayTransactions = transactionsData?.length > 0 ? transactionsData : [];

  // Próximas Contas (lista): 30 dias rolantes
  const displayBills = (nextBills?.filter((b: any) => !b.isPaid) ?? []).slice(0, 3);

  // Cards Contas a Pagar: mês calendário atual
  const allBills = upcomingBills?.filter((b: any) => !b.isPaid) ?? [];
  const totalContasAPagar = allBills.reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);
  const contasAPagarCount = allBills.length;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const upcomingIncome = (incomeScheduled as any[]).filter((t: any) => {
    const d = new Date(t.date);
    return d >= monthStart && d <= monthEnd;
  });
  const totalContasAReceber = upcomingIncome.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  const contasAReceberCount = upcomingIncome.length;

  const totalProventosRecebidos = Number(proventosData?.totalRecebido ?? 0);
  const totalProventosAReceber = Number(proventosData?.totalAReceber ?? 0);

  // Annual cards
  const annualExpensesPaid    = Number(annualSummary?.expensesPaid ?? 0);
  const annualExpensesPending = Number(annualSummary?.expensesPending ?? 0);
  const annualIncomePaid      = Number(annualSummary?.incomePaid ?? 0);
  const annualIncomePending   = Number(annualSummary?.incomePending ?? 0);
  const annualResult          = annualIncomePaid - annualExpensesPaid;

  // Donut: top 6 categories current month
  const topCategories = (expensesByCategory as any[]).slice(0, 6);

  // Patrimônio history: work backwards from current net worth using monthly cash-flow balance
  const currentNetWorthValue = Number(netWorth?.netWorth ?? 0);

  // Check if there is any real cash flow data (non-zero income or expenses)
  const hasCashFlowData = cashFlow && cashFlow.length > 0 && cashFlow.some((flow: any) => Number(flow.income || 0) > 0 || Number(flow.expenses || 0) > 0);

  // Dynamic values for Cash Flow Summary
  const avgIncome = hasCashFlowData 
    ? cashFlow.reduce((acc: number, cur: any) => acc + Number(cur.income || 0), 0) / cashFlow.length 
    : 0;
  const avgExpense = hasCashFlowData 
    ? cashFlow.reduce((acc: number, cur: any) => acc + Number(cur.expenses || 0), 0) / cashFlow.length 
    : 0;

  // Process data format for Recharts
  const rechartsData = hasCashFlowData 
    ? cashFlow.map((flow: any) => ({
        label: (flow.label || flow.month || '').toUpperCase(),
        Receitas: flow.income,
        Despesas: flow.expenses
      }))
    : [];

  // Dynamic subtitle based on current month cash flow
  let subtitleMessage = "Acompanhe sua evolução financeira.";
  if (hasCashFlowData) {
    const lastMonthData = cashFlow[cashFlow.length - 1];
    if (lastMonthData) {
      const netThisMonth = Number(lastMonthData.income || 0) - Number(lastMonthData.expenses || 0);
      if (netThisMonth > 0) {
        subtitleMessage = `Saldo positivo de ${formatCurrency(netThisMonth)} este mês.`;
      } else if (netThisMonth < 0) {
        subtitleMessage = `Atenção: saldo negativo de ${formatCurrency(Math.abs(netThisMonth))} este mês.`;
      }
    }
  }

  // Dynamic Insight Recommendation Logic
  let insightTitle = "Finanças em Dia";
  let insightText = "Sua carteira está organizada! Suas contas estão sob controle e nenhuma pendência urgente foi detectada.";
  let showRecommendationButton = false;

  const totalPendingBills = displayBills.reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);

  if (totalPendingBills > totalCaixa) {
    insightTitle = "Alerta de Caixa Insuficiente";
    insightText = `Atenção: Você possui ${formatCurrency(totalPendingBills)} em contas a vencer nos próximos dias, mas seu saldo em Caixa disponível é de apenas ${formatCurrency(totalCaixa)}. Recomendamos transferir fundos de outra conta ou poupança para evitar multas.`;
  } else if (totalCaixa > 3000 && totalReserva === 0) {
    insightTitle = "Construa sua Reserva de Emergência";
    insightText = `Vimos que você possui ${formatCurrency(totalCaixa)} em Caixa, mas ainda não possui saldo reservado para emergências. Recomendamos mover pelo menos R$ 1.500,00 para o seu Cofrinho ou conta poupança para começar a sua proteção.`;
    showRecommendationButton = true;
  } else if (totalCaixa > 5000) {
    const investSuggest = Math.floor(totalCaixa * 0.3);
    insightTitle = "Otimize seus Rendimentos";
    insightText = `Seu saldo em Caixa (${formatCurrency(totalCaixa)}) está elevado. Que tal transferir ${formatCurrency(investSuggest)} para sua carteira de Investimentos para obter melhores rendimentos no longo prazo?`;
    showRecommendationButton = true;
  }

  return (
    <>
      {/* ─── DESKTOP DASHBOARD ─── */}
      <div className="hidden md:block space-y-gutter">
        {/* Page Header */}
        <div className="flex justify-between items-end mb-xl">
          <div>
            <h2 className="font-display text-display-lg text-primary">Resumo Financeiro</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Olá, {userName}. {subtitleMessage}
            </p>
          </div>
        </div>

        {/* Bento Grid Section */}
        <div className="grid grid-cols-12 gap-gutter mb-gutter">
          {/* Left Column (Accounts Summary + Recent Transactions) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-gutter">
            {/* Account Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {/* Caixa */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant custom-card-shadow flex flex-col h-[140px]">
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
                    <span className="material-symbols-outlined text-[18px]">payments</span>
                  </div>
                  <span className="font-label-sm text-[9px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded uppercase font-bold">DISPONÍVEL</span>
                </div>
                <div className="mt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Caixa</p>
                    <h3 className="font-display text-lg md:text-xl text-primary font-bold">{formatCurrency(totalCaixa)}</h3>
                  </div>
                  <div className="flex items-center gap-xs text-[11px] text-on-surface-variant">
                    <span className="text-outline">Saldo líquido disponível</span>
                  </div>
                </div>
              </div>

              {/* Reserva de Emergência */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant custom-card-shadow flex flex-col h-[140px]">
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                    <span className="material-symbols-outlined text-[18px]">savings</span>
                  </div>
                  <span className="font-label-sm text-[9px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase font-bold">RESERVA</span>
                </div>
                <div className="mt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Reserva de Emergência</p>
                    <h3 className="font-display text-lg md:text-xl text-primary font-bold">{formatCurrency(totalReserva)}</h3>
                  </div>
                  <div className="flex items-center gap-xs text-[11px] text-on-surface-variant">
                    <span className="text-outline">Cofrinhos e Poupança</span>
                  </div>
                </div>
              </div>

              {/* Investimentos */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant custom-card-shadow flex flex-col h-[140px] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div className="w-8 h-8 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500">
                    <span className="material-symbols-outlined text-[18px]">trending_up</span>
                  </div>
                  <span className="font-label-sm text-[9px] text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded uppercase font-bold">INVESTIMENTOS</span>
                </div>
                <div className="mt-3 flex-1 flex flex-col justify-between relative z-10">
                  <div>
                    <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Investimentos</p>
                    <h3 className="font-display text-lg md:text-xl text-primary font-bold">{formatCurrency(totalInvestimentos)}</h3>
                  </div>
                  <div className="flex items-center gap-xs text-[11px] text-on-surface-variant">
                    <span className="text-outline">Ações, Renda Fixa e outros</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter -mt-2">
              {/* Contas a Pagar */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant custom-card-shadow flex flex-col h-[140px]">
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 bg-error/10 rounded-full flex items-center justify-center text-error">
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  </div>
                  <span className="font-label-sm text-[9px] text-error bg-error/10 px-1.5 py-0.5 rounded uppercase font-bold">A PAGAR</span>
                </div>
                <div className="mt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Contas a Pagar</p>
                    <h3 className="font-display text-lg md:text-xl text-primary font-bold">{formatCurrency(totalContasAPagar)}</h3>
                  </div>
                  <div className="flex items-center gap-xs">
                    {contasAPagarCount > 0
                      ? <span className="text-[10px] font-bold bg-error/10 text-error px-xs py-0.5 rounded-full">{contasAPagarCount} lançto{contasAPagarCount !== 1 ? 's' : ''}</span>
                      : <span className="text-outline text-[11px]">Nenhuma pendente no mês</span>
                    }
                  </div>
                </div>
              </div>

              {/* Contas a Receber */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant custom-card-shadow flex flex-col h-[140px]">
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                  </div>
                  <span className="font-label-sm text-[9px] text-secondary bg-secondary/10 px-1.5 py-0.5 rounded uppercase font-bold">A RECEBER</span>
                </div>
                <div className="mt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Contas a Receber</p>
                    <h3 className="font-display text-lg md:text-xl text-secondary font-bold">{formatCurrency(totalContasAReceber)}</h3>
                  </div>
                  <div className="flex items-center gap-xs">
                    {contasAReceberCount > 0
                      ? <span className="text-[10px] font-bold bg-secondary/10 text-secondary px-xs py-0.5 rounded-full">{contasAReceberCount} lançto{contasAReceberCount !== 1 ? 's' : ''}</span>
                      : <span className="text-outline text-[11px]">Nenhuma prevista no mês</span>
                    }
                  </div>
                </div>
              </div>

              {/* Proventos */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant custom-card-shadow flex flex-col h-[140px]">
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">savings</span>
                  </div>
                  <span className="font-label-sm text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase font-bold">PROVENTOS</span>
                </div>
                <div className="mt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Proventos {currentYear}</p>
                    <h3 className="font-display text-lg md:text-xl text-primary font-bold">{formatCurrency(totalProventosRecebidos)}</h3>
                  </div>
                  <div className="flex items-center gap-xs">
                    {totalProventosAReceber > 0
                      ? <span className="text-[10px] font-bold bg-secondary/10 text-secondary px-xs py-0.5 rounded-full whitespace-nowrap">+{formatCurrency(totalProventosAReceber)} a receber</span>
                      : <span className="text-outline text-[11px]">Dividendos e JCP recebidos</span>
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Annual KPI Cards */}
            <div className="grid grid-cols-3 gap-gutter">
              {/* Despesas do Ano */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant custom-card-shadow flex flex-col h-[140px]">
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 bg-error/10 rounded-full flex items-center justify-center text-error">
                    <span className="material-symbols-outlined text-[18px]">trending_down</span>
                  </div>
                  <span className="font-label-sm text-[9px] text-error bg-error/10 px-1.5 py-0.5 rounded uppercase font-bold">{currentYear}</span>
                </div>
                <div className="mt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Despesas {currentYear}</p>
                    <h3 className="font-display text-lg md:text-xl text-error font-bold">{formatCurrency(annualExpensesPaid)}</h3>
                  </div>
                  <div className="flex items-center gap-xs">
                    {annualExpensesPending > 0
                      ? <span className="text-[10px] text-outline">+ {formatCurrency(annualExpensesPending)} previsto</span>
                      : <span className="text-[10px] text-outline">Total pago no ano</span>
                    }
                  </div>
                </div>
              </div>

              {/* Receitas do Ano */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant custom-card-shadow flex flex-col h-[140px]">
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-[18px]">trending_up</span>
                  </div>
                  <span className="font-label-sm text-[9px] text-secondary bg-secondary/10 px-1.5 py-0.5 rounded uppercase font-bold">{currentYear}</span>
                </div>
                <div className="mt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Receitas {currentYear}</p>
                    <h3 className="font-display text-lg md:text-xl text-secondary font-bold">{formatCurrency(annualIncomePaid)}</h3>
                  </div>
                  <div className="flex items-center gap-xs">
                    {annualIncomePending > 0
                      ? <span className="text-[10px] text-outline">+ {formatCurrency(annualIncomePending)} previsto</span>
                      : <span className="text-[10px] text-outline">Total recebido no ano</span>
                    }
                  </div>
                </div>
              </div>

              {/* Resultado do Ano */}
              <div className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant custom-card-shadow flex flex-col h-[140px]">
                <div className="flex justify-between items-start">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", annualResult >= 0 ? "bg-secondary/10 text-secondary" : "bg-error/10 text-error")}>
                    <span className="material-symbols-outlined text-[18px]">balance</span>
                  </div>
                  <span className={cn("font-label-sm text-[9px] px-1.5 py-0.5 rounded uppercase font-bold", annualResult >= 0 ? "text-secondary bg-secondary/10" : "text-error bg-error/10")}>{currentYear}</span>
                </div>
                <div className="mt-3 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">Resultado {currentYear}</p>
                    <h3 className={cn("font-display text-lg md:text-xl font-bold", annualResult >= 0 ? "text-secondary" : "text-error")}>{annualResult >= 0 ? '+' : ''}{formatCurrency(annualResult)}</h3>
                  </div>
                  <div className="flex items-center gap-xs">
                    <span className="text-[10px] text-outline">{annualResult >= 0 ? 'Ano no azul ✓' : 'Ano no vermelho'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-gutter">
              {/* Donut — Despesas por Categoria */}
              <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant custom-card-shadow">
                <div className="flex justify-between items-center mb-md">
                  <div>
                    <h4 className="font-headline text-headline-md text-primary">Despesas por Categoria</h4>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Mês atual · valores pagos</p>
                  </div>
                  <a href="/reports" className="text-[11px] text-primary hover:underline">Ver relatório</a>
                </div>
                {topCategories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[200px] text-center bg-surface-container-low/20 rounded-lg border border-dashed border-outline-variant/60">
                    <span className="material-symbols-outlined text-[32px] text-outline mb-xs">donut_large</span>
                    <p className="text-xs text-on-surface-variant">Nenhuma despesa paga este mês.</p>
                  </div>
                ) : (
                  <div className="flex gap-md items-center">
                    <div className="w-[160px] h-[160px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={topCategories} dataKey="total" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} isAnimationActive={false}>
                            {topCategories.map((entry: any, i: number) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)', borderRadius: '8px', fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {topCategories.map((cat: any, i: number) => (
                        <div key={i} className="flex items-center gap-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-[11px] text-on-surface-variant truncate flex-1">{cat.name}</span>
                          <span className="text-[11px] font-bold text-primary flex-shrink-0">{cat.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Área — Evolução do Patrimônio */}
              <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant custom-card-shadow">
                <div className="flex justify-between items-center mb-md">
                  <div>
                    <h4 className="font-headline text-headline-md text-primary">Evolução do Patrimônio</h4>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Últimos 6 meses · estimado</p>
                  </div>
                </div>
                {(() => {
                  const patrimonioData = hasCashFlowData && cashFlow?.length > 0
                    ? cashFlow.map((_: any, idx: number) => {
                        const futureNet = (cashFlow as any[]).slice(idx + 1).reduce((s: number, m: any) => s + Number(m.balance || 0), 0);
                        return { label: (cashFlow[idx].label || '').toUpperCase(), value: Math.max(0, currentNetWorthValue - futureNet) };
                      })
                    : [];
                  return patrimonioData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-center bg-surface-container-low/20 rounded-lg border border-dashed border-outline-variant/60">
                      <span className="material-symbols-outlined text-[32px] text-outline mb-xs">show_chart</span>
                      <p className="text-xs text-on-surface-variant">Nenhum dado disponível ainda.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={patrimonioData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="patrimonioGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--outline)' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: number) => [formatCurrency(v), 'Patrimônio']} contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)', borderRadius: '8px', fontSize: '11px' }} />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#patrimonioGrad)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>

            {/* Link histórico */}
            <div className="flex justify-end">
              <a href="/transactions" className="text-[12px] text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-[14px]">history</span>
                Ver histórico de transações
              </a>
            </div>
          </div>

          {/* Right Column (Monthly Cash Flow Chart + Upcoming Bills) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
            {/* Monthly Cash Flow Chart */}
            <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant custom-card-shadow flex flex-col min-h-[300px]">
              <div className="flex justify-between items-start mb-xl">
                <div>
                  <h4 className="font-headline text-headline-md text-primary">Fluxo de Caixa</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">Receitas vs Despesas</p>
                </div>
                <button className="text-outline hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
              
              <div className="flex-1 min-h-[180px] flex flex-col justify-center">
                {hasCashFlowData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rechartsData} barGap={4}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--outline)' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v: number, name: string) => [formatCurrency(v), name]}
                        contentStyle={{ backgroundColor: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)', borderRadius: '8px', fontSize: '12px' }}
                        labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Bar dataKey="Receitas" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center p-md bg-surface-container-low/20 rounded-lg border border-dashed border-outline-variant/60">
                    <span className="material-symbols-outlined text-[32px] text-outline mb-xs">bar_chart</span>
                    <p className="font-body-md text-on-surface-variant font-medium text-xs">Nenhum lançamento no período</p>
                    <p className="text-[10px] text-outline">Cadastre suas receitas e despesas para ver a análise gráfica.</p>
                  </div>
                )}
              </div>

              <div className="space-y-md pt-lg border-t border-outline-variant/60 mt-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#10b981' }}></span>
                    <span className="font-body-md text-body-md text-on-surface-variant">Média de Receitas</span>
                  </div>
                  <span className="font-numeric text-numeric-data" style={{ color: '#10b981' }}>{formatCurrency(avgIncome)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }}></span>
                    <span className="font-body-md text-body-md text-on-surface-variant">Média de Despesas</span>
                  </div>
                  <span className="font-numeric text-numeric-data" style={{ color: '#ef4444' }}>{formatCurrency(avgExpense)}</span>
                </div>
              </div>
            </div>

            {/* Upcoming Bills */}
            <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant custom-card-shadow flex flex-col justify-between flex-1">
              <div>
                <div className="flex justify-between items-center mb-xl">
                  <h4 className="font-headline text-headline-md text-primary">Próximas Contas</h4>
                  {displayBills.length > 0 && (
                    <span className="w-6 h-6 flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full">{displayBills.length}</span>
                  )}
                </div>
                <div className="space-y-lg">
                  {displayBills.length === 0 ? (
                    <p className="text-center py-xl text-on-surface-variant font-body-md text-sm">
                      Nenhuma conta pendente nos próximos 30 dias.
                    </p>
                  ) : (
                    displayBills.map((bill: any) => {
                      const billDate = new Date(bill.date);
                      const day = billDate.getDate();
                      const monthName = bill.monthStr || billDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                      const isPending = bill.status === 'Pending' || !bill.isPaid;
                      return (
                        <div key={bill.id} className="flex items-center gap-md p-md border border-outline-variant rounded-lg bg-surface-container-low/30 hover:border-primary transition-colors cursor-pointer">
                          <div className={cn(
                            "text-center px-sm py-xs rounded flex flex-col justify-center min-w-[50px]",
                            isPending ? "bg-error-container/20" : "bg-surface-container-highest"
                          )}>
                            <span className={cn("text-[10px] font-bold uppercase", isPending ? "text-error" : "text-on-surface-variant")}>{monthName}</span>
                            <span className={cn("text-headline-md font-bold", isPending ? "text-error" : "text-primary")}>{day}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-numeric text-numeric-data text-primary font-bold">{bill.description}</p>
                            <p className="text-[12px] text-on-surface-variant">Mensalidade</p>
                          </div>
                          <div className="text-right">
                            <p className="font-numeric text-numeric-data text-primary font-bold">{formatCurrency(Number(bill.amount))}</p>
                            <p className={cn("text-[10px] font-bold uppercase", isPending ? "text-error" : "text-secondary")}>
                              {isPending ? 'Pendente' : 'Pago'}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <button className="w-full mt-xl py-md border-2 border-dashed border-outline-variant rounded-lg text-outline font-label-sm text-label-sm hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Vincular Fatura de Cartão
              </button>
            </div>
          </div>
        </div>


        {/* Insight Full Width Section */}
        {showInsight && (
          <div className="bg-surface-container-lowest p-xl rounded-xl border border-outline-variant custom-card-shadow flex flex-col md:flex-row gap-xl items-center">
            <div className="md:w-1/3">
              <img 
                alt="Visualização de dados financeiros" 
                className="rounded-lg w-full h-48 object-cover shadow-lg" 
                src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80"
              />
            </div>
            <div className="md:w-2/3">
              <div className="inline-block bg-primary text-white text-[10px] font-bold px-sm py-1 rounded-full uppercase tracking-widest mb-md">
                Insight Inteligente
              </div>
              <h3 className="font-display text-display-lg text-primary mb-md">{insightTitle}</h3>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl leading-relaxed">
                {insightText}
              </p>
              <div className="flex gap-md">
                {showRecommendationButton && (
                  <button 
                    onClick={() => {
                      alert("Recomendação aplicada com sucesso!");
                      setShowInsight(false);
                    }}
                    className="px-xl py-md bg-primary text-on-primary rounded-lg font-label-sm text-label-sm hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    Aplicar Recomendação
                  </button>
                )}
                <button 
                  onClick={() => setShowInsight(false)}
                  className="px-xl py-md bg-transparent border border-outline-variant rounded-lg font-label-sm text-label-sm text-primary hover:bg-surface-container-low transition-all"
                >
                  Dispensar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── MOBILE DASHBOARD ─── */}
      <div className="block md:hidden space-y-lg pb-12">
        {/* Welcome Section */}
        <section className="flex flex-col gap-xs">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Olá, {userName}</p>
          <h2 className="font-display-lg-mobile text-display-lg-mobile text-primary">Visão Geral</h2>
        </section>

        {/* Balance Cards - Snap Horizontal Scrolling List */}
        <section className="flex gap-md overflow-x-auto pb-xs snap-x no-scrollbar">
          {/* Caixa */}
          <div className="min-w-[280px] snap-center glass-card border border-outline-variant rounded-xl p-lg shadow-sm flex flex-col justify-between h-44 relative overflow-hidden">
            <div className="z-10">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Caixa</p>
              <p className="font-display-lg-mobile text-display-lg-mobile text-primary mt-base">{formatCurrency(totalCaixa)}</p>
            </div>
            <div className="z-10 flex items-center gap-xs mt-auto">
              <span className="material-symbols-outlined text-secondary text-[18px]">payments</span>
              <span className="font-numeric text-numeric-data text-secondary">Saldo líquido disponível</span>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">account_balance_wallet</span>
            </div>
          </div>

          {/* Reserva de Emergência */}
          <div className="min-w-[280px] snap-center glass-card border border-outline-variant rounded-xl p-lg shadow-sm flex flex-col justify-between h-44 relative overflow-hidden">
            <div className="z-10">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Reserva de Emergência</p>
              <p className="font-display-lg-mobile text-display-lg-mobile text-primary mt-base">{formatCurrency(totalReserva)}</p>
            </div>
            <div className="z-10 flex items-center gap-xs mt-auto">
              <span className="material-symbols-outlined text-secondary text-[18px]">savings</span>
              <span className="font-numeric text-numeric-data text-secondary font-bold">Cofrinhos e Poupança</span>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">savings</span>
            </div>
          </div>

          {/* Investimentos */}
          <div className="min-w-[280px] snap-center glass-card border border-outline-variant rounded-xl p-lg shadow-sm flex flex-col justify-between h-44 relative overflow-hidden">
            <div className="z-10">
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Investimentos</p>
              <p className="font-display-lg-mobile text-display-lg-mobile text-primary mt-base">{formatCurrency(totalInvestimentos)}</p>
            </div>
            <div className="z-10 flex items-center gap-xs mt-auto">
              <span className="material-symbols-outlined text-secondary text-[18px]">trending_up</span>
              <span className="font-numeric text-numeric-data text-secondary">Ações, Renda Fixa e outros</span>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">show_chart</span>
            </div>
          </div>
        </section>

        {/* Cash Flow mini list / summary */}
        <section className="glass-card border border-outline-variant rounded-xl p-lg shadow-sm">
          <div className="flex justify-between items-center mb-lg">
            <h3 className="font-headline text-headline-md text-primary">Fluxo de Caixa</h3>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Últimos 6 meses</span>
          </div>
          {hasCashFlowData ? (
            <>
              <div className="h-36 flex items-end justify-between gap-base chart-container">
                {rechartsData.map((data: any, idx: number) => {
                  const incomeHeight = `${Math.min(100, Math.max(15, (data.income / 12000) * 100))}%`;
                  const expenseHeight = `${Math.min(100, Math.max(15, (data.expense / 12000) * 100))}%`;
                  return (
                    <div key={idx} className="flex-1 flex gap-[2px] items-end h-full">
                      <div 
                        className="flex-1 rounded-t-sm hover:opacity-80 transition-all duration-300"
                        style={{ height: incomeHeight, backgroundColor: '#10b981' }}
                        title={`Receita: ${formatCurrency(data.Receitas)}`}
                      />
                      <div 
                        className="flex-1 rounded-t-sm transition-all duration-300"
                        style={{ height: expenseHeight, backgroundColor: '#ef4444' }}
                        title={`Despesa: ${formatCurrency(data.Despesas)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-sm">
                {rechartsData.map((data: any, idx: number) => (
                  <span key={idx} className="font-label-sm text-[10px] text-outline font-bold uppercase">{data.label}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="py-lg text-center text-on-surface-variant font-body-md text-xs border border-dashed border-outline-variant/60 rounded-lg bg-surface-container-low/20">
              Nenhum lançamento no período.
            </div>
          )}
        </section>

        {/* Mobile Upcoming Bills list */}
        <section className="flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <h3 className="font-headline text-headline-md text-primary">Contas a Vencer</h3>
            <a className="font-label-sm text-label-sm text-secondary font-bold" href="/reports">Ver Todas</a>
          </div>
          <div className="flex flex-col gap-sm">
            {displayBills.length === 0 ? (
              <p className="py-md text-center text-on-surface-variant font-body-md text-sm">
                Nenhuma conta vencida ou com vencimento hoje.
              </p>
            ) : (
              displayBills.map((bill: any) => {
                const isPending = bill.status === 'Pending' || !bill.isPaid;
                const dateStr = new Date(bill.date).toLocaleDateString('pt-BR');
                return (
                  <div key={bill.id} className="flex items-center gap-md bg-surface-container-lowest p-md rounded-xl border border-outline-variant shadow-sm active:scale-[0.98] transition-transform">
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center",
                      isPending ? "bg-tertiary-container text-on-tertiary-container" : "bg-secondary-container text-on-secondary-container"
                    )}>
                      <span className="material-symbols-outlined text-[24px]">
                        {isPending ? 'bolt' : 'check_circle'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body-lg text-body-lg font-semibold text-primary truncate">{bill.description}</p>
                      <p className="font-body-md text-body-md text-on-surface-variant truncate">Vence em {dateStr}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-numeric text-body-lg font-bold text-primary">{formatCurrency(Number(bill.amount))}</p>
                      <span className={cn(
                        "inline-block px-xs py-[2px] text-[10px] rounded-full font-bold uppercase",
                        isPending ? "bg-error-container text-on-error-container" : "bg-secondary-container text-on-secondary-container"
                      )}>
                        {isPending ? 'Pendente' : 'Pago'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Mobile Quick Actions */}
        <section className="grid grid-cols-2 gap-md pt-2">
          <a 
            href="/transactions"
            className="flex items-center justify-center gap-xs bg-primary text-white py-lg rounded-xl font-label-sm shadow-md active:opacity-80 transition-opacity font-bold"
          >
            <span className="material-symbols-outlined">swap_horiz</span>
            Transferências
          </a>
          <a 
            href="/accounts"
            className="flex items-center justify-center gap-xs bg-surface-container-lowest border border-outline text-primary py-lg rounded-xl font-label-sm active:bg-surface-container transition-colors font-bold"
          >
            <span className="material-symbols-outlined">credit_card</span>
            Contas & Cards
          </a>
        </section>

        {/* Floating Action Button for Transaction Addition on Mobile */}
        <a 
          href="/transactions?action=new" 
          className="fixed bottom-24 right-md w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform z-30"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </a>
      </div>
    </>
  );
}
