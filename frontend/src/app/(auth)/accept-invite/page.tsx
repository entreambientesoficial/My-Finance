'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function AcceptInvitePage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError('Token de convite inválido.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/accept-invite', { token, name, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      toast.success('Bem-vindo(a) ao MY-FINANCE!');
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Convite inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#031632] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="material-symbols-outlined text-[#006c49] text-3xl">account_balance_wallet</span>
          <span className="text-white font-bold text-2xl tracking-tight">MY-FINANCE</span>
        </div>

        <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
          <h1 className="text-white text-xl font-bold mb-1">Aceitar convite</h1>
          <p className="text-slate-400 text-sm mb-6">Crie sua senha para entrar na família.</p>

          {!token && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm mb-4">
              Link de convite inválido. Solicite um novo convite.
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Seu nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Como quer ser chamado(a)?"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-[#006c49]/60 focus:bg-white/8 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Crie uma senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-[#006c49]/60 focus:bg-white/8 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full bg-[#006c49] text-white py-3 rounded-xl font-medium text-sm hover:bg-[#005a3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Entrando...' : 'Entrar na família'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
