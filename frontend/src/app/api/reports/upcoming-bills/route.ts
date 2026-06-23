import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const daysAhead = Math.min(90, parseInt(new URL(req.url).searchParams.get('daysAhead') ?? '30'));
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    const bills = await prisma.transaction.findMany({
      where: { householdId: user.householdId, type: 'EXPENSE', isPaid: false, date: { gte: startDate, lte: endDate } },
      include: { category: { select: { name: true, color: true } }, account: { select: { name: true } } },
      orderBy: { date: 'asc' },
    });
    return ok(bills);
  } catch (err) {
    console.error('[reports/upcoming-bills GET]', err);
    return serverError();
  }
});
