export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { unauthorized, serverError } from '@/lib/api-response';

async function getCashFlow(householdId: string, months: number) {
  const now = new Date();
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    const base = { householdId, isPaid: true, date: { gte: startDate, lte: endDate } };
    const [inc, exp] = await Promise.all([
      prisma.transaction.aggregate({ where: { ...base, type: 'INCOME' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...base, type: 'EXPENSE' }, _sum: { amount: true } }),
    ]);
    const income = Number(inc._sum.amount || 0);
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
    const PDFDocument = require('pdfkit');

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

    const bankBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const investmentValue = investments.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.currentPrice || i.purchasePrice || 0), 0);
    const netWorth = bankBalance + investmentValue;
    const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const now = new Date();

    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.rect(0, 0, 595, 80).fill('#031632');
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('MY-FINANCE', 50, 25);
      doc.fontSize(11).font('Helvetica').text(`Relatório Financeiro — ${household?.name || ''}`, 50, 50);
      doc.text(now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), 50, 62);
      doc.moveDown(3);

      doc.fillColor('#031632').fontSize(14).font('Helvetica-Bold').text('Patrimônio Líquido', 50, 110);
      doc.moveTo(50, 128).lineTo(545, 128).strokeColor('#e2e8f0').stroke();
      let x = 50;
      for (const card of [{ label: 'Saldo em Contas', value: fmt(bankBalance) }, { label: 'Investimentos', value: fmt(investmentValue) }, { label: 'Total', value: fmt(netWorth) }]) {
        doc.rect(x, 135, 155, 60).fillColor('#f7f9fb').fill();
        doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(card.label, x + 10, 145);
        doc.fillColor('#031632').fontSize(13).font('Helvetica-Bold').text(card.value, x + 10, 160);
        x += 165;
      }

      doc.fillColor('#031632').fontSize(14).font('Helvetica-Bold').text('Fluxo de Caixa — últimos 3 meses', 50, 220);
      doc.moveTo(50, 238).lineTo(545, 238).strokeColor('#e2e8f0').stroke();
      let y = 245;
      doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Mês', 50, y).text('Receitas', 200, y).text('Despesas', 320, y).text('Saldo', 440, y);
      y += 15;
      for (const row of cashFlow) {
        doc.fillColor('#031632').fontSize(10).font('Helvetica').text(row.label, 50, y).fillColor('#006c49').text(fmt(row.income), 200, y).fillColor('#ef4444').text(fmt(row.expenses), 320, y).fillColor(row.balance >= 0 ? '#006c49' : '#ef4444').text(fmt(row.balance), 440, y);
        y += 20;
        doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#f1f5f9').stroke();
      }

      if (upcomingBills.length > 0) {
        y += 15;
        doc.fillColor('#031632').fontSize(14).font('Helvetica-Bold').text('Próximas Contas a Pagar (30 dias)', 50, y);
        y += 20;
        doc.moveTo(50, y - 2).lineTo(545, y - 2).strokeColor('#e2e8f0').stroke();
        y += 5;
        for (const bill of upcomingBills) {
          doc.fillColor('#031632').fontSize(10).font('Helvetica').text(bill.description || 'Lançamento', 50, y, { width: 280 }).text(new Date(bill.date).toLocaleDateString('pt-BR'), 340, y).fillColor('#ef4444').text(fmt(Number(bill.amount)), 440, y);
          y += 18;
        }
      }

      doc.moveTo(50, 780).lineTo(545, 780).strokeColor('#e2e8f0').stroke();
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text(`Gerado em ${now.toLocaleString('pt-BR')} — MY-FINANCE`, 50, 785, { align: 'center', width: 495 });
      doc.end();
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
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

