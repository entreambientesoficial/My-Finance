import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const goals = await prisma.goal.findMany({
      where: { householdId: user.householdId },
      orderBy: { createdAt: 'desc' },
    });
    return ok(goals);
  } catch (err) {
    console.error('[goals GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const goal = await prisma.goal.create({
      data: {
        ...body,
        householdId: user.householdId,
        ...(body.targetDate && { targetDate: new Date(body.targetDate) }),
      },
    });
    return created(goal);
  } catch (err) {
    console.error('[goals POST]', err);
    return serverError();
  }
});
