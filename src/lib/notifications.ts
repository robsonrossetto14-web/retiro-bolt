type EmailAction = 'registration_confirmation' | 'payment_link' | 'payment_confirmed';

type EmailPayload = {
  action: EmailAction;
  to: string;
  phone?: string;
  participantName: string;
  retreatName: string;
  retreatDate?: string;
  retreatEndDate?: string;
  location?: string;
  instagramHandle?: string | null;
  paymentLink?: string;
  whatsappGroupLink?: string;
};

export type NotificationResult = {
  ok: boolean;
  emailSent: boolean;
  error?: string;
  details?: string;
  whatsapp: {
    attempted: boolean;
    sent: boolean;
    reason?: string;
    details?: string;
  };
};

const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;

const defaultResult: NotificationResult = {
  ok: false,
  emailSent: false,
  error: 'unknown_error',
  whatsapp: {
    attempted: false,
    sent: false,
    reason: 'not_attempted',
  },
};

export async function sendEmailNotification(payload: EmailPayload): Promise<NotificationResult> {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ...defaultResult,
      error: 'missing_supabase_config',
      whatsapp: { ...defaultResult.whatsapp, reason: 'missing_supabase_config' },
    };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let raw = '';
      try {
        raw = await response.text();
      } catch {
        raw = '';
      }

      try {
        const parsed = JSON.parse(raw) as { error?: string; details?: string };
        return {
          ...defaultResult,
          error: parsed.error ?? `http_${response.status}`,
          details: parsed.details ?? raw,
        };
      } catch {
        return {
          ...defaultResult,
          error: `http_${response.status}`,
          details: raw,
        };
      }
    }

    const body = (await response.json()) as Partial<NotificationResult>;
    return {
      ok: body.ok === true,
      emailSent: body.emailSent === true,
      error: body.error,
      details: body.details,
      whatsapp: {
        attempted: body.whatsapp?.attempted === true,
        sent: body.whatsapp?.sent === true,
        reason: body.whatsapp?.reason,
        details: body.whatsapp?.details,
      },
    };
  } catch (error) {
    console.error('Error calling send-email function:', error);
    return { ...defaultResult, error: 'network_error' };
  }
}

