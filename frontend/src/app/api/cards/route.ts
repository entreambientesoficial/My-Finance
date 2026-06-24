import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    if (!user.householdId) return notFound();
    const supabase = createAdminClient();
    const { data: cards } = await supabase
      .from('cards')
      .select('*, account:accounts(name, balance)')
      .eq('householdId', user.householdId)
      .eq('isActive', true)
      .order('name', { ascending: true });
    return ok(cards ?? []);
  } catch (err) {
    console.error('[cards GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    if (body.accountId === '') body.accountId = null;
    if (body.lastFourDigits === '') body.lastFourDigits = null;
    const supabase = createAdminClient();
    const { data: card } = await supabase
      .from('cards')
      .insert({ ...body, householdId: user.householdId })
      .select()
      .single();
    return created(card);
  } catch (err) {
    console.error('[cards POST]', err);
    return serverError();
  }
});
