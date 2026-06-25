'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';

function ConfirmInner() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const supabase = createClient();

    const redirected = { current: false };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (redirected.current) return;

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        redirected.current = true;
        subscription.unsubscribe();
        await api.post('/api/auth/setup', {}).catch(() => {});
        router.replace('/dashboard');
      } else if (event === 'INITIAL_SESSION' && !session) {
        redirected.current = true;
        subscription.unsubscribe();
        router.replace('/login?error=google_failed');
      }
    });

    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      router.replace('/login?error=google_failed');
    }, 10000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#031632] to-[#0a2550] flex items-center justify-center">
      <div className="text-white text-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-300">Entrando...</p>
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
