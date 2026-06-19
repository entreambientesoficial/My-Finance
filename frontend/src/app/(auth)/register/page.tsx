'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  householdName: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await api.post('/auth/register', data);
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      toast.success('Conta criada com sucesso!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#031632] to-[#0a2550] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#006c49] text-4xl">account_balance_wallet</span>
            <span className="text-white text-2xl font-bold tracking-tight">MY-FINANCE</span>
          </div>
          <p className="text-slate-400 text-sm">Comece a controlar suas finanças hoje</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-semibold text-[#031632] mb-6">Criar conta</h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Seu nome</label>
              <input
                {...register('name')}
                placeholder="João Silva"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

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
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome da família <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                {...register('householdName')}
                placeholder="Ex: Família Silva"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#031632]/20 focus:border-[#031632]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#006c49] text-white py-2.5 rounded-lg font-medium text-sm hover:bg-[#005a3d] transition-colors disabled:opacity-60"
            >
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Já tem conta?{' '}
            <Link href="/login" className="text-[#006c49] font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
