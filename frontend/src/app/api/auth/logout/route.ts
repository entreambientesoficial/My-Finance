import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearAuthCookies } from '@/lib/auth';
import { noContent, serverError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('refreshToken')?.value;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {});
    }
    clearAuthCookies();
    return noContent();
  } catch (err) {
    console.error('[logout]', err);
    return serverError();
  }
}
