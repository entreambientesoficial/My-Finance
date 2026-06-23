import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signAccess, signRefresh, setAuthCookies } from '@/lib/auth';
import { ok, conflict, badRequest, serverError } from '@/lib/api-response';

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', type: 'EXPENSE', icon: 'restaurant', color: '#f59e0b' },
  { name: 'Moradia', type: 'EXPENSE', icon: 'home', color: '#3b82f6' },
  { name: 'Transporte', type: 'EXPENSE', icon: 'directions_car', color: '#8b5cf6' },
  { name: 'Saúde', type: 'EXPENSE', icon: 'health_and_safety', color: '#ef4444' },
  { name: 'Educação', type: 'EXPENSE', icon: 'school', color: '#06b6d4' },
  { name: 'Lazer', type: 'EXPENSE', icon: 'sports_esports', color: '#ec4899' },
  { name: 'Vestuário', type: 'EXPENSE', icon: 'checkroom', color: '#f97316' },
  { name: 'Contas e Serviços', type: 'EXPENSE', icon: 'receipt', color: '#64748b' },
  { name: 'Assinaturas', type: 'EXPENSE', icon: 'subscriptions', color: '#7c3aed' },
  { name: 'Pets', type: 'EXPENSE', icon: 'pets', color: '#a16207' },
  { name: 'Beleza', type: 'EXPENSE', icon: 'spa', color: '#db2777' },
  { name: 'Presentes', type: 'EXPENSE', icon: 'card_giftcard', color: '#dc2626' },
  { name: 'Impostos', type: 'EXPENSE', icon: 'account_balance', color: '#374151' },
  { name: 'Outros Gastos', type: 'EXPENSE', icon: 'more_horiz', color: '#6b7280' },
  { name: 'Salário', type: 'INCOME', icon: 'payments', color: '#10b981' },
  { name: 'Freelance', type: 'INCOME', icon: 'work', color: '#059669' },
  { name: 'Investimentos', type: 'INCOME', icon: 'trending_up', color: '#0d9488' },
  { name: 'Aluguel Recebido', type: 'INCOME', icon: 'apartment', color: '#2563eb' },
  { name: 'Outros Recebimentos', type: 'INCOME', icon: 'attach_money', color: '#16a34a' },
] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, householdName } = body;

    if (!name || !email || !password) return badRequest('name, email e password são obrigatórios');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest('E-mail inválido');
    if (password.length < 8) return badRequest('Senha deve ter no mínimo 8 caracteres');
    if (!/^(?=.*[A-Z])(?=.*\d).+$/.test(password)) return badRequest('Senha deve conter ao menos uma letra maiúscula e um número');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return conflict('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: { name: householdName || `Casa de ${name}` },
      });
      const newUser = await tx.user.create({
        data: { name, email, passwordHash, householdId: household.id },
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

    const payload = { sub: user.id, email: user.email, householdId: user.householdId ?? undefined };
    const accessToken = await signAccess(payload);
    const refreshToken = await signRefresh(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

    setAuthCookies(accessToken, refreshToken);
    return ok({ message: 'Conta criada com sucesso' }, 201);
  } catch (err) {
    console.error('[register]', err);
    return serverError();
  }
}
