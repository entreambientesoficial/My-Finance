'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});
type FormData = z.infer<typeof schema>;

const GOOGLE_ERRORS: Record<string, string> = {
  google_cancelled: 'Login com Google cancelado.',
  google_failed: 'Falha ao autenticar com Google. Tente novamente.',
  google_no_email: 'A conta Google não possui e-mail verificado.',
};

function SearchParamsHandler() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const err = searchParams.get('error');
    if (err && GOOGLE_ERRORS[err]) toast.error(GOOGLE_ERRORS[err]);
  }, [searchParams]);
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
      if (error) {
        toast.error(error.message === 'Invalid login credentials' ? 'Credenciais inválidas' : error.message);
        return;
      }
      toast.success('Bem-vindo!');
      router.push('/dashboard');
      router.refresh();
    } catch {
      toast.error('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#031632] to-[#0a2550] flex items-center justify-center p-4">
      <Suspense fallback={null}><SearchParamsHandler /></Suspense>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#006c49] text-4xl">account_balance_wallet</span>
            <span className="text-white text-2xl font-bold tracking-tight">MY-FINANCE</span>
          </div>
          <p className="text-slate-400 text-sm">Gestão financeira familiar inteligente</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-semibold text-[#031632] mb-6">Entrar na sua conta</h1>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-lg py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-4"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecionando...' : 'Entrar com Google'}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                {...register('email')}
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full bg-[#031632] text-white py-2.5 rounded-lg font-medium text-sm hover:bg-[#0a2550] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Não tem conta?{' '}
            <Link href="/register" className="text-[#006c49] font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.548 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
