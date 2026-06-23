import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const month = parseInt(sp.get('month') ?? '0');
    const year = parseInt(sp.get('year') ?? '0');
    const budgets = await prisma.budget.findMany({
      where: { householdId: user.householdId, isActive: true, ...(month && { month }), ...(year && { year }) },
      include: { category: { select: { id: true, name: true, color: true, icon: true } } },
      orderBy: { name: 'asc' },
    });
    return ok(budgets);
  } catch (err) {
    console.error('[budgets GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const budget = await prisma.budget.create({
      data: { ...body, householdId: user.householdId, categoryId: body.categoryId || null },
    });
    return created(budget);
  } catch (err) {
    console.error('[budgets POST]', err);
    return serverError();
  }
});
