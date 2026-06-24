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
        .from('categories')
        .update({ ...body, parentId: body.parentId || null })
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .select()
        .single();
      if (!data) return notFound('Categoria não encontrada');
      return ok(data);
    } catch (err) {
      console.error('[categories/:id PATCH]', err);
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
        .from('categories')
        .delete()
        .eq('id', params.id)
        .eq('householdId', user.householdId);
      return ok({ message: 'Categoria removida' });
    } catch (err) {
      console.error('[categories/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
