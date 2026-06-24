import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

const TX_SELECT = '*, category:categories(id, name, color, icon), account:accounts(id, name), toAccount:accounts!toAccountId(id, name), card:cards(id, name)';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const type = sp.get('type');
    const categoryId = sp.get('categoryId');
    const accountId = sp.get('accountId');
    const cardId = sp.get('cardId');
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');
    const isPaidStr = sp.get('isPaid');
    const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(sp.get('limit') ?? '20'));

    const supabase = createAdminClient();
    let query = supabase
      .from('transactions')
      .select(TX_SELECT, { count: 'exact' })
      .eq('householdId', user.householdId)
      .order('date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (type) query = query.eq('type', type);
    if (categoryId) query = query.eq('categoryId', categoryId);
    if (accountId) query = query.eq('accountId', accountId);
    if (cardId) query = query.eq('cardId', cardId);
    if (isPaidStr !== null) query = query.eq('isPaid', isPaidStr === 'true');
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate + 'T23:59:59');

    const { data, count } = await query;
    const total = count ?? 0;
    return ok({ data: data ?? [], total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[transactions GET]', err);
    return serverError();
  }
});

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const supabase = createAdminClient();

    const txData: any = {
      ...body,
      householdId: user.householdId,
      date: new Date(body.date).toISOString(),
      categoryId: body.categoryId || null,
      accountId: body.accountId || null,
      toAccountId: body.toAccountId || null,
      cardId: body.cardId || null,
    };

    const { data: tx } = await supabase
      .from('transactions')
      .insert(txData)
      .select(TX_SELECT)
      .single();

    if (body.isPaid !== false) {
      const amount = parseFloat(body.amount);
      if (body.type === 'INCOME' && body.accountId) {
        const { data: acc } = await supabase.from('accounts').select('balance').eq('id', body.accountId).single();
        await supabase.from('accounts').update({ balance: parseFloat(acc?.balance ?? '0') + amount }).eq('id', body.accountId);
      } else if (body.type === 'EXPENSE' && body.accountId) {
        const { data: acc } = await supabase.from('accounts').select('balance').eq('id', body.accountId).single();
        await supabase.from('accounts').update({ balance: parseFloat(acc?.balance ?? '0') - amount }).eq('id', body.accountId);
      } else if (body.type === 'TRANSFER' && body.accountId && body.toAccountId) {
        const [{ data: from }, { data: to }] = await Promise.all([
          supabase.from('accounts').select('balance').eq('id', body.accountId).single(),
          supabase.from('accounts').select('balance').eq('id', body.toAccountId).single(),
        ]);
        await Promise.all([
          supabase.from('accounts').update({ balance: parseFloat(from?.balance ?? '0') - amount }).eq('id', body.accountId),
          supabase.from('accounts').update({ balance: parseFloat(to?.balance ?? '0') + amount }).eq('id', body.toAccountId),
        ]);
      }
    }

    return created(tx);
  } catch (err) {
    console.error('[transactions POST]', err);
    return serverError();
  }
});
