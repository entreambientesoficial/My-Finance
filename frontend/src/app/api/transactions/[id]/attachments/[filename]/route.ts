export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { deleteByUrl } from '@/lib/storage';
import { ok, notFound, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string; filename: string } };

export function DELETE(req: NextRequest, { params }: Ctx) {
  return withAuth(async (_r, user) => {
    try {
      if (!user.householdId) return notFound();
      const supabase = createAdminClient();
      const { data: tx } = await supabase
        .from('transactions')
        .select('attachments')
        .eq('id', params.id)
        .eq('householdId', user.householdId)
        .maybeSingle();
      if (!tx) return notFound('Transação não encontrada');

      const fileUrl = (tx.attachments ?? []).find((a: string) => a.includes(params.filename));
      if (fileUrl) await deleteByUrl('attachments', fileUrl).catch(() => {});

      const attachments = (tx.attachments ?? []).filter((a: string) => !a.includes(params.filename));
      const { data: updated } = await supabase
        .from('transactions')
        .update({ attachments })
        .eq('id', params.id)
        .select()
        .single();
      return ok(updated);
    } catch (err) {
      console.error('[transactions/:id/attachments/:filename DELETE]', err);
      return serverError();
    }
  })(req);
}
