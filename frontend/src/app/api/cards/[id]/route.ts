import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

async function findCard(id: string, householdId: string) {
  return prisma.card.findFirst({
    where: { id, householdId, isActive: true },
    include: { account: { select: { name: true, balance: true } } },
  });
}

export function GET(_req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const card = await findCard(params.id, user.householdId);
      if (!card) return notFound('Cartão não encontrado');
      return ok(card);
    } catch (err) {
      console.error('[cards/:id GET]', err);
      return serverError();
    }
  })(_req);
}

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const card = await findCard(params.id, user.householdId);
      if (!card) return notFound('Cartão não encontrado');
      const body = await r.json();
      if (body.accountId === '') body.accountId = null;
      if (body.lastFourDigits === '') body.lastFourDigits = null;
      const updated = await prisma.card.update({ where: { id: params.id }, data: body });
      return ok(updated);
    } catch (err) {
      console.error('[cards/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const card = await findCard(params.id, user.householdId);
      if (!card) return notFound('Cartão não encontrado');
      const updated = await prisma.card.update({ where: { id: params.id }, data: { isActive: false } });
      return ok(updated);
    } catch (err) {
      console.error('[cards/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
