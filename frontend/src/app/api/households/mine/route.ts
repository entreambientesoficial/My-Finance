export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    if (!user.householdId) return notFound('Household não encontrado');
    const supabase = createAdminClient();
    const { data: household } = await supabase
      .from('households')
      .select('*, users(id, name, email, avatarUrl)')
      .eq('id', user.householdId)
      .maybeSingle();
    if (!household) return notFound('Household não encontrado');
    return ok(household);
  } catch (err) {
    console.error('[households/mine GET]', err);
    return serverError();
  }
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound('Household não encontrado');
    const body = await req.json();
    const { name, currency } = body;
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('households')
      .update({ ...(name !== undefined && { name }), ...(currency !== undefined && { currency }) })
      .eq('id', user.householdId)
      .select()
      .single();
    return ok(data);
  } catch (err) {
    console.error('[households/mine PATCH]', err);
    return serverError();
  }
});
