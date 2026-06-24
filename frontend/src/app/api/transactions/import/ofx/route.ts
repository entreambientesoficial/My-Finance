export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

function parseOfx(content: string): Array<{ fitid: string; date: Date; amount: number; name: string; memo: string }> {
  const transactions: any[] = [];
  const getTag = (text: string, tag: string): string => {
    const m = text.match(new RegExp(`<${tag}>([^<\n]+)`, 'i'));
    return m ? m[1].trim() : '';
  };
  const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
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
    let date = new Date();
    if (rawDate && rawDate.length >= 8) {
      date = new Date(`${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`);
    }
    const amount = parseFloat(rawAmount.replace(',', '.')) || 0;
    if (amount === 0 && !rawAmount) continue;
    transactions.push({ fitid, date, amount, name, memo });
  }
  return transactions;
}

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    if (!user.householdId) return notFound();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('Arquivo OFX obrigatório');
    const accountId = (formData.get('accountId') as string) || null;

    const buffer = await file.arrayBuffer();
    const probe = new TextDecoder('latin1').decode(buffer.slice(0, 1024));
    const isWindows1252 = /CHARSET:\s*1252|ENCODING:\s*WINDOWS-1252/i.test(probe);
    const content = new TextDecoder(isWindows1252 ? 'windows-1252' : 'utf-8').decode(buffer);
    const rows = parseOfx(content);
    if (rows.length === 0) return badRequest('Nenhuma transação encontrada no arquivo OFX');

    const supabase = createAdminClient();
    const created: any[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('householdId', user.householdId)
          .eq('notes', `ofx:${row.fitid}`)
          .maybeSingle();
        if (existing) continue;
        const { data: tx } = await supabase
          .from('transactions')
          .insert({ householdId: user.householdId, type: row.amount >= 0 ? 'INCOME' : 'EXPENSE', amount: Math.abs(row.amount), description: row.name || row.memo || null, date: row.date.toISOString(), isPaid: true, accountId, notes: `ofx:${row.fitid}` })
          .select()
          .single();
        created.push(tx);
      } catch {
        errors.push(`FITID ${row.fitid}: erro ao importar`);
      }
    }

    return ok({ imported: created.length, errors: errors.length, messages: errors.slice(0, 10) });
  } catch (err) {
    console.error('[transactions/import/ofx POST]', err);
    return serverError();
  }
});
