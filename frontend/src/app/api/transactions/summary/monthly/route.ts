export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const month = parseInt(sp.get('month') ?? '');
    const year = parseInt(sp.get('year') ?? '');
    if (!month || !year) return badRequest('month e year são obrigatórios');

    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    const supabase = createAdminClient();
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, category:categories(id, name, color, icon)')
      .eq('householdId', user.householdId)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('isPaid', true);

    const txs = transactions ?? [];
    const income = txs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expenses = txs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + parseFloat(t.amount), 0);

    const byCategory = txs
      .filter((t) => t.type === 'EXPENSE' && t.category)
      .reduce((acc: Record<string, any>, t) => {
        const key = t.categoryId!;
        if (!acc[key]) acc[key] = { ...t.category, total: 0 };
        acc[key].total += parseFloat(t.amount);
        return acc;
      }, {});

    return ok({
      income,
      expenses,
      balance: income - expenses,
      byCategory: Object.values(byCategory).sort((a: any, b: any) => b.total - a.total),
    });
  } catch (err) {
    console.error('[transactions/summary/monthly GET]', err);
    return serverError();
  }
});
