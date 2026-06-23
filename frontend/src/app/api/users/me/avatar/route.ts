import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/with-auth';
import { uploadAvatar } from '@/lib/storage';
import { ok, badRequest, serverError } from '@/lib/api-response';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('Arquivo de imagem obrigatório');
    if (!ALLOWED.includes(file.type)) return badRequest('Apenas imagens JPG, PNG, WEBP ou GIF são permitidas');
    if (file.size > 5 * 1024 * 1024) return badRequest('Arquivo excede 5 MB');

    const buffer = Buffer.from(await file.arrayBuffer());
    const avatarUrl = await uploadAvatar(user.sub, buffer, file.type);

    await prisma.user.update({ where: { id: user.sub }, data: { avatarUrl } });
    return ok({ avatarUrl });
  } catch (err) {
    console.error('[users/me/avatar POST]', err);
    return serverError();
  }
});
