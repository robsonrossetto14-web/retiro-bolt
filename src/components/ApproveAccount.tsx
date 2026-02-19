import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

type ApproveAccountProps = {
  token: string;
};

export default function ApproveAccount({ token }: ApproveAccountProps) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);
  const [message, setMessage] = useState('Validando link de aprovação...');

  useEffect(() => {
    const approve = async () => {
      try {
        const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
        const supabaseUrl = env.VITE_SUPABASE_URL;
        const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Configuração do Supabase não encontrada.');
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/approve-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ token }),
        });

        const text = await response.text();
        let payload: { ok?: boolean; message?: string; error?: string } = {};
        try {
          payload = JSON.parse(text) as { ok?: boolean; message?: string; error?: string };
        } catch {
          payload = { ok: response.ok, message: text };
        }

        if (!response.ok || payload.ok !== true) {
          throw new Error(payload.error || payload.message || 'Não foi possível aprovar esta conta.');
        }

        setOk(true);
        setMessage(payload.message || 'Conta aprovada com sucesso.');
      } catch (error) {
        const errorMessage =
          error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
            ? error.message
            : 'Falha ao aprovar conta.';
        setOk(false);
        setMessage(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    void approve();
  }, [token]);

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-stone-900 border-2 border-amber-700 rounded-xl p-8 text-center shadow-2xl">
        {ok ? (
          <ShieldCheck className="w-14 h-14 text-green-400 mx-auto mb-4" />
        ) : (
          <ShieldAlert className="w-14 h-14 text-red-400 mx-auto mb-4" />
        )}
        <h1 className="text-3xl font-bold text-amber-100 mb-3" style={{ fontFamily: 'serif' }}>
          Aprovação de Conta
        </h1>
        <p className="text-amber-200">{loading ? 'Aguarde...' : message}</p>
        <button
          type="button"
          onClick={() => {
            window.location.href = '/';
          }}
          className="mt-6 bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-bold px-6 py-3 rounded border border-amber-600 hover:from-amber-600 hover:to-amber-500 transition-all"
          style={{ fontFamily: 'serif' }}
        >
          Ir para login
        </button>
      </div>
    </div>
  );
}

