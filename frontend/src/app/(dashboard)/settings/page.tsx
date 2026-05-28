'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

type Tab = 'profile' | 'household' | 'categories';

const profileSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  avatarUrl: z.string().url('URL inválida').optional().or(z.literal('')),
});

const householdSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  currency: z.string().min(3).max(3),
});

const categorySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  type: z.enum(['INCOME', 'EXPENSE']),
  icon: z.string().optional(),
  color: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;
type HouseholdForm = z.infer<typeof householdSchema>;
type CategoryForm = z.infer<typeof categorySchema>;

const ICONS = ['restaurant', 'home', 'directions_car', 'health_and_safety', 'school', 'sports_esports', 'checkroom', 'receipt', 'subscriptions', 'pets', 'spa', 'card_giftcard', 'account_balance', 'more_horiz', 'payments', 'work', 'trending_up', 'apartment', 'attach_money', 'shopping_cart', 'flight', 'fitness_center'];
const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#64748b', '#10b981', '#059669', '#0d9488', '#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#a16207', '#db2777', '#374151', '#6b7280'];

export default function SettingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryType, setCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
  });

  const { data: household } = useQuery({
    queryKey: ['household'],
    queryFn: () => api.get('/households/mine').then((r) => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['all-categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const profileForm = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });
  const householdForm = useForm<HouseholdForm>({ resolver: zodResolver(householdSchema) });
  const categoryForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: { type: 'EXPENSE', color: '#f59e0b', icon: 'more_horiz' } });

  useEffect(() => { if (me) profileForm.reset({ name: me.name, avatarUrl: me.avatarUrl || '' }); }, [me]);
  useEffect(() => { if (household) householdForm.reset({ name: household.name, currency: household.currency }); }, [household]);

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/users/me', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); toast.success('Perfil atualizado!'); },
    onError: () => toast.error('Erro ao atualizar perfil'),
  });

  const updateHousehold = useMutation({
    mutationFn: (data: HouseholdForm) => api.patch('/households/mine', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['household'] }); toast.success('Configurações salvas!'); },
    onError: () => toast.error('Erro ao salvar'),
  });

  const createCategory = useMutation({
    mutationFn: (data: CategoryForm) => api.post('/categories', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria criada!');
      categoryForm.reset({ type: 'EXPENSE', color: '#f59e0b', icon: 'more_horiz' });
      setShowCategoryForm(false);
    },
    onError: () => toast.error('Erro ao criar categoria'),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria removida.');
    },
    onError: () => toast.error('Não é possível remover categoria com lançamentos vinculados'),
  });

  const [inviteEmail, setInviteEmail] = useState('');

  const { data: invites = [] } = useQuery({
    queryKey: ['invites'],
    queryFn: () => api.get('/households/invites').then((r) => r.data),
    enabled: tab === 'household',
  });

  const sendInvite = useMutation({
    mutationFn: (email: string) => api.post('/households/invite', { email }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites'] });
      toast.success('Convite enviado!');
      setInviteEmail('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao enviar convite'),
  });

  const cancelInvite = useMutation({
    mutationFn: (id: string) => api.delete(`/households/invites/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invites'] }); toast.success('Convite cancelado.'); },
  });

  const expenseCategories = (categories as any[]).filter((c: any) => c.type === 'EXPENSE');
  const incomeCategories = (categories as any[]).filter((c: any) => c.type === 'INCOME');

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-base">Configurações</h1>
        <p className="text-muted text-sm mt-1">Gerencie seu perfil e preferências</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-subtle p-1 rounded-lg w-fit">
        {([['profile', 'Perfil'], ['household', 'Família'], ['categories', 'Categorias']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-card text-base shadow-sm' : 'text-muted hover:text-base'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PERFIL ──────────────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="bg-card rounded-xl p-6 shadow-sm border border-base">
          <h2 className="font-semibold text-base mb-5">Dados pessoais</h2>

          {me && (
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-base">
              <div className="w-14 h-14 rounded-full bg-[#031632] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                {me.avatarUrl ? (
                  <img src={me.avatarUrl} alt={me.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  me.name?.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="font-semibold text-base">{me.name}</p>
                <p className="text-sm text-muted">{me.email}</p>
              </div>
            </div>
          )}

          <form onSubmit={profileForm.handleSubmit((d) => updateProfile.mutate(d))} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted block mb-1">Nome completo</label>
              <input {...profileForm.register('name')} className="w-full border border-md rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]" />
              {profileForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.name.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-muted block mb-1">URL do avatar <span className="text-placeholder font-normal">(opcional)</span></label>
              <input {...profileForm.register('avatarUrl')} placeholder="https://..." className="w-full border border-md rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]" />
              {profileForm.formState.errors.avatarUrl && <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.avatarUrl.message}</p>}
            </div>

            <div className="pt-2">
              <button type="submit" disabled={updateProfile.isPending} className="bg-[#031632] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0a2550] disabled:opacity-60 transition-colors">
                {updateProfile.isPending ? 'Salvando...' : 'Salvar perfil'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── FAMÍLIA ─────────────────────────────────────────────────────────── */}
      {tab === 'household' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl p-6 shadow-sm border border-base">
            <h2 className="font-semibold text-base mb-5">Configurações da família</h2>
            <form onSubmit={householdForm.handleSubmit((d) => updateHousehold.mutate(d))} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted block mb-1">Nome da família</label>
                <input {...householdForm.register('name')} className="w-full border border-md rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]" />
                {householdForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{householdForm.formState.errors.name.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-muted block mb-1">Moeda padrão</label>
                <select {...householdForm.register('currency')} className="w-full border border-md rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]">
                  <option value="BRL">BRL — Real Brasileiro</option>
                  <option value="USD">USD — Dólar Americano</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — Libra Esterlina</option>
                  <option value="ARS">ARS — Peso Argentino</option>
                </select>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={updateHousehold.isPending} className="bg-[#031632] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0a2550] disabled:opacity-60 transition-colors">
                  {updateHousehold.isPending ? 'Salvando...' : 'Salvar configurações'}
                </button>
              </div>
            </form>
          </div>

          {household?.users && (
            <div className="bg-card rounded-xl p-6 shadow-sm border border-base">
              <h2 className="font-semibold text-base mb-4">Membros</h2>
              <div className="space-y-3">
                {household.users.map((user: any) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#031632] flex items-center justify-center text-white text-sm font-bold">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" /> : user.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-base">{user.name}</p>
                      <p className="text-xs text-placeholder">{user.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Convidar membro */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-base">
            <h2 className="font-semibold text-base mb-1">Convidar membro</h2>
            <p className="text-xs text-muted mb-4">A pessoa receberá um link por e-mail para criar a conta e entrar na família.</p>
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 border border-md rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]"
              />
              <button
                onClick={() => inviteEmail && sendInvite.mutate(inviteEmail)}
                disabled={sendInvite.isPending || !inviteEmail}
                className="bg-[#031632] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0a2550] disabled:opacity-60 transition-colors"
              >
                {sendInvite.isPending ? 'Enviando...' : 'Enviar convite'}
              </button>
            </div>

            {/* Convites pendentes */}
            {(invites as any[]).length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted mb-2">Convites pendentes</p>
                <div className="space-y-2">
                  {(invites as any[]).map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between py-2 border-b border-base last:border-0">
                      <div>
                        <p className="text-sm text-base">{inv.email}</p>
                        <p className="text-xs text-placeholder">Expira: {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <button
                        onClick={() => cancelInvite.mutate(inv.id)}
                        className="text-xs text-red-400 hover:text-red-500 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CATEGORIAS ──────────────────────────────────────────────────────── */}
      {tab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-subtle p-1 rounded-lg">
              {(['EXPENSE', 'INCOME'] as const).map((t) => (
                <button key={t} onClick={() => setCategoryType(t)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${categoryType === t ? 'bg-card text-base shadow-sm' : 'text-muted hover:text-base'}`}>
                  {t === 'EXPENSE' ? 'Despesas' : 'Receitas'}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowCategoryForm(true); categoryForm.setValue('type', categoryType); }}
              className="flex items-center gap-1.5 bg-[#031632] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#0a2550] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Nova categoria
            </button>
          </div>

          {showCategoryForm && (
            <div className="bg-card rounded-xl p-5 shadow-sm border border-base">
              <h3 className="font-semibold text-base mb-4">Nova Categoria</h3>
              <form onSubmit={categoryForm.handleSubmit((d) => createCategory.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Nome *</label>
                    <input {...categoryForm.register('name')} placeholder="Ex: Academia" className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]" />
                    {categoryForm.formState.errors.name && <p className="text-red-500 text-xs mt-0.5">{categoryForm.formState.errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Tipo</label>
                    <select {...categoryForm.register('type')} className="w-full border border-md rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#031632]">
                      <option value="EXPENSE">Despesa</option>
                      <option value="INCOME">Receita</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted block mb-2">Ícone</label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {ICONS.map((icon) => (
                      <button key={icon} type="button"
                        onClick={() => categoryForm.setValue('icon', icon)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${categoryForm.watch('icon') === icon ? 'bg-[#031632] text-white' : 'bg-subtle text-muted hover:bg-card-hover'}`}>
                        <span className="material-symbols-outlined text-[16px]">{icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted block mb-2">Cor</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color) => (
                      <button key={color} type="button"
                        onClick={() => categoryForm.setValue('color', color)}
                        className="w-6 h-6 rounded-full border-2 transition-all"
                        style={{ backgroundColor: color, borderColor: categoryForm.watch('color') === color ? '#031632' : 'transparent' }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowCategoryForm(false)} className="px-4 py-2 text-sm border border-md rounded-lg text-muted hover:bg-card-hover">Cancelar</button>
                  <button type="submit" disabled={createCategory.isPending} className="px-4 py-2 text-sm bg-[#031632] text-white rounded-lg hover:bg-[#0a2550] disabled:opacity-60">
                    {createCategory.isPending ? 'Salvando...' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de categorias */}
          <div className="bg-card rounded-xl shadow-sm border border-base overflow-hidden">
            {(categoryType === 'EXPENSE' ? expenseCategories : incomeCategories).length === 0 ? (
              <div className="text-center py-10 text-placeholder">
                <span className="material-symbols-outlined text-3xl block mb-2">category</span>
                <p className="text-sm">Nenhuma categoria encontrada.</p>
              </div>
            ) : (
              <div className="divide-y divide-border-base">
                {(categoryType === 'EXPENSE' ? expenseCategories : incomeCategories).map((cat: any) => (
                  <div key={cat.id} className="flex items-center justify-between px-5 py-3 hover:bg-card-hover/50 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}20` }}>
                        <span className="material-symbols-outlined text-[16px]" style={{ color: cat.color }}>{cat.icon || 'category'}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-base">{cat.name}</p>
                        <p className="text-xs text-placeholder">{cat.isDefault ? 'Padrão' : 'Personalizada'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      {!cat.isDefault && (
                        <button
                          onClick={() => { if (confirm(`Remover "${cat.name}"?`)) deleteCategory.mutate(cat.id); }}
                          className="opacity-0 group-hover:opacity-100 text-placeholder hover:text-red-500 transition-all"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
