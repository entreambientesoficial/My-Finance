export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const supabase = createAdminClient();
    const { data: investments } = await supabase
      .from('investments')
      .select('*')
      .eq('householdId', user.householdId)
      .order('name', { ascending: true });

    const summary = (investments ?? []).map((inv) => {
      const cost = Number(inv.quantity || 0) * Number(inv.purchasePrice || 0);
      const current = Number(inv.quantity || 0) * Number(inv.currentPrice || inv.purchasePrice || 0);
      const gain = current - cost;
      const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
      return { ...inv, cost, current, gain, gainPct: Math.round(gainPct * 100) / 100 };
    });

    const totalCost = summary.reduce((s, i) => s + i.cost, 0);
    const totalCurrent = summary.reduce((s, i) => s + i.current, 0);
    const totalGain = totalCurrent - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return ok({ investments: summary, totalCost, totalCurrent, totalGain, totalGainPct: Math.round(totalGainPct * 100) / 100 });
  } catch (err) {
    console.error('[investments/portfolio GET]', err);
    return serverError();
  }
});
