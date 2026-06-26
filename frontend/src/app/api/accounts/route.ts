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
    const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        id: crypto.randomUUID(),
        ...body,
        householdId: user.householdId,
        isActive: true,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      console.error('[accounts POST insert]', error);
      return serverError(error.message);
    }
    return created(account);
  } catch (err) {
    console.error('[accounts POST]', err);
    return serverError();
  }
});
