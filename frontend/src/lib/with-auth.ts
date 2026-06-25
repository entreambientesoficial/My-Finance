import { NextRequest, NextResponse } from 'next/server';
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

export function withAuth(handler: Handler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { supabase } = createClientFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
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
