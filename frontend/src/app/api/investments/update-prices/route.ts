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
    for (const inv of investments) {
      if (!inv.ticker) continue;
      if (inv.type === 'CRYPTO') cryptoCoins.push(inv.ticker.toUpperCase());
      else stockTickers.push(inv.ticker.toUpperCase());
    }

    const [stockPrices, cryptoPrices] = await Promise.all([
      fetchStockPrices(Array.from(new Set(stockTickers))),
      fetchCryptoPrices(Array.from(new Set(cryptoCoins))),
    ]);

    const allPrices = { ...stockPrices, ...cryptoPrices };
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
