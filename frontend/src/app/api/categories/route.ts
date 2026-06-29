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

    let parentQuery = supabase
      .from('categories')
      .select('*')
      .eq('householdId', user.householdId)
      .is('parentId', null)
      .order('name', { ascending: true });
    if (type) parentQuery = parentQuery.eq('type', type);

    const { data: parents } = await parentQuery;

    let childQuery = supabase
      .from('categories')
      .select('*')
      .eq('householdId', user.householdId)
      .not('parentId', 'is', null)
      .order('name', { ascending: true });
    if (type) childQuery = childQuery.eq('type', type);

    const { data: children } = await childQuery;

    const categories = (parents ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      children: (children ?? []).filter((c: Record<string, unknown>) => c.parentId === p.id),
    }));

    return ok(categories);
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
      .insert({ id: crypto.randomUUID(), ...body, parentId: body.parentId || null, householdId: user.householdId, updatedAt: new Date().toISOString() })
      .select()
      .single();
    return created(category);
  } catch (err) {
    console.error('[categories POST]', err);
    return serverError();
  }
});
