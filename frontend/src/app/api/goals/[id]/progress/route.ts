export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function POST(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      const { data: goal } = await supabase
        .from('goals')
        .select('*')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .maybeSingle();
      if (!goal) return notFound('Meta não encontrada');

      const body = await r.json();
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return badRequest('Valor inválido');

      if (body.accountId) {
        const { data: account } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', body.accountId)
          .eq('householdId', user.householdId)
          .maybeSingle();
        if (!account) return notFound('Conta não encontrada');
        await supabase.from('accounts').update({ balance: parseFloat(account.balance) - amount }).eq('id', body.accountId);
        await supabase.from('transactions').insert({
          householdId: user.householdId,
          accountId: body.accountId,
          amount,
          description: `Aporte: ${goal.name}`,
          type: 'EXPENSE',
          isPaid: true,
          date: new Date().toISOString(),
        });
      }

      const newAmount = parseFloat(goal.currentAmount) + amount;
      const isCompleted = newAmount >= parseFloat(goal.targetAmount);
      const { data: updated } = await supabase
        .from('goals')
        .update({ currentAmount: newAmount, isCompleted })
        .eq('id', params.id)
        .select()
        .single();
      return ok(updated);
    } catch (err) {
      console.error('[goals/:id/progress POST]', err);
      return serverError();
    }
  })(req);
}
