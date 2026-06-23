import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

const INCLUDE = {
  category: { select: { id: true, name: true, color: true, icon: true } },
  account: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
  card: { select: { id: true, name: true } },
};

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const type = sp.get('type') || undefined;
    const categoryId = sp.get('categoryId') || undefined;
    const accountId = sp.get('accountId') || undefined;
    const cardId = sp.get('cardId') || undefined;
    const startDate = sp.get('startDate') || undefined;
    const endDate = sp.get('endDate') || undefined;
    const isPaidStr = sp.get('isPaid');
    const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(sp.get('limit') ?? '20'));

    const where: any = {
      householdId: user.householdId,
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(accountId && { accountId }),
      ...(cardId && { cardId }),
      ...(isPaidStr !== null && { isPaid: isPaidStr === 'true' }),
      ...((startDate || endDate) && {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate + 'T23:59:59') }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({ where, include: INCLUDE, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.transaction.count({ where }),
    ]);

    return ok({ data, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[transactions GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const data: any = {
      ...body,
      householdId: user.householdId,
      date: new Date(body.date),
      categoryId: body.categoryId || null,
      accountId: body.accountId || null,
      toAccountId: body.toAccountId || null,
      cardId: body.cardId || null,
    };

    const tx = await prisma.transaction.create({ data, include: INCLUDE });

    if (body.isPaid !== false) {
      if (body.type === 'INCOME' && body.accountId) {
        await prisma.account.update({ where: { id: body.accountId }, data: { balance: { increment: body.amount } } });
      } else if (body.type === 'EXPENSE' && body.accountId) {
        await prisma.account.update({ where: { id: body.accountId }, data: { balance: { decrement: body.amount } } });
      } else if (body.type === 'TRANSFER' && body.accountId && body.toAccountId) {
        await prisma.account.update({ where: { id: body.accountId }, data: { balance: { decrement: body.amount } } });
        await prisma.account.update({ where: { id: body.toAccountId }, data: { balance: { increment: body.amount } } });
      }
    }

    return created(tx);
  } catch (err) {
    console.error('[transactions POST]', err);
    return serverError();
  }
});
