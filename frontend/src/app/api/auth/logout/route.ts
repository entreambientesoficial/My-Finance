export const runtime = 'edge'
import { createClient } from '@/lib/supabase/server';
import { noContent, serverError } from '@/lib/api-response';

export async function POST() {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
    return noContent();
  } catch (err) {
    console.error('[logout]', err);
    return serverError();
  }
}
