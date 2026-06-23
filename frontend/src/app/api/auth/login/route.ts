import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signAccess, signRefresh, setAuthCookies } from '@/lib/auth';
import { ok, unauthorized, badRequest, serverError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) return badRequest('email e password são obrigatórios');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return unauthorized('Credenciais inválidas');

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return unauthorized('Credenciais inválidas');

    const payload = { sub: user.id, email: user.email, householdId: user.householdId ?? undefined };
    const accessToken = await signAccess(payload);
    const refreshToken = await signRefresh(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

    setAuthCookies(accessToken, refreshToken);
    return ok({ message: 'Login realizado com sucesso' });
  } catch (err) {
    console.error('[login]', err);
    return serverError();
  }
}
