import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const month = parseInt(sp.get('month') ?? '');
    const year = parseInt(sp.get('year') ?? '');
    if (!month || !year) return badRequest('month e year são obrigatórios');

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await prisma.transaction.findMany({
      where: { householdId: user.householdId, date: { gte: startDate, lte: endDate }, isPaid: true },
      include: { category: { select: { name: true, color: true, icon: true } } },
    });

    const income = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

    const byCategory = transactions
      .filter((t) => t.type === 'EXPENSE' && t.category)
      .reduce((acc: Record<string, any>, t) => {
        const key = t.categoryId!;
        if (!acc[key]) acc[key] = { ...t.category, total: 0 };
        acc[key].total += Number(t.amount);
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
