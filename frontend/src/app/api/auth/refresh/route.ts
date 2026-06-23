import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRefresh, signAccess, signRefresh, setAuthCookies } from '@/lib/auth';
import { ok, unauthorized, tooManyRequests, serverError } from '@/lib/api-response';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // 30 renovações por IP a cada 15 minutos
  if (!rateLimit(`refresh:${getClientIp(req)}`, 30, 15 * 60 * 1000)) {
    return tooManyRequests();
  }

  try {
    const token = req.cookies.get('refreshToken')?.value;
    if (!token) return unauthorized('Refresh token ausente');

    const payload = await verifyRefresh(token);
    if (!payload) return unauthorized('Refresh token inválido ou expirado');

    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
      return unauthorized('Refresh token inválido ou expirado');
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    const newPayload = { sub: stored.user.id, email: stored.user.email, householdId: stored.user.householdId ?? undefined };
    const accessToken = await signAccess(newPayload);
    const refreshToken = await signRefresh(newPayload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: stored.user.id, expiresAt } });

    setAuthCookies(accessToken, refreshToken);
    return ok({ message: 'Token renovado' });
  } catch (err) {
    console.error('[refresh]', err);
    return serverError();
  }
}
