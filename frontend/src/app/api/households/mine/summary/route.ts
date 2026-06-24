import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    if (!user.householdId) return notFound('Household não encontrado');
    const hId = user.householdId;
    const supabase = createAdminClient();

    const [{ data: accounts }, { data: cards }, { data: goals }, { data: budgets }] = await Promise.all([
      supabase.from('accounts').select('id, name, type, balance, currency').eq('householdId', hId).eq('isActive', true),
      supabase.from('cards').select('id, name, brand, creditLimit').eq('householdId', hId).eq('isActive', true),
      supabase.from('goals').select('id, name, targetAmount, currentAmount').eq('householdId', hId).eq('isCompleted', false),
      supabase.from('budgets').select('id, name, amount, period').eq('householdId', hId).eq('isActive', true),
    ]);

    const totalBalance = (accounts ?? []).reduce((sum, a) => sum + parseFloat(a.balance ?? '0'), 0);
    return ok({ accounts: accounts ?? [], cards: cards ?? [], goals: goals ?? [], budgets: budgets ?? [], totalBalance });
  } catch (err) {
    console.error('[households/mine/summary GET]', err);
    return serverError();
  }
});
