export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

const isCardPayment = (desc: string) => {
  const d = (desc || '').toLowerCase();
  return d.includes('fatura de cart') || d.includes('pagamento de fatura') ||
    d.includes('pagamento de cart') || d.includes('pagamento do cart');
};

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const month = parseInt(sp.get('month') ?? '');
    const year = parseInt(sp.get('year') ?? '');
    if (!month || !year) return badRequest('month e year são obrigatórios');

    const householdId = user.householdId;
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
    const supabase = createAdminClient();

    const [
      { data: allCats },
      { data: manualBudgets },
      { data: incomeTxs },
      { data: expenseTxs },
    ] = await Promise.all([
      supabase.from('categories').select('id, name, color, icon, parentId').eq('householdId', householdId),
      supabase.from('budgets').select('*').eq('householdId', householdId).eq('month', month).eq('year', year).eq('isActive', true),
      supabase.from('transactions').select('amount').eq('householdId', householdId).eq('type', 'INCOME').eq('isPaid', true).gte('date', startDate).lte('date', endDate),
      supabase.from('transactions').select('amount, description, categoryId').eq('householdId', householdId).eq('type', 'EXPENSE').gte('date', startDate).lte('date', endDate),
    ]);

    const income = (incomeTxs ?? []).reduce((s, t) => s + parseFloat(t.amount), 0);

    const catById: Record<string, any> = {};
    for (const c of allCats ?? []) catById[c.id] = c;

    // Compute spending per top-level category (all expenses, no card payments)
    const spentByCat: Record<string, number> = {};
    for (const t of expenseTxs ?? []) {
      if (isCardPayment(t.description || '')) continue;
      const cat = t.categoryId ? catById[t.categoryId] : null;
      const topCat = cat ? (cat.parentId && catById[cat.parentId] ? catById[cat.parentId] : cat) : null;
      const key = topCat?.id ?? '__sem_categoria';
      spentByCat[key] = (spentByCat[key] || 0) + Number(t.amount);
    }

    const manualByCategory: Record<string, any> = {};
    for (const b of manualBudgets ?? []) {
      if (b.categoryId) manualByCategory[b.categoryId] = b;
    }

    // Build result for every top-level category
    const topLevelCats = (allCats ?? []).filter((c: any) => !c.parentId);
    const results: any[] = topLevelCats.map((cat: any) => {
      const manual = manualByCategory[cat.id];
      const spent = spentByCat[cat.id] || 0;
      const limit: number | null = manual ? parseFloat(manual.amount) : null;
      return {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        spent,
        limit,
        budgetId: manual?.id ?? null,
        percentage: limit ? Math.round((spent / limit) * 100) : null,
      };
    });

    if (spentByCat['__sem_categoria']) {
      results.push({
        id: '__sem_categoria',
        name: 'Sem categoria',
        color: '#6b7280',
        icon: 'more_horiz',
        spent: spentByCat['__sem_categoria'],
        limit: null,
        budgetId: null,
        percentage: null,
      });
    }

    // Show categories with spending OR with a manual limit set; sort by spent desc
    const filtered = results.filter((r) => r.spent > 0 || r.limit !== null);
    filtered.sort((a, b) => b.spent - a.spent);
    const totalSpent = filtered.reduce((s, r) => s + r.spent, 0);

    // Monthly history — last 6 months, actual spending only (no card payments)
    const monthDates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 1 - (5 - i), 1);
      return {
        label: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').slice(0, 3),
        start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
        isCurrent: i === 5,
      };
    });

    const monthlyHistory = await Promise.all(
      monthDates.map(async (m) => {
        const { data: txs } = await supabase
          .from('transactions')
          .select('amount, description')
          .eq('householdId', householdId)
          .eq('type', 'EXPENSE')
          .gte('date', m.start)
          .lte('date', m.end);
        const actual = (txs ?? [])
          .filter((t) => !isCardPayment(t.description || ''))
          .reduce((s, t) => s + parseFloat(t.amount), 0);
        return {
          label: m.label.charAt(0).toUpperCase() + m.label.slice(1),
          actual,
          isCurrent: m.isCurrent,
        };
      })
    );

    // Top transactions — no card payments, resolve to top-level category
    const { data: topTxsRaw } = await supabase
      .from('transactions')
      .select('id, description, amount, date, isPaid, categoryId')
      .eq('householdId', householdId)
      .eq('type', 'EXPENSE')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('amount', { ascending: false })
      .limit(20);

    const topTransactions = (topTxsRaw ?? [])
      .filter((t) => !isCardPayment(t.description || ''))
      .slice(0, 5)
      .map((t) => {
        const cat = t.categoryId ? catById[t.categoryId] : null;
        const topCat = cat ? (cat.parentId && catById[cat.parentId] ? catById[cat.parentId] : cat) : null;
        return { ...t, resolvedCategoryId: topCat?.id ?? null };
      });

    // Category map for client lookup (top-level only)
    const categoryMap: Record<string, any> = {};
    for (const cat of topLevelCats as any[]) {
      categoryMap[cat.id] = { name: cat.name, color: cat.color, icon: cat.icon };
    }

    return ok({ income, totalSpent, categories: filtered, monthlyHistory, topTransactions, categoryMap });
  } catch (err) {
    console.error('[budgets/progress GET]', err);
    return serverError();
  }
});
