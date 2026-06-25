'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';

function ConfirmInner() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const supabase = createClient();
    let redirected = false;

    // The server-side callback already exchanged the OAuth code and set session
    // cookies. createBrowserClient reads those cookies and fires INITIAL_SESSION.
    // No PKCE exchange happens here — we just wait for the session to be ready
    // and then ensure the user profile exists before entering the dashboard.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (redirected) return;

      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session) {
        redirected = true;
        subscription.unsubscribe();
        // Ensure profile exists — Bearer token is sent automatically by api.ts
        await api.post('/api/auth/setup', {}).catch(() => {});
        router.replace('/dashboard');
        return;
      }

      if (event === 'INITIAL_SESSION' && !session) {
        redirected = true;
        subscription.unsubscribe();
        router.replace('/login?error=google_failed');
      }
    });

    const timeout = setTimeout(() => {
      if (!redirected) {
        redirected = true;
        subscription.unsubscribe();
        router.replace('/login?error=google_failed');
      }
    }, 12000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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
