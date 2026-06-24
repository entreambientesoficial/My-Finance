import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, serverError } from '@/lib/api-response';

const BRAPI_BASE = 'https://brapi.dev/api';
const TOKEN = process.env.BRAPI_TOKEN || '';

interface BrapiDividend {
  assetIssued: string;
  paymentDate: string;
  rate: number;
  relatedTo: string;
  label: string;
  lastDatePrior: string;
}

async function fetchDividends(ticker: string): Promise<BrapiDividend[]> {
  try {
    const url = `${BRAPI_BASE}/quote/${ticker}?dividends=true&token=${TOKEN}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = await res.json();
    const result = data?.results?.[0];
    return result?.dividendsData?.cashDividends ?? [];
  } catch {
    return [];
  }
}

export const POST = withAuth(async (_req: NextRequest, user) => {
  if (!user.householdId) return serverError();

  const supabase = createAdminClient();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const { data: investments } = await supabase
    .from('investments')
    .select('ticker, quantity, purchaseDate')
    .eq('householdId', user.householdId)
    .not('ticker', 'is', null)
    .not('type', 'in', '("CRYPTO","SAVINGS")');

  if (!investments?.length) return ok({ synced: 0, aReceber: 0 });

  const tickerMap: Record<string, { quantidade: number; purchaseDate: Date | null }> = {};
  for (const inv of investments) {
    if (!inv.ticker) continue;
    const tk = inv.ticker.toUpperCase();
    if (!tickerMap[tk]) tickerMap[tk] = { quantidade: 0, purchaseDate: inv.purchaseDate ? new Date(inv.purchaseDate) : null };
    tickerMap[tk].quantidade += Number(inv.quantity || 0);
    if (inv.purchaseDate) {
      const d = new Date(inv.purchaseDate);
      if (!tickerMap[tk].purchaseDate || d < tickerMap[tk].purchaseDate!) tickerMap[tk].purchaseDate = d;
    }
  }

  let synced = 0;
  let aReceber = 0;

  for (const [ticker, { quantidade, purchaseDate }] of Object.entries(tickerMap)) {
    if (quantidade <= 0) continue;
    const dividends = await fetchDividends(ticker);

    for (const div of dividends) {
      if (!div.paymentDate || !div.rate || !div.lastDatePrior) continue;

      const dataCom = new Date(div.lastDatePrior);
      const dataPagamento = new Date(div.paymentDate);

      if (purchaseDate && purchaseDate > dataCom) continue;

      const limite = new Date();
      limite.setMonth(limite.getMonth() - 24);
      if (dataCom < limite) continue;

      const valorTotal = Number((div.rate * quantidade).toFixed(2));
      const status = dataPagamento <= hoje ? 'PAGO' : 'A_RECEBER';
      const tipo = div.label || 'Rendimento';

      try {
        await supabase.from('proventos').upsert(
          {
            householdId: user.householdId,
            ticker,
            tipo,
            valorPorCota: div.rate,
            dataCom: dataCom.toISOString(),
            dataPagamento: dataPagamento.toISOString(),
            status,
            quantidade,
            valorTotal,
            relatedTo: div.relatedTo || null,
          },
          { onConflict: 'householdId,ticker,dataCom,tipo' }
        );
        synced++;
        if (status === 'A_RECEBER') aReceber++;
      } catch {
        // ignora conflito em corridas paralelas
      }
    }
  }

  await supabase
    .from('proventos')
    .update({ status: 'PAGO' })
    .eq('householdId', user.householdId)
    .eq('status', 'A_RECEBER')
    .lte('dataPagamento', hoje.toISOString());

  return ok({ synced, aReceber });
});
