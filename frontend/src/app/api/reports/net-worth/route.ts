import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const [accounts, investments] = await Promise.all([
      prisma.account.findMany({ where: { householdId: user.householdId, isActive: true }, select: { name: true, type: true, balance: true } }),
      prisma.investment.findMany({ where: { householdId: user.householdId }, select: { name: true, type: true, quantity: true, currentPrice: true, purchasePrice: true } }),
    ]);

    const bankBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const investmentValue = investments.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.currentPrice || i.purchasePrice || 0), 0);
    return ok({ bankBalance, investmentValue, netWorth: bankBalance + investmentValue, accounts, investments });
  } catch (err) {
    console.error('[reports/net-worth GET]', err);
    return serverError();
  }
});
