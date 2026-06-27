export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const daysAhead = Math.min(90, parseInt(new URL(req.url).searchParams.get('daysAhead') ?? '30'));
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + daysAhead * 864e5).toISOString();
    const supabase = createAdminClient();

    const { data: bills } = await supabase
      .from('transactions')
      .select('*, category:categories(name, color), account:accounts!accountId(name)')
      .eq('householdId', user.householdId)
      .eq('type', 'EXPENSE')
      .eq('isPaid', false)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    return ok(bills ?? []);
  } catch (err) {
    console.error('[reports/upcoming-bills GET]', err);
    return serverError();
  }
});
