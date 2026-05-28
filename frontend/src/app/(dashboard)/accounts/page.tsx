'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Conta Corrente', SAVINGS: 'Poupança',
  INVESTMENT: 'Investimentos', CASH: 'Dinheiro', OTHER: 'Outra',
};
const CARD_BRAND_LABELS: Record<string, string> = {
  VISA: 'Visa', MASTERCARD: 'Mastercard', ELO: 'Elo',
  AMEX: 'Amex', HIPERCARD: 'Hipercard', OTHER: 'Outro',
};
const ACCOUNT_COLORS = ['#FF6B00', '#0078A8', '#006c49', '#8b5cf6', '#ef4444', '#f59e0b', '#3b82f6', '#031632'];

const accountSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  type: z.enum(['CHECKING', 'SAVINGS', 'INVESTMENT', 'CASH', 'OTHER']),
  bank: z.string().optional(),
  balance: z.coerce.number().default(0),
  color: z.string().optional(),
  currency: z.string().default('BRL'),
});

const cardSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  brand: z.enum(['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER']).default('OTHER'),
  lastFourDigits: z.string().max(4).optional(),
  creditLimit: z.coerce.number().positive('Limite obrigatório'),
  billingDay: z.coerce.number().min(1).max(28),
  dueDay: z.coerce.number().min(1).max(28),
  accountId: z.string().optional(),
  color: z.string().optional(),
});

type AccountForm = z.infer<typeof accountSchema>;
type CardForm = z.infer<typeof cardSchema>;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-base">
          <h2 className="font-semibold text-base">{title}</h2>
          <button onClick={onClose} className="text-placeholder hover:text-muted transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'accounts' | 'cards'>('accounts');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  });

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get('/cards').then((r) => r.data),
  });

  const accountForm = useForm<AccountForm>({ resolver: zodResolver(accountSchema), defaultValues: { type: 'CHECKING', balance: 0, color: '#031632', currency: 'BRL' } });
  const cardForm = useForm<CardForm>({ resolver: zodResolver(cardSchema), defaultValues: { brand: 'OTHER', billingDay: 1, dueDay: 10, color: '#8b5cf6' } });

  const createAccount = useMutation({
    mutationFn: (data: AccountForm) => api.post('/accounts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Conta criada!');
      accountForm.reset();
      setShowAccountModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar conta'),
  });

  const createCard = useMutation({
    mutationFn: (data: CardForm) => api.post('/cards', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Cartão adicionado!');
      cardForm.reset();
      setShowCardModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar cartão'),
  });

  const freezeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/cards/${id}/freeze`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cards'] }); toast.success('Cartão atualizado!'); },
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Conta removida.'); },
  });

  const deleteCard = useMutation({
    mutationFn: (id: string) => api.delete(`/cards/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cards'] }); toast.success('Cartão removido.'); },
  });

  const totalBalance = (accounts as any[]).reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base">Contas & Cartões</h1>
          <p className="text-muted text-sm mt-1">
            {(accounts as any[]).length} contas · Saldo total: <strong>{formatCurrency(totalBalance)}</strong>
          </p>
        </div>
        <button
          onClick={() => tab === 'accounts' ? setShowAccountModal(true) : setShowCardModal(true)}
          className="flex items-center gap-2 bg-[#031632] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a2550] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {tab === 'accounts' ? 'Nova conta' : 'Novo cartão'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-subtle p-1 rounded-lg w-fit">
        {(['accounts', 'cards'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-card text-base shadow-sm' : 'text-muted hover:text-base'}`}>
            {t === 'accounts' ? `Contas (${(accounts as any[]).length})` : `Cartões (${(cards as any[]).length})`}
          </button>
        ))}
      </div>

      {/* Contas */}
      {tab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingAccounts ? (
            <p className="text-placeholder text-sm col-span-3">Carregando...</p>
          ) : (accounts as any[]).length === 0 ? (
            <div className="col-span-3 text-center py-12 text-placeholder">
              <span className="material-symbols-outlined text-4xl block mb-2">account_balance</span>
              <p>Nenhuma conta cadastrada. Adicione a primeira!</p>
            </div>
          ) : (accounts as any[]).map((account: any) => (
            <div key={account.id} className="bg-card rounded-xl p-5 shadow-sm border border-base group relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: account.color || '#031632' }}>
                    <span className="material-symbols-outlined text-white text-[20px]">
                      {account.type === 'SAVINGS' ? 'savings' : account.type === 'INVESTMENT' ? 'trending_up' : account.type === 'CASH' ? 'payments' : 'account_balance'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-base">{account.name}</p>
                    <p className="text-xs text-placeholder">{account.bank || ACCOUNT_TYPE_LABELS[account.type]}</p>
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm('Remover esta conta?')) deleteAccount.mutate(account.id); }}
                  className="opacity-0 group-hover:opacity-100 text-placeholder hover:text-red-500 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
              <p className="text-2xl font-bold text-base tabular-nums">{formatCurrency(Number(account.balance))}</p>
              <p className="text-xs text-placeholder mt-1">{account.currency} · {ACCOUNT_TYPE_LABELS[account.type]}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cartões */}
      {tab === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loadingCards ? (
            <p className="text-placeholder text-sm col-span-2">Carregando...</p>
          ) : (cards as any[]).length === 0 ? (
            <div className="col-span-2 text-center py-12 text-placeholder">
              <span className="material-symbols-outlined text-4xl block mb-2">credit_card</span>
              <p>Nenhum cartão cadastrado. Adicione o primeiro!</p>
            </div>
          ) : (cards as any[]).map((card: any) => (
            <div key={card.id} className="bg-card rounded-xl overflow-hidden shadow-sm border border-base group">
              {/* Cartão visual */}
              <div className="p-5 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${card.color || '#031632'}, ${card.color || '#031632'}99)` }}>
                <div className="flex items-center justify-between mb-6">
                  <p className="font-semibold tracking-wide">{card.name}</p>
                  <span className="text-xs opacity-70">{CARD_BRAND_LABELS[card.brand]}</span>
                </div>
                <p className="text-sm tracking-widest opacity-80">•••• •••• •••• {card.lastFourDigits || '????'}</p>
                {card.isFrozen && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-3xl">ac_unit</span>
                      <p className="text-sm font-medium mt-1">Congelado</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Detalhes */}
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Limite</span>
                  <span className="font-semibold text-base">{formatCurrency(Number(card.creditLimit))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Fechamento / Vencimento</span>
                  <span className="text-base">Dia {card.billingDay} / {card.dueDay}</span>
                </div>
                {card.account && (
                  <div className="flex justify-between">
                    <span className="text-muted">Conta vinculada</span>
                    <span className="text-base">{card.account.name}</span>
                  </div>
                )}
              </div>
              <div className="px-4 pb-4 flex gap-2">
                <button
                  onClick={() => freezeMutation.mutate(card.id)}
                  className="flex-1 text-xs font-medium py-2 rounded-lg border border-md text-muted hover:bg-card-hover transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">{card.isFrozen ? 'lock_open' : 'ac_unit'}</span>
                  {card.isFrozen ? 'Descongelar' : 'Congelar'}
                </button>
                <button
                  onClick={() => { if (confirm('Remover este cartão?')) deleteCard.mutate(card.id); }}
                  className="text-xs font-medium px-3 py-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Conta */}
      {showAccountModal && (
        <Modal title="Nova Conta Bancária" onClose={() => setShowAccountModal(false)}>
          <form onSubmit={accountForm.handleSubmit((d) => createAccount.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted block mb-1">Nome da conta *</label>
                <input {...accountForm.register('name')} placeholder="Ex: Conta Corrente Itaú" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
                {accountForm.formState.errors.name && <p className="text-red-500 text-xs mt-0.5">{accountForm.formState.errors.name.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Tipo *</label>
                <select {...accountForm.register('type')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Banco</label>
                <input {...accountForm.register('bank')} placeholder="Ex: Itaú, Caixa, Nubank" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Saldo inicial (R$)</label>
                <input type="number" step="0.01" {...accountForm.register('balance')} defaultValue="0" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Moeda</label>
                <select {...accountForm.register('currency')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                  <option value="BRL">BRL — Real</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-muted block mb-2">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {ACCOUNT_COLORS.map((color) => (
                    <button key={color} type="button"
                      onClick={() => accountForm.setValue('color', color)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: color, borderColor: accountForm.watch('color') === color ? '#031632' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowAccountModal(false)} className="px-4 py-2 text-sm border border-md rounded-lg text-muted hover:bg-card-hover">Cancelar</button>
              <button type="submit" disabled={createAccount.isPending} className="px-4 py-2 text-sm bg-[#031632] text-white rounded-lg hover:bg-[#0a2550] disabled:opacity-60">
                {createAccount.isPending ? 'Salvando...' : 'Criar conta'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Novo Cartão */}
      {showCardModal && (
        <Modal title="Novo Cartão de Crédito" onClose={() => setShowCardModal(false)}>
          <form onSubmit={cardForm.handleSubmit((d) => createCard.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted block mb-1">Nome do cartão *</label>
                <input {...cardForm.register('name')} placeholder="Ex: Nubank Roxinho" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
                {cardForm.formState.errors.name && <p className="text-red-500 text-xs mt-0.5">{cardForm.formState.errors.name.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Bandeira</label>
                <select {...cardForm.register('brand')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                  {Object.entries(CARD_BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Últimos 4 dígitos</label>
                <input {...cardForm.register('lastFourDigits')} placeholder="1234" maxLength={4} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Limite (R$) *</label>
                <input type="number" step="0.01" {...cardForm.register('creditLimit')} placeholder="5000" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
                {cardForm.formState.errors.creditLimit && <p className="text-red-500 text-xs mt-0.5">{cardForm.formState.errors.creditLimit.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Conta vinculada (débito fatura)</label>
                <select {...cardForm.register('accountId')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                  <option value="">Nenhuma</option>
                  {(accounts as any[]).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Dia fechamento *</label>
                <input type="number" min={1} max={28} {...cardForm.register('billingDay')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Dia vencimento *</label>
                <input type="number" min={1} max={28} {...cardForm.register('dueDay')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
              </div>

              <div className="col-span-2">
                <label className="text-xs font-medium text-muted block mb-2">Cor do cartão</label>
                <div className="flex gap-2 flex-wrap">
                  {['#8b5cf6', '#ef4444', '#3b82f6', '#f59e0b', '#06b6d4', '#10b981', '#ec4899', '#031632'].map((color) => (
                    <button key={color} type="button"
                      onClick={() => cardForm.setValue('color', color)}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: color, borderColor: cardForm.watch('color') === color ? '#031632' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowCardModal(false)} className="px-4 py-2 text-sm border border-md rounded-lg text-muted hover:bg-card-hover">Cancelar</button>
              <button type="submit" disabled={createCard.isPending} className="px-4 py-2 text-sm bg-[#031632] text-white rounded-lg hover:bg-[#0a2550] disabled:opacity-60">
                {createCard.isPending ? 'Salvando...' : 'Adicionar cartão'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
