import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const months = Math.min(24, parseInt(sp.get('months') ?? '6'));
    const accountId = sp.get('accountId') || undefined;
    const householdId = user.householdId;
    const supabase = createAdminClient();
    const now = new Date();
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString();

      let q = supabase.from('transactions').select('type, amount').eq('householdId', householdId).eq('isPaid', true).gte('date', startDate).lte('date', endDate);
      if (accountId) q = q.eq('accountId', accountId);
      const { data: rows } = await q;

      const inc = (rows ?? []).filter((r) => r.type === 'INCOME').reduce((s, r) => s + Number(r.amount), 0);
      const exp = (rows ?? []).filter((r) => r.type === 'EXPENSE').reduce((s, r) => s + Number(r.amount), 0);

      result.push({
        month: date.toISOString().slice(0, 7),
        label: date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }),
        income: inc,
        expenses: exp,
        balance: inc - exp,
      });
    }

    return ok(result);
  } catch (err) {
    console.error('[reports/cash-flow GET]', err);
    return serverError();
  }
});
