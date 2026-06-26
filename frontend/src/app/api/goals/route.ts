export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const supabase = createAdminClient();
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('householdId', user.householdId)
      .order('createdAt', { ascending: false });
    return ok(goals ?? []);
  } catch (err) {
    console.error('[goals GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const supabase = createAdminClient();
    const { data: goal, error } = await supabase
      .from('goals')
      .insert({
        id: crypto.randomUUID(),
        ...body,
        householdId: user.householdId,
        updatedAt: new Date().toISOString(),
        ...(body.targetDate && { targetDate: new Date(body.targetDate).toISOString() }),
      })
      .select()
      .single();
    if (error) { console.error('[goals POST insert]', error); return serverError(error.message); }
    return created(goal);
  } catch (err) {
    console.error('[goals POST]', err);
    return serverError();
  }
});
