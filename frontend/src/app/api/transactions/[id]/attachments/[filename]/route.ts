import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { deleteByUrl } from '@/lib/storage';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string; filename: string } };

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const tx = await prisma.transaction.findFirst({ where: { id: params.id, householdId: user.householdId } });
      if (!tx) return notFound('Transação não encontrada');

      const fileUrl = tx.attachments.find((a) => a.includes(params.filename));
      if (fileUrl) await deleteByUrl('attachments', fileUrl).catch(() => {});

      const updated = await prisma.transaction.update({
        where: { id: params.id },
        data: { attachments: tx.attachments.filter((a) => !a.includes(params.filename)) },
      });
      return ok(updated);
    } catch (err) {
      console.error('[transactions/:id/attachments/:filename DELETE]', err);
      return serverError();
    }
  })(req);
}
