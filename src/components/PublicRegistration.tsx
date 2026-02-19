import React, { useState, useEffect } from 'react';
import { Shield, Sword, CheckCircle, Instagram } from 'lucide-react';
import { supabase, Retreat } from '../lib/supabase';
import { sendEmailNotification, type NotificationResult } from '../lib/notifications';
import { useParams } from './Router';
import logoHomensDeFe from '../assets/logo-homens-de-fe.png';

type RegistrationEmailPayload = {
  action: 'registration_confirmation';
  to: string;
  phone?: string;
  participantName: string;
  retreatName: string;
  retreatDate?: string;
  retreatEndDate?: string;
  location?: string;
  instagramHandle?: string | null;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeBirthDate = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() === Number(month) - 1 &&
      parsed.getDate() === Number(day)
    ) {
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!brMatch) return null;

  const [, day, month, year] = brMatch;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
};

const formatBirthDateInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const formatPhoneInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export default function PublicRegistration() {
  const { shareLink } = useParams();
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [notificationResult, setNotificationResult] = useState<NotificationResult | null>(null);
  const [notificationPayload, setNotificationPayload] = useState<RegistrationEmailPayload | null>(null);
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
    accepted_terms: false,
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

  const sendRegistrationEmailWithRetry = async (
    payload: RegistrationEmailPayload,
    attempts = 3,
  ): Promise<NotificationResult> => {
    let lastResult: NotificationResult | null = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const result = await sendEmailNotification(payload);
      lastResult = result;
      if (result.emailSent) return result;

      if (attempt < attempts) {
        await wait(700 * attempt);
      }
    }

    return (
      lastResult ?? {
        ok: false,
        emailSent: false,
        error: 'email_send_failed',
        whatsapp: { attempted: false, sent: false },
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotificationResult(null);
    setNotificationPayload(null);

    try {
      const normalizedEmail = formData.email.trim().toLowerCase();
      const normalizedBirthDate = normalizeBirthDate(formData.date_of_birth);
      if (normalizedEmail.endsWith('.con')) {
        alert('E-mail parece digitado errado. Você quis dizer ".com"?');
        return;
      }
      if (!normalizedBirthDate) {
        alert('Data de nascimento invalida. Use o formato dd/mm/aaaa.');
        return;
      }
      if (!formData.accepted_terms) {
        alert('Para concluir a inscricao, voce precisa aceitar o termo de participacao.');
        return;
      }

      const basePayload = {
        retreat_id: retreat!.id,
        full_name: formData.full_name,
        phone: formData.phone,
        email: normalizedEmail,
        parish: formData.parish,
        shirt_size: formData.shirt_size,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
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

      const hasHealthIssue = formData.has_health_issue || formData.health_issue_details.trim().length > 0;

      // Try progressively compatible payloads to support different DB schemas.
      const attempts: Array<Record<string, unknown>> = [
        {
          ...basePayload,
          date_of_birth: normalizedBirthDate,
          has_health_issue: hasHealthIssue,
          health_issue_details: formData.health_issue_details || null,
        },
        {
          ...basePayload,
          date_of_birth: normalizedBirthDate,
          uses_controlled_medication: hasHealthIssue,
          medication_details: formData.health_issue_details || null,
        },
        {
          ...basePayload,
          has_health_issue: hasHealthIssue,
          health_issue_details: formData.health_issue_details || null,
        },
        {
          ...basePayload,
          uses_controlled_medication: hasHealthIssue,
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
      const payload: RegistrationEmailPayload = {
        action: 'registration_confirmation',
        to: normalizedEmail,
        phone: formData.phone,
        participantName: formData.full_name,
        retreatName: retreat!.name,
        retreatDate: retreatDates.start,
        retreatEndDate: retreatDates.end,
        location: retreat!.location,
        instagramHandle: retreat!.instagram_handle,
      };

      const notification = await sendRegistrationEmailWithRetry(payload, 3);
      setNotificationResult(notification);
      setNotificationPayload(payload);

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

  const handleResendEmail = async () => {
    if (!notificationPayload) return;
    try {
      setResendingEmail(true);
      const result = await sendRegistrationEmailWithRetry(notificationPayload, 2);
      setNotificationResult(result);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleFinish = (targetUrl: string, appUrl?: string | null) => {
    window.close();

    if (appUrl) {
      // Try opening Instagram app first on mobile.
      window.location.href = appUrl;
    }

    // Fallback to web URL when app is not installed/opened.
    setTimeout(() => {
      window.location.assign(targetUrl);
    }, appUrl ? 800 : 120);
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
    const instagramHandle = retreat.instagram_handle?.replace('@', '').trim() ?? '';
    const instagramUrl = retreat.instagram_handle
      ? `https://instagram.com/${instagramHandle}`
      : 'https://instagram.com';
    const instagramAppUrl = instagramHandle ? `instagram://user?username=${instagramHandle}` : null;

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
                Em breve você receberá mais informações sobre o pagamento.
              </p>

            {notificationResult && (
              <div className="mb-5 rounded-lg border border-amber-700 bg-stone-900/60 p-4 text-left">
                {notificationResult.emailSent ? (
                  <>
                    <p className="text-amber-200 font-bold">E-mail de confirmação enviado.</p>
                    <p className="text-amber-300 text-sm mt-1">
                      Se não encontrar, verifique também a caixa de spam/lixo eletrônico.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-amber-200 font-bold">Não conseguimos confirmar o envio do e-mail.</p>
                    <p className="text-amber-300 text-sm mt-1">
                      Sua inscrição foi salva normalmente. Verifique o spam e, se quiser, tente reenviar.
                    </p>
                    <button
                      type="button"
                      onClick={handleResendEmail}
                      disabled={resendingEmail}
                      className="mt-3 w-full bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-bold py-2 px-4 rounded border-2 border-amber-600 hover:from-amber-600 hover:to-amber-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ fontFamily: 'serif' }}
                    >
                      {resendingEmail ? 'Reenviando...' : 'Reenviar e-mail'}
                    </button>
                  </>
                )}
              </div>
            )}

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

          <button
            type="button"
            onClick={() => handleFinish(instagramUrl, instagramAppUrl)}
            className="inline-flex items-center justify-center w-full mb-6 bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-bold py-3 px-4 rounded border-2 border-amber-600 hover:from-amber-600 hover:to-amber-500 transition-all transform hover:scale-105 shadow-lg"
            style={{ fontFamily: 'serif' }}
          >
            FINALIZAR
          </button>

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
    <div className="app-bg min-h-screen px-4 py-8">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>

      <div className="relative max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <img
            src={logoHomensDeFe}
            alt="Logo Homens de Fé"
            className="h-14 w-auto object-contain mx-auto mb-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
          />
          <h1 className="text-4xl font-bold text-amber-100 tracking-wider" style={{ fontFamily: 'serif' }}>
            {retreat.name}
          </h1>
          <div className="mt-2 flex flex-wrap justify-center gap-2 text-sm text-amber-200">
            {(() => {
              const dates = formatRetreatDates(retreat);
              return (
                <>
                  <span className="rounded-full border border-amber-700 bg-stone-900/70 px-4 py-1.5">📅 {dates.start} - {dates.end}</span>
                  <span className="rounded-full border border-amber-700 bg-stone-900/70 px-4 py-1.5">📍 {retreat.location}</span>
                </>
              );
            })()}
          </div>
        </div>

        <div className="bg-stone-900/95 border-2 border-amber-700 rounded-xl shadow-2xl overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
            <div className="text-center border-b border-amber-700/70 pb-4">
              <h2 className="text-xl font-bold text-amber-100" style={{ fontFamily: 'serif' }}>Faça sua inscrição</h2>
              {retreat.price != null && (
                <p className="text-amber-300 text-sm mt-1">
                  Valor: {Number(retreat.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  WhatsApp *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: formatPhoneInput(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={16}
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
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Data de nascimento *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.date_of_birth}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      date_of_birth: formatBirthDateInput(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
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
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                  placeholder="Nome da sua paróquia"
                  required
                />
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Tamanho da camiseta *
                </label>
                <select
                  value={formData.shirt_size}
                  onChange={(e) => setFormData({ ...formData, shirt_size: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                  required
                >
                  <option value="">Selecione o tamanho</option>
                  {retreat.shirt_sizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Contato de emergência *
                </label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                  placeholder="Nome do contato"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Telefone de emergência *
                </label>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergency_contact_phone: formatPhoneInput(e.target.value),
                    })
                  }
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={16}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                  Informações de saúde (opcional)
                </label>
                <textarea
                  value={formData.health_issue_details}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      health_issue_details: e.target.value,
                      has_health_issue: e.target.value.trim().length > 0,
                    })
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-stone-800 border border-amber-700 rounded text-amber-100 focus:outline-none focus:border-amber-500"
                  placeholder="Alergia, medicamento contínuo, restrições alimentares, etc."
                />
              </div>
            </div>

            <div className="rounded-lg border border-amber-700 bg-stone-900/70 p-4">
              <p className="text-amber-100 text-sm font-bold mb-2" style={{ fontFamily: 'serif' }}>
                Termo de participação
              </p>
              <div className="max-h-36 overflow-y-auto rounded border border-amber-700/60 bg-stone-800/80 p-3 text-xs text-amber-300 leading-relaxed">
                Declaro que as informações fornecidas nesta inscrição são verdadeiras e que participarei do retiro por
                livre e espontânea vontade. Estou ciente das atividades espirituais propostas, das orientações da equipe
                organizadora e autorizo o uso dos meus dados exclusivamente para comunicações e organização deste retiro.
              </div>
              <label className="mt-3 flex items-start gap-2 text-amber-100 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.accepted_terms}
                  onChange={(e) => setFormData({ ...formData, accepted_terms: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-amber-600 bg-stone-800"
                  required
                />
                <span>Li e aceito o termo de participação.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-700 to-amber-600 text-amber-100 font-bold py-3 px-4 rounded border border-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ fontFamily: 'serif' }}
            >
              {loading ? 'ENVIANDO...' : 'Confirmar inscrição'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
