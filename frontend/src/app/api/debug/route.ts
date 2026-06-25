export const runtime = 'edge';

import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClientFromRequest } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const result: Record<string, unknown> = {};

  // Environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? '';
  result.env = {
    supabaseUrl: supabaseUrl ? `✓ ${supabaseUrl}` : '✗ missing',
    anonKey: anonKey ? `✓ ${anonKey.slice(0, 24)}...` : '✗ missing',
    serviceKey: serviceKey ? `✓ ${serviceKey.slice(0, 24)}...` : '✗ missing',
    serviceKeyIsJwt: serviceKey.startsWith('eyJ'),
  };

  // Request headers
  const authHeader = req.headers.get('Authorization') ?? '';
  const cookieHeader = req.headers.get('cookie') ?? '';
  result.request = {
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader ? authHeader.slice(0, 30) + '...' : null,
    hasCookies: !!cookieHeader,
    cookieNames: cookieHeader
      ? cookieHeader.split(';').map((c) => c.trim().split('=')[0])
      : [],
  };

  // Cookie-based auth (server-side SSR client)
  try {
    const { supabase } = createClientFromRequest(req);
    const { data: { user }, error } = await supabase.auth.getUser();
    result.cookieAuth = user
      ? { status: '✓ authenticated', email: user.email, id: user.id }
      : { status: '✗ no session', error: error?.message ?? 'no user returned' };
  } catch (e: unknown) {
    result.cookieAuth = { status: '✗ exception', error: String(e) };
  }

  // Bearer-token auth (if header present)
  if (authHeader.startsWith('Bearer ')) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const jwt = authHeader.slice(7);
      const { data: { user }, error } = await client.auth.getUser(jwt);
      result.bearerAuth = user
        ? { status: '✓ valid jwt', email: user.email, id: user.id }
        : { status: '✗ invalid jwt', error: error?.message };
    } catch (e: unknown) {
      result.bearerAuth = { status: '✗ exception', error: String(e) };
    }
  } else {
    result.bearerAuth = '— no Authorization header sent';
  }

  // Admin client — users table
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('users')
      .select('id, email, supabaseId, householdId')
      .limit(5);
    result.adminUsers = error
      ? { status: '✗ error', message: error.message, code: error.code }
      : { status: '✓ ok', count: data?.length ?? 0, rows: data };
  } catch (e: unknown) {
    result.adminUsers = { status: '✗ exception', error: String(e) };
  }

  // Admin client — categories table
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('categories')
      .select('id, name, householdId')
      .limit(5);
    result.adminCategories = error
      ? { status: '✗ error', message: error.message, code: error.code }
      : { status: '✓ ok', count: data?.length ?? 0, sample: data };
  } catch (e: unknown) {
    result.adminCategories = { status: '✗ exception', error: String(e) };
  }

  return Response.json(result, { status: 200 });
}
