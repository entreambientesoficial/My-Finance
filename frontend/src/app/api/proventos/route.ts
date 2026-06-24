import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, badRequest } from '@/lib/api-response';

export const GET = withAuth(async (req: NextRequest, user) => {
  if (!user.householdId) return badRequest('Sem household');

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const year = searchParams.get('year');

  const supabase = createAdminClient();
  let query = supabase.from('proventos').select('*').eq('householdId', user.householdId).order('dataPagamento', { ascending: false });

  if (status) query = query.eq('status', status);
  if (year) {
    const y = parseInt(year);
    query = query.gte('dataPagamento', new Date(y, 0, 1).toISOString()).lte('dataPagamento', new Date(y, 11, 31, 23, 59, 59).toISOString());
  }

  const { data: proventos } = await query;
  const list = proventos ?? [];

  const totalRecebido = list.filter((p) => p.status === 'PAGO').reduce((s, p) => s + Number(p.valorTotal), 0);
  const totalAReceber = list.filter((p) => p.status === 'A_RECEBER').reduce((s, p) => s + Number(p.valorTotal), 0);

  return ok({ proventos: list, totalRecebido, totalAReceber });
});
