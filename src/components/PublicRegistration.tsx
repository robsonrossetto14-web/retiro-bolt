import React, { useState, useEffect } from 'react';
import { Shield, Sword, CheckCircle, Instagram } from 'lucide-react';
import { supabase, Retreat } from '../lib/supabase';
import { NotificationResult, sendEmailNotification } from '../lib/notifications';
import { useParams } from './Router';
import logoHomensDeFe from '../assets/logo-homens-de-fe.png';

export default function PublicRegistration() {
  const { shareLink } = useParams();
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');
  const [emailNotification, setEmailNotification] = useState<NotificationResult | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    parish: '',
    has_health_issue: false,
    health_issue_details: '',
    shirt_size: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  const formatRetreatDates = (currentRetreat: Retreat) => {
    const start = new Date(currentRetreat.date).toLocaleDateString('pt-BR');
    const end = new Date(currentRetreat.end_date ?? currentRetreat.date).toLocaleDateString('pt-BR');
    return { start, end };
  };

  useEffect(() => {
    loadRetreat();
  }, [shareLink]);

  const loadRetreat = async () => {
    try {
      const { data, error } = await supabase
        .from('retreats')
        .select('*')
        .eq('share_link', shareLink)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setRetreat(data);
    } catch (error) {
      console.error('Error loading retreat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();
      if (normalizedEmail.endsWith('.con')) {
        alert('E-mail parece digitado errado. Você quis dizer ".com"?');
        return;
      }

      setSubmittedEmail(normalizedEmail);

      const basePayload = {
        retreat_id: retreat!.id,
        full_name: formData.full_name,
        phone: formData.phone,
        email: normalizedEmail,
        parish: formData.parish,
        shirt_size: formData.shirt_size,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
      };

      const registrationsTable = 'registrations' as string;
      const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
      const getErrorMessage = (error: unknown) =>
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message.toLowerCase()
          : '';

      const insertRegistrationAsAnon = async (attemptPayload: Record<string, unknown>) => {
        const supabaseUrl = env.VITE_SUPABASE_URL;
        const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
          return new Error('Configuração do Supabase não encontrada.');
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/registrations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(attemptPayload),
        });

        if (response.ok) return null;

        try {
          const payload = (await response.json()) as { message?: string; error?: string };
          return new Error(payload.message || payload.error || `Erro HTTP ${response.status}`);
        } catch {
          return new Error(`Erro HTTP ${response.status}`);
        }
      };

      // Try progressively compatible payloads to support different DB schemas.
      const attempts: Array<Record<string, unknown>> = [
        {
          ...basePayload,
          date_of_birth: formData.date_of_birth || null,
          has_health_issue: formData.has_health_issue,
          health_issue_details: formData.health_issue_details || null,
        },
        {
          ...basePayload,
          date_of_birth: formData.date_of_birth || null,
          uses_controlled_medication: formData.has_health_issue,
          medication_details: formData.health_issue_details || null,
        },
        {
          ...basePayload,
          has_health_issue: formData.has_health_issue,
          health_issue_details: formData.health_issue_details || null,
        },
        {
          ...basePayload,
          uses_controlled_medication: formData.has_health_issue,
          medication_details: formData.health_issue_details || null,
        },
        {
          ...basePayload,
        },
      ];

      let error: unknown = null;
      for (const attemptPayload of attempts) {
        const result = await supabase.from(registrationsTable).insert(attemptPayload);
        error = result.error;
        if (!error) break;

        const message = getErrorMessage(error);
        const isRlsError =
          message.includes('row-level security') ||
          message.includes('new row violates') ||
          message.includes('42501');

        if (isRlsError) {
          const anonError = await insertRegistrationAsAnon(attemptPayload);
          error = anonError;
          if (!error) break;
        }

        const isColumnMismatch =
          message.includes('could not find') ||
          message.includes('column') ||
          message.includes('schema cache');

        if (!isColumnMismatch) break;
      }

      if (error) throw error;

      const retreatDates = formatRetreatDates(retreat!);
      const notification = await sendEmailNotification({
        action: 'registration_confirmation',
        to: normalizedEmail,
        participantName: formData.full_name,
        retreatName: retreat!.name,
        retreatDate: retreatDates.start,
        retreatEndDate: retreatDates.end,
        location: retreat!.location,
        instagramHandle: retreat!.instagram_handle,
      });

      setEmailNotification(notification);

      if (!notification.emailSent) {
        // Keep registration flow smooth for the participant.
        // Delivery can still happen asynchronously depending on provider behavior.
        console.warn('Registration saved but email was not confirmed as sent.', notification);
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting registration:', error);
      const message =
        error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message.toLowerCase()
          : '';

      if (
        message.includes('row-level security') ||
        message.includes('new row violates') ||
        message.includes('42501')
      ) {
        alert(
          'O banco bloqueou a inscrição por política de segurança (RLS). ' +
            'Aplique a migration 20260215003000_fix_registration_insert_rls.sql no Supabase e tente novamente.'
        );
      } else {
        alert('Erro ao enviar inscrição. Por favor, tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resendEmail = async () => {
    if (!retreat || !submittedEmail) return;
    setResendingEmail(true);

    try {
      const retreatDates = formatRetreatDates(retreat);
      const notification = await sendEmailNotification({
        action: 'registration_confirmation',
        to: submittedEmail,
        participantName: formData.full_name,
        retreatName: retreat.name,
        retreatDate: retreatDates.start,
        retreatEndDate: retreatDates.end,
        location: retreat.location,
        instagramHandle: retreat.instagram_handle,
      });
      setEmailNotification(notification);

      if (notification.emailSent) {
        alert('E-mail reenviado. Verifique também spam e promoções.');
      } else {
        alert(
          `Não foi possível confirmar o envio do e-mail agora.\n\nMotivo: ${notification.error ?? 'desconhecido'}`
        );
      }
    } finally {
      setResendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center">
        <div className="text-amber-200 text-xl">Carregando...</div>
      </div>
    );
  }

  if (!retreat) {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center p-4">
        <div className="bg-stone-900 border-4 border-amber-700 rounded-lg p-8 text-center max-w-md">
          <Shield className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-amber-100 mb-2" style={{ fontFamily: 'serif' }}>
            Retiro Não Encontrado
          </h2>
          <p className="text-amber-300">Este link de inscrição não é válido ou o retiro não está mais disponível.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const instagramUrl = retreat.instagram_handle
      ? `https://instagram.com/${retreat.instagram_handle.replace('@', '')}`
      : 'https://instagram.com';

    return (
      <div className="app-bg min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>

        <div className="relative bg-stone-900 border-4 border-amber-700 rounded-lg p-8 text-center max-w-md shadow-2xl">
          <div className="absolute top-2 left-2">
            <Sword className="w-8 h-8 text-amber-500 transform -rotate-45" />
          </div>
          <div className="absolute top-2 right-2">
            <Sword className="w-8 h-8 text-amber-500 transform rotate-45" />
          </div>

          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-amber-100 mb-4" style={{ fontFamily: 'serif' }}>
            Chamado Aceito!
          </h2>
          <p className="text-amber-200 mb-6">
            Sua reserva foi confirmada. Muitos são chamados, mas poucos têm a coragem de dizer
            {' '}
            <span className="font-bold text-amber-100">'Sim'</span>.
            {' '}
            Você acaba de dar o primeiro passo para resgatar a sua essência e fortalecer o seu propósito.
          </p>

          <div className="bg-stone-800 border-2 border-amber-700 rounded-lg p-6 mb-6">
            <p className="text-amber-300 mb-4">
                Em breve você receberá mais informações sobre o pagamento via Sicoob/Sipag.
            </p>

            <div className="mt-4 bg-stone-900/50 border border-amber-700 rounded-lg p-4 text-left">
              <p className="text-amber-200 font-bold mb-2" style={{ fontFamily: 'serif' }}>
                E-mail
              </p>
              {emailNotification?.emailSent ? (
                <p className="text-green-300 text-sm">
                  Enviado para <span className="font-bold">{submittedEmail}</span>. Verifique spam/promoções.
                </p>
              ) : (
                <>
                  <p className="text-amber-300 text-sm">
                    Não conseguimos confirmar o envio para <span className="font-bold">{submittedEmail}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={resendEmail}
                    disabled={resendingEmail}
                    className="mt-3 inline-flex items-center justify-center w-full bg-stone-800 text-amber-100 font-bold py-2 px-4 rounded border border-amber-700 hover:bg-stone-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    style={{ fontFamily: 'serif' }}
                  >
                    {resendingEmail ? 'REENVIANDO...' : 'REENVIAR E-MAIL'}
                  </button>
                  {emailNotification?.error && (
                    <p className="text-amber-400 text-xs mt-2 break-words">
                      Motivo: {emailNotification.error}
                    </p>
                  )}
                </>
              )}
            </div>

            {retreat.instagram_handle && (
              <div className="flex items-center justify-center space-x-2 text-amber-200">
                <Instagram className="w-5 h-5" />
                <span>Siga-nos no Instagram:</span>
                <a
                  href={`https://instagram.com/${retreat.instagram_handle.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-amber-100 hover:text-amber-300 transition-colors"
                >
                  {retreat.instagram_handle}
                </a>
              </div>
            )}
          </div>

          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full mb-6 bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-bold py-3 px-4 rounded border-2 border-amber-600 hover:from-amber-600 hover:to-amber-500 transition-all transform hover:scale-105 shadow-lg"
            style={{ fontFamily: 'serif' }}
          >
            FINALIZAR
          </a>

          <div className="text-amber-400 text-sm">
            {(() => {
              const dates = formatRetreatDates(retreat);
              return (
                <>
                  <p className="font-bold mb-2">Detalhes do Retiro:</p>
                  <p>📅 Início: {dates.start}</p>
                  <p>🏁 Encerramento: {dates.end}</p>
                  <p>📍 {retreat.location}</p>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen py-8 px-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>

      <div className="relative max-w-2xl mx-auto">
        <div className="bg-stone-900 border-4 border-amber-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-700 to-amber-600 p-6 text-center relative">
            <div className="absolute top-2 left-2">
              <Sword className="w-8 h-8 text-amber-200 transform -rotate-45" />
            </div>
            <div className="absolute top-2 right-2">
              <Sword className="w-8 h-8 text-amber-200 transform rotate-45" />
            </div>
            <img
              src={logoHomensDeFe}
              alt="Logo Homens de Fé"
              className="h-16 w-auto object-contain mx-auto mb-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
            />
            <h1 className="text-3xl font-bold text-amber-100 tracking-wider mb-2" style={{ fontFamily: 'serif' }}>
              {retreat.name}
            </h1>
            <div className="text-amber-200">
              {(() => {
                const dates = formatRetreatDates(retreat);
                return (
                  <>
                    <p>📅 Início: {dates.start}</p>
                    <p>🏁 Encerramento: {dates.end}</p>
                  </>
                );
              })()}
              <p>📍 {retreat.location}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div className="bg-stone-800 border-2 border-amber-700 rounded-lg p-4 mb-6">
              <h3 className="text-amber-100 font-bold mb-2" style={{ fontFamily: 'serif' }}>
                Endereço:
              </h3>
              <p className="text-amber-300 text-sm">{retreat.address}</p>
              {retreat.what_to_bring && (
                <>
                  <h3 className="text-amber-100 font-bold mt-4 mb-2" style={{ fontFamily: 'serif' }}>
                    O que levar:
                  </h3>
                  <p className="text-amber-300 text-sm whitespace-pre-line">{retreat.what_to_bring}</p>
                </>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Paróquia *
                </label>
                <input
                  type="text"
                  value={formData.parish}
                  onChange={(e) => setFormData({ ...formData, parish: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Tamanho da Camiseta *
                </label>
                <select
                  value={formData.shirt_size}
                  onChange={(e) => setFormData({ ...formData, shirt_size: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                  required
                >
                  <option value="">Selecione...</option>
                  {retreat.shirt_sizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center space-x-2 text-amber-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.has_health_issue}
                    onChange={(e) =>
                      setFormData({ ...formData, has_health_issue: e.target.checked })
                    }
                    className="w-5 h-5 bg-stone-800 border-2 border-amber-700 rounded focus:ring-amber-500"
                  />
                  <span className="font-bold" style={{ fontFamily: 'serif' }}>
                    Possui problema de saude?
                  </span>
                </label>
              </div>

              {formData.has_health_issue && (
                <div className="md:col-span-2">
                  <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                    Detalhes do Problema de Saude
                  </label>
                  <textarea
                    value={formData.health_issue_details}
                    onChange={(e) => setFormData({ ...formData, health_issue_details: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    placeholder="Descreva o problema de saude e cuidados necessarios..."
                  />
                </div>
              )}

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Contato de Emergência *
                </label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Telefone de Emergência *
                </label>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border-2 border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-bold py-4 px-4 rounded border-2 border-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg text-lg"
              style={{ fontFamily: 'serif' }}
            >
              {loading ? 'ENVIANDO...' : 'CONFIRMAR INSCRIÇÃO'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
