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
        .from('goals')
        .update({ ...body, ...(body.targetDate && { targetDate: new Date(body.targetDate).toISOString() }) })
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .select()
        .single();
      if (!data) return notFound('Meta não encontrada');
      return ok(data);
    } catch (err) {
      console.error('[goals/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      await supabase.from('goals').delete().eq('id', params.id).eq('householdId', user.householdId);
      return ok({ message: 'Meta removida' });
    } catch (err) {
      console.error('[goals/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
