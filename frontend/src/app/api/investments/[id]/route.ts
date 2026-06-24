export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const body = await r.json();
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('investments')
        .update({ ...body, ...(body.purchaseDate && { purchaseDate: new Date(body.purchaseDate).toISOString() }) })
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .select()
        .single();
      if (!data) return notFound('Investimento não encontrado');
      return ok(data);
    } catch (err) {
      console.error('[investments/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      await supabase.from('investments').delete().eq('id', params.id).eq('householdId', user.householdId);
      return ok({ message: 'Investimento removido' });
    } catch (err) {
      console.error('[investments/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
