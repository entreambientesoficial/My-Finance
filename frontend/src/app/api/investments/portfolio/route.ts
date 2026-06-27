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

async function getCDIAnual(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json',
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return 13.25;
    const data = await res.json();
    // BACEN retorna a taxa CDI anual em % (ex: "13.25")
    return Number(String(data[0]?.valor ?? '13.25').replace(',', '.'));
  } catch { return 13.25; }
}

function calcBondCurrentValue(inv: any, cdiAnual: number): number {
  const principal = Number(inv.purchasePrice || 0);
  if (!inv.purchaseDate || principal <= 0) return principal;

  const notes = inv.notes ? (() => { try { return JSON.parse(inv.notes); } catch { return {}; } })() : {};
  const indexador: string = notes.indexador || 'CDI';
  const taxa = Number(notes.taxa ?? 100);

  const start = new Date(inv.purchaseDate);
  const now = new Date();
  const calendarDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const businessDays = Math.round(calendarDays * 252 / 365);

  let annualRate: number;
  if (indexador === 'CDI' || indexador === 'SELIC') {
    annualRate = cdiAnual * (taxa / 100); // ex: 100% × 13.25% = 13.25% a.a.
  } else if (indexador === 'Prefixado') {
    annualRate = taxa; // taxa já é % ao ano
  } else {
    annualRate = cdiAnual * (taxa / 100);
  }

  // Capitalização composta: (1 + r_anual)^(dias_úteis/252)
  return Math.round(principal * Math.pow(1 + annualRate / 100, businessDays / 252) * 100) / 100;
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
    const hasBonds = (investments ?? []).some((inv: any) => inv.type === 'BOND');

    const [usdBrlRate, cdiAnual] = await Promise.all([
      hasUSStocks ? getUsdBrlRate() : Promise.resolve(1),
      hasBonds ? getCDIAnual() : Promise.resolve(13.25),
    ]);

    const summary = (investments ?? []).map((inv) => {
      const isUSD = inv.type === 'STOCK_US';
      const isBond = inv.type === 'BOND';
      const toRate = isUSD ? usdBrlRate : 1;

      const cost = isBond
        ? Number(inv.purchasePrice || 0)
        : Number(inv.quantity || 0) * Number(inv.purchasePrice || 0) * toRate;

      const currentPriceBRL = isBond
        ? calcBondCurrentValue(inv, cdiAnual)
        : Number(inv.quantity || 0) * Number(inv.currentPrice || inv.purchasePrice || 0) * toRate;

      const gain = currentPriceBRL - cost;
      const gainPct = cost > 0 ? (gain / cost) * 100 : 0;

      return {
        ...inv,
        cost,
        current: currentPriceBRL,
        gain,
        gainPct: Math.round(gainPct * 100) / 100,
        currency: isUSD ? 'USD' : 'BRL',
      };
    });

    const totalCost = summary.reduce((s, i) => s + i.cost, 0);
    const totalCurrent = summary.reduce((s, i) => s + i.current, 0);
    const totalGain = totalCurrent - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return ok({
      investments: summary,
      totalCost,
      totalCurrent,
      totalGain,
      totalGainPct: Math.round(totalGainPct * 100) / 100,
      usdBrlRate,
      cdiAnual,
    });
  } catch (err) {
    console.error('[investments/portfolio GET]', err);
    return serverError();
  }
});
