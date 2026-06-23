import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function GET(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const { searchParams } = new URL(r.url);
      const month = parseInt(searchParams.get('month') ?? '');
      const year = parseInt(searchParams.get('year') ?? '');
      if (!month || !year) return badRequest('month e year são obrigatórios');

      const card = await prisma.card.findFirst({ where: { id: params.id, householdId: user.householdId, isActive: true } });
      if (!card) return notFound('Cartão não encontrado');

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const transactions = await prisma.transaction.findMany({
        where: { cardId: params.id, date: { gte: startDate, lte: endDate } },
        include: { category: { select: { name: true, color: true, icon: true } } },
        orderBy: { date: 'desc' },
      });

      const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
      return ok({ total, transactions });
    } catch (err) {
      console.error('[cards/:id/invoice GET]', err);
      return serverError();
    }
  })(req);
}
