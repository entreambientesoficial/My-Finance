'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getCurrentMonthYear, cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/CurrencyInput';

const TYPE_COLORS: Record<string, string> = { INCOME: 'text-secondary', EXPENSE: 'text-error', TRANSFER: 'text-blue-500' };
const TYPE_LABELS: Record<string, string> = { INCOME: 'Receita', EXPENSE: 'Despesa', TRANSFER: 'Transferência' };

const PLACEHOLDER_TRANSACTIONS = [
  {
    id: 'demo-1',
    date: '2026-06-02T12:00:00.000Z',
    description: 'Amazon Web Services',
    notes: 'Pagamento Cloud Jun/26',
    amount: 1250.00,
    type: 'EXPENSE',
    isPaid: true,
    category: { id: 'c-cloud', name: 'Tecnologia', color: '#031632', icon: 'cloud' },
    account: { id: 'acc-main', name: 'Conta Principal' }
  },
  {
    id: 'demo-2',
    date: '2026-06-01T15:30:00.000Z',
    description: 'Transferência Recebida - PIX',
    notes: 'João Silva Mello',
    amount: 4800.00,
    type: 'INCOME',
    isPaid: false,
    category: { id: 'c-income', name: 'Salário', color: '#006c49', icon: 'payments' },
    account: { id: 'acc-main', name: 'Conta Principal' }
  },
  {
    id: 'demo-3',
    date: '2026-05-30T10:00:00.000Z',
    description: 'Starbucks Coffee #342',
    notes: 'Despesa corporativa',
    amount: 42.50,
    type: 'EXPENSE',
    isPaid: false,
    category: { id: 'c-food', name: 'Alimentação', color: '#ba1a1a', icon: 'restaurant' },
    card: { id: 'card-corp', name: 'Visa Corporate' }
  },
  {
    id: 'demo-4',
    date: '2026-05-28T09:00:00.000Z',
    description: 'Condomínio Ed. Alpha',
    notes: 'Boleto Itaú',
    amount: 850.00,
    type: 'EXPENSE',
    isPaid: true,
    category: { id: 'c-housing', name: 'Moradia', color: '#3b82f6', icon: 'home' },
    account: { id: 'acc-main', name: 'Conta Principal' }
  },
  {
    id: 'demo-5',
    date: '2026-05-25T14:20:00.000Z',
    description: 'Supermercado Pão de Açúcar',
    notes: 'Compras Mensais',
    amount: 624.90,
    type: 'EXPENSE',
    isPaid: true,
    category: { id: 'c-food', name: 'Alimentação', color: '#ba1a1a', icon: 'shopping_cart' },
    account: { id: 'acc-main', name: 'Conta Principal' }
  }
];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-outline-variant rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <h2 className="font-headline text-headline-md text-primary font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-container rounded-full text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <div className="p-5 max-h-[85vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function EditTransactionModal({ 
  transaction, 
  onClose, 
  categories, 
  accounts, 
  cards, 
  onSave, 
  isSaving 
}: any) {
  const { register, handleSubmit, watch, setValue, control } = useForm<any>({
    defaultValues: {
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description || '',
      categoryId: transaction.categoryId || '',
      date: transaction.date ? new Date(transaction.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      accountId: transaction.accountId || '',
      toAccountId: transaction.toAccountId || '',
      cardId: transaction.cardId || '',
      isPaid: transaction.isPaid ? 'true' : 'false',
    }
  });

  const transactionType = watch('type');

  // Find initial parent and child IDs
  const initialCategoryId = transaction.categoryId || '';
  let initialParentId = '';
  let initialSubId = '';

  if (initialCategoryId) {
    const parent = categories.find((c: any) => 
      c.id === initialCategoryId || c.children?.some((child: any) => child.id === initialCategoryId)
    );
    if (parent) {
      initialParentId = parent.id;
      if (parent.id !== initialCategoryId) {
        initialSubId = initialCategoryId;
      }
    }
  }

  const [selectedParentId, setSelectedParentId] = useState(initialParentId);
  const [selectedSubId, setSelectedSubId] = useState(initialSubId);

  // Handlers for category / subcategory change
  const handleParentCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parentId = e.target.value;
    setSelectedParentId(parentId);
    setSelectedSubId('');
    setValue('categoryId', parentId); // default to parent if no sub is selected
  };

  const handleSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subId = e.target.value;
    setSelectedSubId(subId);
    setValue('categoryId', subId || selectedParentId); // if sub is empty, use parent
  };

  const displayAccountsSelect = accounts.length > 0 ? accounts : [
    { id: 'checking', name: 'Chase Platinum' },
    { id: 'savings', name: 'Goldman Sachs' }
  ];

  const displayCardsSelect = cards.length > 0 ? cards : [
    { id: 'c1', name: 'Capital Reserve Visa' }
  ];

  return (
    <Modal title="Editar Lançamento" onClose={onClose}>
      <form onSubmit={handleSubmit((d) => onSave(d))} className="space-y-6">
        {/* Transaction Type Radio Selector */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-[10px] text-outline tracking-wider uppercase font-bold">TIPO DE TRANSAÇÃO</label>
          <div className="inline-flex p-1 bg-surface-container-low rounded-lg w-full">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => {
              const isActive = transactionType === t;
              let colorClass = 'text-primary';
              let icon = 'sync_alt';
              let label = 'Transferência';
              
              if (t === 'EXPENSE') {
                colorClass = 'text-error';
                icon = 'arrow_circle_down';
                label = 'Despesa';
              } else if (t === 'INCOME') {
                colorClass = 'text-secondary';
                icon = 'arrow_circle_up';
                label = 'Receita';
              }
              
              return (
                <label 
                  key={t} 
                  className={cn(
                    "flex-grow flex-1 flex items-center justify-center gap-xs py-2 rounded-lg cursor-pointer transition-all text-xs font-bold select-none",
                    isActive ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                  )}
                >
                  <input 
                    type="radio" 
                    {...register('type')} 
                    value={t} 
                    className="sr-only" 
                    onChange={() => {
                      setValue('type', t);
                      setValue('categoryId', '');
                      setSelectedParentId('');
                      setSelectedSubId('');
                      setValue('accountId', '');
                      setValue('toAccountId', '');
                      setValue('cardId', '');
                    }}
                  />
                  <span className={cn("material-symbols-outlined text-[16px]", isActive ? 'text-white' : colorClass)}>{icon}</span>
                  {label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Value Input */}
          <div className="md:col-span-2 flex flex-col gap-xs">
            <label className="font-label-sm text-[10px] text-outline uppercase font-bold" htmlFor="edit-form-val">VALOR *</label>
            <div className="relative">
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <CurrencyInput
                    id="edit-form-val"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-numeric text-headline-md outline-none transition-all"
                  />
                )}
              />
            </div>
          </div>

          {/* Description */}
          <div className="md:col-span-2 flex flex-col gap-xs">
            <label className="font-label-sm text-[10px] text-outline uppercase font-bold" htmlFor="edit-form-desc">DESCRIÇÃO</label>
            <input 
              type="text" 
              id="edit-form-desc" 
              {...register('description')} 
              placeholder="Ex: Supermercado Mensal" 
              className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all text-sm"
            />
          </div>

          {/* Category & Subcategory */}
          {transactionType !== 'TRANSFER' && (
            <>
              <div className="flex flex-col gap-xs">
                <label className="font-label-sm text-[10px] text-outline uppercase font-bold">CATEGORIA</label>
                <div className="relative">
                  <select 
                    value={selectedParentId}
                    onChange={handleParentCategoryChange}
                    className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm"
                  >
                    <option value="">Sem categoria</option>
                    {(categories as any[]).filter((c: any) => c.type === transactionType).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">keyboard_arrow_down</span>
                </div>
              </div>

              <div className="flex flex-col gap-xs">
                <label className="font-label-sm text-[10px] text-outline uppercase font-bold">SUBCATEGORIA</label>
                <div className="relative">
                  <select 
                    value={selectedSubId}
                    onChange={handleSubCategoryChange}
                    disabled={!selectedParentId}
                    className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Geral / Nenhuma</option>
                    {selectedParentId && categories
                      .find((c: any) => c.id === selectedParentId)
                      ?.children?.map((child: any) => (
                        <option key={child.id} value={child.id}>{child.name}</option>
                      ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">keyboard_arrow_down</span>
                </div>
              </div>
            </>
          )}

          {/* Date */}
          <div className={cn("flex flex-col gap-xs", transactionType === 'TRANSFER' ? 'md:col-span-2' : '')}>
            <label className="font-label-sm text-[10px] text-outline uppercase font-bold">DATA *</label>
            <input 
              type="date" 
              required 
              {...register('date')} 
              className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all text-sm"
            />
          </div>

          {/* Account / Credit Card */}
          <div className="flex flex-col gap-xs">
            <label className="font-label-sm text-[10px] text-outline uppercase font-bold">
              {transactionType === 'TRANSFER' ? 'CONTA ORIGEM *' : 'CONTA *'}
            </label>
            <div className="relative">
              <select 
                required 
                {...register('accountId')} 
                className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm"
              >
                <option value="">Selecionar conta</option>
                {(displayAccountsSelect as any[]).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">account_balance</span>
            </div>
          </div>

          {/* Conditional: To Account for Transfer */}
          {transactionType === 'TRANSFER' && (
            <div className="flex flex-col gap-xs">
              <label className="font-label-sm text-[10px] text-outline uppercase font-bold">CONTA DESTINO *</label>
              <div className="relative">
                <select 
                  required 
                  {...register('toAccountId')} 
                  className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm"
                >
                  <option value="">Selecionar conta</option>
                  {(displayAccountsSelect as any[]).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">account_balance</span>
              </div>
            </div>
          )}

          {/* Conditional: Card for Expense */}
          {transactionType === 'EXPENSE' && (
            <div className="flex flex-col gap-xs md:col-span-2">
              <label className="font-label-sm text-[10px] text-outline uppercase font-bold">CARTÃO DE CRÉDITO</label>
              <div className="relative">
                <select 
                  {...register('cardId')} 
                  className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm"
                >
                  <option value="">Nenhum (Debitado da conta)</option>
                  {(displayCardsSelect as any[]).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">credit_card</span>
              </div>
            </div>
          )}

          {/* Status Radio options */}
          <div className="md:col-span-2 flex flex-col gap-xs pt-2">
            <label className="font-label-sm text-[10px] text-outline uppercase font-bold">STATUS</label>
            <div className="flex items-center gap-md h-10">
              <label className="flex items-center gap-xs cursor-pointer group text-sm">
                <input 
                  type="radio" 
                  value="true"
                  {...register('isPaid')} 
                  className="w-4 h-4 text-secondary focus:ring-secondary border-outline-variant bg-surface-container-lowest" 
                />
                <span className="text-on-surface-variant group-hover:text-secondary transition-colors font-medium">
                  {transactionType === 'INCOME' ? 'Recebido' : 'Pago / Efetivado'}
                </span>
              </label>
              <label className="flex items-center gap-xs cursor-pointer group text-sm">
                <input 
                  type="radio" 
                  value="false"
                  {...register('isPaid')} 
                  className="w-4 h-4 text-primary focus:ring-primary border-outline-variant bg-surface-container-lowest" 
                />
                <span className="text-on-surface-variant group-hover:text-primary transition-colors font-medium">Pendente</span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 flex items-center justify-end gap-md border-t border-outline-variant">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-lg border border-outline-variant font-label-sm text-xs font-bold text-on-surface-variant hover:bg-surface-container-low transition-all active:scale-[0.98]"
          >
            CANCELAR
          </button>
          <button 
            type="submit" 
            disabled={isSaving}
            className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-bold hover:opacity-90 shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {isSaving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function formatDateLong(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${d.getUTCDate().toString().padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  } catch {
    return dateStr;
  }
}

function CategoryBadge({ category, type }: any) {
  if (type === 'TRANSFER') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold">
        <span className="material-symbols-outlined text-[12px]">sync_alt</span>
        Transf
      </span>
    );
  }
  const color = category?.color || '#6b7280';
  const icon = category?.icon || (type === 'INCOME' ? 'payments' : 'shopping_bag');
  const name = category?.name || (type === 'INCOME' ? 'Receita' : 'Geral');
  return (
    <span 
      className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      <span className="material-symbols-outlined text-[12px]">{icon}</span>
      {name}
    </span>
  );
}

function AccountInfo({ account, card, toAccount, type }: any) {
  if (type === 'TRANSFER') {
    return (
      <span className="text-on-surface-variant text-xs flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px] text-outline">account_balance</span>
        {account?.name || 'Origem'} 
        <span className="material-symbols-outlined text-[12px] text-outline">arrow_forward</span> 
        {toAccount?.name || 'Destino'}
      </span>
    );
  }
  if (card) {
    return (
      <span className="text-on-surface-variant text-xs flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px] text-outline">credit_card</span>
        {card.name}
      </span>
    );
  }
  return (
    <span className="text-on-surface-variant text-xs flex items-center gap-1">
      <span className="material-symbols-outlined text-[14px] text-outline">account_balance</span>
      {account?.name || 'Conta Corrente'}
    </span>
  );
}

function StatusBadge({ type, isPaid }: { type: string; isPaid: boolean }) {
  if (type === 'TRANSFER') {
    return (
      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold flex items-center gap-1 w-fit">
        <span className="material-symbols-outlined text-sm">sync_alt</span>
        Transferido
      </span>
    );
  }
  if (isPaid) {
    return (
      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold flex items-center gap-1 w-fit">
        <span className="material-symbols-outlined text-sm">check_circle</span>
        Efetivado
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-xs font-bold flex items-center gap-1 w-fit">
      <span className="material-symbols-outlined text-sm">pending</span>
      Pendente
    </span>
  );
}

function SessionSummary({ txList, isLoading }: { txList: any[]; isLoading: boolean }) {
  const count = txList.length;
  const income = txList.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
  const expense = txList.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
  const pendingCount = txList.filter(t => !t.isPaid).length;

  return (
    <div className="bg-primary dark:bg-primary-container text-white p-lg rounded-xl shadow-sm space-y-md border border-outline-variant/10">
      <div className="flex justify-between items-center">
        <span className="font-label-sm text-label-sm uppercase tracking-wider opacity-85">Resumo das Transações</span>
        <span className="material-symbols-outlined opacity-80">info</span>
      </div>
      <div className="space-y-md">
        <div className="flex justify-between items-end border-b border-white/10 pb-xs">
          <span className="text-body-md text-white/80">Lançamentos</span>
          <span className="font-numeric text-headline-md leading-none">{isLoading ? '...' : count}</span>
        </div>
        <div className="flex justify-between items-end border-b border-white/10 pb-xs">
          <span className="text-body-md text-white/80">Total Receitas</span>
          <span className="font-numeric text-headline-md leading-none text-secondary-fixed">{isLoading ? '...' : formatCurrency(income)}</span>
        </div>
        <div className="flex justify-between items-end border-b border-white/10 pb-xs">
          <span className="text-body-md text-white/80">Total Despesas</span>
          <span className="font-numeric text-headline-md leading-none text-tertiary-fixed-dim">{isLoading ? '...' : formatCurrency(expense)}</span>
        </div>
        <div className="flex justify-between items-end">
          <span className="text-body-md text-white/80">Pendentes</span>
          <span className="font-numeric text-headline-md leading-none text-amber-300">{isLoading ? '...' : pendingCount}</span>
        </div>
      </div>
    </div>
  );
}

function ImportPanel({ 
  importFormat, 
  setImportFormat, 
  importAccountId, 
  setImportAccountId, 
  accounts, 
  importResult, 
  setImportResult, 
  importMutation, 
  importOfxMutation, 
  importFileRef, 
  importOfxFileRef 
}: any) {
  const [selectedFileName, setSelectedFileName] = useState('');

  return (
    <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant space-y-md">
      <div>
        <h3 className="font-headline text-headline-md text-primary font-bold">Importar Extrato</h3>
        <p className="text-xs text-on-surface-variant mt-1">Carregue arquivos OFX ou CSV para conciliar automaticamente.</p>
        <p className="text-[11px] text-primary/80 dark:text-primary-fixed-dim/80 mt-2 leading-relaxed bg-primary/5 dark:bg-primary-container/20 p-2 rounded-lg border border-outline-variant/20 flex gap-1 items-start">
          <span className="material-symbols-outlined text-[14px] mt-[2px] shrink-0">info</span>
          <span>
            <strong>Dica:</strong> No seu banco, o extrato OFX pode se chamar <strong>"MS Money"</strong> ou <strong>"Quicken"</strong>. Ambos funcionam perfeitamente!
          </span>
        </p>
      </div>

      <div className="flex gap-1 bg-surface-container-low p-1 rounded-lg">
        {(['csv', 'ofx'] as const).map((fmt) => (
          <button 
            key={fmt} 
            type="button"
            onClick={() => { setImportFormat(fmt); setImportResult(null); }}
            className={cn(
              "flex-1 py-1.5 rounded-md text-sm font-medium transition-colors",
              importFormat === fmt ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'
            )}
          >
            {fmt === 'csv' ? 'CSV' : 'OFX'}
          </button>
        ))}
      </div>

      <div>
        <label className="font-label-sm text-[10px] text-outline block mb-1">VINCULAR À CONTA</label>
        <div className="relative">
          <select 
            value={importAccountId} 
            onChange={(e) => setImportAccountId(e.target.value)}
            className="w-full px-md py-sm pr-10 rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm"
          >
            <option value="">Sem conta específica</option>
            {(accounts as any[]).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">account_balance</span>
        </div>
      </div>

      {!importResult ? (
        <div>
          <input 
            ref={importFileRef} 
            type="file" 
            accept=".csv" 
            className="hidden"
            onChange={(e) => { 
              const f = e.target.files?.[0]; 
              if (f) {
                setSelectedFileName(f.name);
                importMutation.mutate(f); 
              }
            }} 
          />
          <input 
            ref={importOfxFileRef} 
            type="file" 
            accept=".ofx,.ofc" 
            className="hidden"
            onChange={(e) => { 
              const f = e.target.files?.[0]; 
              if (f) {
                setSelectedFileName(f.name);
                importOfxMutation.mutate(f); 
              }
            }} 
          />
          
          <div
            onClick={() => importFormat === 'csv' ? importFileRef.current?.click() : importOfxFileRef.current?.click()}
            className="border-2 border-dashed border-outline-variant rounded-xl p-lg flex flex-col items-center justify-center bg-surface hover:bg-surface-container-low transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-primary-fixed mb-sm flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-primary text-xl">cloud_upload</span>
            </div>
            <span className="font-bold text-primary text-sm max-w-full truncate px-sm">
              {importMutation.isPending || importOfxMutation.isPending 
                ? `Importando ${selectedFileName || 'arquivo'}...` 
                : 'Selecionar Arquivo'}
            </span>
            <span className="text-[10px] text-on-surface-variant mt-0.5">Clique ou arraste</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={cn(
            "rounded-xl p-3 border",
            importResult.imported > 0 ? 'bg-secondary/5 border-secondary/20 text-on-secondary-container' : 'bg-error-container text-on-error-container border-error/20'
          )}>
            <div className="flex items-center gap-2">
              <span className={cn(
                "material-symbols-outlined text-xl",
                importResult.imported > 0 ? 'text-secondary' : 'text-error'
              )}>
                {importResult.imported > 0 ? 'check_circle' : 'error'}
              </span>
              <div className="text-xs">
                <p className="font-bold">{importResult.imported} importados</p>
                {importResult.errors > 0 && <p className="opacity-80">{importResult.errors} ignorados</p>}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setImportResult(null); setSelectedFileName(''); }}
            className="text-xs text-primary hover:underline font-semibold"
          >
            Importar outro
          </button>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filters, setFilters] = useState<any>({ page: 1, limit: 25 });
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importAccountId, setImportAccountId] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [importFormat, setImportFormat] = useState<'csv' | 'ofx'>('csv');
  const importOfxFileRef = useRef<HTMLInputElement>(null);
  const [attachTx, setAttachTx] = useState<any>(null);
  const attachFileRef = useRef<HTMLInputElement>(null);
  const [editingTx, setEditingTx] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters, selectedType],
    queryFn: () => api.get('/transactions', { params: { ...filters, ...(selectedType && { type: selectedType }) } }).then((r) => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then((r) => r.data),
  });

  const { data: cards = [] } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get('/cards').then((r) => r.data),
  });

  const { register, handleSubmit, reset, watch, setValue, control } = useForm<any>({ defaultValues: { type: 'EXPENSE', isPaid: true } });
  const transactionType = watch('type');

  const [newSelectedParentId, setNewSelectedParentId] = useState('');
  const [newSelectedSubId, setNewSelectedSubId] = useState('');

  const handleNewParentCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parentId = e.target.value;
    setNewSelectedParentId(parentId);
    setNewSelectedSubId('');
    setValue('categoryId', parentId);
  };

  const handleNewSubCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subId = e.target.value;
    setNewSelectedSubId(subId);
    setValue('categoryId', subId || newSelectedParentId);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/transactions', { ...data, amount: Number(data.amount), isPaid: data.isPaid === 'true' || data.isPaid === true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['monthly-summary'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Lançamento criado!');
      reset({ type: 'EXPENSE', isPaid: true });
      setNewSelectedParentId('');
      setNewSelectedSubId('');
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      api.patch(`/transactions/${id}`, { 
        ...data, 
        amount: Number(data.amount), 
        isPaid: data.isPaid === 'true' || data.isPaid === true 
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['monthly-summary'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Lançamento atualizado!');
      setEditingTx(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao atualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['monthly-summary'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Removido!');
    },
  });

  const togglePaidMutation = useMutation({
    mutationFn: ({ id, isPaid }: { id: string; isPaid: boolean }) =>
      api.patch(`/transactions/${id}`, { isPaid }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['monthly-summary'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Status atualizado!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao atualizar'),
  });

  function exportCsv() {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (selectedType) params.set('type', selectedType);

    const token = localStorage.getItem('accessToken');
    const url = `${process.env.NEXT_PUBLIC_API_URL}/reports/export/transactions.csv?${params}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success('CSV exportado!');
      })
      .catch(() => toast.error('Erro ao exportar'));
  }

  const importOfxMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      if (importAccountId) form.append('accountId', importAccountId);
      return api.post('/transactions/import/ofx', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
    },
    onSuccess: (result) => {
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      if (result.imported > 0) toast.success(`${result.imported} lançamentos importados!`);
      if (result.errors > 0) toast(`${result.errors} linhas ignoradas`, { icon: '⚠️' });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao importar OFX'),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      if (importAccountId) form.append('accountId', importAccountId);
      return api.post('/transactions/import/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
    },
    onSuccess: (result) => {
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      if (result.imported > 0) toast.success(`${result.imported} lançamentos importados!`);
      if (result.errors > 0) toast(`${result.errors} linhas ignoradas`, { icon: '⚠️' });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao importar'),
  });

  const uploadAttachment = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`/transactions/${id}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
    },
    onSuccess: (updated) => {
      setAttachTx(updated);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Anexo enviado!');
    },
    onError: () => toast.error('Erro ao enviar anexo'),
  });

  const removeAttachment = useMutation({
    mutationFn: ({ id, filename }: { id: string; filename: string }) =>
      api.delete(`/transactions/${id}/attachments/${filename}`).then((r) => r.data),
    onSuccess: (updated) => {
      setAttachTx(updated);
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Anexo removido.');
    },
  });

  const rawList = data?.data || [];
  const isRealData = rawList.length > 0;
  
  // Choose source data and perform client side fallback filtering if no transactions exist in the database
  const displayList = isRealData 
    ? rawList 
    : PLACEHOLDER_TRANSACTIONS.filter((t: any) => {
        if (selectedType && t.type !== selectedType) return false;
        if (filters.startDate && new Date(t.date) < new Date(filters.startDate)) return false;
        if (filters.endDate && new Date(t.date) > new Date(filters.endDate + 'T23:59:59')) return false;
        return true;
      });

  // Client side search query filtering (always active)
  const filteredList = displayList.filter((t: any) => {
    if (searchQuery) {
      const desc = (t.description || '').toLowerCase();
      const notes = (t.notes || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return desc.includes(query) || notes.includes(query);
    }
    return true;
  });

  const displayAccountsSelect = accounts.length > 0 ? accounts : [
    { id: 'checking', name: 'Chase Platinum' },
    { id: 'savings', name: 'Goldman Sachs' }
  ];

  const displayCardsSelect = cards.length > 0 ? cards : [
    { id: 'c1', name: 'Capital Reserve Visa' }
  ];

  function renderAmount(t: any) {
    const isIncome = t.type === 'INCOME';
    const isTransfer = t.type === 'TRANSFER';
    const colorClass = isIncome ? 'text-secondary font-bold' : isTransfer ? 'text-blue-500 font-bold' : 'text-error font-bold';
    const sign = isIncome ? '+' : isTransfer ? '' : '−';
    return (
      <span className={cn("font-numeric whitespace-nowrap text-right", colorClass)}>
        {sign} {formatCurrency(Number(t.amount))}
      </span>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Decorative Floating Blur */}
      <div className="fixed top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none"></div>

      {/* ─── DESKTOP TRANSACTIONS VIEW ─── */}
      <div className="hidden md:block space-y-gutter">
        {/* Header */}
        <div className="flex justify-between items-end mb-xl">
          <div>
            <h2 className="font-display text-display-lg text-primary">Transações</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">Gerencie e concilie seus lançamentos financeiros com precisão.</p>
          </div>
          <div className="flex gap-md">
            <button
              onClick={exportCsv}
              className="flex items-center gap-xs border border-outline-variant text-on-surface-variant px-lg py-md rounded-lg font-label-sm text-label-sm hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Exportar CSV
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-xs bg-primary text-on-primary px-lg py-md rounded-lg font-label-sm text-label-sm active:scale-95 transition-transform shadow-md font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Novo Lançamento
            </button>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-12 gap-gutter">
          {/* Left Column (Stats & Upload - 4 columns) */}
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <ImportPanel 
              importFormat={importFormat}
              setImportFormat={setImportFormat}
              importAccountId={importAccountId}
              setImportAccountId={setImportAccountId}
              accounts={accounts}
              importResult={importResult}
              setImportResult={setImportResult}
              importMutation={importMutation}
              importOfxMutation={importOfxMutation}
              importFileRef={importFileRef}
              importOfxFileRef={importOfxFileRef}
            />
            <SessionSummary txList={displayList} isLoading={isLoading} />
          </div>

          {/* Right Column (List - 8 columns) */}
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
              {/* Filter Section */}
              <div className="p-lg border-b border-outline-variant bg-surface-container-lowest space-y-md">
                <div className="flex justify-between items-center flex-wrap gap-md">
                  <div>
                    <h2 className="font-headline text-headline-md text-primary font-bold">Lançamentos Registrados</h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">Mostrando últimos lançamentos da conta</p>
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative w-64">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                    <input 
                      type="text"
                      placeholder="Buscar descrição..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-surface-container-low border-none rounded-full text-sm w-full focus:ring-2 focus:ring-primary transition-all text-on-surface"
                    />
                  </div>
                </div>

                {/* Filters details */}
                <div className="flex justify-between items-center flex-wrap gap-sm pt-2">
                  {/* Type Filter tabs */}
                  <div className="flex gap-1 bg-surface-container-low p-1 rounded-lg">
                    {[
                      ['', 'Todos'],
                      ['INCOME', 'Receitas'],
                      ['EXPENSE', 'Despesas'],
                      ['TRANSFER', 'Transferências']
                    ].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => { setSelectedType(val); setFilters((f: any) => ({ ...f, page: 1 })); }}
                        className={cn(
                          "px-3 py-1 rounded-md text-xs font-semibold transition-colors",
                          selectedType === val ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-primary'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Date range inputs */}
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      onChange={(e) => setFilters((f: any) => ({ ...f, startDate: e.target.value, page: 1 }))}
                      className="border border-outline-variant rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary bg-surface-container-lowest text-on-surface transition-colors cursor-pointer" 
                    />
                    <span className="text-outline text-xs">até</span>
                    <input 
                      type="date" 
                      onChange={(e) => setFilters((f: any) => ({ ...f, endDate: e.target.value, page: 1 }))}
                      className="border border-outline-variant rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-primary bg-surface-container-lowest text-on-surface transition-colors cursor-pointer" 
                    />
                  </div>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-container-low text-on-surface-variant font-label-sm text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-md lg:px-sm py-md">Data</th>
                      <th className="px-md lg:px-sm py-md">Descrição</th>
                      <th className="px-md lg:px-sm py-md text-right">Valor</th>
                      <th className="px-md lg:px-sm py-md">Conta / Cartão</th>
                      <th className="px-md lg:px-sm py-md">Status</th>
                      <th className="px-md lg:px-sm py-md text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/35 bg-surface-container-lowest">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-lg py-12 text-center text-on-surface-variant">
                          <div className="flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                            Carregando lançamentos...
                          </div>
                        </td>
                      </tr>
                    ) : filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-lg py-12 text-center text-on-surface-variant font-medium">
                          Nenhum lançamento encontrado.
                        </td>
                      </tr>
                    ) : filteredList.map((t: any) => {
                      const isReal = isRealData;
                      return (
                        <tr key={t.id} className="hover:bg-surface-container-low/20 transition-colors group">
                          <td className="px-md lg:px-sm py-md font-numeric text-xs whitespace-nowrap">{formatDateLong(t.date)}</td>
                          <td className="px-md lg:px-sm py-md">
                            <div className="flex flex-col max-w-[200px] lg:max-w-[260px]">
                              <span className="font-bold text-primary truncate text-sm">{t.description || 'Sem descrição'}</span>
                              {t.notes && <span className="text-xs text-on-surface-variant truncate mt-0.5">{t.notes}</span>}
                              <div className="mt-1">
                                <CategoryBadge category={t.category} type={t.type} />
                              </div>
                            </div>
                          </td>
                          <td className="px-md lg:px-sm py-md text-right font-semibold">
                            {renderAmount(t)}
                          </td>
                          <td className="px-md lg:px-sm py-md">
                            <AccountInfo account={t.account} card={t.card} toAccount={t.toAccount} type={t.type} />
                          </td>
                          <td className="px-md lg:px-sm py-md">
                            <StatusBadge type={t.type} isPaid={t.isPaid} />
                          </td>
                          <td className="px-md lg:px-sm py-md text-right">
                            <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              {isReal ? (
                                <>
                                  <button
                                    onClick={() => togglePaidMutation.mutate({ id: t.id, isPaid: !t.isPaid })}
                                    className={cn(
                                      "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                                      t.isPaid 
                                        ? "text-on-surface-variant hover:bg-surface-container hover:text-amber-600" 
                                        : "text-secondary hover:bg-secondary/15"
                                    )}
                                    title={t.isPaid ? 'Marcar como Pendente' : (t.type === 'INCOME' ? 'Marcar como Recebido' : 'Marcar como Pago')}
                                  >
                                    <span className="material-symbols-outlined text-[20px]">
                                      {t.isPaid ? 'undo' : 'check_circle'}
                                    </span>
                                  </button>

                                  <button
                                    onClick={() => setEditingTx(t)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary"
                                    title="Editar"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                  </button>

                                  <button
                                    onClick={() => setAttachTx(t)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary relative"
                                    title="Anexos"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">attach_file</span>
                                    {t.attachments?.length > 0 && (
                                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#006c49] text-[9px] text-white rounded-full flex items-center justify-center font-bold">
                                        {t.attachments.length}
                                      </span>
                                    )}
                                  </button>
 
                                  <button
                                    onClick={() => { if (confirm('Remover este lançamento?')) deleteMutation.mutate(t.id); }}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-error"
                                    title="Excluir"
                                  >
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-outline-variant font-bold tracking-widest uppercase">DEMO</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {data && data.pages > 1 && (
                <div className="p-lg bg-surface-container-low flex items-center justify-between border-t border-outline-variant/60">
                  <span className="text-xs text-on-surface-variant">
                    Página {data.page} de {data.pages} · {data.total} total
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setFilters((f: any) => ({ ...f, page: f.page - 1 }))} 
                      disabled={data.page === 1}
                      className="px-3 py-1 rounded bg-white border border-outline-variant text-xs text-on-surface-variant font-semibold disabled:opacity-40 hover:bg-surface-container transition-colors"
                    >
                      Anterior
                    </button>
                    <button 
                      onClick={() => setFilters((f: any) => ({ ...f, page: f.page + 1 }))} 
                      disabled={data.page === data.pages}
                      className="px-3 py-1 rounded bg-white border border-outline-variant text-xs text-on-surface-variant font-semibold disabled:opacity-40 hover:bg-surface-container transition-colors"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MOBILE TRANSACTIONS VIEW ─── */}
      <div className="block md:hidden space-y-md">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-primary">Lançamentos</h2>
            <p className="text-xs text-on-surface-variant">{data?.total || 0} encontrados</p>
          </div>
          
          <div className="flex gap-1.5">
            <button 
              onClick={() => setShowImport(true)} 
              className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary active:bg-surface-container-high transition-colors"
              title="Importar Extrato"
            >
              <span className="material-symbols-outlined text-[20px]">upload_file</span>
            </button>
            <button 
              onClick={() => setShowForm(true)}
              className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center active:scale-95 transition-transform shadow-md"
              title="Novo Lançamento"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input 
            type="text"
            placeholder="Buscar lançamentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-xl text-sm w-full focus:ring-1 focus:ring-primary text-on-surface focus:outline-none"
          />
        </div>

        {/* Scrollable Type Filter tags */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            ['', 'Todos'],
            ['INCOME', 'Receitas'],
            ['EXPENSE', 'Despesas'],
            ['TRANSFER', 'Transf.']
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setSelectedType(val); setFilters((f: any) => ({ ...f, page: 1 })); }}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap",
                selectedType === val ? 'bg-[#031632] text-white' : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable Stats */}
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          <div className="flex-shrink-0 w-36 bg-surface-container-lowest border border-outline-variant p-3 rounded-xl">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Receitas</p>
            <p className="font-numeric text-sm font-bold text-secondary mt-1">
              {isLoading ? '...' : formatCurrency(filteredList.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + Number(t.amount), 0))}
            </p>
          </div>
          <div className="flex-shrink-0 w-36 bg-surface-container-lowest border border-outline-variant p-3 rounded-xl">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Despesas</p>
            <p className="font-numeric text-sm font-bold text-error mt-1">
              {isLoading ? '...' : formatCurrency(filteredList.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + Number(t.amount), 0))}
            </p>
          </div>
          <div className="flex-shrink-0 w-36 bg-surface-container-lowest border border-outline-variant p-3 rounded-xl">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Pendentes</p>
            <p className="font-numeric text-sm font-bold text-amber-550 mt-1">
              {isLoading ? '...' : filteredList.filter((t: any) => !t.isPaid).length} itens
            </p>
          </div>
        </div>

        {/* Mobile items listing */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
              <p className="text-xs mt-2">Carregando...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-8 text-center text-xs text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded-xl">
              Nenhuma transação encontrada.
            </div>
          ) : filteredList.map((t: any) => {
            const isReal = isRealData;
            return (
              <div key={t.id} className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl space-y-3 shadow-xs">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <CategoryBadge category={t.category} type={t.type} />
                  <div className="text-sm font-bold">
                    {renderAmount(t)}
                  </div>
                </div>

                {/* Description & Account */}
                <div>
                  <p className="font-bold text-primary text-sm">{t.description || 'Sem descrição'}</p>
                  {t.notes && <p className="text-xs text-on-surface-variant mt-0.5">{t.notes}</p>}
                  <div className="flex items-center justify-between mt-2 text-xs text-on-surface-variant">
                    <span>{formatDateLong(t.date)}</span>
                    <AccountInfo account={t.account} card={t.card} toAccount={t.toAccount} type={t.type} />
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex justify-between items-center pt-2 border-t border-outline-variant/30">
                  <StatusBadge type={t.type} isPaid={t.isPaid} />
                  
                  <div className="flex items-center gap-1">
                    {isReal ? (
                      <>
                        <button
                          onClick={() => togglePaidMutation.mutate({ id: t.id, isPaid: !t.isPaid })}
                          className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
                          title="Atualizar Status"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {t.isPaid ? 'undo' : 'check_circle'}
                          </span>
                        </button>

                        <button
                          onClick={() => setEditingTx(t)}
                          className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>

                        <button
                          onClick={() => setAttachTx(t)}
                          className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant relative"
                          title="Anexos"
                        >
                          <span className="material-symbols-outlined text-[18px]">attach_file</span>
                          {t.attachments?.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-[8px] text-white rounded-full flex items-center justify-center font-bold">
                              {t.attachments.length}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => { if (confirm('Remover este lançamento?')) deleteMutation.mutate(t.id); }}
                          className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-error"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-outline-variant font-bold tracking-widest uppercase">DEMO</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Pagination */}
        {data && data.pages > 1 && (
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-on-surface-variant">Pág. {data.page} de {data.pages}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilters((f: any) => ({ ...f, page: f.page - 1 }))} 
                disabled={data.page === 1}
                className="px-3 py-1 bg-surface-container-lowest border border-outline-variant text-xs font-semibold rounded disabled:opacity-40 text-on-surface-variant"
              >
                Anterior
              </button>
              <button 
                onClick={() => setFilters((f: any) => ({ ...f, page: f.page + 1 }))} 
                disabled={data.page === data.pages}
                className="px-3 py-1 bg-surface-container-lowest border border-outline-variant text-xs font-semibold rounded disabled:opacity-40 text-on-surface-variant"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL: NOVO LANÇAMENTO (Based on Stitch 'novo_lanamento') ─── */}
      {showForm && (
        <Modal title="Novo Lançamento" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-6">
            {/* Transaction Type Radio Selector */}
            <div className="flex flex-col gap-xs">
              <label className="font-label-sm text-[10px] text-outline tracking-wider uppercase font-bold">TIPO DE TRANSAÇÃO</label>
              <div className="inline-flex p-1 bg-surface-container-low rounded-lg w-full">
                {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => {
                  const isActive = transactionType === t;
                  let colorClass = 'text-primary';
                  let icon = 'sync_alt';
                  let label = 'Transferência';
                  
                  if (t === 'EXPENSE') {
                    colorClass = 'text-error';
                    icon = 'arrow_circle_down';
                    label = 'Despesa';
                  } else if (t === 'INCOME') {
                    colorClass = 'text-secondary';
                    icon = 'arrow_circle_up';
                    label = 'Receita';
                  }
                  
                  return (
                    <label 
                      key={t} 
                      className={cn(
                        "flex-grow flex-1 flex items-center justify-center gap-xs py-2 rounded-lg cursor-pointer transition-all text-xs font-bold select-none",
                        isActive ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                      )}
                    >
                      <input 
                        type="radio" 
                        {...register('type')} 
                        value={t} 
                        className="sr-only" 
                        onChange={() => {
                          setValue('type', t);
                          setValue('categoryId', '');
                          setNewSelectedParentId('');
                          setNewSelectedSubId('');
                          setValue('accountId', '');
                          setValue('toAccountId', '');
                          setValue('cardId', '');
                        }}
                      />
                      <span className={cn("material-symbols-outlined text-[16px]", isActive ? 'text-white' : colorClass)}>{icon}</span>
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Value Input */}
              <div className="md:col-span-2 flex flex-col gap-xs">
                <label className="font-label-sm text-[10px] text-outline uppercase font-bold" htmlFor="form-val">VALOR *</label>
                <div className="relative">
                  <Controller
                    control={control}
                    name="amount"
                    render={({ field }) => (
                      <CurrencyInput
                        id="form-val"
                        required
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-numeric text-headline-md outline-none transition-all"
                      />
                    )}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="md:col-span-2 flex flex-col gap-xs">
                <label className="font-label-sm text-[10px] text-outline uppercase font-bold" htmlFor="form-desc">DESCRIÇÃO</label>
                <input 
                  type="text" 
                  id="form-desc" 
                  {...register('description')} 
                  placeholder="Ex: Supermercado Mensal" 
                  className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all text-sm"
                />
              </div>

              {/* Category & Subcategory */}
              {transactionType !== 'TRANSFER' && (
                <>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-sm text-[10px] text-outline uppercase font-bold">CATEGORIA</label>
                    <div className="relative">
                      <select 
                        value={newSelectedParentId}
                        onChange={handleNewParentCategoryChange}
                        className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm"
                      >
                        <option value="">Sem categoria</option>
                        {(categories as any[]).filter((c: any) => c.type === transactionType).map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">keyboard_arrow_down</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-xs">
                    <label className="font-label-sm text-[10px] text-outline uppercase font-bold">SUBCATEGORIA</label>
                    <div className="relative">
                      <select 
                        value={newSelectedSubId}
                        onChange={handleNewSubCategoryChange}
                        disabled={!newSelectedParentId}
                        className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Geral / Nenhuma</option>
                        {newSelectedParentId && categories
                          .find((c: any) => c.id === newSelectedParentId)
                          ?.children?.map((child: any) => (
                            <option key={child.id} value={child.id}>{child.name}</option>
                          ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">keyboard_arrow_down</span>
                    </div>
                  </div>
                </>
              )}

              {/* Date */}
              <div className={cn("flex flex-col gap-xs", transactionType === 'TRANSFER' ? 'md:col-span-2' : '')}>
                <label className="font-label-sm text-[10px] text-outline uppercase font-bold">DATA *</label>
                <input 
                  type="date" 
                  required 
                  {...register('date')} 
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all text-sm"
                />
              </div>

              {/* Account / Credit Card */}
              <div className="flex flex-col gap-xs">
                <label className="font-label-sm text-[10px] text-outline uppercase font-bold">
                  {transactionType === 'TRANSFER' ? 'CONTA ORIGEM *' : 'CONTA *'}
                </label>
                <div className="relative">
                  <select 
                    required 
                    {...register('accountId')} 
                    className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm"
                  >
                    <option value="">Selecionar conta</option>
                    {(displayAccountsSelect as any[]).map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">account_balance</span>
                </div>
              </div>

              {/* Conditional: To Account for Transfer */}
              {transactionType === 'TRANSFER' && (
                <div className="flex flex-col gap-xs">
                  <label className="font-label-sm text-[10px] text-outline uppercase font-bold">CONTA DESTINO *</label>
                  <div className="relative">
                    <select 
                      required 
                      {...register('toAccountId')} 
                      className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm"
                    >
                      <option value="">Selecionar conta</option>
                      {(displayAccountsSelect as any[]).map((a: any) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">account_balance</span>
                  </div>
                </div>
              )}

              {/* Conditional: Card for Expense */}
              {transactionType === 'EXPENSE' && (
                <div className="flex flex-col gap-xs md:col-span-2">
                  <label className="font-label-sm text-[10px] text-outline uppercase font-bold">CARTÃO DE CRÉDITO</label>
                  <div className="relative">
                    <select 
                      {...register('cardId')} 
                      className="w-full appearance-none px-md py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/10 font-body-md outline-none transition-all cursor-pointer text-sm"
                    >
                      <option value="">Nenhum (Debitado da conta)</option>
                      {(displayCardsSelect as any[]).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 pointer-events-none text-outline-variant text-[18px]">credit_card</span>
                  </div>
                </div>
              )}

              {/* Status Radio options */}
              <div className="md:col-span-2 flex flex-col gap-xs pt-2">
                <label className="font-label-sm text-[10px] text-outline uppercase font-bold">STATUS</label>
                <div className="flex items-center gap-md h-10">
                  <label className="flex items-center gap-xs cursor-pointer group text-sm">
                    <input 
                      type="radio" 
                      value="true"
                      defaultChecked={true}
                      {...register('isPaid')} 
                      className="w-4 h-4 text-secondary focus:ring-secondary border-outline-variant bg-surface-container-lowest" 
                    />
                    <span className="text-on-surface-variant group-hover:text-secondary transition-colors font-medium">
                      {transactionType === 'INCOME' ? 'Recebido' : 'Pago / Efetivado'}
                    </span>
                  </label>
                  <label className="flex items-center gap-xs cursor-pointer group text-sm">
                    <input 
                      type="radio" 
                      value="false"
                      {...register('isPaid')} 
                      className="w-4 h-4 text-primary focus:ring-primary border-outline-variant bg-surface-container-lowest" 
                    />
                    <span className="text-on-surface-variant group-hover:text-primary transition-colors font-medium">Pendente</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center justify-end gap-md border-t border-outline-variant">
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="px-5 py-2.5 rounded-lg border border-outline-variant font-label-sm text-xs font-bold text-on-surface-variant hover:bg-surface-container-low transition-all active:scale-[0.98]"
              >
                CANCELAR
              </button>
              <button 
                type="submit" 
                disabled={createMutation.isPending}
                className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-bold hover:opacity-90 shadow-md transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {createMutation.isPending ? 'SALVANDO...' : 'SALVAR LANÇAMENTO'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── MODAL: IMPORTAR EXTRATO (For Mobile) ─── */}
      {showImport && (
        <Modal title="Importar Extrato" onClose={() => { setShowImport(false); setImportResult(null); }}>
          <ImportPanel 
            importFormat={importFormat}
            setImportFormat={setImportFormat}
            importAccountId={importAccountId}
            setImportAccountId={setImportAccountId}
            accounts={accounts}
            importResult={importResult}
            setImportResult={setImportResult}
            importMutation={importMutation}
            importOfxMutation={importOfxMutation}
            importFileRef={importFileRef}
            importOfxFileRef={importOfxFileRef}
          />
        </Modal>
      )}

      {/* ─── MODAL: EDITAR LANÇAMENTO ─── */}
      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          categories={categories}
          accounts={accounts}
          cards={cards}
          isSaving={updateMutation.isPending}
          onSave={(data: any) => updateMutation.mutate({ id: editingTx.id, data })}
        />
      )}

      {/* ─── MODAL: ANEXOS ─── */}
      {attachTx && (
        <Modal title="Anexos do Lançamento" onClose={() => setAttachTx(null)}>
          <div className="space-y-4">
            <div className="bg-surface-container-low rounded-lg p-3">
              <p className="text-sm font-semibold text-primary">{attachTx.description || 'Lançamento'}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">{formatDateLong(attachTx.date)} · {formatCurrency(Number(attachTx.amount))}</p>
            </div>

            {attachTx.attachments?.length > 0 ? (
              <div className="space-y-2">
                {attachTx.attachments.map((url: string) => {
                  const filename = url.split('/').pop() || '';
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
                  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '');
                  return (
                    <div key={url} className="flex items-center gap-3 p-2.5 bg-surface-container rounded-lg">
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                        {isImage ? 'image' : 'description'}
                      </span>
                      <a href={`${apiBase}${url}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 text-sm text-primary hover:text-secondary truncate transition-colors font-medium">
                        {filename}
                      </a>
                      <button onClick={() => removeAttachment.mutate({ id: attachTx.id, filename })}
                        className="text-placeholder hover:text-error transition-colors">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant text-center py-4 bg-surface-container-low rounded-lg">
                Nenhum anexo ainda para este lançamento.
              </p>
            )}

            <input 
              ref={attachFileRef} 
              type="file" 
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment.mutate({ id: attachTx.id, file: f }); }} 
            />
            
            <button 
              onClick={() => attachFileRef.current?.click()} 
              disabled={uploadAttachment.isPending}
              className="w-full border-2 border-dashed border-outline-variant rounded-xl py-6 text-on-surface-variant hover:bg-surface-container transition-colors flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl text-placeholder">cloud_upload</span>
              <span className="text-sm font-semibold">{uploadAttachment.isPending ? 'Enviando...' : 'Adicionar Anexo'}</span>
              <span className="text-[10px] text-placeholder">PDF, imagens ou planilhas até 10 MB</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
