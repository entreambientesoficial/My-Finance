export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const supabase = createAdminClient();
    const year = new Date().getFullYear();
    const startDate = new Date(year, 0, 1).toISOString();
    const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

    const { data: rows } = await supabase
      .from('transactions')
      .select('type, amount, isPaid')
      .eq('householdId', user.householdId)
      .in('type', ['INCOME', 'EXPENSE'])
      .gte('date', startDate)
      .lte('date', endDate);

    const tx = rows ?? [];
    const expensesPaid    = tx.filter(r => r.type === 'EXPENSE' && r.isPaid).reduce((s, r) => s + Number(r.amount), 0);
    const expensesPending = tx.filter(r => r.type === 'EXPENSE' && !r.isPaid).reduce((s, r) => s + Number(r.amount), 0);
    const incomePaid      = tx.filter(r => r.type === 'INCOME' && r.isPaid).reduce((s, r) => s + Number(r.amount), 0);
    const incomePending   = tx.filter(r => r.type === 'INCOME' && !r.isPaid).reduce((s, r) => s + Number(r.amount), 0);

    return ok({ expensesPaid, expensesPending, incomePaid, incomePending, year });
  } catch (err) {
    console.error('[reports/annual-summary GET]', err);
    return serverError();
  }
});
