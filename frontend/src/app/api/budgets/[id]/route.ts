import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const budget = await prisma.budget.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!budget) return notFound('Orçamento não encontrado');
      const body = await r.json();
      const updated = await prisma.budget.update({
        where: { id: params.id },
        data: { ...body, ...(body.categoryId !== undefined && { categoryId: body.categoryId || null }) },
      });
      return ok(updated);
    } catch (err) {
      console.error('[budgets/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const budget = await prisma.budget.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!budget) return notFound('Orçamento não encontrado');
      await prisma.budget.update({ where: { id: params.id }, data: { isActive: false } });
      return ok({ message: 'Orçamento removido' });
    } catch (err) {
      console.error('[budgets/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
