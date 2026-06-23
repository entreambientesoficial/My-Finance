import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

function parseCsvLine(line: string, sep: string): string[] {
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

function parseAmount(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

function detectColumns(headers: string[]) {
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

function mapRow(cols: string[], _headers: string[], colMap: ReturnType<typeof detectColumns>) {
  const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx] : '');

  let date: Date | null = null;
  const rawDate = get(colMap.date);
  if (rawDate) {
    const parts = rawDate.match(/(\d{2,4})[\/\-](\d{2})[\/\-](\d{2,4})/);
    if (parts) {
      const [, a, b, c] = parts;
      date = a.length === 4 ? new Date(`${a}-${b}-${c}`) : new Date(`${c}-${b}-${a}`);
    }
  }

  let amount = 0;
  let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

  if (colMap.credit >= 0 && colMap.debit >= 0) {
    const credit = parseAmount(get(colMap.credit));
    const debit = parseAmount(get(colMap.debit));
    if (credit > 0) { amount = credit; type = 'INCOME'; } else { amount = debit; type = 'EXPENSE'; }
  } else {
    const raw = parseAmount(get(colMap.amount));
    amount = Math.abs(raw);
    type = raw >= 0 ? 'INCOME' : 'EXPENSE';
  }

  const rawType = get(colMap.type).toLowerCase();
  if (rawType.includes('credito') || rawType.includes('recebimento') || rawType === 'c') type = 'INCOME';
  if (rawType.includes('debito') || rawType.includes('pagamento') || rawType === 'd') type = 'EXPENSE';

  return { date, amount, type, description: get(colMap.description) || null };
}

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('Arquivo CSV obrigatório');
    const accountId = (formData.get('accountId') as string) || null;

    const csvContent = await file.text();
    const lines = csvContent.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return badRequest('CSV vazio ou inválido');

    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map((h) => h.toLowerCase().trim().replace(/"/g, ''));
    const colMap = detectColumns(headers);

    const created: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i], sep);
      try {
        const row = mapRow(cols, headers, colMap);
        if (!row.amount || !row.date) continue;
        const tx = await prisma.transaction.create({
          data: { householdId: user.householdId, type: row.type, amount: Math.abs(row.amount), description: row.description, date: row.date, isPaid: true, accountId },
        });
        created.push(tx);
      } catch {
        errors.push(`Linha ${i + 1}: formato inválido`);
      }
    }

    return ok({ imported: created.length, errors: errors.length, messages: errors.slice(0, 10) });
  } catch (err) {
    console.error('[transactions/import/csv POST]', err);
    return serverError();
  }
});
