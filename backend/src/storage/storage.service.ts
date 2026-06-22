import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { extname } from 'path';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private readonly avatarsBucket = 'avatars';
  private readonly attachmentsBucket = 'attachments';

  constructor(private config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const key = config.get<string>('SUPABASE_SERVICE_KEY');

    if (!url || !key) {
      console.warn('⚠️  SUPABASE_URL ou SUPABASE_SERVICE_KEY não definidas — uploads desabilitados.');
    }

    this.supabase = createClient(url ?? '', key ?? '');
  }

  /**
   * Faz upload de um arquivo para o Supabase Storage e retorna a URL pública.
   */
  async uploadAvatar(userId: string, buffer: Buffer, mimetype: string): Promise<string> {
    const ext = this.mimeToExt(mimetype);
    const path = `user-${userId}/avatar${ext}`;

    const { data, error } = await this.supabase.storage
      .from(this.avatarsBucket)
      .upload(path, buffer, {
        contentType: mimetype,
        upsert: true,        // sobrescreve avatar anterior
      });

    if (error) {
      throw new InternalServerErrorException(`Falha no upload do avatar: ${error.message}`);
    }

    const publicUrl = this.getPublicUrl(this.avatarsBucket, data.path);
    return `${publicUrl}?v=${Date.now()}`;
  }

  /**
   * Faz upload de um anexo de transação para o Supabase Storage.
   */
  async uploadAttachment(
    householdId: string,
    originalname: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    const ext = extname(originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const path = `household-${householdId}/${unique}${ext}`;

    const { data, error } = await this.supabase.storage
      .from(this.attachmentsBucket)
      .upload(path, buffer, { contentType: mimetype, upsert: false });

    if (error) {
      throw new InternalServerErrorException(`Falha no upload do anexo: ${error.message}`);
    }

    return this.getPublicUrl(this.attachmentsBucket, data.path);
  }

  /**
   * Remove um arquivo do Supabase Storage pela URL pública.
   */
  async deleteByUrl(bucket: string, publicUrl: string): Promise<void> {
    // Extrai o path relativo da URL pública
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const path = publicUrl.slice(idx + marker.length);
    await this.supabase.storage.from(bucket).remove([path]);
  }

  private getPublicUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  private mimeToExt(mimetype: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    return map[mimetype] ?? '.bin';
  }
}
