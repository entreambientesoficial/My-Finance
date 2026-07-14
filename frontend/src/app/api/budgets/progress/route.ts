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

    const householdId = user.householdId;
    const currentStart = new Date(year, month - 1, 1).toISOString();
    const currentEnd = new Date(year, month, 0, 23, 59, 59).toISOString();
    const pastStart = new Date(year, month - 4, 1).toISOString();
    const pastEnd = new Date(year, month - 1, 0, 23, 59, 59).toISOString();

    const supabase = createAdminClient();
    const [{ data: categories }, { data: manualBudgets }] = await Promise.all([
      supabase.from('categories').select('*').eq('householdId', householdId).eq('type', 'EXPENSE').is('parentId', null),
      supabase.from('budgets').select('*').eq('householdId', householdId).eq('month', month).eq('year', year).eq('isActive', true),
    ]);

    const results = await Promise.all(
      (categories ?? []).map(async (cat) => {
        const manual = (manualBudgets ?? []).find((b) => b.categoryId === cat.id);
        const { data: children } = await supabase
          .from('categories')
          .select('id')
          .eq('householdId', householdId)
          .eq('parentId', cat.id);
        const categoryIds = [cat.id, ...(children ?? []).map((c) => c.id)];

        const [{ data: currentTxs }, { data: pastTxs }] = await Promise.all([
          supabase.from('transactions').select('amount').eq('householdId', householdId).eq('type', 'EXPENSE').eq('isPaid', true).in('categoryId', categoryIds).gte('date', currentStart).lte('date', currentEnd),
          supabase.from('transactions').select('amount').eq('householdId', householdId).eq('type', 'EXPENSE').eq('isPaid', true).in('categoryId', categoryIds).gte('date', pastStart).lte('date', pastEnd),
        ]);

        const spent = (currentTxs ?? []).reduce((s, t) => s + parseFloat(t.amount), 0);
        const pastTotal = (pastTxs ?? []).reduce((s, t) => s + parseFloat(t.amount), 0);
        const pastAvg = pastTotal / 3;

        let limit: number;
        let isAutomatic = true;
        let description: string;

        if (manual) {
          limit = parseFloat(manual.amount);
          isAutomatic = false;
          description = 'Limite definido manualmente.';
        } else {
          let raw = pastAvg;
          if (raw <= 0) raw = spent > 0 ? spent * 1.5 : 0;
          limit = raw > 0 ? Math.max(100, Math.ceil(raw / 50) * 50) : 0;
          description = pastAvg > 0
            ? `Média de R$ ${pastAvg.toFixed(2)} nos últimos 3 meses.`
            : spent > 0 ? 'Baseado no gasto atual do mês.' : 'Sem gastos registrados.';
        }

        return {
          id: manual ? manual.id : `auto-${cat.id}`,
          name: cat.name,
          amount: limit,
          spent,
          remaining: limit > 0 ? limit - spent : -spent,
          percentage: limit > 0 ? Math.round((spent / limit) * 100) : spent > 0 ? 100 : 0,
          category: { id: cat.id, name: cat.name, color: cat.color, icon: cat.icon },
          description,
          isAutomatic,
        };
      })
    );

    const filtered = results.filter((r) => r.spent > 0 || !r.isAutomatic);
    const finalBudgets = filtered.length > 0 ? filtered : results.slice(0, 4);
    const totalBudget = finalBudgets.reduce((s, r) => s + r.amount, 0);

    const monthDates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 1 - (5 - i), 1);
      return {
        label: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').slice(0, 3),
        start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      };
    });

    const monthlyHistory = await Promise.all(
      monthDates.map(async (m) => {
        const { data: txs } = await supabase.from('transactions').select('amount').eq('householdId', householdId).eq('type', 'EXPENSE').eq('isPaid', true).gte('date', m.start).lte('date', m.end);
        const actual = (txs ?? []).reduce((s, t) => s + parseFloat(t.amount), 0);
        return { label: m.label.charAt(0).toUpperCase() + m.label.slice(1), planned: totalBudget, actual };
      })
    );

    const { data: topTransactions, error: topTxError } = await supabase
      .from('transactions')
      .select('id, description, amount, date, isPaid, categoryId')
      .eq('householdId', householdId)
      .eq('type', 'EXPENSE')
      .gte('date', currentStart)
      .lte('date', currentEnd)
      .order('amount', { ascending: false })
      .limit(5);
    if (topTxError) console.error('[budgets/progress topTransactions]', topTxError);

    const totalCurrentSpent = finalBudgets.reduce((s, r) => s + r.spent, 0);
    const prevMonthActual = monthlyHistory[4]?.actual ?? 0;
    const variance = prevMonthActual > 0
      ? ((totalCurrentSpent - prevMonthActual) / prevMonthActual) * 100
      : null;

    // Build category map from results (all categories, even zero-spend ones)
    const categoryMap = Object.fromEntries(
      results.map((r) => [r.category.id, r.category])
    );

    return ok({ budgets: finalBudgets, topTransactions: topTransactions ?? [], monthlyHistory, variance, categoryMap });
  } catch (err) {
    console.error('[budgets/progress GET]', err);
    return serverError();
  }
});
