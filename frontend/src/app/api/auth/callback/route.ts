export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';

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

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=google_cancelled`);
  }

  try {
    const response = NextResponse.redirect(`${base}/dashboard`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options as any);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message);
      return NextResponse.redirect(`${base}/login?error=google_failed`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${base}/login?error=google_failed`);
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('id')
      .eq('supabaseId', user.id)
      .maybeSingle();

    if (!profile) {
      const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email!.split('@')[0];
      const firstName = name.split(' ')[0];
      const householdName = user.user_metadata?.household_name || `Casa de ${firstName}`;

      const { data: household } = await admin
        .from('households')
        .insert({ name: householdName, currency: 'BRL' })
        .select('id')
        .single();

      if (household) {
        const { data: newUser } = await admin
          .from('users')
          .insert({
            supabaseId: user.id,
            email: user.email!,
            name,
            avatarUrl: user.user_metadata?.avatar_url || null,
            householdId: household.id,
          })
          .select('id')
          .single();

        if (newUser) {
          await admin.from('categories').insert(
            DEFAULT_CATEGORIES.map((cat) => ({
              ...cat,
              householdId: household.id,
              isDefault: true,
            }))
          );
        }
      }
    }

    return response;
  } catch (err) {
    console.error('[auth/callback] unexpected error:', err);
    return NextResponse.redirect(`${base}/login?error=google_failed`);
  }
}
