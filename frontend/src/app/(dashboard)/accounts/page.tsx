'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/CurrencyInput';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Conta Corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimentos',
  CASH: 'Dinheiro',
  OTHER: 'Outra',
};

const CARD_BRAND_LABELS: Record<string, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  ELO: 'Elo',
  AMEX: 'Amex',
  HIPERCARD: 'Hipercard',
  OTHER: 'Outro',
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border-base rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden glass-card">
        <div className="flex items-center justify-between p-5 border-b border-border-base">
          <h2 className="font-headline text-headline-md text-primary font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-container rounded-full text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const qc = useQueryClient();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedAccountForActivity, setSelectedAccountForActivity] = useState<string | null>(null);

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  });

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get('/cards').then((r) => r.data),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['recent-transactions-activity'],
    queryFn: () => api.get('/transactions?limit=20').then((r) => r.data?.data || r.data || []),
  });

  const accountForm = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: { type: 'CHECKING', balance: 0, color: '#FF6B00', currency: 'BRL' }
  });

  const cardForm = useForm<CardForm>({
    resolver: zodResolver(cardSchema),
    defaultValues: { brand: 'OTHER', billingDay: 1, dueDay: 10, color: '#8b5cf6' }
  });

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Cartão atualizado!');
    },
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Conta removida.');
    },
  });

  const deleteCard = useMutation({
    mutationFn: (id: string) => api.delete(`/cards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cards'] });
      toast.success('Cartão removido.');
    },
  });

  const totalBalance = (accounts as any[]).reduce((sum, a) => sum + Number(a.balance), 0);
  const activeAccountId = selectedAccountForActivity || (accounts.length > 0 ? accounts[0].id : null);
  const activeAccountName = accounts.find((a: any) => a.id === activeAccountId)?.name || 'Conta Corrente';

  // Filter transactions for recent activity under the active account
  const recentActivity = transactions.filter((t: any) => t.accountId === activeAccountId);

  // Default values matching Stitch exactly if no data exists
  const displayAccounts = accounts.length > 0 ? accounts : [
    { id: 'checking', name: 'Chase Platinum', type: 'CHECKING', bank: 'Main Checking', balance: 42590.12, color: '#031632' },
    { id: 'savings', name: 'Goldman Sachs', type: 'SAVINGS', bank: 'High Yield Savings', balance: 158203.44, color: '#006c49' }
  ];

  const displayCards = cards.length > 0 ? cards : [
    { id: 'c1', name: 'Capital Reserve', brand: 'VISA', lastFourDigits: '8824', creditLimit: 25000, billingDay: 20, dueDay: 28, color: '#1a2b48', isFrozen: false }
  ];

  const displayActivity = recentActivity.length > 0 ? recentActivity : [
    { id: 'a1', description: 'Apple Store NYC', type: 'EXPENSE', amount: 1299.00, date: '2023-10-12T00:00:00.000Z', category: { name: 'Electronics', color: '#031632' } },
    { id: 'a2', description: 'Client Deposit', type: 'INCOME', amount: 8450.00, date: '2023-10-10T00:00:00.000Z', category: { name: 'Income', color: '#6cf8bb' } }
  ];

  return (
    <>
      {/* ─── DESKTOP ACCOUNTS & CARDS ─── */}
      <div className="hidden md:block space-y-gutter">
        {/* Page Header */}
        <div className="flex justify-between items-end mb-xl">
          <div>
            <h2 className="font-display text-display-lg text-primary">Contas & Cartões</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Gerencie seus ativos líquidos e facilidades de crédito em um só lugar.</p>
          </div>
          <div className="flex gap-md">
            <button
              onClick={() => setShowAccountModal(true)}
              className="flex items-center gap-xs border border-primary text-primary px-lg py-md rounded-lg font-label-sm text-label-sm hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              Conectar Nova Conta
            </button>
            <button
              onClick={() => setShowCardModal(true)}
              className="flex items-center gap-xs bg-primary text-on-primary px-lg py-md rounded-lg font-label-sm text-label-sm active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[18px]">add_card</span>
              Adicionar Novo Cartão
            </button>
          </div>
        </div>

        {/* Bento Grid Section */}
        <div className="grid grid-cols-12 gap-gutter mb-xl">
          {/* Bank Accounts Grid (Left Area - 8 columns) */}
          <div className="col-span-12 lg:col-span-8 space-y-gutter">
            <h3 className="font-headline text-headline-md text-primary px-1 font-bold">Contas Bancárias</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {displayAccounts.map((account: any) => {
                const isReal = accounts.length > 0;
                return (
                  <div 
                    key={account.id}
                    onClick={() => isReal && setSelectedAccountForActivity(account.id)}
                    className={cn(
                      "bg-surface-container-lowest p-lg rounded-xl border shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[160px]",
                      activeAccountId === account.id ? "border-primary ring-2 ring-primary/10" : "border-outline-variant"
                    )}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                    <div className="flex justify-between items-start mb-xl relative z-10">
                      <div className="flex items-center gap-md">
                        <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center" style={{ color: account.color || 'var(--primary)' }}>
                          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {account.type === 'SAVINGS' ? 'savings' : account.type === 'INVESTMENT' ? 'trending_up' : account.type === 'CASH' ? 'payments' : 'account_balance'}
                          </span>
                        </div>
                        <div>
                          <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{ACCOUNT_TYPE_LABELS[account.type] || 'Checking'}</p>
                          <p className="font-headline text-headline-md text-primary font-bold">{account.name}</p>
                        </div>
                      </div>
                      
                      {isReal ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Remover esta conta?')) deleteAccount.mutate(account.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-placeholder hover:text-error transition-all"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      ) : (
                        <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">more_vert</span>
                      )}
                    </div>
                    
                    <div className="space-y-base relative z-10 mt-auto">
                      <p className="font-label-sm text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Saldo Disponível</p>
                      <p className="font-display text-display-lg text-primary">{formatCurrency(Number(account.balance), account.currency)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filtered Transactions activity (Chase activity) */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-sm">
              <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low/30">
                <h4 className="font-headline text-headline-md text-primary font-bold">Atividade Recente</h4>
                <div className="flex gap-xs items-center">
                  <span className="px-md py-1 bg-primary/10 text-primary rounded-full font-label-sm text-label-sm font-bold">{activeAccountName}</span>
                  <a href="/transactions" className="text-primary font-label-sm text-label-sm hover:underline ml-2">Ver Todas</a>
                </div>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low/50 border-b border-outline-variant/60">
                    <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Transação</th>
                    <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Categoria</th>
                    <th className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase font-bold text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {displayActivity.map((tx: any) => {
                    const isIncome = tx.type === 'INCOME';
                    const iconName = isIncome ? 'payments' : (tx.category?.icon || 'shopping_bag');
                    const formattedDate = new Date(tx.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <tr key={tx.id} className="hover:bg-surface-container-low/20 transition-colors">
                        <td className="px-lg py-md">
                          <div className="flex items-center gap-md">
                            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                              <span className="material-symbols-outlined text-[20px]">{iconName}</span>
                            </div>
                            <div>
                              <p className="font-body-lg text-body-lg font-bold text-primary">{tx.description}</p>
                              <p className="font-label-sm text-label-sm text-on-surface-variant">{formattedDate}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-lg py-md">
                          <span 
                            className="px-md py-1 rounded-full font-label-sm text-label-sm"
                            style={{ 
                              backgroundColor: `${tx.category?.color || '#6b7280'}1A`,
                              color: tx.category?.color || '#6b7280'
                            }}
                          >
                            {tx.category?.name || (isIncome ? 'Receita' : 'Geral')}
                          </span>
                        </td>
                        <td className={cn(
                          "px-lg py-md text-right font-numeric text-numeric-data font-bold",
                          isIncome ? "text-secondary" : "text-error"
                        )}>
                          {isIncome ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Credit Card Management (Right Area - 4 columns) */}
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <h3 className="font-headline text-headline-md text-primary px-1 font-bold">Cartões de Crédito</h3>
            
            {displayCards.map((card: any) => {
              const isReal = cards.length > 0;
              const limit = Number(card.creditLimit);
              // Calculate simulated invoice from transactions using this card
              const currentInvoice = transactions
                .filter((t: any) => t.cardId === card.id && t.type === 'EXPENSE' && t.isPaid)
                .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 3124.50;

              const percentUsed = Math.min(100, Math.round((currentInvoice / limit) * 100));

              return (
                <div key={card.id} className="space-y-gutter">
                  {/* Premium Visual Card */}
                  <div 
                    className="relative h-56 w-full rounded-2xl overflow-hidden shadow-xl p-xl flex flex-col justify-between text-white group transition-all"
                    style={{ background: `linear-gradient(135deg, ${card.color || '#031632'}, ${card.color || '#031632'}cc)` }}
                  >
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                      <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent"></div>
                      <div className="absolute -bottom-10 -left-10 w-40 h-40 border-[20px] border-white/10 rounded-full"></div>
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                      <div>
                        <p className="font-label-sm text-label-sm opacity-70 tracking-widest uppercase">{CARD_BRAND_LABELS[card.brand]} INFINITE</p>
                        <p className="font-headline text-headline-md font-bold">{card.name}</p>
                      </div>
                      <span className="material-symbols-outlined text-[32px] opacity-90">contactless</span>
                    </div>
                    <div className="space-y-xs relative z-10 mt-auto">
                      <p className="font-numeric text-lg tracking-[0.2em]">•••• •••• •••• {card.lastFourDigits || '8824'}</p>
                      <div className="flex gap-xl text-left">
                        <div>
                          <p className="text-[10px] uppercase opacity-60">Vencimento</p>
                          <p className="font-label-sm text-label-sm">Dia {card.dueDay}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase opacity-60">Fatura</p>
                          <p className="font-label-sm text-label-sm">Fechamento Dia {card.billingDay}</p>
                        </div>
                      </div>
                    </div>
                    {card.isFrozen && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-20">
                        <div className="text-center text-white">
                          <span className="material-symbols-outlined text-4xl animate-pulse">ac_unit</span>
                          <p className="text-sm font-bold mt-2 uppercase tracking-widest">Congelado</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Details controls */}
                  <div className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant space-y-lg shadow-sm">
                    <div>
                      <div className="flex justify-between mb-xs">
                        <p className="font-label-sm text-label-sm text-on-surface-variant">Limite Utilizado</p>
                        <p className="font-label-sm text-label-sm font-bold text-primary">{formatCurrency(currentInvoice)} / {formatCurrency(limit)}</p>
                      </div>
                      <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-1000" 
                          style={{ width: `${percentUsed}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-md pt-md border-t border-outline-variant/60">
                      <div>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">Fatura Atual</p>
                        <p className="font-headline text-headline-md text-error font-bold">{formatCurrency(currentInvoice)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-label-sm text-label-sm text-on-surface-variant">Vencimento</p>
                        <p className="font-headline text-headline-md text-primary font-bold">Dia {card.dueDay}</p>
                      </div>
                    </div>

                    <div className="space-y-sm">
                      <button className="w-full bg-primary text-on-primary py-md rounded-lg font-label-sm text-label-sm hover:opacity-90 active:scale-[0.98] transition-all font-bold">
                        Pagar Fatura Atual
                      </button>
                      
                      <div className="flex gap-2">
                        {isReal && (
                          <button 
                            onClick={() => freezeMutation.mutate(card.id)}
                            className="flex-1 border border-outline text-on-surface-variant py-md rounded-lg font-label-sm text-label-sm hover:bg-surface-container-low transition-colors flex items-center justify-center gap-xs font-bold"
                          >
                            <span className="material-symbols-outlined text-[18px]">{card.isFrozen ? 'lock_open' : 'lock'}</span>
                            {card.isFrozen ? 'Desbloquear' : 'Bloquear Cartão'}
                          </button>
                        )}
                        {isReal && (
                          <button
                            onClick={() => { if (confirm('Excluir este cartão?')) deleteCard.mutate(card.id); }}
                            className="border border-error/30 text-error px-4 rounded-lg hover:bg-error-container/20 transition-colors flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Security Banner */}
            <div className="bg-primary-container text-on-primary-container p-lg rounded-xl flex items-center gap-md border border-outline-variant/30">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white">security</span>
              </div>
              <div>
                <p className="font-label-sm text-label-sm font-bold text-white">Segurança Ativa</p>
                <p className="text-[12px] text-white/80 leading-tight">Verificação biométrica ativada para todas as transações deste cartão.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Promo Section at the bottom */}
        <section className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12">
            <div className="relative rounded-2xl overflow-hidden h-48 group shadow-sm border border-outline-variant">
              <img 
                alt="Luxury lifestyle imagery" 
                className="absolute inset-0 w-full h-full object-cover grayscale brightness-50 group-hover:scale-105 transition-transform duration-700" 
                src="https://images.unsplash.com/photo-1542744094-3a31f103e35f?auto=format&fit=crop&w=1200&q=80"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/60 to-transparent flex items-center p-xl">
                <div className="max-w-xl text-left">
                  <span className="px-md py-1 bg-secondary text-on-secondary rounded-full font-label-sm text-label-sm mb-md inline-block font-bold">Nova Funcionalidade</span>
                  <h3 className="font-display text-display-lg text-white mb-xs">Cofres Familiares</h3>
                  <p className="font-body-md text-white/80 mb-md">Compartilhe o acesso a saldos específicos de forma segura com membros da família, configurando limites individuais.</p>
                  <button className="bg-white text-primary px-lg py-sm rounded-lg font-label-sm text-label-sm font-bold hover:bg-opacity-90 transition-all">Explorar Cofres</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ─── MOBILE ACCOUNTS & CARDS ─── */}
      <div className="block md:hidden space-y-lg pb-12">
        {/* Section Header: Cards */}
        <section className="space-y-sm">
          <div className="flex justify-between items-center">
            <h2 className="font-headline text-headline-md text-primary font-bold">Meus Cartões</h2>
            <button 
              onClick={() => setShowCardModal(true)}
              className="flex items-center gap-xs text-primary font-label-sm active:scale-[0.98] transition-transform font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Novo Cartão</span>
            </button>
          </div>

          {/* Horizontal Cards Carousel */}
          <div className="flex gap-md overflow-x-auto no-scrollbar snap-x snap-mandatory py-xs -mx-md px-md">
            {displayCards.map((card: any) => (
              <div 
                key={card.id}
                className="min-w-[280px] h-[180px] rounded-xl p-lg flex flex-col justify-between text-white shadow-lg snap-start relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${card.color || '#031632'}, ${card.color || '#031632'}99)` }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                <div className="flex justify-between items-start z-10">
                  <span className="font-label-sm opacity-80 uppercase tracking-widest font-bold">{CARD_BRAND_LABELS[card.brand]} INFINITE</span>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>contactless</span>
                </div>
                <div className="z-10 mt-auto">
                  <p className="font-numeric text-body-lg tracking-[4px] mb-base">•••• •••• •••• {card.lastFourDigits || '8824'}</p>
                  <div className="flex justify-between items-end text-left">
                    <div>
                      <p className="text-[10px] uppercase opacity-60">Titular</p>
                      <p className="font-label-sm font-bold">CLIENTE DEMO</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase opacity-60 text-right">Vencimento</p>
                      <p className="font-label-sm text-right font-bold">Dia {card.dueDay}</p>
                    </div>
                  </div>
                </div>
                {card.isFrozen && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                    <span className="material-symbols-outlined text-3xl">ac_unit</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Section Header: Accounts */}
        <section className="space-y-sm">
          <div className="flex justify-between items-center">
            <h2 className="font-headline text-headline-md text-primary font-bold">Contas Bancárias</h2>
            <button 
              onClick={() => setShowAccountModal(true)}
              className="flex items-center gap-xs text-secondary font-label-sm active:scale-[0.98] transition-transform font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              <span>Conectar</span>
            </button>
          </div>

          {/* Accounts Vertical Stack */}
          <div className="space-y-md">
            {displayAccounts.map((account: any) => (
              <div 
                key={account.id} 
                className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: account.color || '#031632' }}>
                    <span className="material-symbols-outlined text-[20px]">
                      {account.type === 'SAVINGS' ? 'savings' : account.type === 'INVESTMENT' ? 'trending_up' : account.type === 'CASH' ? 'payments' : 'account_balance'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="font-label-sm text-on-surface font-bold truncate max-w-[130px]">{account.name}</p>
                    <p className="text-on-surface-variant text-[11px] truncate max-w-[130px]">{account.bank || ACCOUNT_TYPE_LABELS[account.type]}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-numeric text-body-lg font-bold text-primary">{formatCurrency(Number(account.balance), account.currency)}</p>
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">DISPONÍVEL</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Actions & Stats Bento Mini Grid */}
        <section className="grid grid-cols-2 gap-md pt-2">
          <div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border border-outline-variant flex flex-col gap-xs text-left">
            <span className="material-symbols-outlined text-primary text-xl">trending_up</span>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase">Saldo Acumulado</p>
            <p className="font-numeric text-body-lg font-bold text-primary">{formatCurrency(totalBalance)}</p>
          </div>
          <div className="bg-surface-container-lowest p-md rounded-xl shadow-sm border border-outline-variant flex flex-col gap-xs text-left">
            <span className="material-symbols-outlined text-secondary text-xl">verified_user</span>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase">Score de Crédito</p>
            <p className="font-numeric text-body-lg font-bold text-secondary">842</p>
          </div>
        </section>
      </div>

      {/* ─── MODAL ADD ACCOUNT ─── */}
      {showAccountModal && (
        <Modal title="Conectar Nova Conta" onClose={() => setShowAccountModal(false)}>
          <form onSubmit={accountForm.handleSubmit((d) => createAccount.mutate(d))} className="space-y-4 text-left">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Nome da Conta *</label>
                <input 
                  {...accountForm.register('name')} 
                  placeholder="Ex: Itaú Personalité" 
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                />
                {accountForm.formState.errors.name && <p className="text-error text-xs mt-0.5">{accountForm.formState.errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Tipo *</label>
                  <select 
                    {...accountForm.register('type')} 
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  >
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Instituição Bancária</label>
                  <input 
                    {...accountForm.register('bank')} 
                    placeholder="Ex: Itaú, Caixa" 
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Saldo Inicial</label>
                  <Controller
                    control={accountForm.control}
                    name="balance"
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
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Moeda</label>
                  <select 
                    {...accountForm.register('currency')} 
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  >
                    <option value="BRL">BRL (R$)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-2">Cor da Conta</label>
                <div className="flex gap-2 flex-wrap">
                  {ACCOUNT_COLORS.map((color) => (
                    <button 
                      key={color} 
                      type="button"
                      onClick={() => accountForm.setValue('color', color)}
                      className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                      style={{ 
                        backgroundColor: color, 
                        borderColor: accountForm.watch('color') === color ? 'var(--primary)' : 'transparent' 
                      }}
                    >
                      {accountForm.watch('color') === color && (
                        <span className="material-symbols-outlined text-white text-[16px]">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-border-base mt-6">
              <button 
                type="button" 
                onClick={() => setShowAccountModal(false)} 
                className="px-4 py-2 text-sm border border-outline rounded-lg text-on-surface-variant hover:bg-surface-container transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={createAccount.isPending} 
                className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 disabled:opacity-60 font-bold"
              >
                {createAccount.isPending ? 'Conectando...' : 'Conectar Conta'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── MODAL ADD CARD ─── */}
      {showCardModal && (
        <Modal title="Adicionar Novo Cartão" onClose={() => setShowCardModal(false)}>
          <form onSubmit={cardForm.handleSubmit((d) => createCard.mutate(d))} className="space-y-4 text-left">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1">Nome do Cartão *</label>
                <input 
                  {...cardForm.register('name')} 
                  placeholder="Ex: Cartão de Crédito Black" 
                  className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                />
                {cardForm.formState.errors.name && <p className="text-error text-xs mt-0.5">{cardForm.formState.errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Bandeira *</label>
                  <select 
                    {...cardForm.register('brand')} 
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  >
                    {Object.entries(CARD_BRAND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Últimos 4 Dígitos</label>
                  <input 
                    {...cardForm.register('lastFourDigits')} 
                    placeholder="1234" 
                    maxLength={4} 
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Limite de Crédito *</label>
                  <Controller
                    control={cardForm.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                      />
                    )}
                  />
                  {cardForm.formState.errors.creditLimit && <p className="text-error text-xs mt-0.5">{cardForm.formState.errors.creditLimit.message}</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Conta para Débito Fatura</label>
                  <select 
                    {...cardForm.register('accountId')} 
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  >
                    <option value="">Nenhuma</option>
                    {(accounts as any[]).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Dia de Fechamento *</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={28} 
                    {...cardForm.register('billingDay')} 
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-on-surface-variant block mb-1">Dia de Vencimento *</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={28} 
                    {...cardForm.register('dueDay')} 
                    className="w-full bg-surface-container-low border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-2">Cor do Cartão</label>
                <div className="flex gap-2 flex-wrap">
                  {['#8b5cf6', '#ef4444', '#3b82f6', '#f59e0b', '#06b6d4', '#10b981', '#ec4899', '#031632'].map((color) => (
                    <button 
                      key={color} 
                      type="button"
                      onClick={() => cardForm.setValue('color', color)}
                      className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                      style={{ 
                        backgroundColor: color, 
                        borderColor: cardForm.watch('color') === color ? 'var(--primary)' : 'transparent' 
                      }}
                    >
                      {cardForm.watch('color') === color && (
                        <span className="material-symbols-outlined text-white text-[16px]">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-border-base mt-6">
              <button 
                type="button" 
                onClick={() => setShowCardModal(false)} 
                className="px-4 py-2 text-sm border border-outline rounded-lg text-on-surface-variant hover:bg-surface-container transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={createCard.isPending} 
                className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 disabled:opacity-60 font-bold"
              >
                {createCard.isPending ? 'Salvando...' : 'Adicionar Cartão'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
