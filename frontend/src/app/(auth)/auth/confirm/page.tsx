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

    async function finish() {
      const supabase = createClient();

      // getSession() awaits createBrowserClient initialization internally.
      // It reads the session cookies that the server-side callback already set.
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login?error=google_failed');
        return;
      }

      // Ensure the user profile exists in our database.
      // The Bearer token is added automatically by the api.ts interceptor.
      try {
        const res = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        });
        if (!res.ok && res.status !== 200) {
          // If setup fails, still try to go to dashboard — withAuth will retry
          console.warn('[auth/confirm] setup returned', res.status);
        }
      } catch (e) {
        console.warn('[auth/confirm] setup error', e);
      }

      router.replace('/dashboard');
    }

    // Timeout safety net — if everything hangs, redirect after 15s
    const timeout = setTimeout(() => {
      router.replace('/login?error=google_failed');
    }, 15000);

    finish().finally(() => clearTimeout(timeout));
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
