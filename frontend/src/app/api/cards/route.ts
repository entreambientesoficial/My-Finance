export const runtime = 'edge'
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
    const { data: card, error } = await supabase
      .from('cards')
      .insert({ id: crypto.randomUUID(), ...body, householdId: user.householdId, isActive: true, updatedAt: new Date().toISOString() })
      .select()
      .single();
    if (error) { console.error('[cards POST insert]', error); return serverError(error.message); }
    return created(card);
  } catch (err) {
    console.error('[cards POST]', err);
    return serverError();
  }
});
