import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signAccess, signRefresh, setAuthCookiesOnResponse } from '@/lib/auth';

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação',      type: 'EXPENSE', icon: 'restaurant',        color: '#f59e0b' },
  { name: 'Moradia',          type: 'EXPENSE', icon: 'home',              color: '#3b82f6' },
  { name: 'Transporte',       type: 'EXPENSE', icon: 'directions_car',    color: '#8b5cf6' },
  { name: 'Saúde',            type: 'EXPENSE', icon: 'health_and_safety', color: '#ef4444' },
  { name: 'Educação',         type: 'EXPENSE', icon: 'school',            color: '#06b6d4' },
  { name: 'Lazer',            type: 'EXPENSE', icon: 'sports_esports',    color: '#ec4899' },
  { name: 'Vestuário',        type: 'EXPENSE', icon: 'checkroom',         color: '#f97316' },
  { name: 'Contas e Serviços',type: 'EXPENSE', icon: 'receipt',           color: '#64748b' },
  { name: 'Assinaturas',      type: 'EXPENSE', icon: 'subscriptions',     color: '#7c3aed' },
  { name: 'Pets',             type: 'EXPENSE', icon: 'pets',              color: '#a16207' },
  { name: 'Beleza',           type: 'EXPENSE', icon: 'spa',               color: '#db2777' },
  { name: 'Presentes',        type: 'EXPENSE', icon: 'card_giftcard',     color: '#dc2626' },
  { name: 'Impostos',         type: 'EXPENSE', icon: 'account_balance',   color: '#374151' },
  { name: 'Outros Gastos',    type: 'EXPENSE', icon: 'more_horiz',        color: '#6b7280' },
  { name: 'Salário',          type: 'INCOME',  icon: 'payments',          color: '#10b981' },
  { name: 'Freelance',        type: 'INCOME',  icon: 'work',              color: '#059669' },
  { name: 'Investimentos',    type: 'INCOME',  icon: 'trending_up',       color: '#0d9488' },
  { name: 'Aluguel Recebido', type: 'INCOME',  icon: 'apartment',         color: '#2563eb' },
  { name: 'Outros Recebimentos', type: 'INCOME', icon: 'attach_money',   color: '#16a34a' },
] as const;

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/login?error=${reason}`);

  if (error || !code) return fail('google_cancelled');

  try {
    // 1. Trocar code por tokens Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('google_failed');
    const { access_token } = await tokenRes.json();

    // 2. Buscar dados do usuário no Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) return fail('google_failed');
    const { sub: googleId, email, name, picture } = await userRes.json();

    if (!email) return fail('google_no_email');

    // 3. Encontrar ou criar usuário
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      // Vincula googleId se a conta existia com e-mail/senha
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatarUrl: user.avatarUrl || picture || null },
        });
      }
    } else {
      // Cria novo usuário + household + categorias padrão
      user = await prisma.$transaction(async (tx) => {
        const firstName = (name as string).split(' ')[0];
        const household = await tx.household.create({
          data: { name: `Casa de ${firstName}` },
        });
        const newUser = await tx.user.create({
          data: {
            name: name as string,
            email: email as string,
            passwordHash: null,
            googleId: googleId as string,
            avatarUrl: (picture as string) || null,
            householdId: household.id,
          },
        });
        await tx.category.createMany({
          data: DEFAULT_CATEGORIES.map((cat) => ({
            ...cat,
            householdId: household.id,
            isDefault: true,
          })),
        });
        return newUser;
      });
    }

    // 4. Emitir JWT próprio e redirecionar
    const payload = { sub: user.id, email: user.email, householdId: user.householdId ?? undefined };
    const accessToken = await signAccess(payload);
    const refreshToken = await signRefresh(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

    const response = NextResponse.redirect(`${base}/dashboard`);
    setAuthCookiesOnResponse(response, accessToken, refreshToken);
    return response;
  } catch (err) {
    console.error('[google/callback]', err);
    return fail('google_failed');
  }
}
