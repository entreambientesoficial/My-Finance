import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    if (!user.householdId) return notFound('Household não encontrado');
    const household = await prisma.household.findUnique({
      where: { id: user.householdId },
      include: {
        users: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
    if (!household) return notFound('Household não encontrado');
    return ok(household);
  } catch (err) {
    console.error('[households/mine GET]', err);
    return serverError();
  }
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound('Household não encontrado');
    const body = await req.json();
    const { name, currency } = body;
    const updated = await prisma.household.update({
      where: { id: user.householdId },
      data: { ...(name !== undefined && { name }), ...(currency !== undefined && { currency }) },
    });
    return ok(updated);
  } catch (err) {
    console.error('[households/mine PATCH]', err);
    return serverError();
  }
});
