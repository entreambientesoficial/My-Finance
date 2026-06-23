import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const investments = await prisma.investment.findMany({
      where: { householdId: user.householdId },
      orderBy: { name: 'asc' },
    });
    return ok(investments);
  } catch (err) {
    console.error('[investments GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const { accountId, ...investmentData } = body;

    if (accountId) {
      const account = await prisma.account.findFirst({ where: { id: accountId, householdId: user.householdId } });
      if (!account) return notFound('Conta de débito não encontrada');
      const cost = Number(body.quantity || 0) * Number(body.purchasePrice || 0);
      if (cost > 0) {
        await prisma.account.update({ where: { id: accountId }, data: { balance: { decrement: cost } } });
        await prisma.transaction.create({
          data: { householdId: user.householdId, accountId, amount: cost, description: `Compra de Ativo: ${body.ticker || body.name}`, type: 'EXPENSE', isPaid: true, date: body.purchaseDate ? new Date(body.purchaseDate) : new Date() },
        });
      }
    }

    const investment = await prisma.investment.create({
      data: {
        ...investmentData,
        householdId: user.householdId,
        ...(body.purchaseDate && { purchaseDate: new Date(body.purchaseDate) }),
      },
    });
    return created(investment);
  } catch (err) {
    console.error('[investments POST]', err);
    return serverError();
  }
});
