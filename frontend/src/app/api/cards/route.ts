import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    if (!user.householdId) return notFound();
    const cards = await prisma.card.findMany({
      where: { householdId: user.householdId, isActive: true },
      include: { account: { select: { name: true, balance: true } } },
      orderBy: { name: 'asc' },
    });
    return ok(cards);
  } catch (err) {
    console.error('[cards GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    if (body.accountId === '') body.accountId = null;
    if (body.lastFourDigits === '') body.lastFourDigits = null;
    const card = await prisma.card.create({
      data: { ...body, householdId: user.householdId },
    });
    return created(card);
  } catch (err) {
    console.error('[cards POST]', err);
    return serverError();
  }
});
