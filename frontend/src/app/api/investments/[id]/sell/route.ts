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
      const body = await r.json();
      const { accountId, amount, date, extraIds } = body;

      if (!accountId) return badRequest('Conta de crédito é obrigatória');
      if (!amount || Number(amount) <= 0) return badRequest('Valor do resgate deve ser positivo');

      const supabase = createAdminClient();

      // All IDs to delete (primary + any consolidated extras)
      const allIds: string[] = [params.id, ...(Array.isArray(extraIds) ? extraIds : [])];

      // Fetch investment(s) to get name/ticker for the transaction description
      const { data: invList } = await supabase
        .from('investments')
        .select('id, name, ticker')
        .in('id', allIds)
        .eq('householdId', user.householdId);

      if (!invList || invList.length === 0) return notFound('Investimento não encontrado');

      // Credit the target account
      const { data: account } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', accountId)
        .eq('householdId', user.householdId)
        .maybeSingle();

      if (!account) return notFound('Conta não encontrada');

      const redeemAmount = Number(amount);
      await supabase
        .from('accounts')
        .update({ balance: Number(account.balance) + redeemAmount })
        .eq('id', accountId);

      // Create INCOME transaction for the redemption
      const firstName = invList[0].ticker || invList[0].name;
      await supabase.from('transactions').insert({
        id: crypto.randomUUID(),
        householdId: user.householdId,
        accountId,
        amount: redeemAmount,
        description: `Resgate: ${firstName}`,
        type: 'INCOME',
        isPaid: true,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Delete all investment records
      await supabase
        .from('investments')
        .delete()
        .in('id', allIds)
        .eq('householdId', user.householdId);

      return ok({ message: 'Ativo resgatado com sucesso' });
    } catch (err) {
      console.error('[investments/:id/sell POST]', err);
      return serverError();
    }
  })(req);
}
