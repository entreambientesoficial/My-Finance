export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const supabase = createAdminClient();

    const [{ data: accounts }, { data: investments }] = await Promise.all([
      supabase.from('accounts').select('name, type, balance').eq('householdId', user.householdId).eq('isActive', true),
      supabase.from('investments').select('name, type, quantity, currentPrice, purchasePrice').eq('householdId', user.householdId),
    ]);

    const bankBalance = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0);
    const investmentValue = (investments ?? []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.currentPrice || i.purchasePrice || 0), 0);
    return ok({ bankBalance, investmentValue, netWorth: bankBalance + investmentValue, accounts: accounts ?? [], investments: investments ?? [] });
  } catch (err) {
    console.error('[reports/net-worth GET]', err);
    return serverError();
  }
});
