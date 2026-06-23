import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const cat = await prisma.category.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!cat) return notFound('Categoria não encontrada');
      const body = await r.json();
      const updated = await prisma.category.update({
        where: { id: params.id },
        data: { ...body, parentId: body.parentId || null },
      });
      return ok(updated);
    } catch (err) {
      console.error('[categories/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const cat = await prisma.category.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!cat) return notFound('Categoria não encontrada');
      await prisma.category.delete({ where: { id: params.id } });
      return ok({ message: 'Categoria removida' });
    } catch (err) {
      console.error('[categories/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
