'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getCurrentMonthYear } from '@/lib/utils';

const TYPE_COLORS: Record<string, string> = { INCOME: 'text-[#006c49]', EXPENSE: 'text-red-500', TRANSFER: 'text-blue-500' };
const TYPE_LABELS: Record<string, string> = { INCOME: 'Receita', EXPENSE: 'Despesa', TRANSFER: 'Transferência' };
const TYPE_BG: Record<string, string> = {
  INCOME: 'bg-[#006c49]/10 text-[#006c49]',
  EXPENSE: 'bg-red-500/10 text-red-500',
  TRANSFER: 'bg-blue-500/10 text-blue-500',
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-base sticky top-0 bg-card rounded-t-2xl">
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

export default function TransactionsPage() {
  const qc = useQueryClient();
  const { month, year } = getCurrentMonthYear();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filters, setFilters] = useState<any>({ page: 1, limit: 25 });
  const [selectedType, setSelectedType] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importAccountId, setImportAccountId] = useState('');
  const [importResult, setImportResult] = useState<any>(null);
  const [importFormat, setImportFormat] = useState<'csv' | 'ofx'>('csv');
  const importOfxFileRef = useRef<HTMLInputElement>(null);
  const [attachTx, setAttachTx] = useState<any>(null);
  const attachFileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters],
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

  const { register, handleSubmit, reset, watch } = useForm<any>({ defaultValues: { type: 'EXPENSE', isPaid: true } });
  const transactionType = watch('type');

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/transactions', { ...data, amount: Number(data.amount), isPaid: data.isPaid === 'true' || data.isPaid === true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['monthly-summary'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['household-summary'] });
      toast.success('Lançamento criado!');
      reset({ type: 'EXPENSE', isPaid: true });
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['monthly-summary'] });
      toast.success('Removido!');
    },
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

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) importMutation.mutate(file);
  }

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-base">Transações</h1>
          <p className="text-muted text-sm mt-1">
            {data?.total || 0} lançamentos encontrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 border border-md text-muted px-3 py-2 rounded-lg text-sm hover:bg-card-hover transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Importar CSV
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 border border-md text-muted px-3 py-2 rounded-lg text-sm hover:bg-card-hover transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Exportar CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#031632] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a2550] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Novo lançamento
          </button>
        </div>
      </div>

      {/* Filtros de tipo */}
      <div className="flex gap-2 flex-wrap">
        {[['', 'Todos'], ['INCOME', 'Receitas'], ['EXPENSE', 'Despesas'], ['TRANSFER', 'Transferências']].map(([value, label]) => (
          <button key={value}
            onClick={() => { setSelectedType(value); setFilters((f: any) => ({ ...f, page: 1 })); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedType === value ? 'bg-[#031632] text-white' : 'bg-card border border-md text-muted hover:bg-card-hover'}`}>
            {label}
          </button>
        ))}
        {/* Filtro por período */}
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" onChange={(e) => setFilters((f: any) => ({ ...f, startDate: e.target.value, page: 1 }))}
            className="border border-md rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
          <span className="text-placeholder text-xs">até</span>
          <input type="date" onChange={(e) => setFilters((f: any) => ({ ...f, endDate: e.target.value, page: 1 }))}
            className="border border-md rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl shadow-sm border border-base overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-base bg-subtle/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Data</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Descrição</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Categoria</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Conta / Cartão</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Tipo</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted uppercase tracking-wide">Valor</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-placeholder">Carregando...</td></tr>
            ) : (data?.data || []).length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-placeholder">Nenhum lançamento encontrado.</td></tr>
            ) : (data?.data || []).map((t: any) => (
              <tr key={t.id} className="border-b border-base hover:bg-card-hover/50 transition-colors">
                <td className="px-5 py-3 text-muted whitespace-nowrap">{formatDate(t.date)}</td>
                <td className="px-5 py-3">
                  <p className="font-medium text-base truncate max-w-[200px]">{t.description || '—'}</p>
                  {!t.isPaid && <span className="text-xs text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">Pendente</span>}
                </td>
                <td className="px-5 py-3">
                  {t.category ? (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${t.category.color}20`, color: t.category.color }}>
                      <span className="material-symbols-outlined text-[12px]">{t.category.icon || 'category'}</span>
                      {t.category.name}
                    </span>
                  ) : <span className="text-placeholder text-xs">—</span>}
                </td>
                <td className="px-5 py-3 text-muted text-xs">
                  {t.account?.name || t.card?.name || '—'}
                  {t.toAccount && <span className="text-placeholder"> → {t.toAccount.name}</span>}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BG[t.type]}`}>{TYPE_LABELS[t.type]}</span>
                </td>
                <td className={`px-5 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${TYPE_COLORS[t.type]}`}>
                  {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '−' : ''}{formatCurrency(Number(t.amount))}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setAttachTx(t)}
                      className="text-placeholder hover:text-muted transition-colors relative"
                      title="Anexos"
                    >
                      <span className="material-symbols-outlined text-[18px]">attach_file</span>
                      {t.attachments?.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#006c49] rounded-full text-[9px] text-white flex items-center justify-center">{t.attachments.length}</span>
                      )}
                    </button>
                    <button
                      onClick={() => { if (confirm('Remover este lançamento?')) deleteMutation.mutate(t.id); }}
                      className="text-placeholder hover:text-red-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Paginação */}
        {data && data.pages > 1 && (
          <div className="px-5 py-3 border-t border-base flex items-center justify-between text-sm text-muted">
            <span>Página {data.page} de {data.pages} · {data.total} total</span>
            <div className="flex gap-2">
              <button onClick={() => setFilters((f: any) => ({ ...f, page: f.page - 1 }))} disabled={data.page === 1}
                className="px-3 py-1 rounded border border-md disabled:opacity-40 hover:bg-card-hover">Anterior</button>
              <button onClick={() => setFilters((f: any) => ({ ...f, page: f.page + 1 }))} disabled={data.page === data.pages}
                className="px-3 py-1 rounded border border-md disabled:opacity-40 hover:bg-card-hover">Próxima</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Novo Lançamento */}
      {showForm && (
        <Modal title="Novo Lançamento" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            {/* Tipo */}
            <div className="flex gap-2">
              {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
                <label key={t} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors
                  ${transactionType === t ? (t === 'INCOME' ? 'border-[#006c49] bg-[#006c49]/5 text-[#006c49]' : t === 'EXPENSE' ? 'border-red-500 bg-red-500/5 text-red-500' : 'border-blue-500 bg-blue-500/5 text-blue-500') : 'border-md text-muted hover:border-md'}`}>
                  <input type="radio" {...register('type')} value={t} className="sr-only" />
                  <span className="material-symbols-outlined text-[16px]">{t === 'INCOME' ? 'arrow_downward' : t === 'EXPENSE' ? 'arrow_upward' : 'sync_alt'}</span>
                  {TYPE_LABELS[t]}
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Valor (R$) *</label>
                <input type="number" step="0.01" min="0.01" {...register('amount')} placeholder="0,00"
                  className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Data *</label>
                <input type="date" {...register('date')} defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted block mb-1">Descrição</label>
                <input {...register('description')} placeholder="Ex: Compra no supermercado"
                  className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Categoria</label>
                <select {...register('categoryId')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                  <option value="">Sem categoria</option>
                  {(categories as any[]).filter((c: any) => c.type === transactionType || transactionType === 'TRANSFER').map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted block mb-1">
                  {transactionType === 'TRANSFER' ? 'Conta origem' : 'Conta'}
                </label>
                <select {...register('accountId')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                  <option value="">Selecionar conta</option>
                  {(accounts as any[]).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {transactionType === 'TRANSFER' && (
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Conta destino</label>
                  <select {...register('toAccountId')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                    <option value="">Selecionar conta</option>
                    {(accounts as any[]).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {transactionType === 'EXPENSE' && (
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Cartão</label>
                  <select {...register('cardId')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                    <option value="">Nenhum</option>
                    {(cards as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-2 flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                  <input type="checkbox" {...register('isPaid')} defaultChecked={true} className="rounded border-md text-[#031632] focus:ring-[#031632]" />
                  Lançamento já efetivado
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-base">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-md rounded-lg text-muted hover:bg-card-hover">Cancelar</button>
              <button type="submit" disabled={createMutation.isPending}
                className="px-4 py-2 text-sm bg-[#031632] text-white rounded-lg hover:bg-[#0a2550] disabled:opacity-60">
                {createMutation.isPending ? 'Salvando...' : 'Salvar lançamento'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Import */}
      {showImport && (
        <Modal title="Importar Extrato" onClose={() => { setShowImport(false); setImportResult(null); setImportFormat('csv'); }}>
          <div className="space-y-5">
            {/* Format tabs */}
            <div className="flex gap-1 bg-subtle p-1 rounded-lg">
              {(['csv', 'ofx'] as const).map((fmt) => (
                <button key={fmt} onClick={() => { setImportFormat(fmt); setImportResult(null); }}
                  className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${importFormat === fmt ? 'bg-card text-base shadow-sm' : 'text-muted hover:text-base'}`}>
                  {fmt === 'csv' ? 'CSV' : 'OFX / OFC'}
                </button>
              ))}
            </div>

            <div className="bg-blue-500/10 rounded-lg p-4 text-sm text-blue-400">
              <p className="font-medium mb-1">{importFormat === 'csv' ? 'Formatos CSV suportados' : 'Arquivos OFX suportados'}</p>
              {importFormat === 'csv' ? (
                <ul className="list-disc list-inside space-y-1 text-blue-400/80 text-xs">
                  <li>CSV com colunas: Data, Descrição, Valor (separado por ; ou ,)</li>
                  <li>CSV com colunas separadas de Crédito e Débito</li>
                  <li>Exportações de Nubank, Itaú, Bradesco, Inter, XP e outros</li>
                  <li>Datas nos formatos DD/MM/AAAA ou AAAA-MM-DD</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-blue-400/80 text-xs">
                  <li>Arquivos .ofx e .ofc (Open Financial Exchange)</li>
                  <li>Exportações de internet banking da maioria dos bancos</li>
                  <li>Deduplicação automática por FITID</li>
                  <li>Importação de extratos de conta corrente e poupança</li>
                </ul>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted block mb-1">Vincular lançamentos à conta</label>
              <select value={importAccountId} onChange={(e) => setImportAccountId(e.target.value)}
                className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                <option value="">Sem conta específica</option>
                {(accounts as any[]).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {!importResult ? (
              <div>
                <input ref={importFileRef} type="file" accept=".csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importMutation.mutate(f); }} />
                <input ref={importOfxFileRef} type="file" accept=".ofx,.ofc" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importOfxMutation.mutate(f); }} />
                <button
                  onClick={() => importFormat === 'csv' ? importFileRef.current?.click() : importOfxFileRef.current?.click()}
                  disabled={importMutation.isPending || importOfxMutation.isPending}
                  className="w-full border-2 border-dashed border-md rounded-xl py-8 text-muted hover:border-[#031632]/30 hover:bg-card-hover transition-colors flex flex-col items-center gap-2"
                >
                  <span className="material-symbols-outlined text-4xl text-placeholder">upload_file</span>
                  <span className="text-sm font-medium">
                    {importMutation.isPending || importOfxMutation.isPending
                      ? 'Importando...'
                      : `Clique para selecionar o arquivo ${importFormat.toUpperCase()}`}
                  </span>
                  <span className="text-xs text-placeholder">Máximo 5 MB</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`rounded-xl p-4 ${importResult.imported > 0 ? 'bg-[#006c49]/5 border border-[#006c49]/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-2xl ${importResult.imported > 0 ? 'text-[#006c49]' : 'text-red-500'}`}>
                      {importResult.imported > 0 ? 'check_circle' : 'error'}
                    </span>
                    <div>
                      <p className="font-semibold text-base">{importResult.imported} lançamentos importados</p>
                      {importResult.errors > 0 && <p className="text-xs text-red-500">{importResult.errors} linhas ignoradas por erro de formato</p>}
                    </div>
                  </div>
                </div>
                {importResult.messages?.length > 0 && (
                  <div className="text-xs text-muted space-y-1">
                    {importResult.messages.map((m: string, i: number) => <p key={i}>{m}</p>)}
                  </div>
                )}
                <button
                  onClick={() => {
                    setImportResult(null);
                    if (importFileRef.current) importFileRef.current.value = '';
                    if (importOfxFileRef.current) importOfxFileRef.current.value = '';
                  }}
                  className="text-sm text-muted hover:text-base underline"
                >
                  Importar outro arquivo
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal Anexos */}
      {attachTx && (
        <Modal title="Anexos do Lançamento" onClose={() => setAttachTx(null)}>
          <div className="space-y-4">
            <div className="bg-subtle rounded-lg p-3">
              <p className="text-sm font-medium text-base">{attachTx.description || 'Lançamento'}</p>
              <p className="text-xs text-muted mt-0.5">{formatDate(attachTx.date)} · {formatCurrency(Number(attachTx.amount))}</p>
            </div>

            {attachTx.attachments?.length > 0 ? (
              <div className="space-y-2">
                {attachTx.attachments.map((url: string) => {
                  const filename = url.split('/').pop() || '';
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
                  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '');
                  return (
                    <div key={url} className="flex items-center gap-3 p-2.5 bg-subtle rounded-lg">
                      <span className="material-symbols-outlined text-[20px] text-muted">
                        {isImage ? 'image' : 'description'}
                      </span>
                      <a href={`${apiBase}${url}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 text-sm text-base hover:text-[#006c49] truncate transition-colors">
                        {filename}
                      </a>
                      <button onClick={() => removeAttachment.mutate({ id: attachTx.id, filename })}
                        className="text-placeholder hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-placeholder text-center py-4">Nenhum anexo ainda.</p>
            )}

            <input ref={attachFileRef} type="file" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment.mutate({ id: attachTx.id, file: f }); }} />
            <button onClick={() => attachFileRef.current?.click()} disabled={uploadAttachment.isPending}
              className="w-full border-2 border-dashed border-md rounded-xl py-6 text-muted hover:bg-card-hover transition-colors flex flex-col items-center gap-1.5">
              <span className="material-symbols-outlined text-2xl text-placeholder">cloud_upload</span>
              <span className="text-sm">{uploadAttachment.isPending ? 'Enviando...' : 'Clique para anexar arquivo'}</span>
              <span className="text-xs text-placeholder">PDF, imagens, planilhas — máx 10 MB</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
