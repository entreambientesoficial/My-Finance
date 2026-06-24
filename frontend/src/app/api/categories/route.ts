export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const type = new URL(req.url).searchParams.get('type');
    const supabase = createAdminClient();
    let query = supabase
      .from('categories')
      .select('*, children:categories!parentId(*)')
      .eq('householdId', user.householdId)
      .is('parentId', null)
      .order('name', { ascending: true });
    if (type) query = query.eq('type', type);
    const { data: categories } = await query;
    return ok(categories ?? []);
  } catch (err) {
    console.error('[categories GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const supabase = createAdminClient();
    const { data: category } = await supabase
      .from('categories')
      .insert({ ...body, parentId: body.parentId || null, householdId: user.householdId })
      .select()
      .single();
    return created(category);
  } catch (err) {
    console.error('[categories POST]', err);
    return serverError();
  }
});
