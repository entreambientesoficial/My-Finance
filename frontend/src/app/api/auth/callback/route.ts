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
    // Temporary response object so createServerClient can read the PKCE verifier
    // from req.cookies. We don't use the Set-Cookie output — tokens are passed
    // via URL hash instead, which is reliable across all Cloudflare Pages setups.
    const dummy = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              dummy.cookies.set(name, value, options as any);
            });
          },
        },
      }
    );

    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !exchangeData.session) {
      console.error('[auth/callback] exchange error:', error?.message);
      return NextResponse.redirect(`${base}/login?error=google_failed`);
    }

    const { access_token, refresh_token, expires_in } = exchangeData.session;

    // Pass tokens via URL hash — browser does not send hash to server (no logs),
    // and it bypasses the Set-Cookie-on-redirect reliability issue in Cloudflare Pages.
    const hash = new URLSearchParams({
      access_token,
      refresh_token: refresh_token ?? '',
      expires_in: String(expires_in ?? 3600),
      token_type: 'bearer',
    }).toString();

    return NextResponse.redirect(`${base}/auth/confirm#${hash}`);
  } catch (err) {
    console.error('[auth/callback] unexpected error:', err);
    return NextResponse.redirect(`${base}/login?error=google_failed`);
  }
}
