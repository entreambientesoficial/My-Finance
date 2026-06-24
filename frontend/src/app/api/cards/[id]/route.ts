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
        .from('cards')
        .select('*, account:accounts(name, balance)')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .eq('isActive', true)
        .maybeSingle();
      if (!data) return notFound('Cartão não encontrado');
      return ok(data);
    } catch (err) {
      console.error('[cards/:id GET]', err);
      return serverError();
    }
  })(req);
}

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const body = await r.json();
      if (body.accountId === '') body.accountId = null;
      if (body.lastFourDigits === '') body.lastFourDigits = null;
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('cards')
        .update(body)
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .select()
        .single();
      if (!data) return notFound('Cartão não encontrado');
      return ok(data);
    } catch (err) {
      console.error('[cards/:id PATCH]', err);
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
        .from('cards')
        .update({ isActive: false })
        .eq('id', params.id)
        .eq('householdId', user.householdId);
      return ok({ message: 'Cartão removido' });
    } catch (err) {
      console.error('[cards/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
