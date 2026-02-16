// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type EmailAction = 'registration_confirmation' | 'payment_link' | 'payment_confirmed';

type RequestPayload = {
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

type WhatsAppResult = {
  attempted: boolean;
  sent: boolean;
  reason?: string;
  details?: string;
};

type WhatsAppTemplateConfig = {
  paymentLinkTemplateName?: string | null;
  paymentConfirmedTemplateName?: string | null;
  languageCode?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseAllowedOrigins(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  // If not configured, keep backward compatibility.
  if (allowedOrigins.length === 0) return true;
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

function looksLikeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function escapeHtml(value?: string | null): string {
  if (!value) return '-';
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function actionButton(url: string, label: string): string {
  return `
    <a href="${escapeHtml(url)}" style="
      display:inline-block;
      background:#b8860b;
      color:#1a1206;
      padding:12px 18px;
      border-radius:8px;
      text-decoration:none;
      font-weight:700;
      margin-top:12px;
    ">${escapeHtml(label)}</a>
  `;
}

function normalizeLogoUrl(logoUrl?: string | null): string | null {
  if (!logoUrl) return null;
  const trimmed = logoUrl.trim();
  if (!trimmed) return null;

  // Common copy/paste mistake: duplicated extension (e.g. .png.png)
  return trimmed.replace(/\.(png|jpe?g|webp|gif)\.\1$/i, '.$1');
}

function normalizePhoneForWhatsApp(rawPhone?: string): string | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return null;
}

function buildWhatsAppMessage(payload: RequestPayload): string | null {
  const safeName = payload.participantName || 'participante';
  const dateInfo = payload.retreatEndDate && payload.retreatEndDate !== payload.retreatDate
    ? `${payload.retreatDate} ate ${payload.retreatEndDate}`
    : payload.retreatDate ?? '-';

  if (payload.action === 'payment_link') {
    return [
      `Paz, ${safeName}!`,
      '',
      `As formas de pagamento via Sicoob/Sipag do retiro "${payload.retreatName}" foram enviadas para o seu e-mail.`,
      'Confira sua caixa de entrada e spam.',
      '',
      `Data: ${dateInfo}`,
      `Local: ${payload.location ?? '-'}`,
    ].join('\n');
  }

  if (payload.action === 'payment_confirmed') {
    return [
      `Paz, ${safeName}!`,
      '',
      `Pagamento confirmado para o retiro "${payload.retreatName}".`,
      'Sua vaga esta garantida!',
      payload.whatsappGroupLink ? `Entre no grupo: ${payload.whatsappGroupLink}` : '',
      '',
      `Data: ${dateInfo}`,
      `Local: ${payload.location ?? '-'}`,
    ].filter(Boolean).join('\n');
  }

  return null;
}

async function sendWhatsAppMessage(
  payload: RequestPayload,
  accessToken?: string | null,
  phoneNumberId?: string | null,
  apiVersion?: string | null,
  templateConfig?: WhatsAppTemplateConfig,
): Promise<WhatsAppResult> {
  if (!payload.phone) {
    return { attempted: false, sent: false, reason: 'missing_phone' };
  }

  const to = normalizePhoneForWhatsApp(payload.phone);
  if (!to) {
    return { attempted: true, sent: false, reason: 'invalid_phone' };
  }

  if (!accessToken || !phoneNumberId) {
    return { attempted: true, sent: false, reason: 'config_missing' };
  }

  const endpoint = `https://graph.facebook.com/${apiVersion ?? 'v22.0'}/${phoneNumberId}/messages`;

  const selectedTemplate =
    payload.action === 'payment_link'
      ? templateConfig?.paymentLinkTemplateName
      : payload.action === 'payment_confirmed'
        ? templateConfig?.paymentConfirmedTemplateName
        : null;

  // Production path: use approved Utility templates.
  if (selectedTemplate) {
    const dateInfo = payload.retreatEndDate && payload.retreatEndDate !== payload.retreatDate
      ? `${payload.retreatDate} ate ${payload.retreatEndDate}`
      : payload.retreatDate ?? '-';

    const templateBodyParams =
      payload.action === 'payment_link'
        ? [
            payload.participantName,
            payload.retreatName,
            dateInfo,
            payload.location ?? '-',
          ]
        : [
            payload.participantName,
            payload.retreatName,
            payload.whatsappGroupLink ?? '-',
            dateInfo,
          ];

    const templateResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: selectedTemplate,
          language: {
            code: templateConfig?.languageCode ?? 'pt_BR',
          },
          components: [
            {
              type: 'body',
              parameters: templateBodyParams.map((value) => ({
                type: 'text',
                text: value,
              })),
            },
          ],
        },
      }),
    });

    if (!templateResponse.ok) {
      const details = await templateResponse.text();
      return { attempted: true, sent: false, reason: 'template_provider_error', details };
    }

    return { attempted: true, sent: true };
  }

  const message = buildWhatsAppMessage(payload);
  if (!message) {
    return { attempted: false, sent: false, reason: 'action_not_supported' };
  }

  // Fallback path for dev/testing when template is not configured.
  const textResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }),
  });

  if (!textResponse.ok) {
    const details = await textResponse.text();
    return { attempted: true, sent: false, reason: 'provider_error', details };
  }

  return { attempted: true, sent: true, reason: 'fallback_text_sent' };
}

function baseTemplate(
  title: string,
  intro: string,
  details: string,
  actionHtml = '',
  footer = '',
  logoUrl?: string | null,
): string {
  const normalizedLogoUrl = normalizeLogoUrl(logoUrl);
  const safeLogoUrl = normalizedLogoUrl ? escapeHtml(normalizedLogoUrl) : '';
  const logoHtml = safeLogoUrl
    ? `
      <div style="padding:20px 24px 0;">
        <img src="${safeLogoUrl}" alt="Homens de Fe" style="max-width:180px;height:auto;display:block;margin:0 auto;" />
      </div>
    `
    : '';

  return `
    <div style="background:#120d06;padding:24px 12px;font-family:Arial,sans-serif;color:#f8f3e8;">
      <div style="max-width:640px;margin:0 auto;background:#1e160b;border:1px solid #3c2b12;border-radius:12px;overflow:hidden;">
        ${logoHtml}
        <div style="padding:20px 24px;background:#2b1d0c;border-bottom:1px solid #3c2b12;">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#d5b06c;">Retiros Homens de Fe</div>
          <h1 style="margin:8px 0 0;font-size:22px;color:#f6e4b6;">${title}</h1>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 14px;line-height:1.6;">${intro}</p>
          <div style="background:#161008;border:1px solid #3c2b12;border-radius:10px;padding:14px 16px;">
            ${details}
          </div>
          ${actionHtml ? `<div>${actionHtml}</div>` : ''}
          ${footer ? `<p style="margin:18px 0 0;color:#d6c39e;line-height:1.6;">${footer}</p>` : ''}
        </div>
      </div>
    </div>
  `;
}

function paymentInstructionsHtml(rawInstructions?: string): string {
  if (!rawInstructions) return '';
  const trimmed = rawInstructions.trim();
  if (!trimmed) return '';

  if (looksLikeHttpUrl(trimmed)) {
    return actionButton(trimmed, 'Ver formas de pagamento');
  }

  const formatted = escapeHtml(trimmed).replaceAll('\n', '<br/>');
  return `
    <div style="margin-top:12px;background:#161008;border:1px dashed #8a6b2f;border-radius:10px;padding:12px 14px;line-height:1.6;">
      <strong>Instrucoes de pagamento:</strong><br/>
      ${formatted}
    </div>
  `;
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildEmail(payload: RequestPayload, logoUrl?: string | null): { subject: string; html: string } {
  const dateInfo = payload.retreatEndDate && payload.retreatEndDate !== payload.retreatDate
    ? `${payload.retreatDate} até ${payload.retreatEndDate}`
    : payload.retreatDate ?? '-';
  const details = `
    <p style="margin:0 0 8px;"><strong>Retiro:</strong> ${escapeHtml(payload.retreatName)}</p>
    <p style="margin:0 0 8px;"><strong>Participante:</strong> ${escapeHtml(payload.participantName)}</p>
    <p style="margin:0 0 8px;"><strong>Data:</strong> ${escapeHtml(dateInfo)}</p>
    <p style="margin:0;"><strong>Local:</strong> ${escapeHtml(payload.location ?? '-')}</p>
  `;

  if (payload.action === 'payment_link') {
    return {
      subject: `Formas de pagamento (Sicoob/Sipag) - ${payload.retreatName}`,
      html: baseTemplate(
        'Formas de pagamento (Sicoob/Sipag) disponiveis',
        `Ola, ${escapeHtml(payload.participantName)}! As formas de pagamento via Sicoob/Sipag foram enviadas abaixo.`,
        details,
        paymentInstructionsHtml(payload.paymentLink),
        'Se precisar de ajuda, fale com a equipe organizadora.',
        logoUrl,
      ),
    };
  }

  if (payload.action === 'payment_confirmed') {
    return {
      subject: `Pagamento confirmado - ${payload.retreatName}`,
      html: baseTemplate(
        'Pagamento confirmado',
        `Pagamento confirmado, ${escapeHtml(payload.participantName)}! Sua participacao esta garantida.`,
        details,
        payload.whatsappGroupLink ? actionButton(payload.whatsappGroupLink, 'Entrar no grupo do WhatsApp') : '',
        'Nos vemos em breve. Preparacao e coragem para essa jornada.',
        logoUrl,
      ),
    };
  }

  return {
    subject: `Inscrição recebida - ${payload.retreatName}`,
    html: baseTemplate(
      'Chamado Aceito!',
      `Sua inscricao foi recebida com sucesso, ${escapeHtml(payload.participantName)}.`,
      `
        ${details}
        ${payload.instagramHandle ? `<p style="margin:10px 0 0;"><strong>Instagram:</strong> ${escapeHtml(payload.instagramHandle)}</p>` : ''}
      `,
      '',
      "Muitos sao chamados, mas poucos tem coragem de dizer 'Sim'. Em breve voce recebera os proximos passos.",
      logoUrl,
    ),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const googleScriptWebhookUrl = Deno.env.get('GOOGLE_SCRIPT_WEBHOOK_URL');
    const googleScriptWebhookToken = Deno.env.get('GOOGLE_SCRIPT_WEBHOOK_TOKEN');
    const emailLogoUrl = Deno.env.get('EMAIL_LOGO_URL');
    const whatsappAccessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const whatsappPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const whatsappApiVersion = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v22.0';
    const whatsappTemplatePaymentLink = Deno.env.get('WHATSAPP_TEMPLATE_PAYMENT_LINK');
    const whatsappTemplatePaymentConfirmed = Deno.env.get('WHATSAPP_TEMPLATE_PAYMENT_CONFIRMED');
    const whatsappTemplateLanguageCode = Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE_CODE') ?? 'pt_BR';
    const allowedOrigins = parseAllowedOrigins(Deno.env.get('EMAIL_ALLOWED_ORIGINS'));

    if (!googleScriptWebhookUrl) {
      return new Response(JSON.stringify({ error: 'Email provider not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestOrigin = req.headers.get('origin');
    if (!isOriginAllowed(requestOrigin, allowedOrigins)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json() as RequestPayload;
    if (!payload?.action || !payload?.to || !payload?.participantName || !payload?.retreatName) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isLikelyEmail(payload.to)) {
      return new Response(JSON.stringify({ error: 'Invalid recipient email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { subject, html } = buildEmail(payload, emailLogoUrl);

    const googleResponse = await fetch(googleScriptWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: payload.to,
        participantName: payload.participantName,
        subject,
        html,
        action: payload.action,
        retreatName: payload.retreatName,
        ...(googleScriptWebhookToken ? { token: googleScriptWebhookToken } : {}),
      }),
    });

    if (!googleResponse.ok) {
      const errorBody = await googleResponse.text();
      return new Response(JSON.stringify({ error: 'Failed to send email', details: errorBody }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const whatsapp = await sendWhatsAppMessage(
      payload,
      whatsappAccessToken,
      whatsappPhoneNumberId,
      whatsappApiVersion,
      {
        paymentLinkTemplateName: whatsappTemplatePaymentLink,
        paymentConfirmedTemplateName: whatsappTemplatePaymentConfirmed,
        languageCode: whatsappTemplateLanguageCode,
      },
    );

    return new Response(JSON.stringify({ ok: true, emailSent: true, whatsapp }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

