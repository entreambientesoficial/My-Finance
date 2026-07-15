export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, created, notFound, serverError } from '@/lib/api-response';

// parentId included so we can resolve subcategory → parent on the server
const TX_SELECT = '*, category:categories(id, name, color, icon, parentId), account:accounts!accountId(id, name), toAccount:accounts!toAccountId(id, name), card:cards(id, name)';

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const sp = new URL(req.url).searchParams;
    const type        = sp.get('type');
    const categoryId  = sp.get('categoryId');
    const accountId   = sp.get('accountId');
    const cardId      = sp.get('cardId');
    const startDate   = sp.get('startDate');
    const endDate     = sp.get('endDate');
    const isPaidStr   = sp.get('isPaid');
    const page        = Math.max(1, parseInt(sp.get('page') ?? '1'));
    const limit       = Math.min(100, parseInt(sp.get('limit') ?? '20'));
    const sortByRaw   = sp.get('sortBy') ?? 'date';
    const sortDir     = sp.get('sortDir') === 'asc';
    const allowedSort = ['date', 'amount', 'description', 'isPaid', 'category', 'account'];
    const sortBy      = allowedSort.includes(sortByRaw) ? sortByRaw : 'date';

    const supabase = createAdminClient();

    // Fetch all categories to resolve subcategory → parent
    const { data: allCats } = await supabase
      .from('categories').select('id, name, color, icon, parentId')
      .eq('householdId', user.householdId);

    const catById: Record<string, any> = {};
    for (const c of allCats ?? []) catById[c.id] = c;

    // Returns top-level category for a given categoryId
    const resolveTopCat = (catId: string | null) => {
      if (!catId) return null;
      const cat = catById[catId];
      if (!cat) return null;
      return (cat.parentId && catById[cat.parentId]) ? catById[cat.parentId] : cat;
    };

    // Base filtered query (no sort/pagination yet)
    let baseQuery = supabase
      .from('transactions')
      .select(TX_SELECT, { count: 'exact' })
      .eq('householdId', user.householdId);

    if (type)           baseQuery = baseQuery.eq('type', type);
    if (categoryId)     baseQuery = baseQuery.eq('categoryId', categoryId);
    if (accountId)      baseQuery = baseQuery.eq('accountId', accountId);
    if (cardId)         baseQuery = baseQuery.eq('cardId', cardId);
    if (isPaidStr !== null) baseQuery = baseQuery.eq('isPaid', isPaidStr === 'true');
    if (startDate)      baseQuery = baseQuery.gte('date', startDate);
    if (endDate)        baseQuery = baseQuery.lte('date', endDate + 'T23:59:59');

    // Category sort: resolve in memory so we sort by parent-category name
    if (sortBy === 'category') {
      const { data: allData, count } = await baseQuery.order('date', { ascending: false }).limit(2000);
      const resolved = (allData ?? []).map(tx => ({
        ...tx,
        displayCategory: resolveTopCat(tx.categoryId),
      }));
      const asc = sortDir ? 1 : -1;
      resolved.sort((a, b) => {
        const na = a.displayCategory?.name ?? '';
        const nb = b.displayCategory?.name ?? '';
        return na.localeCompare(nb, 'pt-BR') * asc;
      });
      const total = count ?? resolved.length;
      const pageData = resolved.slice((page - 1) * limit, page * limit);
      return ok({ data: pageData, total, page, limit, pages: Math.ceil(total / limit) });
    }

    // All other sorts: use DB ordering
    let query = baseQuery;
    if (sortBy === 'account') {
      query = query.order('name', { foreignTable: 'accounts', ascending: sortDir });
    } else {
      query = query.order(sortBy, { ascending: sortDir });
    }
    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, count } = await query;
    const total = count ?? 0;

    // Add displayCategory to every transaction
    const resolvedData = (data ?? []).map(tx => ({
      ...tx,
      displayCategory: resolveTopCat(tx.categoryId),
    }));

    return ok({ data: resolvedData, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[transactions GET]', err);
    return serverError();
  }
});

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getNextDate(start: Date, index: number, frequency: string): Date {
  if (frequency === 'WEEKLY') return addDays(start, index * 7);
  if (frequency === 'YEARLY') { const d = new Date(start); d.setFullYear(d.getFullYear() + index); return d; }
  if (frequency === 'DAILY') return addDays(start, index);
  return addMonths(start, index); // MONTHLY default
}

async function adjustBalance(supabase: any, accountId: string, delta: number) {
  const { data: acc } = await supabase.from('accounts').select('balance').eq('id', accountId).single();
  await supabase.from('accounts').update({ balance: parseFloat(acc?.balance ?? '0') + delta }).eq('id', accountId);
}

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const body = await req.json();
    const supabase = createAdminClient();

    const recurrenceType: string = body.recurrenceType || 'ONCE';
    const isCard = !!body.cardId;
    const startDate = new Date(body.date);
    const now = new Date();

    // Multiple transactions: INSTALLMENT or RECURRING
    if (recurrenceType === 'INSTALLMENT' || recurrenceType === 'RECURRING') {
      const n = Math.max(2, parseInt(body.totalInstallments) || 2);
      const frequency: string = body.recurrenceFrequency || 'MONTHLY';
      const groupId = crypto.randomUUID();
      const isInstallment = recurrenceType === 'INSTALLMENT';

      const txsToInsert: any[] = [];
      let totalBalanceDelta = 0;

      for (let i = 0; i < n; i++) {
        const txDate = getNextDate(startDate, i, frequency);
        const isPastOrToday = txDate <= now;
        // Past/today: respect user's isPaid choice. Future: always pending.
        // Card transactions: never affect balance regardless.
        const isPaidThis = isCard ? false : (isPastOrToday ? body.isPaid !== false : false);

        const descSuffix = isInstallment ? ` ${i + 1}/${n}` : '';
        txsToInsert.push({
          id: crypto.randomUUID(),
          householdId: user.householdId,
          type: body.type,
          amount: body.amount,
          description: (body.description || '') + descSuffix,
          date: txDate.toISOString(),
          purchaseDate: body.purchaseDate ? new Date(body.purchaseDate).toISOString() : null,
          accountId: body.accountId || null,
          toAccountId: body.toAccountId || null,
          cardId: body.cardId || null,
          categoryId: body.categoryId || null,
          isPaid: isPaidThis,
          recurrenceGroupId: groupId,
          installmentNumber: i + 1,
          totalInstallments: n,
          recurrenceFrequency: frequency,
          recurrenceType,
          updatedAt: new Date().toISOString(),
        });

        if (!isCard && isPaidThis) {
          const amount = parseFloat(body.amount);
          if (body.type === 'EXPENSE') totalBalanceDelta -= amount;
          else if (body.type === 'INCOME') totalBalanceDelta += amount;
        }
      }

      const { data: txs, error } = await supabase.from('transactions').insert(txsToInsert).select(TX_SELECT);
      if (error) { console.error('[transactions POST multi insert]', error); return serverError(error.message); }

      // Single balance update for all paid transactions
      if (totalBalanceDelta !== 0 && body.accountId) {
        await adjustBalance(supabase, body.accountId, totalBalanceDelta);
      }
      // TRANSFER not supported for multi-transaction (edge case, skip)

      return created(txs);
    }

    // Single transaction
    const isPaid = isCard ? false : body.isPaid !== false;

    const txData: any = {
      id: crypto.randomUUID(),
      householdId: user.householdId,
      type: body.type,
      amount: body.amount,
      description: body.description || null,
      date: startDate.toISOString(),
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate).toISOString() : null,
      accountId: body.accountId || null,
      toAccountId: body.toAccountId || null,
      cardId: body.cardId || null,
      categoryId: body.categoryId || null,
      isPaid,
      recurrenceType: 'ONCE',
      updatedAt: new Date().toISOString(),
    };

    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .insert(txData)
      .select(TX_SELECT)
      .single();
    if (txError) { console.error('[transactions POST insert]', txError); return serverError(txError.message); }

    // Balance update only for non-card paid transactions
    if (isPaid && !isCard) {
      const amount = parseFloat(body.amount);
      if (body.type === 'INCOME' && body.accountId) {
        await adjustBalance(supabase, body.accountId, amount);
      } else if (body.type === 'EXPENSE' && body.accountId) {
        await adjustBalance(supabase, body.accountId, -amount);
      } else if (body.type === 'TRANSFER' && body.accountId && body.toAccountId) {
        await Promise.all([
          adjustBalance(supabase, body.accountId, -amount),
          adjustBalance(supabase, body.toAccountId, amount),
        ]);
      }
    }

    return created(tx);
  } catch (err) {
    console.error('[transactions POST]', err);
    return serverError();
  }
});
