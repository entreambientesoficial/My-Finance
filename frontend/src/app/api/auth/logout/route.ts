export const runtime = 'edge'
import { NextRequest } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { noContent, serverError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { supabase } = createClientFromRequest(req);
    await supabase.auth.signOut({ scope: 'local' });
    return noContent();
  } catch (err) {
    console.error('[logout]', err);
    return serverError();
  }
}
