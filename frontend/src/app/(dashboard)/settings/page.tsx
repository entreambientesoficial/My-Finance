'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

type Tab = 'profile' | 'household' | 'categories' | 'privacy';

const profileSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  avatarUrl: z.string().optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
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
  return '';
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryType, setCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
    queryFn: () => api.get('/api/users/me').then((r) => r.data),
  });

  const { data: household } = useQuery({
    queryKey: ['household'],
    queryFn: () => api.get('/api/households/mine').then((r) => r.data),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['all-categories'],
    queryFn: () => api.get('/api/categories').then((r) => r.data),
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
      return api.post('/api/users/me/avatar', formData, {
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
    mutationFn: (data: ProfileForm) => api.patch('/api/users/me', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); toast.success('Perfil atualizado!'); },
    onError: () => toast.error('Erro ao atualizar perfil'),
  });

  const updatePassword = useMutation({
    mutationFn: (data: PasswordForm) => api.patch('/api/users/me', {
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
    mutationFn: (data: HouseholdForm) => api.patch('/api/households/mine', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['household'] }); toast.success('Configurações salvas!'); },
    onError: () => toast.error('Erro ao salvar'),
  });

  const createCategory = useMutation({
    mutationFn: (data: CategoryForm) => api.post('/api/categories', {
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
    mutationFn: ({ id, data }: { id: string; data: CategoryForm }) => api.patch(`/api/categories/${id}`, {
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
    mutationFn: (id: string) => api.delete(`/api/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria removida.');
    },
    onError: () => toast.error('Não é possível remover categoria com lançamentos vinculados'),
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
        {([['profile', 'Perfil'], ['household', 'Família'], ['categories', 'Categorias'], ['privacy', 'Privacidade']] as [Tab, string][]).map(([t, label]) => (
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

        </div>
      )}

      {/* ── PRIVACIDADE ─────────────────────────────────────────────────────── */}
      {tab === 'privacy' && (
        <div className="space-y-6">

          {/* Cabeçalho LGPD */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-[22px]">shield</span>
              </div>
              <div>
                <h2 className="font-semibold text-base text-on-surface">Política de Privacidade e Proteção de Dados</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">Em conformidade com a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014).</p>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 text-xs text-on-surface-variant leading-relaxed">
              O <strong className="text-on-surface">MY-FINANCE</strong> coleta e trata seus dados pessoais exclusivamente para a prestação do serviço de gestão financeira pessoal e familiar. Nenhum dado é vendido ou compartilhado com terceiros para fins comerciais.
            </div>
          </div>

          {/* Dados coletados */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <h3 className="font-semibold text-sm text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">database</span>
              Dados que Coletamos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { icon: 'person', label: 'Dados Cadastrais', desc: 'Nome, e-mail e senha (armazenada em hash bcrypt, nunca em texto puro).' },
                { icon: 'account_balance', label: 'Dados Financeiros', desc: 'Contas, cartões, transações, investimentos, metas e orçamentos inseridos por você.' },
                { icon: 'photo_camera', label: 'Foto de Perfil', desc: 'Imagem enviada voluntariamente. Armazenada em servidor seguro (Supabase Storage).' },
                { icon: 'analytics', label: 'Dados de Uso', desc: 'Data e hora de acesso para segurança da conta. Não rastreamos comportamento de navegação.' },
              ].map((item) => (
                <div key={item.label} className="flex gap-3 p-3 bg-surface-container-low/50 rounded-lg border border-outline-variant/40">
                  <span className="material-symbols-outlined text-[18px] text-primary/70 flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-on-surface">{item.label}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Finalidade e Base Legal */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <h3 className="font-semibold text-sm text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">gavel</span>
              Finalidade e Base Legal (LGPD Art. 7º)
            </h3>
            <div className="space-y-3">
              {[
                { base: 'Execução de Contrato — Art. 7º, V', desc: 'Seus dados são tratados para viabilizar o serviço que você contratou ao criar sua conta.' },
                { base: 'Legítimo Interesse — Art. 7º, IX', desc: 'Utilizamos logs de acesso para segurança da conta e detecção de acessos indevidos.' },
                { base: 'Consentimento — Art. 7º, I', desc: 'Funcionalidades opcionais (ex: foto de perfil) são ativadas com seu consentimento explícito e podem ser revogadas a qualquer momento.' },
              ].map((item) => (
                <div key={item.base} className="flex gap-3 text-xs">
                  <span className="text-primary font-bold min-w-[10px]">•</span>
                  <div>
                    <span className="font-semibold text-on-surface">{item.base}:</span>
                    <span className="text-on-surface-variant ml-1">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Retenção e Segurança */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <h3 className="font-semibold text-sm text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">lock</span>
              Retenção de Dados e Segurança
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-on-surface-variant">
              <div className="space-y-2">
                <p className="font-semibold text-on-surface">Período de Retenção</p>
                <p className="leading-relaxed">Seus dados são mantidos enquanto sua conta estiver ativa. Após a exclusão da conta, os dados são removidos permanentemente em até <strong className="text-on-surface">30 dias</strong>, salvo obrigações legais em contrário.</p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-on-surface">Medidas de Segurança</p>
                <ul className="space-y-1 leading-relaxed">
                  <li>• Senhas criptografadas com bcrypt</li>
                  <li>• Comunicação via HTTPS/TLS</li>
                  <li>• Banco de dados em ambiente isolado (Supabase)</li>
                  <li>• Autenticação com tokens JWT de curta duração</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Seus Direitos — LGPD Art. 18 */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <h3 className="font-semibold text-sm text-on-surface mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">verified_user</span>
              Seus Direitos como Titular (LGPD Art. 18)
            </h3>
            <p className="text-xs text-on-surface-variant mb-4">Você pode exercer os seguintes direitos a qualquer momento, gratuitamente:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { icon: 'search', right: 'Confirmação e Acesso', desc: 'Confirmar se tratamos seus dados e acessar cópia completa.' },
                { icon: 'edit', right: 'Correção', desc: 'Corrigir dados incompletos, inexatos ou desatualizados.' },
                { icon: 'download', right: 'Portabilidade', desc: 'Receber seus dados em formato estruturado (CSV/JSON).' },
                { icon: 'delete_forever', right: 'Eliminação', desc: 'Solicitar exclusão dos dados tratados com base em consentimento.' },
                { icon: 'block', right: 'Revogação do Consentimento', desc: 'Revogar o consentimento para tratamentos opcionais a qualquer momento.' },
                { icon: 'info', right: 'Informação sobre Compartilhamento', desc: 'Saber com quais entidades seus dados foram compartilhados.' },
              ].map((item) => (
                <div key={item.right} className="flex gap-2.5 p-2.5 rounded-lg bg-surface-container-low/40 border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[16px] text-secondary flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div className="text-xs">
                    <p className="font-semibold text-on-surface">{item.right}</p>
                    <p className="text-on-surface-variant mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Encarregado / DPO */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-outline-variant">
            <h3 className="font-semibold text-sm text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">contact_mail</span>
              Controlador e Encarregado de Dados (DPO)
            </h3>
            <div className="text-xs text-on-surface-variant space-y-1.5 leading-relaxed">
              <p><strong className="text-on-surface">Controlador:</strong> MY-FINANCE — Gestão Financeira Pessoal</p>
              <p><strong className="text-on-surface">Encarregado (DPO):</strong> Responsável pela privacidade e proteção de dados</p>
              <p><strong className="text-on-surface">Contato:</strong> privacidade@myfinance.com.br</p>
              <p className="mt-2 italic">Para exercer qualquer direito previsto na LGPD ou esclarecer dúvidas sobre o tratamento de seus dados, entre em contato pelo e-mail acima. Respondemos em até 15 dias úteis.</p>
            </div>
          </div>

          {/* Zona de Perigo */}
          <div className="bg-card rounded-xl p-6 shadow-sm border border-error/30">
            <h3 className="font-semibold text-sm text-error mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              Exportar e Encerrar Conta
            </h3>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant/60">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Exportar meus dados</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Baixe uma cópia completa de todos os seus dados financeiros em formato CSV (exercício do direito de portabilidade — LGPD Art. 18, V).</p>
                </div>
                <a
                  href="/api/reports/export/transactions.csv"
                  download
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 border border-outline-variant rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container transition-colors whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Baixar CSV
                </a>
              </div>

              <div className="flex items-start justify-between gap-4 p-4 bg-error/5 rounded-lg border border-error/20">
                <div>
                  <p className="text-sm font-semibold text-error">Excluir minha conta</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Remove permanentemente sua conta e todos os dados financeiros associados. Esta ação é irreversível e não pode ser desfeita.</p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-error text-on-error rounded-lg text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  Excluir conta
                </button>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-on-surface-variant/60 text-center pb-2">
            Política de Privacidade MY-FINANCE · Última atualização: Junho de 2026 · Em conformidade com a LGPD (Lei 13.709/2018)
          </p>
        </div>
      )}

      {/* ── MODAL: EXCLUIR CONTA ─────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-error/30 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-outline-variant flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-error text-[20px]">delete_forever</span>
              </div>
              <div>
                <h2 className="font-bold text-base text-error">Excluir conta permanentemente</h2>
                <p className="text-xs text-on-surface-variant">Esta ação não pode ser revertida</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-error/5 border border-error/20 rounded-lg p-3 text-xs text-on-surface-variant space-y-1.5 leading-relaxed">
                <p>Ao confirmar, serão excluídos permanentemente:</p>
                <ul className="space-y-1 ml-2">
                  <li>• Sua conta e dados de perfil</li>
                  <li>• Todas as contas bancárias e cartões</li>
                  <li>• Todo o histórico de transações</li>
                  <li>• Investimentos, metas e orçamentos</li>
                </ul>
                <p className="mt-2 font-medium text-error">Os dados serão removidos em até 30 dias conforme a LGPD.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">
                  Para confirmar, digite <span className="text-error font-bold">EXCLUIR</span> abaixo:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="EXCLUIR"
                  className="w-full border border-outline-variant bg-surface-container-lowest rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-error/20 focus:border-error text-on-surface"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2 border-t border-outline-variant/60">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                  className="px-4 py-2 text-sm border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmText !== 'EXCLUIR'}
                  onClick={() => {
                    toast.error('Funcionalidade disponível em breve. Entre em contato com privacidade@myfinance.com.br para solicitar a exclusão.');
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                  }}
                  className="px-4 py-2 text-sm bg-error text-on-error rounded-lg font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  Excluir permanentemente
                </button>
              </div>
            </div>
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
