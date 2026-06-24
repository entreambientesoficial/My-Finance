import { createClient } from '@supabase/supabase-js';
import { extname } from 'path';

const AVATARS = 'avatars';
const ATTACHMENTS = 'attachments';

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function getPublicUrl(bucket: string, path: string): string {
  const { data } = getClient().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAvatar(userId: string, buffer: Buffer, mimetype: string): Promise<string> {
  const ext = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' } as Record<string, string>)[mimetype] ?? '.bin';
  const path = `user-${userId}/avatar${ext}`;
  const { data, error } = await getClient().storage.from(AVATARS).upload(path, buffer, { contentType: mimetype, upsert: true });
  if (error) throw new Error(`Falha no upload do avatar: ${error.message}`);
  return `${getPublicUrl(AVATARS, data.path)}?v=${Date.now()}`;
}

export async function uploadAttachment(householdId: string, originalname: string, buffer: Buffer, mimetype: string): Promise<string> {
  const ext = extname(originalname);
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const path = `household-${householdId}/${unique}${ext}`;
  const { data, error } = await getClient().storage.from(ATTACHMENTS).upload(path, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new Error(`Falha no upload do anexo: ${error.message}`);
  return getPublicUrl(ATTACHMENTS, data.path);
}

export async function deleteByUrl(bucket: string, publicUrl: string): Promise<void> {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await getClient().storage.from(bucket).remove([path]);
}
