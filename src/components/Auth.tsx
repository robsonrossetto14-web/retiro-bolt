import React, { useState } from 'react';
import { Sword } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import logoHomensDeFe from '../assets/logo-homens-de-fe.png';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
  const logoSrc = env.VITE_SUPABASE_URL
    ? `${env.VITE_SUPABASE_URL}/storage/v1/object/public/email-assets/logo.png`
    : logoHomensDeFe;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>

      <div className="relative max-w-md w-full">
        <div className="bg-surface-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-surface-800 to-slate-800 p-6 text-center relative border-b border-slate-700">
            <div className="absolute top-2 left-2">
              <Sword className="w-8 h-8 text-accent-300 transform -rotate-45" />
            </div>
            <div className="absolute top-2 right-2">
              <Sword className="w-8 h-8 text-accent-300 transform rotate-45" />
            </div>
            <img
              src={logoSrc}
              alt="Logo Homens de Fe"
              className="h-24 w-auto object-contain mx-auto mb-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
            />
            <h1 className="text-3xl font-bold text-slate-100 tracking-wider" style={{ fontFamily: 'serif' }}>
              RETIROS HOMENS DE FÉ
            </h1>
            <p className="text-slate-300 text-sm mt-1">Portal Administrativo</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-slate-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-800 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-500/30"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-800 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-800 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-500/30"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-900/50 border-2 border-red-700 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-accent-500/40 to-accent-400/40 text-slate-100 font-bold py-3 px-4 rounded border border-accent-400/50 hover:from-accent-500/60 hover:to-accent-400/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
                style={{ fontFamily: 'serif' }}
              >
                {loading ? 'Aguarde...' : isLogin ? 'ENTRAR' : 'CRIAR CONTA'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-accent-300 hover:text-accent-400 text-sm"
                style={{ fontFamily: 'serif' }}
              >
                {isLogin ? 'Criar nova conta' : 'Já tenho conta'}
              </button>
            </div>
            {!isSupabaseConfigured && (
              <div className="mt-4 rounded border border-accent-400/40 bg-accent-500/10 p-3 text-xs text-slate-200">
                <p className="font-semibold text-accent-300">Modo local ativo (sem Supabase)</p>
                <p>Email: admin@local.com</p>
                <p>Senha: 123456</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
