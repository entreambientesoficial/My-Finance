export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth } from '@/lib/with-auth';
import { ok, notFound, badRequest, serverError } from '@/lib/api-response';

export const GET = withAuth(async (_req, user) => {
  try {
    const supabase = createAdminClient();
    const { data: me } = await supabase
      .from('users')
      .select('id, name, email, avatarUrl, householdId, household:households(id, name, currency), createdAt')
      .eq('id', user.sub)
      .maybeSingle();
    if (!me) return notFound('Usuário não encontrado');
    return ok(me);
  } catch (err) {
    console.error('[users/me GET]', err);
    return serverError();
  }
});

export const PATCH = withAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { currentPassword, newPassword, name, avatarUrl } = body;
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    if (newPassword) {
      if (!currentPassword) return badRequest('A senha atual é obrigatória para cadastrar uma nova senha');

      const tempClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error: signInError } = await tempClient.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) return badRequest('Senha atual incorreta');

      const { error: updateError } = await createAdminClient().auth.admin.updateUserById(user.supabaseId, { password: newPassword });
      if (updateError) return badRequest('Não foi possível alterar a senha');
    }

    if (Object.keys(updateData).length > 0) {
      const supabase = createAdminClient();
      await supabase.from('users').update(updateData).eq('id', user.sub);
    }

    const supabase = createAdminClient();
    const { data: updated } = await supabase
      .from('users')
      .select('id, name, email, avatarUrl')
      .eq('id', user.sub)
      .single();
    return ok(updated);
  } catch (err) {
    console.error('[users/me PATCH]', err);
    return serverError();
  }
});
