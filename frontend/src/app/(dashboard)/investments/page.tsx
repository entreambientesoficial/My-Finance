'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  STOCK: 'Ação', FUND: 'FII/Fundo', BOND: 'Renda Fixa', CRYPTO: 'Crypto',
  REAL_ESTATE: 'Imóvel', SAVINGS: 'Poupança', OTHER: 'Outro',
};

export default function InvestmentsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.get('/investments/portfolio').then((r) => r.data),
  });

  const { register, handleSubmit, reset } = useForm<any>();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/investments', {
      ...data,
      quantity: data.quantity ? Number(data.quantity) : undefined,
      purchasePrice: data.purchasePrice ? Number(data.purchasePrice) : undefined,
      currentPrice: data.currentPrice ? Number(data.currentPrice) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); toast.success('Investimento adicionado!'); reset(); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/investments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['portfolio'] }); toast.success('Removido!'); },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base">Investimentos</h1>
          <p className="text-muted text-sm mt-1">{portfolio?.investments?.length || 0} ativos na carteira</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-[#031632] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a2550] transition-colors">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Adicionar ativo
        </button>
      </div>

      {/* Resumo da carteira */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Patrimônio Atual', value: formatCurrency(portfolio?.totalCurrent || 0), color: 'text-base' },
          { label: 'Custo Total', value: formatCurrency(portfolio?.totalCost || 0), color: 'text-muted' },
          { label: 'Resultado', value: formatCurrency(portfolio?.totalGain || 0), color: (portfolio?.totalGain || 0) >= 0 ? 'text-[#006c49]' : 'text-red-500' },
          { label: 'Rentabilidade', value: formatPercent(portfolio?.totalGainPct || 0), color: (portfolio?.totalGainPct || 0) >= 0 ? 'text-[#006c49]' : 'text-red-500' },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-xl p-4 shadow-sm border border-base">
            <p className="text-xs text-muted">{item.label}</p>
            <p className={`text-lg font-bold mt-1 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
          <h2 className="font-semibold text-base mb-4">Novo Investimento</h2>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Nome</label>
              <input {...register('name')} placeholder="Ex: ITSA4" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Tipo</label>
              <select {...register('type')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Ticker</label>
              <input {...register('ticker')} placeholder="ITSA4" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Quantidade</label>
              <input type="number" step="0.000001" {...register('quantity')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Preço de Compra (R$)</label>
              <input type="number" step="0.01" {...register('purchasePrice')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Preço Atual (R$)</label>
              <input type="number" step="0.01" {...register('currentPrice')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Corretora</label>
              <input {...register('broker')} placeholder="XP, Clear, NuInvest..." className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted block mb-1">Data de Compra</label>
              <input type="date" {...register('purchaseDate')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
            </div>
            <div className="flex items-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 text-sm border border-md rounded-lg text-muted hover:bg-card-hover">Cancelar</button>
              <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2 text-sm bg-[#006c49] text-white rounded-lg hover:bg-[#005a3d] disabled:opacity-60">
                {createMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de ativos */}
      <div className="bg-card rounded-xl shadow-sm border border-base overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-base">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Ativo</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Tipo</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Qtd</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Preço Atual</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Valor Total</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Resultado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-placeholder">Carregando...</td></tr>
            ) : (portfolio?.investments || []).map((inv: any) => (
              <tr key={inv.id} className="border-b border-base hover:bg-card-hover/50">
                <td className="px-5 py-3">
                  <p className="font-medium text-base">{inv.name}</p>
                  {inv.ticker && <p className="text-xs text-placeholder">{inv.ticker} · {inv.broker}</p>}
                </td>
                <td className="px-5 py-3 text-muted">{TYPE_LABELS[inv.type]}</td>
                <td className="px-5 py-3 text-right tabular-nums text-base">{Number(inv.quantity || 0).toLocaleString('pt-BR')}</td>
                <td className="px-5 py-3 text-right tabular-nums text-base">{formatCurrency(Number(inv.currentPrice || inv.purchasePrice || 0))}</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-base">{formatCurrency(inv.current)}</td>
                <td className={`px-5 py-3 text-right font-semibold tabular-nums ${inv.gain >= 0 ? 'text-[#006c49]' : 'text-red-500'}`}>
                  {formatPercent(inv.gainPct)}
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => deleteMutation.mutate(inv.id)} className="text-placeholder hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
