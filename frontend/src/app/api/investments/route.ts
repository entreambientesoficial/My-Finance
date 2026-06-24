export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const supabase = createAdminClient();
    const { data: investments } = await supabase
      .from('investments')
      .select('*')
      .eq('householdId', user.householdId)
      .order('name', { ascending: true });
    return ok(investments ?? []);
  } catch (err) {
    console.error('[investments GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const { accountId, ...investmentData } = body;
    const supabase = createAdminClient();

    if (accountId) {
      const { data: account } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', accountId)
        .eq('householdId', user.householdId)
        .maybeSingle();
      if (!account) return notFound('Conta de débito não encontrada');
      const cost = Number(body.quantity || 0) * Number(body.purchasePrice || 0);
      if (cost > 0) {
        await supabase.from('accounts').update({ balance: parseFloat(account.balance) - cost }).eq('id', accountId);
        await supabase.from('transactions').insert({
          householdId: user.householdId,
          accountId,
          amount: cost,
          description: `Compra de Ativo: ${body.ticker || body.name}`,
          type: 'EXPENSE',
          isPaid: true,
          date: body.purchaseDate ? new Date(body.purchaseDate).toISOString() : new Date().toISOString(),
        });
      }
    }

    const { data: investment } = await supabase
      .from('investments')
      .insert({
        ...investmentData,
        householdId: user.householdId,
        ...(body.purchaseDate && { purchaseDate: new Date(body.purchaseDate).toISOString() }),
      })
      .select()
      .single();
    return created(investment);
  } catch (err) {
    console.error('[investments POST]', err);
    return serverError();
  }
});
