export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

const BRAPI_TOKEN = process.env.BRAPI_TOKEN || '';
const BRAPI_BASE = 'https://brapi.dev/api';

async function fetchStockPrices(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {};
  const url = `${BRAPI_BASE}/quote/${tickers.join(',')}${BRAPI_TOKEN ? `?token=${BRAPI_TOKEN}` : ''}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return {};
    const json = await res.json();
    const map: Record<string, number> = {};
    for (const item of json.results || []) {
      if (item.symbol && item.regularMarketPrice != null) map[item.symbol.toUpperCase()] = Number(item.regularMarketPrice);
    }
    return map;
  } catch { return {}; }
}

async function fetchCryptoPrices(coins: string[]): Promise<Record<string, number>> {
  if (!coins.length) return {};
  const url = `${BRAPI_BASE}/v2/crypto?coin=${coins.join(',')}&currency=BRL${BRAPI_TOKEN ? `&token=${BRAPI_TOKEN}` : ''}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return {};
    const json = await res.json();
    const map: Record<string, number> = {};
    for (const item of json.coins || []) {
      if (item.coin && item.regularMarketPrice != null) map[item.coin.toUpperCase()] = Number(item.regularMarketPrice);
    }
    return map;
  } catch { return {}; }
}

async function fetchUSStockPrices(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {};
  const results: Record<string, number> = {};
  await Promise.all(tickers.map(async (ticker) => {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyFinance/1.0)' }, next: { revalidate: 0 } }
      );
      if (!res.ok) return;
      const json = await res.json();
      const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price != null) results[ticker.toUpperCase()] = Number(price);
    } catch {}
  }));
  return results;
}

export const POST = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const supabase = createAdminClient();
    const { data: investments } = await supabase
      .from('investments')
      .select('*')
      .eq('householdId', user.householdId)
      .not('ticker', 'is', null);

    if (!investments?.length) return ok({ updated: 0, prices: {} });

    const stockTickers: string[] = [];
    const cryptoCoins: string[] = [];
    const usStockTickers: string[] = [];

    for (const inv of investments) {
      if (!inv.ticker) continue;
      if (inv.type === 'CRYPTO') cryptoCoins.push(inv.ticker.toUpperCase());
      else if (inv.type === 'STOCK_US') usStockTickers.push(inv.ticker.toUpperCase());
      else stockTickers.push(inv.ticker.toUpperCase());
    }

    const [stockPrices, cryptoPrices, usPrices] = await Promise.all([
      fetchStockPrices(Array.from(new Set(stockTickers))),
      fetchCryptoPrices(Array.from(new Set(cryptoCoins))),
      fetchUSStockPrices(Array.from(new Set(usStockTickers))),
    ]);

    const allPrices = { ...stockPrices, ...cryptoPrices, ...usPrices };
    let updated = 0;

    for (const inv of investments) {
      if (!inv.ticker) continue;
      const price = allPrices[inv.ticker.toUpperCase()];
      if (price && price > 0) {
        await supabase.from('investments').update({ currentPrice: price }).eq('id', inv.id);
        updated++;
      }
    }

    return ok({ updated, prices: allPrices, notFound: investments.length - updated });
  } catch (err) {
    console.error('[investments/update-prices POST]', err);
    return serverError();
  }
});
