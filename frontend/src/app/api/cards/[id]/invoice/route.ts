export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, badRequest, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function GET(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const { searchParams } = new URL(r.url);
      const month = parseInt(searchParams.get('month') ?? '');
      const year = parseInt(searchParams.get('year') ?? '');
      if (!month || !year) return badRequest('month e year são obrigatórios');

      const supabase = createAdminClient();
      const { data: card } = await supabase
        .from('cards')
        .select('id')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .eq('isActive', true)
        .maybeSingle();
      if (!card) return notFound('Cartão não encontrado');

      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, category:categories(name, color, icon)')
        .eq('cardId', params.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      const total = (transactions ?? []).reduce((sum, t) => sum + parseFloat(t.amount), 0);
      return ok({ total, transactions: transactions ?? [] });
    } catch (err) {
      console.error('[cards/:id/invoice GET]', err);
      return serverError();
    }
  })(req);
}

// POST /api/cards/[id]/invoice — paga a fatura: debita conta e quita transações do cartão
export function POST(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const body = await r.json();
      const { accountId, amount, date, description, categoryId } = body;
      if (!accountId || !amount || amount <= 0) return badRequest('accountId e amount são obrigatórios');

      const supabase = createAdminClient();

      // Verify card belongs to household
      const { data: card } = await supabase
        .from('cards')
        .select('id')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .maybeSingle();
      if (!card) return notFound('Cartão não encontrado');

      // 1. Create expense transaction on bank account to record the payment
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          id: crypto.randomUUID(),
          householdId: user.householdId,
          type: 'EXPENSE',
          amount,
          description: description || `Pagamento Fatura - Cartão`,
          date: new Date(date || new Date()).toISOString(),
          accountId,
          cardId: null,
          categoryId: categoryId || null,
          isPaid: true,
          recurrenceType: 'ONCE',
          updatedAt: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (txError) { console.error('[cards/:id/invoice POST tx]', txError); return serverError(txError.message); }

      // 2. Deduct from bank account balance (verify account belongs to household)
      const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).eq('householdId', user.householdId).maybeSingle();
      if (!acc) return notFound('Conta bancária não encontrada');
      await supabase.from('accounts').update({ balance: parseFloat(acc.balance ?? '0') - parseFloat(amount) }).eq('id', accountId).eq('householdId', user.householdId);

      // 3. Mark all unpaid card transactions as paid (settling the bill)
      const { data: settled } = await supabase
        .from('transactions')
        .update({ isPaid: true, updatedAt: new Date().toISOString() })
        .eq('cardId', params.id)
        .eq('householdId', user.householdId)
        .eq('isPaid', false)
        .select('id');

      return created({ transaction: tx, settledCount: settled?.length ?? 0 });
    } catch (err) {
      console.error('[cards/:id/invoice POST]', err);
      return serverError();
    }
  })(req);
}
