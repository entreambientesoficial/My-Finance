export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const rawStart = sp.get('startDate');
    const rawEnd = sp.get('endDate');
    let startDate: string;
    let endDate: string;
    if (rawStart && rawEnd) {
      startDate = new Date(rawStart).toISOString();
      endDate = new Date(rawEnd + 'T23:59:59').toISOString();
    } else {
      const daysAhead = Math.min(90, parseInt(sp.get('daysAhead') ?? '30'));
      startDate = new Date().toISOString();
      endDate = new Date(Date.now() + daysAhead * 864e5).toISOString();
    }
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
