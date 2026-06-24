import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function GET(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
    try {
      if (!user.householdId) return notFound();
      const { searchParams } = new URL(r.url);
      const month = parseInt(searchParams.get('month') ?? '');
      const year = parseInt(searchParams.get('year') ?? '');
      if (!month || !year) return badRequest('month e year são obrigatórios');

      const supabase = createAdminClient();
      const { data: card } = await supabase
        .from('cards')
        .select('id')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .eq('isActive', true)
        .maybeSingle();
      if (!card) return notFound('Cartão não encontrado');

      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, category:categories(name, color, icon)')
        .eq('cardId', params.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      const total = (transactions ?? []).reduce((sum, t) => sum + parseFloat(t.amount), 0);
      return ok({ total, transactions: transactions ?? [] });
    } catch (err) {
      console.error('[cards/:id/invoice GET]', err);
      return serverError();
    }
  })(req);
}
