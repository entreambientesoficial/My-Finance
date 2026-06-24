export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function GET(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .maybeSingle();
      if (!data) return notFound('Conta não encontrada');
      return ok(data);
    } catch (err) {
      console.error('[accounts/:id GET]', err);
      return serverError();
    }
  })(req);
}

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const body = await r.json();
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('accounts')
        .update(body)
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .select()
        .single();
      if (!data) return notFound('Conta não encontrada');
      return ok(data);
    } catch (err) {
      console.error('[accounts/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      await supabase
        .from('accounts')
        .update({ isActive: false })
        .eq('id', params.id)
        .eq('householdId', user.householdId);
      return ok({ message: 'Conta removida' });
    } catch (err) {
      console.error('[accounts/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
