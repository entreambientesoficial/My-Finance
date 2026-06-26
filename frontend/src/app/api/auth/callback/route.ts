export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${base}/login?error=google_cancelled`);
  }

  try {
    // Create the redirect response first so we can attach cookies to it
    const redirectTo = NextResponse.redirect(`${base}/dashboard`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            // Write session cookies directly into the redirect response
            cookiesToSet.forEach(({ name, value, options }) => {
              redirectTo.cookies.set(name, value, options as any);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error('[auth/callback] exchange error:', error?.message);
      return NextResponse.redirect(`${base}/login?error=google_failed`);
    }

    // Session cookies are now embedded in the 302 redirect to /dashboard.
    // The browser will store them and send them on every subsequent request.
    return redirectTo;
  } catch (err) {
    console.error('[auth/callback] unexpected error:', err);
    return NextResponse.redirect(`${base}/login?error=google_failed`);
  }
}
