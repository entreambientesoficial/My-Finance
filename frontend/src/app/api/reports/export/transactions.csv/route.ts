export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { unauthorized, serverError } from '@/lib/api-response';

const TYPE_LABELS: Record<string, string> = { INCOME: 'Receita', EXPENSE: 'Despesa', TRANSFER: 'Transferência' };

export async function GET(req: NextRequest) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return unauthorized();

      const sp = new URL(r.url).searchParams;
      const type = sp.get('type') || undefined;
      const rawStart = sp.get('startDate');
      const rawEnd = sp.get('endDate');

      const supabase = createAdminClient();
      let q = supabase
        .from('transactions')
        .select('*, category:categories(name), account:accounts(name), card:cards(name)')
        .eq('householdId', user.householdId)
        .order('date', { ascending: false });

      if (type) q = q.eq('type', type);
      if (rawStart) q = q.gte('date', new Date(rawStart).toISOString());
      if (rawEnd) q = q.lte('date', new Date(rawEnd + 'T23:59:59').toISOString());

      const { data: transactions } = await q;

      const header = 'Data;Tipo;Descricao;Valor;Categoria;Conta;Cartao;Pago\n';
      const rows = (transactions ?? []).map((t) => {
        const date = new Date(t.date).toLocaleDateString('pt-BR');
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
  })(req);
}
