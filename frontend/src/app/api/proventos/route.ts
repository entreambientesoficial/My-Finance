import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, badRequest } from '@/lib/api-response';
import type { JwtPayload } from '@/lib/auth';

export const GET = withAuth(async (req: NextRequest, user: JwtPayload) => {
  if (!user.householdId) return badRequest('Sem household');

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // A_RECEBER | PAGO | null = todos
  const year = searchParams.get('year');

  const where: any = { householdId: user.householdId };
  if (status) where.status = status;
  if (year) {
    const y = parseInt(year);
    where.dataPagamento = {
      gte: new Date(y, 0, 1),
      lte: new Date(y, 11, 31, 23, 59, 59),
    };
  }

  const proventos = await prisma.provento.findMany({
    where,
    orderBy: { dataPagamento: 'desc' },
  });

  const totalRecebido = proventos
    .filter((p) => p.status === 'PAGO')
    .reduce((s, p) => s + Number(p.valorTotal), 0);

  const totalAReceber = proventos
    .filter((p) => p.status === 'A_RECEBER')
    .reduce((s, p) => s + Number(p.valorTotal), 0);

  return ok({ proventos, totalRecebido, totalAReceber });
});
