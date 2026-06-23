import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const goal = await prisma.goal.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!goal) return notFound('Meta não encontrada');
      const body = await r.json();
      const updated = await prisma.goal.update({
        where: { id: params.id },
        data: { ...body, ...(body.targetDate && { targetDate: new Date(body.targetDate) }) },
      });
      return ok(updated);
    } catch (err) {
      console.error('[goals/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const goal = await prisma.goal.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!goal) return notFound('Meta não encontrada');
      await prisma.goal.delete({ where: { id: params.id } });
      return ok({ message: 'Meta removida' });
    } catch (err) {
      console.error('[goals/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
