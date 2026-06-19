import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

export interface TransactionFilters {
  type?: string;
  categoryId?: string;
  accountId?: string;
  cardId?: string;
  startDate?: string;
  endDate?: string;
  isPaid?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(householdId: string, dto: CreateTransactionDto) {
    const data: any = {
      ...dto,
      householdId,
      date: new Date(dto.date),
      categoryId: dto.categoryId || null,
      accountId: dto.accountId || null,
      toAccountId: dto.toAccountId || null,
      cardId: dto.cardId || null,
    };

    const transaction = await this.prisma.transaction.create({
      data,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        account: { select: { id: true, name: true } },
        card: { select: { id: true, name: true } },
      },
    });

    if (dto.isPaid !== false) {
      if (dto.type === 'INCOME' && dto.accountId) {
        await this.prisma.account.update({
          where: { id: dto.accountId },
          data: { balance: { increment: dto.amount } },
        });
      } else if (dto.type === 'EXPENSE' && dto.accountId) {
        await this.prisma.account.update({
          where: { id: dto.accountId },
          data: { balance: { decrement: dto.amount } },
        });
      } else if (dto.type === 'TRANSFER' && dto.accountId && dto.toAccountId) {
        await this.prisma.account.update({
          where: { id: dto.accountId },
          data: { balance: { decrement: dto.amount } },
        });
        await this.prisma.account.update({
          where: { id: dto.toAccountId },
          data: { balance: { increment: dto.amount } },
        });
      }
    }

    return transaction;
  }

  async findAll(householdId: string, filters: TransactionFilters) {
    const { type, categoryId, accountId, cardId, startDate, endDate, isPaid, page = 1, limit = 20 } = filters;

    const where: any = {
      householdId,
      ...(type && { type }),
      ...(categoryId && { categoryId }),
      ...(accountId && { accountId }),
      ...(cardId && { cardId }),
      ...(isPaid !== undefined && isPaid !== null && { isPaid: isPaid === true || (isPaid as any) === 'true' }),
      ...(startDate || endDate ? {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate + 'T23:59:59') }),
        },
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          account: { select: { id: true, name: true } },
          toAccount: { select: { id: true, name: true } },
          card: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) };
  }

  async findOne(id: string, householdId: string) {
    const t = await this.prisma.transaction.findFirst({
      where: { id, householdId },
      include: { category: true, account: true, toAccount: true, card: true },
    });
    if (!t) throw new NotFoundException('Transação não encontrada');
    return t;
  }

  async update(id: string, householdId: string, dto: Partial<CreateTransactionDto>) {
    const oldTx = await this.findOne(id, householdId);
    const data: any = {
      ...dto,
      ...(dto.date && { date: new Date(dto.date) }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId || null }),
      ...(dto.accountId !== undefined && { accountId: dto.accountId || null }),
      ...(dto.toAccountId !== undefined && { toAccountId: dto.toAccountId || null }),
      ...(dto.cardId !== undefined && { cardId: dto.cardId || null }),
    };

    const updatedTx = await this.prisma.transaction.update({
      where: { id },
      data,
    });

    if (dto.isPaid !== undefined && oldTx.isPaid !== (dto.isPaid === true)) {
      const isMarkedPaid = dto.isPaid === true;
      const amount = Number(oldTx.amount);
      const accId = oldTx.accountId;
      const toAccId = oldTx.toAccountId;

      if (isMarkedPaid) {
        if (oldTx.type === 'INCOME' && accId) {
          await this.prisma.account.update({ where: { id: accId }, data: { balance: { increment: amount } } });
        } else if (oldTx.type === 'EXPENSE' && accId) {
          await this.prisma.account.update({ where: { id: accId }, data: { balance: { decrement: amount } } });
        } else if (oldTx.type === 'TRANSFER' && accId && toAccId) {
          await this.prisma.account.update({ where: { id: accId }, data: { balance: { decrement: amount } } });
          await this.prisma.account.update({ where: { id: toAccId }, data: { balance: { increment: amount } } });
        }
      } else {
        if (oldTx.type === 'INCOME' && accId) {
          await this.prisma.account.update({ where: { id: accId }, data: { balance: { decrement: amount } } });
        } else if (oldTx.type === 'EXPENSE' && accId) {
          await this.prisma.account.update({ where: { id: accId }, data: { balance: { increment: amount } } });
        } else if (oldTx.type === 'TRANSFER' && accId && toAccId) {
          await this.prisma.account.update({ where: { id: accId }, data: { balance: { increment: amount } } });
          await this.prisma.account.update({ where: { id: toAccId }, data: { balance: { decrement: amount } } });
        }
      }
    }

    return updatedTx;
  }

  async remove(id: string, householdId: string) {
    await this.findOne(id, householdId);
    return this.prisma.transaction.delete({ where: { id } });
  }

  async getMonthlySummary(householdId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: { householdId, date: { gte: startDate, lte: endDate }, isPaid: true },
      include: { category: { select: { name: true, color: true, icon: true } } },
    });

    const income = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

    const byCategory = transactions
      .filter((t) => t.type === 'EXPENSE' && t.category)
      .reduce((acc: Record<string, any>, t) => {
        const key = t.categoryId!;
        if (!acc[key]) acc[key] = { ...t.category, total: 0 };
        acc[key].total += Number(t.amount);
        return acc;
      }, {});

    return {
      income,
      expenses,
      balance: income - expenses,
      byCategory: Object.values(byCategory).sort((a: any, b: any) => b.total - a.total),
    };
  }

  // ── Attachment ────────────────────────────────────────────────────────────

  async addAttachment(id: string, householdId: string, fileUrl: string) {
    const tx = await this.findOne(id, householdId);
    return this.prisma.transaction.update({
      where: { id },
      data: { attachments: { push: fileUrl } },
    });
  }

  async removeAttachment(id: string, householdId: string, filename: string) {
    const tx = await this.findOne(id, householdId);
    const updated = tx.attachments.filter((a) => !a.endsWith(filename));
    return this.prisma.transaction.update({
      where: { id },
      data: { attachments: updated },
    });
  }

  // ── Import CSV ────────────────────────────────────────────────────────────
  async importFromCsv(householdId: string, csvContent: string, accountId?: string) {
    const lines = csvContent.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new BadRequestException('CSV vazio ou inválido');

    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map((h) => h.toLowerCase().trim().replace(/"/g, ''));
    const colMap = this.detectCsvColumns(headers);

    const created: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i], sep);
      try {
        const row = this.mapCsvRow(cols, headers, colMap);
        if (!row.amount || !row.date) continue;

        const tx = await this.prisma.transaction.create({
          data: {
            householdId,
            type: row.type as any,
            amount: Math.abs(row.amount),
            description: row.description || null,
            date: row.date,
            isPaid: true,
            accountId: accountId || null,
          },
        });
        created.push(tx);
      } catch {
        errors.push(`Linha ${i + 1}: formato inválido`);
      }
    }

    return { imported: created.length, errors: errors.length, messages: errors.slice(0, 10) };
  }

  // ── Import OFX ────────────────────────────────────────────────────────────
  async importFromOfx(householdId: string, content: string, accountId?: string) {
    const transactions = this.parseOfx(content);
    if (transactions.length === 0) throw new BadRequestException('Nenhuma transação encontrada no arquivo OFX');

    const created: any[] = [];
    const errors: string[] = [];

    for (const row of transactions) {
      try {
        const existing = await this.prisma.transaction.findFirst({
          where: { householdId, notes: `ofx:${row.fitid}` },
        });
        if (existing) continue; // skip duplicate by FITID

        const tx = await this.prisma.transaction.create({
          data: {
            householdId,
            type: row.amount >= 0 ? 'INCOME' : 'EXPENSE',
            amount: Math.abs(row.amount),
            description: row.name || row.memo || null,
            date: row.date,
            isPaid: true,
            accountId: accountId || null,
            notes: `ofx:${row.fitid}`,
          },
        });
        created.push(tx);
      } catch {
        errors.push(`FITID ${row.fitid}: erro ao importar`);
      }
    }

    return { imported: created.length, errors: errors.length, messages: errors.slice(0, 10) };
  }

  private parseOfx(content: string): Array<{ fitid: string; date: Date; amount: number; name: string; memo: string }> {
    const transactions: any[] = [];
    // Support both SGML (legacy) and XML OFX
    const xml = content.includes('<?xml') || content.includes('<OFX>');

    const getTag = (text: string, tag: string): string => {
      const re = new RegExp(`<${tag}>([^<\n]+)`, 'i');
      const m = text.match(re);
      return m ? m[1].trim() : '';
    };

    // Extract all <STMTTRN>...</STMTTRN> blocks
    const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    // For SGML (no closing tags), split by <STMTTRN>
    const sgmlRe = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi;

    const re = content.includes('</STMTTRN>') ? blockRe : sgmlRe;
    let match: RegExpExecArray | null;

    while ((match = re.exec(content)) !== null) {
      const block = match[1];
      const fitid = getTag(block, 'FITID') || String(Date.now());
      const rawDate = getTag(block, 'DTPOSTED');
      const rawAmount = getTag(block, 'TRNAMT');
      const name = getTag(block, 'NAME') || getTag(block, 'PAYEE');
      const memo = getTag(block, 'MEMO');

      // Parse date: 20240101120000 → Date
      let date = new Date();
      if (rawDate && rawDate.length >= 8) {
        const y = rawDate.slice(0, 4);
        const mo = rawDate.slice(4, 6);
        const d = rawDate.slice(6, 8);
        date = new Date(`${y}-${mo}-${d}`);
      }

      const amount = parseFloat(rawAmount.replace(',', '.')) || 0;
      if (amount === 0 && !rawAmount) continue;

      transactions.push({ fitid, date, amount, name, memo });
    }

    return transactions;
  }

  private detectCsvColumns(headers: string[]) {
    const find = (candidates: string[]) => headers.findIndex((h) => candidates.some((c) => h.includes(c)));
    return {
      date: find(['data', 'date', 'dt']),
      description: find(['descri', 'historico', 'memo', 'detail', 'lancamento']),
      amount: find(['valor', 'amount', 'value', 'credito', 'debito', 'montante']),
      credit: find(['credito', 'credit', 'entrada']),
      debit: find(['debito', 'debit', 'saida']),
      type: find(['tipo', 'type', 'natureza']),
    };
  }

  private parseCsvLine(line: string, sep: string): string[] {
    const result: string[] = [];
    let inQuotes = false;
    let current = '';
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === sep && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  }

  private mapCsvRow(cols: string[], headers: string[], colMap: Record<string, number>) {
    const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx] : '');

    let date: Date | null = null;
    const rawDate = get(colMap.date);
    if (rawDate) {
      const parts = rawDate.match(/(\d{2,4})[\/\-](\d{2})[\/\-](\d{2,4})/);
      if (parts) {
        const [, a, b, c] = parts;
        if (a.length === 4) date = new Date(`${a}-${b}-${c}`);
        else date = new Date(`${c}-${b}-${a}`);
      }
    }

    let amount = 0;
    let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

    if (colMap.credit >= 0 && colMap.debit >= 0) {
      const credit = this.parseAmount(get(colMap.credit));
      const debit = this.parseAmount(get(colMap.debit));
      if (credit > 0) { amount = credit; type = 'INCOME'; }
      else { amount = debit; type = 'EXPENSE'; }
    } else {
      const raw = this.parseAmount(get(colMap.amount));
      amount = Math.abs(raw);
      type = raw >= 0 ? 'INCOME' : 'EXPENSE';
    }

    const rawType = get(colMap.type).toLowerCase();
    if (rawType.includes('credito') || rawType.includes('recebimento') || rawType === 'c') type = 'INCOME';
    if (rawType.includes('debito') || rawType.includes('pagamento') || rawType === 'd') type = 'EXPENSE';

    return { date, amount, type, description: get(colMap.description) || null };
  }

  private parseAmount(raw: string): number {
    if (!raw) return 0;
    const cleaned = raw.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }
}
