import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { unauthorized, serverError } from '@/lib/api-response';

const PRIMARY = rgb(0.012, 0.086, 0.196); // #031632
const WHITE   = rgb(1, 1, 1);
const GRAY    = rgb(0.392, 0.455, 0.545); // #64748b
const GREEN   = rgb(0.024, 0.42, 0.286);  // #006c49
const RED     = rgb(0.937, 0.267, 0.267); // #ef4444
const LIGHT   = rgb(0.969, 0.976, 0.984); // #f7f9fb
const BORDER  = rgb(0.886, 0.906, 0.937); // #e2e8f0

async function getCashFlow(householdId: string, months: number) {
  const now = new Date();
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate   = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    const base = { householdId, isPaid: true, date: { gte: startDate, lte: endDate } };
    const [inc, exp] = await Promise.all([
      prisma.transaction.aggregate({ where: { ...base, type: 'INCOME'  }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...base, type: 'EXPENSE' }, _sum: { amount: true } }),
    ]);
    const income   = Number(inc._sum.amount || 0);
    const expenses = Number(exp._sum.amount || 0);
    result.push({ label: date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }), income, expenses, balance: income - expenses });
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.householdId) return unauthorized();

    const householdId = user.householdId;
    const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const now = new Date();

    const [household, accounts, investments, cashFlow, upcomingBills] = await Promise.all([
      prisma.household.findUnique({ where: { id: householdId } }),
      prisma.account.findMany({ where: { householdId, isActive: true }, select: { name: true, type: true, balance: true } }),
      prisma.investment.findMany({ where: { householdId }, select: { name: true, type: true, quantity: true, currentPrice: true, purchasePrice: true } }),
      getCashFlow(householdId, 3),
      prisma.transaction.findMany({
        where: { householdId, type: 'EXPENSE', isPaid: false, date: { gte: new Date(), lte: new Date(Date.now() + 30 * 864e5) } },
        include: { category: { select: { name: true } } },
        orderBy: { date: 'asc' },
        take: 8,
      }),
    ]);

    const bankBalance     = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const investmentValue = investments.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.currentPrice || i.purchasePrice || 0), 0);
    const netWorth        = bankBalance + investmentValue;

    // ── Build PDF ──────────────────────────────────────────────────────────
    const pdfDoc  = await PDFDocument.create();
    const page    = pdfDoc.addPage([595, 842]); // A4
    const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const { height } = page.getSize();
    const toY = (y: number) => height - y; // pdf-lib origin is bottom-left

    // Header background
    page.drawRectangle({ x: 0, y: toY(80), width: 595, height: 80, color: PRIMARY });
    page.drawText('MY-FINANCE', { x: 50, y: toY(45), size: 20, font: bold, color: WHITE });
    page.drawText(`Relatório Financeiro — ${household?.name || ''}`, { x: 50, y: toY(60), size: 11, font: regular, color: WHITE });
    page.drawText(now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), { x: 50, y: toY(72), size: 9, font: regular, color: WHITE });

    // Section: Patrimônio Líquido
    page.drawText('Patrimônio Líquido', { x: 50, y: toY(110), size: 14, font: bold, color: PRIMARY });
    page.drawLine({ start: { x: 50, y: toY(128) }, end: { x: 545, y: toY(128) }, thickness: 1, color: BORDER });

    const cards = [
      { label: 'Saldo em Contas', value: fmt(bankBalance) },
      { label: 'Investimentos',   value: fmt(investmentValue) },
      { label: 'Total',           value: fmt(netWorth) },
    ];
    cards.forEach((card, i) => {
      const cx = 50 + i * 165;
      page.drawRectangle({ x: cx, y: toY(195), width: 155, height: 60, color: LIGHT });
      page.drawText(card.label, { x: cx + 10, y: toY(150), size: 9, font: regular, color: GRAY });
      page.drawText(card.value, { x: cx + 10, y: toY(165), size: 11, font: bold, color: PRIMARY });
    });

    // Section: Fluxo de Caixa
    page.drawText('Fluxo de Caixa — últimos 3 meses', { x: 50, y: toY(220), size: 14, font: bold, color: PRIMARY });
    page.drawLine({ start: { x: 50, y: toY(238) }, end: { x: 545, y: toY(238) }, thickness: 1, color: BORDER });

    let y = 255;
    page.drawText('Mês',       { x: 50,  y: toY(y), size: 9, font: regular, color: GRAY });
    page.drawText('Receitas',  { x: 200, y: toY(y), size: 9, font: regular, color: GRAY });
    page.drawText('Despesas',  { x: 320, y: toY(y), size: 9, font: regular, color: GRAY });
    page.drawText('Saldo',     { x: 440, y: toY(y), size: 9, font: regular, color: GRAY });
    y += 18;

    for (const row of cashFlow) {
      page.drawText(row.label,         { x: 50,  y: toY(y), size: 10, font: regular, color: PRIMARY });
      page.drawText(fmt(row.income),   { x: 200, y: toY(y), size: 10, font: regular, color: GREEN });
      page.drawText(fmt(row.expenses), { x: 320, y: toY(y), size: 10, font: regular, color: RED });
      page.drawText(fmt(row.balance),  { x: 440, y: toY(y), size: 10, font: regular, color: row.balance >= 0 ? GREEN : RED });
      y += 20;
      page.drawLine({ start: { x: 50, y: toY(y - 5) }, end: { x: 545, y: toY(y - 5) }, thickness: 0.5, color: LIGHT });
    }

    // Section: Próximas Contas
    if (upcomingBills.length > 0) {
      y += 15;
      page.drawText('Próximas Contas a Pagar (30 dias)', { x: 50, y: toY(y), size: 14, font: bold, color: PRIMARY });
      y += 20;
      page.drawLine({ start: { x: 50, y: toY(y - 2) }, end: { x: 545, y: toY(y - 2) }, thickness: 1, color: BORDER });
      y += 5;
      for (const bill of upcomingBills) {
        const desc = (bill.description || 'Lançamento').slice(0, 40);
        page.drawText(desc, { x: 50, y: toY(y), size: 10, font: regular, color: PRIMARY });
        page.drawText(new Date(bill.date).toLocaleDateString('pt-BR'), { x: 340, y: toY(y), size: 10, font: regular, color: GRAY });
        page.drawText(fmt(Number(bill.amount)), { x: 440, y: toY(y), size: 10, font: regular, color: RED });
        y += 18;
      }
    }

    // Footer
    page.drawLine({ start: { x: 50, y: toY(780) }, end: { x: 545, y: toY(780) }, thickness: 1, color: BORDER });
    page.drawText(`Gerado em ${now.toLocaleString('pt-BR')} — MY-FINANCE`, { x: 50, y: toY(792), size: 8, font: regular, color: GRAY });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio-${now.toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[reports/export/pdf GET]', err);
    return serverError();
  }
}
