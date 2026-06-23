import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, serverError } from '@/lib/api-response';
import type { JwtPayload } from '@/lib/auth';

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

export const POST = withAuth(async (_req: NextRequest, user: JwtPayload) => {
  if (!user.householdId) return serverError();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Busca todos os investimentos com ticker (exclui crypto — dividendos via equity)
  const investments = await prisma.investment.findMany({
    where: {
      householdId: user.householdId,
      ticker: { not: null },
      type: { notIn: ['CRYPTO', 'SAVINGS'] },
    },
    select: { ticker: true, quantity: true, purchaseDate: true },
  });

  if (investments.length === 0) return ok({ synced: 0, aReceber: 0 });

  // Agrupa por ticker e soma quantidades (caso haja compras parciais)
  const tickerMap: Record<string, { quantidade: number; purchaseDate: Date | null }> = {};
  for (const inv of investments) {
    if (!inv.ticker) continue;
    const tk = inv.ticker.toUpperCase();
    if (!tickerMap[tk]) {
      tickerMap[tk] = { quantidade: 0, purchaseDate: inv.purchaseDate };
    }
    tickerMap[tk].quantidade += Number(inv.quantity || 0);
    // usa a data de compra mais antiga
    if (inv.purchaseDate && (!tickerMap[tk].purchaseDate || inv.purchaseDate < tickerMap[tk].purchaseDate!)) {
      tickerMap[tk].purchaseDate = inv.purchaseDate;
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

      // Só contabiliza se o usuário era dono na data COM
      if (purchaseDate && purchaseDate > dataCom) continue;

      // Só processa dividendos dos últimos 24 meses
      const limite = new Date();
      limite.setMonth(limite.getMonth() - 24);
      if (dataCom < limite) continue;

      const valorTotal = Number((div.rate * quantidade).toFixed(2));
      const status = dataPagamento <= hoje ? 'PAGO' : 'A_RECEBER';
      const tipo = div.label || 'Rendimento';

      try {
        await prisma.provento.upsert({
          where: {
            householdId_ticker_dataCom_tipo: {
              householdId: user.householdId!,
              ticker,
              dataCom,
              tipo,
            },
          },
          update: {
            valorPorCota: div.rate,
            dataPagamento,
            status,
            quantidade,
            valorTotal,
            relatedTo: div.relatedTo || null,
          },
          create: {
            householdId: user.householdId!,
            ticker,
            tipo,
            valorPorCota: div.rate,
            dataCom,
            dataPagamento,
            status,
            quantidade,
            valorTotal,
            relatedTo: div.relatedTo || null,
          },
        });
        synced++;
        if (status === 'A_RECEBER') aReceber++;
      } catch {
        // ignora conflito de unique constraint em corridas paralelas
      }
    }
  }

  // Atualiza status de PAGO para registros cuja data de pagamento já passou
  await prisma.provento.updateMany({
    where: {
      householdId: user.householdId,
      status: 'A_RECEBER',
      dataPagamento: { lte: hoje },
    },
    data: { status: 'PAGO' },
  });

  return ok({ synced, aReceber });
});
