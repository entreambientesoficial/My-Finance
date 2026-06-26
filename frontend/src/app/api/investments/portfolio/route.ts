export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

const BRAPI_TOKEN = process.env.BRAPI_TOKEN || '';

async function getUsdBrlRate(): Promise<number> {
  try {
    const url = `https://brapi.dev/api/v2/currency?currency=USD-BRL${BRAPI_TOKEN ? `&token=${BRAPI_TOKEN}` : ''}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return 5.75;
    const json = await res.json();
    return Number(json.currency?.[0]?.bid ?? 5.75);
  } catch { return 5.75; }
}

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const supabase = createAdminClient();
    const { data: investments } = await supabase
      .from('investments')
      .select('*')
      .eq('householdId', user.householdId)
      .order('name', { ascending: true });

    const hasUSStocks = (investments ?? []).some((inv: any) => inv.type === 'STOCK_US');
    const usdBrlRate = hasUSStocks ? await getUsdBrlRate() : 1;

    const summary = (investments ?? []).map((inv) => {
      const isUSD = inv.type === 'STOCK_US';
      const toRate = isUSD ? usdBrlRate : 1;
      const cost = Number(inv.quantity || 0) * Number(inv.purchasePrice || 0) * toRate;
      const current = Number(inv.quantity || 0) * Number(inv.currentPrice || inv.purchasePrice || 0) * toRate;
      const gain = current - cost;
      const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
      return { ...inv, cost, current, gain, gainPct: Math.round(gainPct * 100) / 100, currency: isUSD ? 'USD' : 'BRL' };
    });

    const totalCost = summary.reduce((s, i) => s + i.cost, 0);
    const totalCurrent = summary.reduce((s, i) => s + i.current, 0);
    const totalGain = totalCurrent - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return ok({ investments: summary, totalCost, totalCurrent, totalGain, totalGainPct: Math.round(totalGainPct * 100) / 100, usdBrlRate });
  } catch (err) {
    console.error('[investments/portfolio GET]', err);
    return serverError();
  }
});
