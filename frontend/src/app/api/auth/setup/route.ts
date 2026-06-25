export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, unauthorized, serverError } from '@/lib/api-response';

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação',        type: 'EXPENSE', icon: 'restaurant',        color: '#f59e0b' },
  { name: 'Moradia',            type: 'EXPENSE', icon: 'home',              color: '#3b82f6' },
  { name: 'Transporte',         type: 'EXPENSE', icon: 'directions_car',    color: '#8b5cf6' },
  { name: 'Saúde',              type: 'EXPENSE', icon: 'health_and_safety', color: '#ef4444' },
  { name: 'Educação',           type: 'EXPENSE', icon: 'school',            color: '#06b6d4' },
  { name: 'Lazer',              type: 'EXPENSE', icon: 'sports_esports',    color: '#ec4899' },
  { name: 'Vestuário',          type: 'EXPENSE', icon: 'checkroom',         color: '#f97316' },
  { name: 'Contas e Serviços',  type: 'EXPENSE', icon: 'receipt',           color: '#64748b' },
  { name: 'Assinaturas',        type: 'EXPENSE', icon: 'subscriptions',     color: '#7c3aed' },
  { name: 'Pets',               type: 'EXPENSE', icon: 'pets',              color: '#a16207' },
  { name: 'Beleza',             type: 'EXPENSE', icon: 'spa',               color: '#db2777' },
  { name: 'Presentes',          type: 'EXPENSE', icon: 'card_giftcard',     color: '#dc2626' },
  { name: 'Impostos',           type: 'EXPENSE', icon: 'account_balance',   color: '#374151' },
  { name: 'Outros Gastos',      type: 'EXPENSE', icon: 'more_horiz',        color: '#6b7280' },
  { name: 'Salário',            type: 'INCOME',  icon: 'payments',          color: '#10b981' },
  { name: 'Freelance',          type: 'INCOME',  icon: 'work',              color: '#059669' },
  { name: 'Investimentos',      type: 'INCOME',  icon: 'trending_up',       color: '#0d9488' },
  { name: 'Aluguel Recebido',   type: 'INCOME',  icon: 'apartment',         color: '#2563eb' },
  { name: 'Outros Recebimentos',type: 'INCOME',  icon: 'attach_money',      color: '#16a34a' },
] as const;

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7);
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: { user } } = await client.auth.getUser(jwt);
    if (user) return user;
  }
  const { supabase } = createClientFromRequest(req);
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return unauthorized();

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('supabaseId', user.id)
      .maybeSingle();

    if (existing) return ok({ message: 'Perfil já existe' });

    const body = await req.json().catch(() => ({}));
    const name = body.name || user.user_metadata?.full_name || user.user_metadata?.name || user.email!.split('@')[0];
    const householdName = body.householdName || `Casa de ${name.split(' ')[0]}`;
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
    const now = new Date().toISOString();

    const newHouseholdId = crypto.randomUUID();
    const { data: household, error: householdError } = await admin
      .from('households')
      .insert({ id: newHouseholdId, name: householdName, currency: 'BRL', updatedAt: now })
      .select('id')
      .single();

    if (!household) {
      console.error('[auth/setup] household insert error:', householdError?.message);
      return serverError('Erro ao criar família');
    }

    const { error: userError } = await admin.from('users').insert({
      id: crypto.randomUUID(),
      supabaseId: user.id,
      email: user.email!,
      name,
      avatarUrl,
      householdId: household.id,
      updatedAt: now,
    });

    if (userError) {
      console.error('[auth/setup] user insert error:', userError.message);
    }

    await admin.from('categories').insert(
      DEFAULT_CATEGORIES.map((cat) => ({
        id: crypto.randomUUID(),
        ...cat,
        householdId: household.id,
        isDefault: true,
        updatedAt: now,
      }))
    );

    return ok({ message: 'Perfil criado com sucesso' });
  } catch (err) {
    console.error('[auth/setup]', err);
    return serverError();
  }
}
