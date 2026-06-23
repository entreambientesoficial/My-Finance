import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const inv = await prisma.investment.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!inv) return notFound('Investimento não encontrado');
      const body = await r.json();
      const updated = await prisma.investment.update({
        where: { id: params.id },
        data: { ...body, ...(body.purchaseDate && { purchaseDate: new Date(body.purchaseDate) }) },
      });
      return ok(updated);
    } catch (err) {
      console.error('[investments/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const inv = await prisma.investment.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!inv) return notFound('Investimento não encontrado');
      await prisma.investment.delete({ where: { id: params.id } });
      return ok({ message: 'Investimento removido' });
    } catch (err) {
      console.error('[investments/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
