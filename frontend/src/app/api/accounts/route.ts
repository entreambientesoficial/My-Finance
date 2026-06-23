import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    if (!user.householdId) return notFound();
    const accounts = await prisma.account.findMany({
      where: { householdId: user.householdId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return ok(accounts);
  } catch (err) {
    console.error('[accounts GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const account = await prisma.account.create({
      data: { ...body, householdId: user.householdId },
    });
    return created(account);
  } catch (err) {
    console.error('[accounts POST]', err);
    return serverError();
  }
});
