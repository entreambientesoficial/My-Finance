import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const months = Math.min(24, parseInt(sp.get('months') ?? '6'));
    const accountId = sp.get('accountId') || undefined;
    const householdId = user.householdId;
    const now = new Date();
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const baseWhere: any = { householdId, isPaid: true, date: { gte: startDate, lte: endDate } };
      if (accountId) baseWhere.accountId = accountId;

      const [income, expenses] = await Promise.all([
        prisma.transaction.aggregate({ where: { ...baseWhere, type: 'INCOME' }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { ...baseWhere, type: 'EXPENSE' }, _sum: { amount: true } }),
      ]);

      const inc = Number(income._sum.amount || 0);
      const exp = Number(expenses._sum.amount || 0);
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
