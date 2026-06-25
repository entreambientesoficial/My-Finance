import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { unauthorized } from './api-response';

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
    const { data: household } = await admin
      .from('households')
      .insert({ name: `Casa de ${name.split(' ')[0]}`, currency: 'BRL' })
      .select('id')
      .single();

    if (household) {
      const { data: newUser } = await admin
        .from('users')
        .insert({ supabaseId, email, name, householdId: household.id })
        .select('id, householdId')
        .single();
      if (newUser) return newUser;
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
