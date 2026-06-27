export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

const TX_SELECT = '*, category:categories(*), account:accounts!accountId(*), toAccount:accounts!toAccountId(*), card:cards(*)';

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

      const body = await r.json();
      const updateData: any = {
        ...body,
        ...(body.date && { date: new Date(body.date).toISOString() }),
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

      // Card transactions never adjust account balance directly (settled via "Pagar Fatura")
      if (body.isPaid !== undefined && oldTx.isPaid !== (body.isPaid === true) && !oldTx.cardId) {
        const isMarkedPaid = body.isPaid === true;
        const amount = parseFloat(oldTx.amount);
        const accId = oldTx.accountId;
        const toAccId = oldTx.toAccountId;

        const adjustBalance = async (id: string, delta: number) => {
          const { data: acc } = await supabase.from('accounts').select('balance').eq('id', id).single();
          await supabase.from('accounts').update({ balance: parseFloat(acc?.balance ?? '0') + delta }).eq('id', id);
        };

        if (isMarkedPaid) {
          if (oldTx.type === 'INCOME' && accId) await adjustBalance(accId, amount);
          else if (oldTx.type === 'EXPENSE' && accId) await adjustBalance(accId, -amount);
          else if (oldTx.type === 'TRANSFER' && accId && toAccId) {
            await adjustBalance(accId, -amount);
            await adjustBalance(toAccId, amount);
          }
        } else {
          if (oldTx.type === 'INCOME' && accId) await adjustBalance(accId, -amount);
          else if (oldTx.type === 'EXPENSE' && accId) await adjustBalance(accId, amount);
          else if (oldTx.type === 'TRANSFER' && accId && toAccId) {
            await adjustBalance(accId, amount);
            await adjustBalance(toAccId, -amount);
          }
        }
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
        .select('id')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .maybeSingle();
      if (!tx) return notFound('Transação não encontrada');
      await supabase.from('transactions').delete().eq('id', params.id);
      return ok({ message: 'Transação removida' });
    } catch (err) {
      console.error('[transactions/:id DELETE]', err);
      return serverError();
    }
  })(req);
}
