export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

const isCardPayment = (desc: string) => {
  const d = desc.toLowerCase();
  return d.includes('fatura de cart') || d.includes('pagamento de fatura') || d.includes('pagamento de cart') || d.includes('pagamento do cart');
};

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const accountId = sp.get('accountId') || undefined;
    const rawStart = sp.get('startDate');
    const rawEnd = sp.get('endDate');
    const month = parseInt(sp.get('month') ?? '');
    const year = parseInt(sp.get('year') ?? '');

    let startDate: string;
    let endDate: string;
    if (rawStart || rawEnd) {
      startDate = rawStart ? new Date(rawStart).toISOString() : new Date('2000-01-01').toISOString();
      endDate = rawEnd ? new Date(rawEnd + 'T23:59:59').toISOString() : new Date('2100-12-31').toISOString();
    } else {
      const m = month || new Date().getMonth() + 1;
      const y = year || new Date().getFullYear();
      startDate = new Date(y, m - 1, 1).toISOString();
      endDate = new Date(y, m, 0, 23, 59, 59).toISOString();
    }

    const supabase = createAdminClient();

    // Fetch all categories to resolve parent hierarchy
    const { data: allCats } = await supabase
      .from('categories')
      .select('id, name, color, icon, parentId')
      .eq('householdId', user.householdId);

    // Map: categoryId → effective parent category (or itself if top-level)
    const catById: Record<string, any> = {};
    for (const c of allCats ?? []) catById[c.id] = c;

    const resolveParent = (catId: string | null) => {
      if (!catId) return null;
      const cat = catById[catId];
      if (!cat) return null;
      return cat.parentId && catById[cat.parentId] ? catById[cat.parentId] : cat;
    };

    const isPaidParam = sp.get('isPaid');
    let q = supabase
      .from('transactions')
      .select('id, amount, description, categoryId')
      .eq('householdId', user.householdId)
      .eq('type', 'EXPENSE')
      .gte('date', startDate)
      .lte('date', endDate);
    if (isPaidParam !== null) q = q.eq('isPaid', isPaidParam === 'true');
    if (accountId) q = q.eq('accountId', accountId);

    const { data: transactions } = await q;

    const byCategory: Record<string, any> = {};
    for (const t of transactions ?? []) {
      if (isCardPayment(t.description || '')) continue;
      const parent = resolveParent(t.categoryId);
      const key = parent?.id || '__sem_categoria';
      if (!byCategory[key]) {
        byCategory[key] = {
          name: parent?.name || 'Sem categoria',
          color: parent?.color || '#6b7280',
          icon: parent?.icon || 'more_horiz',
          total: 0,
          count: 0,
        };
      }
      byCategory[key].total += Number(t.amount);
      byCategory[key].count++;
    }

    const items = Object.values(byCategory).sort((a, b) => b.total - a.total);
    const grandTotal = items.reduce((s, i) => s + i.total, 0);
    return ok(items.map((i) => ({ ...i, percentage: grandTotal > 0 ? Math.round((i.total / grandTotal) * 100) : 0 })));
  } catch (err) {
    console.error('[reports/expenses-by-category GET]', err);
    return serverError();
  }
});
