import { withAuth } from '@/lib/with-auth';
import { prisma } from '@/lib/prisma';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    if (!user.householdId) return notFound('Household não encontrado');
    const hId = user.householdId;

    const [accounts, cards, goals, budgets] = await Promise.all([
      prisma.account.findMany({
        where: { householdId: hId, isActive: true },
        select: { id: true, name: true, type: true, balance: true, currency: true },
      }),
      prisma.card.findMany({
        where: { householdId: hId, isActive: true },
        select: { id: true, name: true, brand: true, creditLimit: true },
      }),
      prisma.goal.findMany({
        where: { householdId: hId, isCompleted: false },
        select: { id: true, name: true, targetAmount: true, currentAmount: true },
      }),
      prisma.budget.findMany({
        where: { householdId: hId, isActive: true },
        select: { id: true, name: true, amount: true, period: true },
      }),
    ]);

    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    return ok({ accounts, cards, goals, budgets, totalBalance });
  } catch (err) {
    console.error('[households/mine/summary GET]', err);
    return serverError();
  }
});
