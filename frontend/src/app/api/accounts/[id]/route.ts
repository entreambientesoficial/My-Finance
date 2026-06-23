import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

async function findAccount(id: string, householdId: string) {
  return prisma.account.findFirst({ where: { id, householdId } });
}

export function GET(_req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const account = await findAccount(params.id, user.householdId);
      if (!account) return notFound('Conta não encontrada');
      return ok(account);
    } catch (err) {
      console.error('[accounts/:id GET]', err);
      return serverError();
    }
  })(_req);
}

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const account = await findAccount(params.id, user.householdId);
      if (!account) return notFound('Conta não encontrada');
      const body = await r.json();
      const updated = await prisma.account.update({ where: { id: params.id }, data: body });
      return ok(updated);
    } catch (err) {
      console.error('[accounts/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const account = await findAccount(params.id, user.householdId);
      if (!account) return notFound('Conta não encontrada');
      const updated = await prisma.account.update({ where: { id: params.id }, data: { isActive: false } });
      return ok(updated);
    } catch (err) {
      console.error('[accounts/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
