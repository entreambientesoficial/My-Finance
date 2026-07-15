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
        const ticker = body.ticker ? String(body.ticker).toUpperCase() : body.name;
        await supabase.from('transactions').insert({
          id: crypto.randomUUID(),
          householdId: user.householdId,
          accountId,
          amount: cost,
          description: `Aporte: ${ticker}`,
          type: 'TRANSFER',
          isPaid: true,
          date: body.purchaseDate ? new Date(body.purchaseDate).toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // For variable assets (non-BOND), merge with existing record if same ticker+type exists
    const canMerge = investmentData.type && investmentData.type !== 'BOND' && investmentData.ticker;
    if (canMerge) {
      const { data: existing } = await supabase
        .from('investments')
        .select('id, quantity, purchasePrice')
        .eq('householdId', user.householdId)
        .eq('ticker', String(investmentData.ticker).toUpperCase())
        .eq('type', investmentData.type)
        .maybeSingle();

      if (existing) {
        const addQty = Number(investmentData.quantity || 0);
        const prevQty = Number(existing.quantity || 0);
        const totalQty = prevQty + addQty;
        const avgPrice =
          totalQty > 0
            ? (prevQty * Number(existing.purchasePrice) + addQty * Number(investmentData.purchasePrice || 0)) / totalQty
            : Number(existing.purchasePrice);

        const { data: merged } = await supabase
          .from('investments')
          .update({ quantity: totalQty, purchasePrice: avgPrice, updatedAt: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        return ok(merged);
      }

      // Normalise ticker to uppercase before insert
      investmentData.ticker = String(investmentData.ticker).toUpperCase();
    }

    const { data: investment, error: invError } = await supabase
      .from('investments')
      .insert({
        id: crypto.randomUUID(),
        ...investmentData,
        householdId: user.householdId,
        updatedAt: new Date().toISOString(),
        ...(body.purchaseDate && { purchaseDate: new Date(body.purchaseDate).toISOString() }),
      })
      .select()
      .single();
    if (invError) { console.error('[investments POST insert]', invError); return serverError(invError.message); }
    return created(investment);
  } catch (err) {
    console.error('[investments POST]', err);
    return serverError();
  }
});
