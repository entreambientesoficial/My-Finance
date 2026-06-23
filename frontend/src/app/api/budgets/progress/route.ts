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

    const householdId = user.householdId;
    const currentStart = new Date(year, month - 1, 1);
    const currentEnd = new Date(year, month, 0, 23, 59, 59);
    const pastStart = new Date(year, month - 4, 1);
    const pastEnd = new Date(year, month - 1, 0, 23, 59, 59);

    const [categories, manualBudgets] = await Promise.all([
      // Only top-level categories (no parent) to avoid duplicate parent+child entries
      prisma.category.findMany({ where: { householdId, type: 'EXPENSE', parentId: null } }),
      prisma.budget.findMany({ where: { householdId, month, year, isActive: true } }),
    ]);

    const results = await Promise.all(
      categories.map(async (cat) => {
        const manual = manualBudgets.find((b) => b.categoryId === cat.id);

        // Aggregate spending for this category AND its subcategories
        const childIds = (
          await prisma.category.findMany({
            where: { householdId, parentId: cat.id },
            select: { id: true },
          })
        ).map((c) => c.id);

        const categoryIds = [cat.id, ...childIds];

        const [currentAgg, pastAgg] = await Promise.all([
          prisma.transaction.aggregate({
            where: { householdId, type: 'EXPENSE', isPaid: true, categoryId: { in: categoryIds }, date: { gte: currentStart, lte: currentEnd } },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: { householdId, type: 'EXPENSE', isPaid: true, categoryId: { in: categoryIds }, date: { gte: pastStart, lte: pastEnd } },
            _sum: { amount: true },
          }),
        ]);

        const spent = Number(currentAgg._sum.amount || 0);
        const pastAvg = Number(pastAgg._sum.amount || 0) / 3;

        let limit: number;
        let isAutomatic = true;
        let description: string;

        if (manual) {
          limit = Number(manual.amount);
          isAutomatic = false;
          description = 'Limite definido manualmente.';
        } else {
          let raw = pastAvg;
          if (raw <= 0) raw = spent > 0 ? spent * 1.5 : 0;
          limit = raw > 0 ? Math.max(100, Math.ceil(raw / 50) * 50) : 0;
          description = pastAvg > 0
            ? `Média de R$ ${pastAvg.toFixed(2)} nos últimos 3 meses.`
            : spent > 0
            ? 'Baseado no gasto atual do mês.'
            : 'Sem gastos registrados.';
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

    // Only show categories with actual spending OR with a manual budget
    const filtered = results.filter((r) => r.spent > 0 || !r.isAutomatic);
    const finalBudgets = filtered.length > 0 ? filtered : results.slice(0, 4);

    // Top 5 expense transactions for current month (for Movimentações de Impacto)
    const topTransactions = await prisma.transaction.findMany({
      where: { householdId, type: 'EXPENSE', isPaid: true, date: { gte: currentStart, lte: currentEnd } },
      orderBy: { amount: 'desc' },
      take: 5,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        category: { select: { name: true, icon: true, color: true } },
      },
    });

    // Last 6 months spending history for the chart
    const totalBudget = finalBudgets.reduce((s, r) => s + r.amount, 0);
    const monthDates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 1 - (5 - i), 1);
      return {
        label: d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').slice(0, 3),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      };
    });

    const monthlyAggs = await Promise.all(
      monthDates.map((m) =>
        prisma.transaction.aggregate({
          where: { householdId, type: 'EXPENSE', isPaid: true, date: { gte: m.start, lte: m.end } },
          _sum: { amount: true },
        })
      )
    );

    const monthlyHistory = monthDates.map((m, i) => ({
      label: m.label.charAt(0).toUpperCase() + m.label.slice(1),
      planned: totalBudget,
      actual: Number(monthlyAggs[i]._sum.amount || 0),
    }));

    return ok({ budgets: finalBudgets, topTransactions, monthlyHistory });
  } catch (err) {
    console.error('[budgets/progress GET]', err);
    return serverError();
  }
});
