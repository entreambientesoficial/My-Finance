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
  avatarUrl: z.string().optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
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
  parentId: z.string().optional().or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;
type HouseholdForm = z.infer<typeof householdSchema>;
type CategoryForm = z.infer<typeof categorySchema>;

const ICONS = ['restaurant', 'home', 'directions_car', 'health_and_safety', 'school', 'sports_esports', 'checkroom', 'receipt', 'subscriptions', 'pets', 'spa', 'card_giftcard', 'account_balance', 'more_horiz', 'payments', 'work', 'trending_up', 'apartment', 'attach_money', 'shopping_cart', 'flight', 'fitness_center'];

const COLORS = [
  '#f59e0b', // Alimentação
  '#3b82f6', // Moradia
  '#8b5cf6', // Transporte
  '#ef4444', // Saúde
  '#06b6d4', // Educação
  '#ec4899', // Lazer
  '#f97316', // Vestuário
  '#64748b', // Contas e Serviços
  '#7c3aed', // Assinaturas
  '#a16207', // Pets
  '#db2777', // Beleza
  '#dc2626', // Presentes
  '#374151', // Impostos
  '#6b7280', // Outros Gastos
  '#10b981', // Salário
  '#059669', // Freelance
  '#0d9488', // Investimentos
  '#2563eb', // Aluguel Recebido
  '#16a34a', // Outros Recebimentos
];

const getAvatarUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `http://localhost:3001${url}`;
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryType, setCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const householdForm = useForm<HouseholdForm>({ resolver: zodResolver(householdSchema) });
  const categoryForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: { type: 'EXPENSE', color: '#f59e0b', icon: 'more_horiz', parentId: '' } });

  useEffect(() => { if (me) profileForm.reset({ name: me.name, avatarUrl: me.avatarUrl || '' }); }, [me]);
  useEffect(() => { if (household) householdForm.reset({ name: household.name, currency: household.currency }); }, [household]);

  const watchedAvatarUrl = profileForm.watch('avatarUrl');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['me'] });
      profileForm.setValue('avatarUrl', res.data.avatarUrl);
      toast.success('Foto de perfil atualizada!');
    },
    onError: () => toast.error('Erro ao fazer upload da imagem'),
    onSettled: () => setIsUploading(false),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      uploadAvatar.mutate(file);
    }
  };

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/users/me', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); toast.success('Perfil atualizado!'); },
    onError: () => toast.error('Erro ao atualizar perfil'),
  });

  const updatePassword = useMutation({
    mutationFn: (data: PasswordForm) => api.patch('/users/me', {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    }),
    onSuccess: () => {
      toast.success('Senha alterada com sucesso!');
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erro ao alterar senha');
    }
  });

  const updateHousehold = useMutation({
    mutationFn: (data: HouseholdForm) => api.patch('/households/mine', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['household'] }); toast.success('Configurações salvas!'); },
    onError: () => toast.error('Erro ao salvar'),
  });

  const createCategory = useMutation({
    mutationFn: (data: CategoryForm) => api.post('/categories', {
      ...data,
      parentId: data.parentId || null
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria criada!');
      categoryForm.reset({ type: categoryType, color: '#f59e0b', icon: 'more_horiz', parentId: '' });
      setShowCategoryForm(false);
    },
    onError: () => toast.error('Erro ao criar categoria'),
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryForm }) => api.patch(`/categories/${id}`, {
      ...data,
      parentId: data.parentId || null
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria atualizada!');
      categoryForm.reset({ type: categoryType, color: '#f59e0b', icon: 'more_horiz', parentId: '' });
      setEditingCategory(null);
      setShowCategoryForm(false);
    },
    onError: () => toast.error('Erro ao atualizar categoria'),
  });

  const onSubmitCategory = (d: CategoryForm) => {
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, data: d });
    } else {
      createCategory.mutate(d);
    }
  };

  const handleEditClick = (cat: any) => {
    setEditingCategory(cat);
    setShowCategoryForm(true);
    categoryForm.reset({
      name: cat.name,
      type: cat.type,
      icon: cat.icon || 'more_horiz',
      color: cat.color || '#f59e0b',
      parentId: cat.parentId || '',
    });
  };

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

  const sortByName = (arr: any[]) => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const expenseCategories = sortByName((categories as any[]).filter((c: any) => c.type === 'EXPENSE'))
    .map((cat: any) => ({ ...cat, children: sortByName(cat.children || []) }));
  const incomeCategories = sortByName((categories as any[]).filter((c: any) => c.type === 'INCOME'))
    .map((cat: any) => ({ ...cat, children: sortByName(cat.children || []) }));

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Configurações</h1>
        <p className="text-on-surface-variant text-sm mt-1">Gerencie seu perfil e preferências</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container p-1 rounded-xl w-fit border border-outline-variant/60">
        {([['profile', 'Perfil'], ['household', 'Família'], ['categories', 'Categorias']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${tab === t ? 'bg-primary text-on-primary shadow-sm scale-[1.02]' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PERFIL ──────────────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <h2 className="font-semibold text-base text-on-surface mb-5">Dados pessoais</h2>

            {me && (
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-outline-variant">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-xl font-bold flex-shrink-0 overflow-hidden relative border border-outline-variant cursor-pointer group hover:opacity-90 transition-all shadow-sm"
                  title="Clique para alterar foto"
                >
                  {isUploading ? (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                      <span className="material-symbols-outlined text-white animate-spin text-lg">sync</span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                      <span className="material-symbols-outlined text-white text-lg">photo_camera</span>
                    </div>
                  )}
                  {watchedAvatarUrl || me.avatarUrl ? (
                    <img 
                      src={getAvatarUrl(watchedAvatarUrl || me.avatarUrl)} 
                      alt={me.name} 
                      className="w-full h-full rounded-full object-cover" 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }} 
                    />
                  ) : null}
                  <span className="absolute inset-0 flex items-center justify-center bg-primary-container text-on-primary-container text-xl font-bold select-none -z-10">
                    {me.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-base text-on-surface">{me.name}</p>
                  <p className="text-sm text-on-surface-variant">{me.email}</p>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-primary font-semibold mt-1 hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">upload</span>
                    Alterar foto (Local)
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={profileForm.handleSubmit((d) => updateProfile.mutate(d))} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Nome completo</label>
                <input {...profileForm.register('name')} className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface" />
                {profileForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.name.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">URL do avatar <span className="text-on-surface-variant/60 font-normal">(opcional)</span></label>
                <input {...profileForm.register('avatarUrl')} placeholder="https://..." className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface" />
                {profileForm.formState.errors.avatarUrl && <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.avatarUrl.message}</p>}
              </div>

              <div className="pt-2">
                <button type="submit" disabled={updateProfile.isPending} className="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]">
                  {updateProfile.isPending ? 'Salvando...' : 'Salvar perfil'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <h2 className="font-semibold text-base text-on-surface mb-5">Alterar senha</h2>
            <form onSubmit={passwordForm.handleSubmit((d) => updatePassword.mutate(d))} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Senha atual</label>
                <input type="password" {...passwordForm.register('currentPassword')} className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface" />
                {passwordForm.formState.errors.currentPassword && <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.currentPassword.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Nova senha</label>
                <input type="password" {...passwordForm.register('newPassword')} className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface" />
                {passwordForm.formState.errors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.newPassword.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Confirmar nova senha</label>
                <input type="password" {...passwordForm.register('confirmPassword')} className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface" />
                {passwordForm.formState.errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>}
              </div>

              <div className="pt-2">
                <button type="submit" disabled={updatePassword.isPending} className="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]">
                  {updatePassword.isPending ? 'Alterando...' : 'Alterar senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FAMÍLIA ─────────────────────────────────────────────────────────── */}
      {tab === 'household' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <h2 className="font-semibold text-base text-on-surface mb-5">Configurações da família</h2>
            <form onSubmit={householdForm.handleSubmit((d) => updateHousehold.mutate(d))} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Nome da família</label>
                <input {...householdForm.register('name')} autoComplete="off" className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface" />
                {householdForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{householdForm.formState.errors.name.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-on-surface-variant block mb-1">Moeda padrão</label>
                <select {...householdForm.register('currency')} className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface">
                  <option value="BRL">BRL — Real Brasileiro</option>
                  <option value="USD">USD — Dólar Americano</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — Libra Esterlina</option>
                  <option value="ARS">ARS — Peso Argentino</option>
                </select>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={updateHousehold.isPending} className="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]">
                  {updateHousehold.isPending ? 'Salvando...' : 'Salvar configurações'}
                </button>
              </div>
            </form>
          </div>

          {household?.users && (
            <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
              <h2 className="font-semibold text-base text-on-surface mb-4">Membros</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {household.users.map((user: any) => {
                  const isMe = user.id === me?.id;
                  return (
                    <div key={user.id} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/60 shadow-xs relative overflow-hidden">
                      <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-sm font-bold flex-shrink-0 overflow-hidden border border-outline-variant">
                        {user.avatarUrl ? <img src={getAvatarUrl(user.avatarUrl)} alt={user.name} className="w-full h-full rounded-full object-cover" /> : user.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-on-surface truncate flex items-center gap-1.5">
                          {user.name}
                          {isMe && <span className="bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Você</span>}
                        </p>
                        <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Convidar membro */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <h2 className="font-semibold text-base text-on-surface mb-1">Convidar membro</h2>
            <p className="text-xs text-on-surface-variant mb-4">A pessoa receberá um link por e-mail para criar a conta e entrar na família.</p>
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface"
              />
              <button
                onClick={() => inviteEmail && sendInvite.mutate(inviteEmail)}
                disabled={sendInvite.isPending || !inviteEmail}
                className="bg-primary text-on-primary px-4 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]"
              >
                {sendInvite.isPending ? 'Enviando...' : 'Enviar convite'}
              </button>
            </div>

            {/* Convites pendentes */}
            {(invites as any[]).length > 0 && (
              <div className="mt-4 border-t border-outline-variant/60 pt-4">
                <p className="text-xs font-semibold text-on-surface-variant mb-2">Convites pendentes</p>
                <div className="space-y-2">
                  {(invites as any[]).map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between py-2 border-b border-outline-variant/30 last:border-0">
                      <div>
                        <p className="text-sm text-on-surface font-medium">{inv.email}</p>
                        <p className="text-xs text-on-surface-variant">Expira: {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <button
                        onClick={() => cancelInvite.mutate(inv.id)}
                        className="text-xs text-red-500 hover:text-red-600 transition-colors font-semibold px-2.5 py-1 hover:bg-red-500/10 rounded-lg"
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
            <div className="flex gap-1 bg-surface-container p-1 rounded-xl border border-outline-variant/60">
              {(['EXPENSE', 'INCOME'] as const).map((t) => (
                <button key={t} onClick={() => setCategoryType(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${categoryType === t ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}>
                  {t === 'EXPENSE' ? 'Despesas' : 'Receitas'}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setEditingCategory(null);
                setShowCategoryForm(true);
                categoryForm.reset({
                  name: '',
                  type: categoryType,
                  color: '#f59e0b',
                  icon: 'more_horiz',
                  parentId: '',
                });
              }}
              className="flex items-center gap-1.5 bg-primary text-on-primary px-3 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Nova categoria
            </button>
          </div>

          {showCategoryForm && (
            <div className="bg-card rounded-xl p-5 shadow-sm border border-outline-variant">
              <h3 className="font-semibold text-base text-on-surface mb-4">
                {editingCategory ? 'Editar Categoria / Subcategoria' : 'Nova Categoria / Subcategoria'}
              </h3>
              <form onSubmit={categoryForm.handleSubmit(onSubmitCategory)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant block mb-1">Nome *</label>
                    <input {...categoryForm.register('name')} placeholder="Ex: Cinema" className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface" />
                    {categoryForm.formState.errors.name && <p className="text-red-500 text-xs mt-0.5">{categoryForm.formState.errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant block mb-1">Tipo</label>
                    <select {...categoryForm.register('type')} className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface" disabled={!!categoryForm.watch('parentId')}>
                      <option value="EXPENSE">Despesa</option>
                      <option value="INCOME">Receita</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant block mb-1">Categoria Pai <span className="text-on-surface-variant/60 font-normal">(Opcional)</span></label>
                    <select
                      {...categoryForm.register('parentId')}
                      className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary text-on-surface"
                      onChange={(e) => {
                        const val = e.target.value;
                        categoryForm.setValue('parentId', val || undefined);
                        if (val) {
                          const parent = categories.find((c: any) => c.id === val);
                          if (parent) {
                            categoryForm.setValue('type', parent.type);
                          }
                        }
                      }}
                    >
                      <option value="">Nenhuma (Categoria Principal)</option>
                      {(categoryForm.watch('type') === 'EXPENSE' ? expenseCategories : incomeCategories).map((parent: any) => (
                        <option key={parent.id} value={parent.id}>{parent.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-on-surface-variant block mb-2">Ícone</label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto border border-outline-variant/60 p-2 rounded-lg bg-surface-container-low/40">
                    {ICONS.map((icon) => (
                      <button key={icon} type="button"
                        onClick={() => categoryForm.setValue('icon', icon)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${categoryForm.watch('icon') === icon ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'}`}>
                        <span className="material-symbols-outlined text-[16px]">{icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-on-surface-variant block mb-2">Cor</label>
                  <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-surface-container-low/40 border border-outline-variant/60">
                    {COLORS.map((color) => (
                      <button key={color} type="button"
                        onClick={() => categoryForm.setValue('color', color)}
                        className="w-6 h-6 rounded-full border-2 transition-all active:scale-95"
                        style={{ backgroundColor: color, borderColor: categoryForm.watch('color') === color ? 'var(--primary)' : 'transparent' }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-2 border-t border-outline-variant/60">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategoryForm(false);
                      setEditingCategory(null);
                      categoryForm.reset({ type: categoryType, color: '#f59e0b', icon: 'more_horiz', parentId: '' });
                    }}
                    className="px-4 py-2 text-sm border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createCategory.isPending || updateCategory.isPending}
                    className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg font-bold hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.98]"
                  >
                    {createCategory.isPending || updateCategory.isPending ? 'Salvando...' : (editingCategory ? 'Salvar' : 'Criar')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de categorias e subcategorias */}
          <div className="bg-card rounded-xl shadow-sm border border-outline-variant overflow-hidden">
            {(categoryType === 'EXPENSE' ? expenseCategories : incomeCategories).length === 0 ? (
              <div className="text-center py-10 text-on-surface-variant/60">
                <span className="material-symbols-outlined text-3xl block mb-2">category</span>
                <p className="text-sm">Nenhuma categoria encontrada.</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {(categoryType === 'EXPENSE' ? expenseCategories : incomeCategories).map((cat: any) => {
                  const isExpanded = expandedCategories.has(cat.id);
                  const hasChildren = cat.children && cat.children.length > 0;
                  return (
                    <div key={cat.id} className="divide-y divide-outline-variant/30 bg-card">
                      {/* Categoria Principal */}
                      <div
                        className={`flex items-center justify-between px-5 py-3.5 group ${hasChildren ? 'cursor-pointer hover:bg-surface-container-low/50' : 'hover:bg-card-hover/40'} transition-colors`}
                        onClick={() => hasChildren && toggleCategory(cat.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-outline-variant/20" style={{ backgroundColor: `${cat.color}15` }}>
                            <span className="material-symbols-outlined text-[18px]" style={{ color: cat.color }}>{cat.icon || 'category'}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{cat.name}</p>
                            <p className="text-xs text-on-surface-variant">
                              {cat.isDefault ? 'Padrão' : 'Personalizada'} • {cat.children?.length || 0} subcategor{cat.children?.length === 1 ? 'ia' : 'ias'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full mr-1" style={{ backgroundColor: cat.color }} />
                          {hasChildren && (
                            <span
                              className={`material-symbols-outlined text-[18px] text-on-surface-variant/60 transition-transform duration-200 mr-1 ${isExpanded ? 'rotate-180' : ''}`}
                            >
                              expand_more
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditClick(cat); }}
                            className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-primary transition-all p-1 hover:bg-surface-container rounded-lg"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm(`Remover categoria "${cat.name}" e todas as suas subcategorias?`)) deleteCategory.mutate(cat.id); }}
                            className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-red-500 transition-all p-1 hover:bg-surface-container rounded-lg"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Subcategorias (Children) — colapsáveis */}
                      {hasChildren && isExpanded && (
                        <div className="bg-surface-container-lowest/50 pl-14 pr-5 py-2 space-y-1.5 border-t border-outline-variant/20">
                          {cat.children.map((sub: any) => (
                            <div key={sub.id} className="flex items-center justify-between py-1 border-b border-outline-variant/10 last:border-0 group/sub">
                              <div className="flex items-center gap-2 py-0.5">
                                <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">subdirectory_arrow_right</span>
                                <span className="text-xs font-semibold text-on-surface">{sub.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleEditClick(sub)}
                                  className="opacity-0 group-hover/sub:opacity-100 text-on-surface-variant hover:text-primary transition-all p-0.5 hover:bg-surface-container rounded"
                                  title="Editar"
                                >
                                  <span className="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                                <button
                                  onClick={() => { if (confirm(`Remover subcategoria "${sub.name}"?`)) deleteCategory.mutate(sub.id); }}
                                  className="opacity-0 group-hover/sub:opacity-100 text-on-surface-variant hover:text-red-500 transition-all p-0.5 hover:bg-surface-container rounded"
                                  title="Excluir"
                                >
                                  <span className="material-symbols-outlined text-[14px]">delete</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
