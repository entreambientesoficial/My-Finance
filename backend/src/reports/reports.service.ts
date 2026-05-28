import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getCashFlow(householdId: string, months: number = 6) {
    const result = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const [income, expenses] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: { householdId, type: 'INCOME', isPaid: true, date: { gte: startDate, lte: endDate } },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { householdId, type: 'EXPENSE', isPaid: true, date: { gte: startDate, lte: endDate } },
          _sum: { amount: true },
        }),
      ]);

      result.push({
        month: date.toISOString().slice(0, 7),
        label: date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }),
        income: Number(income._sum.amount || 0),
        expenses: Number(expenses._sum.amount || 0),
        balance: Number(income._sum.amount || 0) - Number(expenses._sum.amount || 0),
      });
    }

    return result;
  }

  async getExpensesByCategory(householdId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: { householdId, type: 'EXPENSE', isPaid: true, date: { gte: startDate, lte: endDate } },
      include: { category: { select: { name: true, color: true, icon: true } } },
    });

    const byCategory: Record<string, any> = {};
    for (const t of transactions) {
      const key = t.categoryId || '__sem_categoria';
      if (!byCategory[key]) {
        byCategory[key] = {
          name: t.category?.name || 'Sem categoria',
          color: t.category?.color || '#6b7280',
          icon: t.category?.icon || 'more_horiz',
          total: 0,
          count: 0,
        };
      }
      byCategory[key].total += Number(t.amount);
      byCategory[key].count++;
    }

    const items = Object.values(byCategory).sort((a: any, b: any) => b.total - a.total);
    const grandTotal = items.reduce((s: number, i: any) => s + i.total, 0);

    return items.map((i: any) => ({
      ...i,
      percentage: grandTotal > 0 ? Math.round((i.total / grandTotal) * 100) : 0,
    }));
  }

  async getNetWorth(householdId: string) {
    const [accounts, investments] = await Promise.all([
      this.prisma.account.findMany({
        where: { householdId, isActive: true },
        select: { name: true, type: true, balance: true },
      }),
      this.prisma.investment.findMany({
        where: { householdId },
        select: { name: true, type: true, quantity: true, currentPrice: true, purchasePrice: true },
      }),
    ]);

    const bankBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const investmentValue = investments.reduce(
      (s, i) => s + Number(i.quantity || 0) * Number(i.currentPrice || i.purchasePrice || 0),
      0,
    );

    return { bankBalance, investmentValue, netWorth: bankBalance + investmentValue, accounts, investments };
  }

  async getUpcomingBills(householdId: string, daysAhead: number = 30) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    return this.prisma.transaction.findMany({
      where: { householdId, isPaid: false, date: { gte: startDate, lte: endDate } },
      include: {
        category: { select: { name: true, color: true } },
        account: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  async exportTransactionsCsv(
    householdId: string,
    filters: { startDate?: string; endDate?: string; type?: string },
  ): Promise<string> {
    const where: any = { householdId };
    if (filters.type) where.type = filters.type;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate + 'T23:59:59');
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        category: { select: { name: true } },
        account: { select: { name: true } },
        card: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const TYPE_LABELS: Record<string, string> = { INCOME: 'Receita', EXPENSE: 'Despesa', TRANSFER: 'Transferência' };

    const header = 'Data;Tipo;Descricao;Valor;Categoria;Conta;Cartao;Pago\n';
    const rows = transactions.map((t) => {
      const date = t.date.toLocaleDateString('pt-BR');
      const type = TYPE_LABELS[t.type] || t.type;
      const desc = (t.description || '').replace(/;/g, ',');
      const amount = Number(t.amount).toFixed(2).replace('.', ',');
      const category = t.category?.name || '';
      const account = t.account?.name || '';
      const card = t.card?.name || '';
      const paid = t.isPaid ? 'Sim' : 'Não';
      return `${date};${type};${desc};${amount};${category};${account};${card};${paid}`;
    });

    return header + rows.join('\n');
  }

  async exportSummaryPdf(householdId: string): Promise<Buffer> {
    // Dynamic import to avoid issues when pdfkit is not yet installed
    const PDFDocument = require('pdfkit');

    const [household, netWorth, cashFlow, upcomingBills] = await Promise.all([
      this.prisma.household.findUnique({ where: { id: householdId } }),
      this.getNetWorth(householdId),
      this.getCashFlow(householdId, 3),
      this.getUpcomingBills(householdId, 15),
    ]);

    const now = new Date();
    const fmt = (n: number) =>
      n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.rect(0, 0, 595, 80).fill('#031632');
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
        .text('MY-FINANCE', 50, 25);
      doc.fontSize(11).font('Helvetica')
        .text(`Relatório Financeiro — ${household?.name || ''}`, 50, 50);
      doc.text(now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), 50, 62);

      doc.moveDown(3);

      // Patrimônio Líquido
      doc.fillColor('#031632').fontSize(14).font('Helvetica-Bold').text('Patrimônio Líquido', 50, 110);
      doc.moveTo(50, 128).lineTo(545, 128).strokeColor('#e2e8f0').stroke();

      const cards = [
        { label: 'Saldo em Contas', value: fmt(netWorth.bankBalance) },
        { label: 'Investimentos', value: fmt(netWorth.investmentValue) },
        { label: 'Total', value: fmt(netWorth.netWorth) },
      ];
      let x = 50;
      for (const card of cards) {
        doc.rect(x, 135, 155, 60).fillColor('#f7f9fb').fill();
        doc.fillColor('#64748b').fontSize(9).font('Helvetica').text(card.label, x + 10, 145);
        doc.fillColor('#031632').fontSize(13).font('Helvetica-Bold').text(card.value, x + 10, 160);
        x += 165;
      }

      // Fluxo de caixa
      doc.fillColor('#031632').fontSize(14).font('Helvetica-Bold').text('Fluxo de Caixa — últimos 3 meses', 50, 220);
      doc.moveTo(50, 238).lineTo(545, 238).strokeColor('#e2e8f0').stroke();

      let y = 245;
      doc.fillColor('#64748b').fontSize(9).font('Helvetica')
        .text('Mês', 50, y).text('Receitas', 200, y).text('Despesas', 320, y).text('Saldo', 440, y);
      y += 15;

      for (const row of cashFlow) {
        doc.fillColor('#031632').fontSize(10).font('Helvetica')
          .text(row.label, 50, y)
          .fillColor('#006c49').text(fmt(row.income), 200, y)
          .fillColor('#ef4444').text(fmt(row.expenses), 320, y)
          .fillColor(row.balance >= 0 ? '#006c49' : '#ef4444').text(fmt(row.balance), 440, y);
        y += 20;
        doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#f1f5f9').stroke();
      }

      // Contas a pagar
      if (upcomingBills.length > 0) {
        y += 15;
        doc.fillColor('#031632').fontSize(14).font('Helvetica-Bold').text('Próximas Contas a Pagar (15 dias)', 50, y);
        y += 20;
        doc.moveTo(50, y - 2).lineTo(545, y - 2).strokeColor('#e2e8f0').stroke();
        y += 5;

        for (const bill of upcomingBills.slice(0, 8)) {
          doc.fillColor('#031632').fontSize(10).font('Helvetica')
            .text(bill.description || 'Lançamento', 50, y, { width: 280 })
            .text(new Date(bill.date).toLocaleDateString('pt-BR'), 340, y)
            .fillColor('#ef4444').text(fmt(Number(bill.amount)), 440, y);
          y += 18;
        }
      }

      // Footer
      doc.moveTo(50, 780).lineTo(545, 780).strokeColor('#e2e8f0').stroke();
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text(`Gerado em ${now.toLocaleString('pt-BR')} — MY-FINANCE`, 50, 785, { align: 'center', width: 495 });

      doc.end();
    });
  }
}
