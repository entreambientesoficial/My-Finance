import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const card = await prisma.card.findFirst({ where: { id: params.id, householdId: user.householdId, isActive: true } });
      if (!card) return notFound('Cartão não encontrado');
      const updated = await prisma.card.update({ where: { id: params.id }, data: { isFrozen: !card.isFrozen } });
      return ok(updated);
    } catch (err) {
      console.error('[cards/:id/freeze PATCH]', err);
      return serverError();
    }
  })(req);
}
