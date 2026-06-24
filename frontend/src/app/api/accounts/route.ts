export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    if (!user.householdId) return notFound();
    const supabase = createAdminClient();
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('householdId', user.householdId)
      .eq('isActive', true)
      .order('name', { ascending: true });
    return ok(accounts ?? []);
  } catch (err) {
    console.error('[accounts GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const supabase = createAdminClient();
    const { data: account } = await supabase
      .from('accounts')
      .insert({ ...body, householdId: user.householdId })
      .select()
      .single();
    return created(account);
  } catch (err) {
    console.error('[accounts POST]', err);
    return serverError();
  }
});
