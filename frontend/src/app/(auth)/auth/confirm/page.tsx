'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function ConfirmInner() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const timeout = setTimeout(() => {
      router.replace('/login?error=google_failed');
    }, 15000);

    async function finish() {
      const supabase = createClient();

      // The server-side callback passes tokens in the URL hash to avoid
      // relying on Set-Cookie headers from redirect responses in Cloudflare Pages.
      const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      let session = null;

      if (access_token && refresh_token) {
        // Store the session client-side via setSession — bypasses HTTP cookie issues
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error || !data.session) {
          clearTimeout(timeout);
          router.replace('/login?error=google_failed');
          return;
        }
        session = data.session;
        // Clear tokens from URL without triggering navigation
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else {
        // Fallback: try reading from cookies (e.g., direct navigation to this page)
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }

      if (!session) {
        clearTimeout(timeout);
        router.replace('/login?error=google_failed');
        return;
      }

      // Ensure the user profile exists before entering the dashboard
      try {
        await fetch('/api/auth/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        });
      } catch {
        // withAuth will auto-create profile as fallback
      }

      clearTimeout(timeout);
      router.replace('/dashboard');
    }

    finish();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#031632] to-[#0a2550] flex items-center justify-center">
      <div className="text-white text-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-300">Finalizando login...</p>
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#031632] to-[#0a2550] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ConfirmInner />
    </Suspense>
  );
}
