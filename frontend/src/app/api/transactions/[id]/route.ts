export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

const TX_SELECT = '*, category:categories(*), account:accounts!accountId(*), toAccount:accounts!toAccountId(*), card:cards(*)';

async function adjustBalance(supabase: any, householdId: string, accountId: string, delta: number) {
  const { data: acc } = await supabase
    .from('accounts')
    .select('balance')
    .eq('id', accountId)
    .eq('householdId', householdId)
    .maybeSingle();
  if (!acc) return;
  await supabase
    .from('accounts')
    .update({ balance: parseFloat(acc.balance ?? '0') + delta })
    .eq('id', accountId)
    .eq('householdId', householdId);
}

// Apply or reverse a transaction's balance effect.
// pass reverse=true to undo a previously applied effect.
async function applyTxBalance(
  supabase: any,
  householdId: string,
  tx: { isPaid: boolean; cardId: string | null; type: string; amount: string | number; accountId: string | null; toAccountId: string | null },
  reverse = false,
) {
  if (!tx.isPaid || tx.cardId) return; // card invoices are settled separately
  const sign = reverse ? -1 : 1;
  const amount = parseFloat(String(tx.amount));
  if (tx.type === 'INCOME' && tx.accountId) {
    await adjustBalance(supabase, householdId, tx.accountId, sign * amount);
  } else if (tx.type === 'EXPENSE' && tx.accountId) {
    await adjustBalance(supabase, householdId, tx.accountId, sign * -amount);
  } else if (tx.type === 'TRANSFER' && tx.accountId && tx.toAccountId) {
    await adjustBalance(supabase, householdId, tx.accountId, sign * -amount);
    await adjustBalance(supabase, householdId, tx.toAccountId, sign * amount);
  }
}

export function GET(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('transactions')
        .select(TX_SELECT)
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .maybeSingle();
      if (!data) return notFound('Transação não encontrada');
      return ok(data);
    } catch (err) {
      console.error('[transactions/:id GET]', err);
      return serverError();
    }
  })(req);
}

export function PATCH(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      const { data: oldTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .maybeSingle();
      if (!oldTx) return notFound('Transação não encontrada');

      const raw = await r.json();
      const { id: _id, householdId: _hid, createdAt: _ca, recurrenceGroupId: _rgi, ...body } = raw;
      const updateData: any = {
        ...body,
        ...(body.date && { date: new Date(body.date).toISOString() }),
        ...(body.paidDate !== undefined && { paidDate: body.paidDate ? new Date(body.paidDate).toISOString() : null }),
        ...(body.isPaid === false && { paidDate: null }),
        ...(body.purchaseDate !== undefined && { purchaseDate: body.purchaseDate ? new Date(body.purchaseDate).toISOString() : null }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId || null }),
        ...(body.accountId !== undefined && { accountId: body.accountId || null }),
        ...(body.toAccountId !== undefined && { toAccountId: body.toAccountId || null }),
        ...(body.cardId !== undefined && { cardId: body.cardId || null }),
      };

      const { data: updated } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      // Balance recalculation: reverse old state, apply new state.
      // Triggers whenever any balance-affecting field is present in the request body.
      const balanceFieldsInBody = ['isPaid', 'amount', 'accountId', 'toAccountId', 'type', 'cardId'];
      if (balanceFieldsInBody.some((f) => f in body)) {
        const newState = {
          isPaid: body.isPaid !== undefined ? body.isPaid === true : oldTx.isPaid,
          cardId: body.cardId !== undefined ? (body.cardId || null) : oldTx.cardId,
          type: body.type || oldTx.type,
          amount: body.amount !== undefined ? body.amount : oldTx.amount,
          accountId: body.accountId !== undefined ? (body.accountId || null) : oldTx.accountId,
          toAccountId: body.toAccountId !== undefined ? (body.toAccountId || null) : oldTx.toAccountId,
        };
        // Reverse whatever the old state contributed to balance, then apply the new state
        await applyTxBalance(supabase, user.householdId, oldTx, true);
        await applyTxBalance(supabase, user.householdId, newState);
      }

      return ok(updated);
    } catch (err) {
      console.error('[transactions/:id PATCH]', err);
      return serverError();
    }
  })(req);
}

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      const { data: tx } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .maybeSingle();
      if (!tx) return notFound('Transação não encontrada');

      await supabase.from('transactions').delete().eq('id', params.id).eq('householdId', user.householdId);

      // Reverse the balance effect of the deleted transaction
      await applyTxBalance(supabase, user.householdId, tx, true);

      return ok({ message: 'Transação removida' });
    } catch (err) {
      console.error('[transactions/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
