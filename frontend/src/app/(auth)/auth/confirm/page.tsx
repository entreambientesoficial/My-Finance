'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// This page is no longer part of the main OAuth flow.
// The callback route now sets cookies server-side and redirects directly to /dashboard.
// This page exists only as a fallback for direct navigation or stale bookmarks.
export default function AuthConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        router.replace(session ? '/dashboard' : '/login');
      })
      .catch(() => router.replace('/login'));
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
