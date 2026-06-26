import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { unauthorized } from './api-response';

const DEFAULT_CATEGORIES: Array<{
  name: string;
  type: 'EXPENSE' | 'INCOME';
  icon: string;
  color: string;
  children: string[];
}> = [
  { name: 'Alimentação',         type: 'EXPENSE', icon: 'restaurant',        color: '#f59e0b', children: ['Açougue', 'Cafés', 'Delivery', 'Hortifruti', 'Lanchonetes e Pizzarias', 'Padaria', 'Restaurantes', 'Supermercado'] },
  { name: 'Despesas Pessoais',   type: 'EXPENSE', icon: 'checkroom',         color: '#ec4899', children: ['Academia e Fitness', 'Barbearia/Salão', 'Calçados', 'Cosméticos', 'Roupas'] },
  { name: 'Educação',            type: 'EXPENSE', icon: 'school',            color: '#06b6d4', children: ['Cursos', 'Livros', 'Material escolar', 'Mensalidades'] },
  { name: 'Família e Presentes', type: 'EXPENSE', icon: 'card_giftcard',     color: '#dc2626', children: ['Ajuda familiar', 'Doações', 'Presentes'] },
  { name: 'Financeiro',          type: 'EXPENSE', icon: 'account_balance',   color: '#374151', children: ['Empréstimos', 'Financiamentos', 'Juros', 'Tarifas bancárias'] },
  { name: 'Impostos e Taxas',    type: 'EXPENSE', icon: 'receipt_long',      color: '#6b7280', children: ['Cartórios e Registros', 'IOF', 'IPTU', 'IPVA', 'ITCMD'] },
  { name: 'Investimentos',       type: 'EXPENSE', icon: 'trending_up',       color: '#0d9488', children: ['Aportes em ações', 'Aportes em FIIs', 'CDB', 'Previdência', 'Reserva de emergência', 'Tesouro Direto'] },
  { name: 'Lazer',               type: 'EXPENSE', icon: 'sports_esports',    color: '#7c3aed', children: ['Assinaturas', 'Cinema', 'Hobbies', 'Passeios', 'Viagens'] },
  { name: 'Moradia',             type: 'EXPENSE', icon: 'home',              color: '#3b82f6', children: ['Água', 'Celular e Telefone', 'Condomínio', 'Energia elétrica', 'Financiamento', 'Gás', 'Internet', 'Manutenção Elétrica', 'Manutenção Hidráulica', 'Manutenção Jardinagem', 'Manutenção Pintura', 'Seguro residencial'] },
  { name: 'Outros',              type: 'EXPENSE', icon: 'more_horiz',        color: '#9ca3af', children: ['Despesas diversas', 'Imprevistos', 'Multas'] },
  { name: 'Patrimônio',          type: 'EXPENSE', icon: 'villa',             color: '#92400e', children: ['Compra de imóvel', 'Compra de veículo', 'Equipamentos', 'Móveis', 'Reforma'] },
  { name: 'Pets',                type: 'EXPENSE', icon: 'pets',              color: '#a16207', children: ['Assistência Médica', 'Banho e tosa', 'Medicamentos', 'Ração', 'Veterinário'] },
  { name: 'Receitas',            type: 'INCOME',  icon: 'payments',          color: '#10b981', children: ['Aluguel Recebido', 'Aposentadoria', 'Dividendos Ações', 'Dividendos FIIs', 'Outros', 'Outros investimentos', 'Rendimentos financeiros CDB', 'Rendimentos financeiros Poupança', 'Rendimentos financeiros Tesouro', 'Salário', 'Trabalho autônomo', 'Vendas'] },
  { name: 'Saúde',               type: 'EXPENSE', icon: 'health_and_safety', color: '#ef4444', children: ['Consultas e Exames', 'Medicamentos', 'Odontologia', 'Plano de saúde', 'Terapias'] },
  { name: 'Serviços Digitais',   type: 'EXPENSE', icon: 'devices',           color: '#6366f1', children: ['Chat GPT', 'Claude', 'Google AI', 'Microsoft 365', 'Netflix', 'Spotify', 'YouTube'] },
  { name: 'Transporte',          type: 'EXPENSE', icon: 'directions_car',    color: '#8b5cf6', children: ['Aplicativos (Uber, 99)', 'Combustível', 'Estacionamento', 'Licenciamento', 'Manutenção e Revisão', 'Pedágio', 'Seguro', 'Transporte público'] },
];

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
        for (const cat of DEFAULT_CATEGORIES) {
          const parentId = crypto.randomUUID();
          await admin.from('categories').insert({
            id: parentId,
            name: cat.name,
            type: cat.type,
            icon: cat.icon,
            color: cat.color,
            householdId: household.id,
            isDefault: true,
            parentId: null,
            updatedAt: now,
          });
          if (cat.children.length > 0) {
            await admin.from('categories').insert(
              cat.children.map(childName => ({
                id: crypto.randomUUID(),
                name: childName,
                type: cat.type,
                icon: cat.icon,
                color: cat.color,
                householdId: household.id,
                isDefault: true,
                parentId,
                updatedAt: now,
              }))
            );
          }
        }
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
