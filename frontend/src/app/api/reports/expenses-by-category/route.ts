import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    let startDate: Date;
    let endDate: Date;
    if (rawStart || rawEnd) {
      startDate = rawStart ? new Date(rawStart) : new Date('2000-01-01');
      endDate = rawEnd ? new Date(rawEnd + 'T23:59:59') : new Date('2100-12-31');
    } else {
      const m = month || new Date().getMonth() + 1;
      const y = year || new Date().getFullYear();
      startDate = new Date(y, m - 1, 1);
      endDate = new Date(y, m, 0, 23, 59, 59);
    }

    const where: any = { householdId: user.householdId, type: 'EXPENSE', isPaid: true, date: { gte: startDate, lte: endDate } };
    if (accountId) where.accountId = accountId;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: { select: { name: true, color: true, icon: true } } },
    });

    const byCategory: Record<string, any> = {};
    for (const t of transactions) {
      if (isCardPayment(t.description || '')) continue;
      const key = t.categoryId || '__sem_categoria';
      if (!byCategory[key]) {
        byCategory[key] = { name: t.category?.name || 'Sem categoria', color: t.category?.color || '#6b7280', icon: t.category?.icon || 'more_horiz', total: 0, count: 0 };
      }
      byCategory[key].total += Number(t.amount);
      byCategory[key].count++;
    }

    const items = Object.values(byCategory).sort((a: any, b: any) => b.total - a.total);
    const grandTotal = items.reduce((s: number, i: any) => s + i.total, 0);
    return ok(items.map((i: any) => ({ ...i, percentage: grandTotal > 0 ? Math.round((i.total / grandTotal) * 100) : 0 })));
  } catch (err) {
    console.error('[reports/expenses-by-category GET]', err);
    return serverError();
  }
});
