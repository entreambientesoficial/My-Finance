export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { uploadAttachment } from '@/lib/storage';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

type Ctx = { params: { id: string } };

export function POST(req: NextRequest, { params }: Ctx) {
  return withAuth(async (r, user) => {
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

      const formData = await r.formData();
      const file = formData.get('file') as File | null;
      if (!file) return badRequest('Arquivo obrigatório');

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileUrl = await uploadAttachment(user.householdId, file.name, buffer, file.type);

      const attachments = [...(tx.attachments ?? []), fileUrl];
      const { data: updated } = await supabase
        .from('transactions')
        .update({ attachments })
        .eq('id', params.id)
        .select()
        .single();
      return ok(updated);
    } catch (err) {
      console.error('[transactions/:id/attachments POST]', err);
      return serverError();
    }
  })(req);
}
