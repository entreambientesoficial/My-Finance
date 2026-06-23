import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        householdId: true,
        household: { select: { id: true, name: true, currency: true } },
        createdAt: true,
      },
    });
    if (!me) return notFound('Usuário não encontrado');
    return ok(me);
  } catch (err) {
    console.error('[users/me GET]', err);
    return serverError();
  }
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { currentPassword, newPassword, name, avatarUrl } = body;
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    if (newPassword) {
      if (!currentPassword) return badRequest('A senha atual é obrigatória para cadastrar uma nova senha');
      const existing = await prisma.user.findUnique({ where: { id: user.sub } });
      if (!existing) return notFound('Usuário não encontrado');
      const match = await bcrypt.compare(currentPassword, existing.passwordHash);
      if (!match) return badRequest('Senha atual incorreta');
      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: user.sub },
      data: updateData,
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    return ok(updated);
  } catch (err) {
    console.error('[users/me PATCH]', err);
    return serverError();
  }
});
