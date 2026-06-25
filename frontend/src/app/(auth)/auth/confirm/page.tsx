'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';

function ConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const code = searchParams.get('code');
    if (!code) {
      router.replace('/login?error=google_cancelled');
      return;
    }

    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error || !data.session) {
          router.replace('/login?error=google_failed');
          return;
        }

        await api.post('/api/auth/setup', {}).catch(() => {});

        router.replace('/dashboard');
      } catch {
        router.replace('/login?error=google_failed');
      }
    })();
  }, [searchParams, router]);

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
