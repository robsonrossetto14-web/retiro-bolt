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

type NotificationResult = {
  ok: boolean;
  emailSent: boolean;
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
    return { ...defaultResult, whatsapp: { ...defaultResult.whatsapp, reason: 'missing_supabase_config' } };
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
      return defaultResult;
    }

    const body = await response.json() as Partial<NotificationResult>;
    return {
      ok: body.ok === true,
      emailSent: body.emailSent === true,
      whatsapp: {
        attempted: body.whatsapp?.attempted === true,
        sent: body.whatsapp?.sent === true,
        reason: body.whatsapp?.reason,
        details: body.whatsapp?.details,
      },
    };
  } catch (error) {
    console.error('Error calling send-email function:', error);
    return defaultResult;
  }
}

