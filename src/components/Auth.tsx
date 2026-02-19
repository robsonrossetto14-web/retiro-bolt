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
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
  const logoSrc = env.VITE_SUPABASE_URL
    ? `${env.VITE_SUPABASE_URL}/storage/v1/object/public/email-assets/logo.png`
    : logoHomensDeFe;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password, fullName);
        if (result.pendingApproval) {
          setSuccessMessage('Conta criada com sucesso. Aguarde aprovação do administrador para acessar o painel.');
          setIsLogin(true);
          setPassword('');
          return;
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        const message = err.message.toLowerCase();
        if (message.includes('user already registered')) {
          setError('Este e-mail já possui conta. Clique em "Já tenho conta" e faça login.');
        } else if (message.includes('invalid login credentials')) {
          setError('E-mail ou senha inválidos.');
        } else if (message.includes('email not confirmed')) {
          setError('E-mail ainda não confirmado.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Erro ao autenticar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>

      <div className="relative max-w-[680px] w-full">
        <div className="bg-stone-900/95 border-2 border-amber-700/80 rounded-2xl shadow-[0_18px_45px_rgba(0,0,0,0.45)] overflow-hidden">
          <div className="bg-gradient-to-r from-amber-900/35 to-slate-900 p-8 text-center relative border-b border-amber-700/70">
            <div className="absolute top-2 left-2">
              <Sword className="w-8 h-8 text-amber-300 transform -rotate-45" />
            </div>
            <div className="absolute top-2 right-2">
              <Sword className="w-8 h-8 text-amber-300 transform rotate-45" />
            </div>
            <img
              src={logoSrc}
              alt="Logo Homens de Fe"
              className="h-28 w-auto object-contain mx-auto mb-3 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
            />
            <h1 className="text-5xl md:text-6xl font-bold text-amber-100 tracking-wider leading-tight" style={{ fontFamily: 'serif' }}>
              RETIROS HOMENS DE FÉ
            </h1>
            <p className="text-amber-300 text-sm mt-2">Portal Administrativo</p>
          </div>

          <div className="p-8 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded-lg text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded-lg text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded-lg text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-900/50 border-2 border-red-700 text-red-200 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="bg-green-900/40 border border-green-700 text-green-200 px-4 py-3 rounded">
                  {successMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-bold py-3.5 px-4 rounded-lg border border-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] shadow-lg"
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
                  setSuccessMessage('');
                }}
                className="text-amber-300 hover:text-amber-200 text-sm"
                style={{ fontFamily: 'serif' }}
              >
                {isLogin ? 'Criar nova conta' : 'Já tenho conta'}
              </button>
            </div>
            {!isSupabaseConfigured && (
              <div className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                <p className="font-semibold text-amber-300">Modo local ativo (sem Supabase)</p>
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
