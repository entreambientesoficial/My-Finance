import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      const { data: card } = await supabase
        .from('cards')
        .select('isFrozen')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .eq('isActive', true)
        .maybeSingle();
      if (!card) return notFound('Cartão não encontrado');
      const { data: updated } = await supabase
        .from('cards')
        .update({ isFrozen: !card.isFrozen })
        .eq('id', params.id)
        .select()
        .single();
      return ok(updated);
    } catch (err) {
      console.error('[cards/:id/freeze PATCH]', err);
      return serverError();
    }
  })(req);
}
