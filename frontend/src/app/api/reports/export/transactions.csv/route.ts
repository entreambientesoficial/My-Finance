import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { unauthorized, serverError } from '@/lib/api-response';

const TYPE_LABELS: Record<string, string> = { INCOME: 'Receita', EXPENSE: 'Despesa', TRANSFER: 'Transferência' };

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.householdId) return unauthorized();

    const sp = new URL(req.url).searchParams;
    const type = sp.get('type') || undefined;
    const rawStart = sp.get('startDate');
    const rawEnd = sp.get('endDate');

    const where: any = { householdId: user.householdId };
    if (type) where.type = type;
    if (rawStart || rawEnd) {
      where.date = {};
      if (rawStart) where.date.gte = new Date(rawStart);
      if (rawEnd) where.date.lte = new Date(rawEnd + 'T23:59:59');
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: { select: { name: true } }, account: { select: { name: true } }, card: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    const header = 'Data;Tipo;Descricao;Valor;Categoria;Conta;Cartao;Pago\n';
    const rows = transactions.map((t) => {
      const date = t.date.toLocaleDateString('pt-BR');
      const tp = TYPE_LABELS[t.type] || t.type;
      const desc = (t.description || '').replace(/;/g, ',');
      const amount = Number(t.amount).toFixed(2).replace('.', ',');
      return `${date};${tp};${desc};${amount};${t.category?.name || ''};${t.account?.name || ''};${t.card?.name || ''};${t.isPaid ? 'Sim' : 'Não'}`;
    });

    const csv = '﻿' + header + rows.join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="transacoes-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error('[reports/export/csv GET]', err);
    return serverError();
  }
}
