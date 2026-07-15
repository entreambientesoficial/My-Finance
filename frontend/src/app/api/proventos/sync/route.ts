export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, serverError } from '@/lib/api-response';

interface YahooDividend {
  rate: number;
  dataCom: Date;     // ex-dividend date
  dataPagamento: Date;
}

// Yahoo Finance has dividend events for all B3 assets — no token needed
async function fetchDividendsYahoo(ticker: string): Promise<YahooDividend[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SA?events=div&range=2y&interval=1mo`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyFinance/1.0)' },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.error(`[proventos/sync] Yahoo ${ticker} HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const divEvents: Record<string, { amount: number; date: number }> =
      data?.chart?.result?.[0]?.events?.dividends ?? {};

    const results: YahooDividend[] = [];
    for (const d of Object.values(divEvents)) {
      if (!d.amount || !d.date) continue;
      const dataCom = new Date(d.date * 1000);
      // FIIs and BR stocks typically pay 3 business days after ex-date
      const dataPagamento = new Date(dataCom);
      dataPagamento.setDate(dataPagamento.getDate() + 3);
      results.push({ rate: Number(d.amount), dataCom, dataPagamento });
    }
    console.log(`[proventos/sync] Yahoo ${ticker}: ${results.length} dividendos`);
    return results;
  } catch (e) {
    console.error(`[proventos/sync] Yahoo ${ticker} erro:`, e);
    return [];
  }
}

export const POST = withAuth(async (_req: NextRequest, user) => {
  if (!user.householdId) return serverError();

  const supabase = createAdminClient();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Only STOCK (Ações BR) and FUND (FIIs) have dividend events on B3
  const { data: investments } = await supabase
    .from('investments')
    .select('ticker, quantity, purchaseDate')
    .eq('householdId', user.householdId)
    .not('ticker', 'is', null)
    .in('type', ['STOCK', 'FUND']);

  console.log(`[proventos/sync] Ativos BR com ticker: ${investments?.length ?? 0}`);

  if (!investments?.length) {
    return ok({ synced: 0, aReceber: 0, tickersChecked: [], noDataTickers: [] });
  }

  // Merge multiple entries for the same ticker (e.g. multiple purchases)
  const tickerMap: Record<string, { quantidade: number; purchaseDate: Date | null }> = {};
  for (const inv of investments) {
    if (!inv.ticker) continue;
    const tk = inv.ticker.toUpperCase();
    if (!tickerMap[tk]) tickerMap[tk] = { quantidade: 0, purchaseDate: null };
    tickerMap[tk].quantidade += Number(inv.quantity || 0);
    if (inv.purchaseDate) {
      const d = new Date(inv.purchaseDate);
      if (!tickerMap[tk].purchaseDate || d < tickerMap[tk].purchaseDate!) {
        tickerMap[tk].purchaseDate = d;
      }
    }
  }

  let synced = 0;
  let aReceber = 0;
  const tickersChecked: string[] = [];
  const noDataTickers: string[] = [];
  const lookbackLimit = new Date();
  lookbackLimit.setMonth(lookbackLimit.getMonth() - 24);

  for (const [ticker, { quantidade, purchaseDate }] of Object.entries(tickerMap)) {
    if (quantidade <= 0) continue;
    tickersChecked.push(ticker);

    const dividends = await fetchDividendsYahoo(ticker);
    if (dividends.length === 0) {
      noDataTickers.push(ticker);
      continue;
    }

    for (const { rate, dataCom, dataPagamento } of dividends) {
      // Skip if investor didn't own the asset on the ex-dividend date
      if (purchaseDate && purchaseDate > dataCom) continue;
      // Skip dividends older than 24 months
      if (dataCom < lookbackLimit) continue;

      const valorTotal = Number((rate * quantidade).toFixed(2));
      const status = dataPagamento <= hoje ? 'PAGO' : 'A_RECEBER';

      try {
        await supabase.from('proventos').upsert(
          {
            householdId: user.householdId,
            ticker,
            tipo: 'Rendimento',
            valorPorCota: rate,
            dataCom: dataCom.toISOString(),
            dataPagamento: dataPagamento.toISOString(),
            status,
            quantidade,
            valorTotal,
            relatedTo: null,
          },
          { onConflict: 'householdId,ticker,dataCom,tipo' }
        );
        synced++;
        if (status === 'A_RECEBER') aReceber++;
      } catch (e) {
        console.error(`[proventos/sync] upsert ${ticker} erro:`, e);
      }
    }
  }

  // Mark past A_RECEBER as PAGO
  await supabase
    .from('proventos')
    .update({ status: 'PAGO' })
    .eq('householdId', user.householdId)
    .eq('status', 'A_RECEBER')
    .lte('dataPagamento', hoje.toISOString());

  console.log(`[proventos/sync] Resultado: ${synced} upserts, noData: ${noDataTickers.join(', ')}`);

  return ok({ synced, aReceber, tickersChecked, noDataTickers });
});
