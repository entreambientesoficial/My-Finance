import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

function supabaseConfig(
  getAll: () => { name: string; value: string }[],
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll, setAll } }
  );
}

export function createClientFromRequest(req: NextRequest, res?: NextResponse) {
  const response = res || NextResponse.next();
  return {
    supabase: supabaseConfig(
      () => req.cookies.getAll(),
      (cookiesToSet) => {
        // Mirror cookies into req so Supabase can read back what it just wrote
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as any)
        );
      }
    ),
    response,
  };
}
