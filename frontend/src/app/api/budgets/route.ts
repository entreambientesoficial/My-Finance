export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const month = parseInt(sp.get('month') ?? '0');
    const year = parseInt(sp.get('year') ?? '0');
    const supabase = createAdminClient();
    let query = supabase
      .from('budgets')
      .select('*, category:categories(id, name, color, icon)')
      .eq('householdId', user.householdId)
      .eq('isActive', true)
      .order('name', { ascending: true });
    if (month) query = query.eq('month', month);
    if (year) query = query.eq('year', year);
    const { data: budgets } = await query;
    return ok(budgets ?? []);
  } catch (err) {
    console.error('[budgets GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const supabase = createAdminClient();
    const { data: budget } = await supabase
      .from('budgets')
      .insert({ ...body, householdId: user.householdId, categoryId: body.categoryId || null })
      .select()
      .single();
    return created(budget);
  } catch (err) {
    console.error('[budgets POST]', err);
    return serverError();
  }
});
