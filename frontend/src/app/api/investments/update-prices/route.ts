import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, serverError } from '@/lib/api-response';

const BRAPI_TOKEN = process.env.BRAPI_TOKEN || '';
const BRAPI_BASE = 'https://brapi.dev/api';

async function fetchStockPrices(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {};
  const joined = tickers.join(',');
  const url = `${BRAPI_BASE}/quote/${joined}${BRAPI_TOKEN ? `?token=${BRAPI_TOKEN}` : ''}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return {};
    const json = await res.json();
    const map: Record<string, number> = {};
    for (const item of json.results || []) {
      if (item.symbol && item.regularMarketPrice != null) {
        map[item.symbol.toUpperCase()] = Number(item.regularMarketPrice);
      }
    }
    return map;
  } catch {
    return {};
  }
}

async function fetchCryptoPrices(coins: string[]): Promise<Record<string, number>> {
  if (!coins.length) return {};
  const joined = coins.join(',');
  const url = `${BRAPI_BASE}/v2/crypto?coin=${joined}&currency=BRL${BRAPI_TOKEN ? `&token=${BRAPI_TOKEN}` : ''}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return {};
    const json = await res.json();
    const map: Record<string, number> = {};
    for (const item of json.coins || []) {
      if (item.coin && item.regularMarketPrice != null) {
        map[item.coin.toUpperCase()] = Number(item.regularMarketPrice);
      }
    }
    return map;
  } catch {
    return {};
  }
}

export const POST = withAuth(async (_req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();

    const investments = await prisma.investment.findMany({
      where: { householdId: user.householdId, ticker: { not: null } },
    });

    if (!investments.length) return ok({ updated: 0, prices: {} });

    const stockTickers: string[] = [];
    const cryptoCoins: string[] = [];

    for (const inv of investments) {
      if (!inv.ticker) continue;
      const ticker = inv.ticker.toUpperCase();
      if (inv.type === 'CRYPTO') {
        cryptoCoins.push(ticker);
      } else {
        stockTickers.push(ticker);
      }
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
        await prisma.investment.update({
          where: { id: inv.id },
          data: { currentPrice: price },
        });
        updated++;
      }
    }

    return ok({ updated, prices: allPrices, notFound: investments.length - updated });
  } catch (err) {
    console.error('[investments/update-prices POST]', err);
    return serverError();
  }
});
