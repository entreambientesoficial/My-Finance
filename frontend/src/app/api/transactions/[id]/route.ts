import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

const INCLUDE = { category: true, account: true, toAccount: true, card: true };

export function GET(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const tx = await prisma.transaction.findFirst({ where: { id: params.id, householdId: user.householdId }, include: INCLUDE });
      if (!tx) return notFound('Transação não encontrada');
      return ok(tx);
    } catch (err) {
      console.error('[transactions/:id GET]', err);
      return serverError();
    }
  })(req);
}

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const oldTx = await prisma.transaction.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!oldTx) return notFound('Transação não encontrada');

      const body = await r.json();
      const data: any = {
        ...body,
        ...(body.date && { date: new Date(body.date) }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId || null }),
        ...(body.accountId !== undefined && { accountId: body.accountId || null }),
        ...(body.toAccountId !== undefined && { toAccountId: body.toAccountId || null }),
        ...(body.cardId !== undefined && { cardId: body.cardId || null }),
      };

      const updated = await prisma.transaction.update({ where: { id: params.id }, data });

      if (body.isPaid !== undefined && oldTx.isPaid !== (body.isPaid === true)) {
        const isMarkedPaid = body.isPaid === true;
        const amount = Number(oldTx.amount);
        const accId = oldTx.accountId;
        const toAccId = oldTx.toAccountId;
        if (isMarkedPaid) {
          if (oldTx.type === 'INCOME' && accId) await prisma.account.update({ where: { id: accId }, data: { balance: { increment: amount } } });
          else if (oldTx.type === 'EXPENSE' && accId) await prisma.account.update({ where: { id: accId }, data: { balance: { decrement: amount } } });
          else if (oldTx.type === 'TRANSFER' && accId && toAccId) {
            await prisma.account.update({ where: { id: accId }, data: { balance: { decrement: amount } } });
            await prisma.account.update({ where: { id: toAccId }, data: { balance: { increment: amount } } });
          }
        } else {
          if (oldTx.type === 'INCOME' && accId) await prisma.account.update({ where: { id: accId }, data: { balance: { decrement: amount } } });
          else if (oldTx.type === 'EXPENSE' && accId) await prisma.account.update({ where: { id: accId }, data: { balance: { increment: amount } } });
          else if (oldTx.type === 'TRANSFER' && accId && toAccId) {
            await prisma.account.update({ where: { id: accId }, data: { balance: { increment: amount } } });
            await prisma.account.update({ where: { id: toAccId }, data: { balance: { decrement: amount } } });
          }
        }
      }

      return ok(updated);
    } catch (err) {
      console.error('[transactions/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const tx = await prisma.transaction.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!tx) return notFound('Transação não encontrada');
      await prisma.transaction.delete({ where: { id: params.id } });
      return ok({ message: 'Transação removida' });
    } catch (err) {
      console.error('[transactions/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
