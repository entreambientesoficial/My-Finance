import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function POST(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const goal = await prisma.goal.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!goal) return notFound('Meta não encontrada');

      const body = await r.json();
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return badRequest('Valor inválido');

      if (body.accountId) {
        const account = await prisma.account.findFirst({ where: { id: body.accountId, householdId: user.householdId } });
        if (!account) return notFound('Conta não encontrada');
        await prisma.account.update({ where: { id: body.accountId }, data: { balance: { decrement: amount } } });
        await prisma.transaction.create({
          data: { householdId: user.householdId, accountId: body.accountId, amount, description: `Aporte: ${goal.name}`, type: 'EXPENSE', isPaid: true, date: new Date() },
        });
      }

      const newAmount = Number(goal.currentAmount) + amount;
      const isCompleted = newAmount >= Number(goal.targetAmount);
      const updated = await prisma.goal.update({ where: { id: params.id }, data: { currentAmount: newAmount, isCompleted } });
      return ok(updated);
    } catch (err) {
      console.error('[goals/:id/progress POST]', err);
      return serverError();
    }
  })(req);
}
