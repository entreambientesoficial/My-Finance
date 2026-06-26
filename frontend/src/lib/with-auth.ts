import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { unauthorized } from './api-response';

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação',         type: 'EXPENSE', icon: 'restaurant',        color: '#f59e0b' },
  { name: 'Moradia',             type: 'EXPENSE', icon: 'home',              color: '#3b82f6' },
  { name: 'Transporte',          type: 'EXPENSE', icon: 'directions_car',    color: '#8b5cf6' },
  { name: 'Saúde',               type: 'EXPENSE', icon: 'health_and_safety', color: '#ef4444' },
  { name: 'Educação',            type: 'EXPENSE', icon: 'school',            color: '#06b6d4' },
  { name: 'Lazer',               type: 'EXPENSE', icon: 'sports_esports',    color: '#ec4899' },
  { name: 'Vestuário',           type: 'EXPENSE', icon: 'checkroom',         color: '#f97316' },
  { name: 'Contas e Serviços',   type: 'EXPENSE', icon: 'receipt',           color: '#64748b' },
  { name: 'Assinaturas',         type: 'EXPENSE', icon: 'subscriptions',     color: '#7c3aed' },
  { name: 'Pets',                type: 'EXPENSE', icon: 'pets',              color: '#a16207' },
  { name: 'Beleza',              type: 'EXPENSE', icon: 'spa',               color: '#db2777' },
  { name: 'Presentes',           type: 'EXPENSE', icon: 'card_giftcard',     color: '#dc2626' },
  { name: 'Impostos',            type: 'EXPENSE', icon: 'account_balance',   color: '#374151' },
  { name: 'Outros Gastos',       type: 'EXPENSE', icon: 'more_horiz',        color: '#6b7280' },
  { name: 'Salário',             type: 'INCOME',  icon: 'payments',          color: '#10b981' },
  { name: 'Freelance',           type: 'INCOME',  icon: 'work',              color: '#059669' },
  { name: 'Investimentos',       type: 'INCOME',  icon: 'trending_up',       color: '#0d9488' },
  { name: 'Aluguel Recebido',    type: 'INCOME',  icon: 'apartment',         color: '#2563eb' },
  { name: 'Outros Recebimentos', type: 'INCOME',  icon: 'attach_money',      color: '#16a34a' },
] as const;

export interface AuthUser {
  sub: string;
  email: string;
  householdId?: string;
  supabaseId: string;
}

export type JwtPayload = AuthUser;

type Handler = (req: NextRequest, user: AuthUser) => Promise<NextResponse>;

async function getSupabaseUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7);
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: { user } } = await client.auth.getUser(jwt);
    if (user) return { user, jwt };
  }

  const { supabase } = createClientFromRequest(req);
  const { data: { user } } = await supabase.auth.getUser();
  return { user: user ?? null, jwt: null };
}

async function getOrCreateProfile(supabaseId: string, email: string, metadata: Record<string, unknown>, jwt: string | null) {
  const admin = createAdminClient();

  // Primary: admin client (bypasses RLS)
  const { data: existing } = await admin
    .from('users')
    .select('id, householdId')
    .eq('supabaseId', supabaseId)
    .maybeSingle();

  if (existing) return existing;

  // Admin client found nothing — profile may never have been created.
  // Try creating it now.
  try {
    const name = (metadata?.full_name || metadata?.name || email.split('@')[0]) as string;
    const avatarUrl = (metadata?.avatar_url || metadata?.picture) as string | undefined;
    const now = new Date().toISOString();
    const householdId = crypto.randomUUID();
    const { data: household } = await admin
      .from('households')
      .insert({ id: householdId, name: `Casa de ${name.split(' ')[0]}`, currency: 'BRL', updatedAt: now })
      .select('id')
      .single();

    if (household) {
      const { data: newUser } = await admin
        .from('users')
        .insert({ id: crypto.randomUUID(), supabaseId, email, name, avatarUrl: avatarUrl ?? null, householdId: household.id, updatedAt: now })
        .select('id, householdId')
        .single();
      if (newUser) {
        // Create default categories for the new household
        await admin.from('categories').insert(
          DEFAULT_CATEGORIES.map((cat) => ({
            id: crypto.randomUUID(),
            ...cat,
            householdId: household.id,
            isDefault: true,
            updatedAt: now,
          }))
        );
        return newUser;
      }
    }
  } catch {
    // Race condition or admin client issue — try re-reading below
  }

  // Re-read in case a concurrent request created it
  const { data: retry } = await admin
    .from('users')
    .select('id, householdId')
    .eq('supabaseId', supabaseId)
    .maybeSingle();

  if (retry) return retry;

  // Fallback: try with the user's own JWT (works if users table has RLS
  // policy allowing SELECT on own row: auth.uid() = "supabaseId")
  if (jwt) {
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data: rls } = await userClient
      .from('users')
      .select('id, householdId')
      .eq('supabaseId', supabaseId)
      .maybeSingle();
    if (rls) return rls;
  }

  return null;
}

export function withAuth(handler: Handler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { user, jwt } = await getSupabaseUser(req);
    if (!user) return unauthorized();

    const profile = await getOrCreateProfile(user.id, user.email!, user.user_metadata ?? {}, jwt);

    if (!profile) return unauthorized('Perfil não encontrado');

    return handler(req, {
      sub: profile.id,
      email: user.email!,
      householdId: (profile as { householdId?: string | null }).householdId ?? undefined,
      supabaseId: user.id,
    });
  };
}
