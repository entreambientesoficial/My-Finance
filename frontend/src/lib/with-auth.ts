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
  // Prefer Bearer token (set by browser Axios interceptor) — avoids Edge Runtime cookie issues
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

  // Fall back to cookie-based session
  const { supabase } = createClientFromRequest(req);
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export function withAuth(handler: Handler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const user = await getSupabaseUser(req);
    if (!user) return unauthorized();

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('id, householdId')
      .eq('supabaseId', user.id)
      .maybeSingle();

    if (!profile) return unauthorized('Perfil não encontrado');

    return handler(req, {
      sub: profile.id,
      email: user.email!,
      householdId: profile.householdId ?? undefined,
      supabaseId: user.id,
    });
  };
}
