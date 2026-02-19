import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

type ApprovalRequestPayload = {
  userId?: string;
  email?: string;
  fullName?: string;
};

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const webhookUrl = Deno.env.get('GOOGLE_SCRIPT_WEBHOOK_URL');
    const webhookToken = Deno.env.get('GOOGLE_SCRIPT_WEBHOOK_TOKEN');
    const adminApprovalEmail = Deno.env.get('ADMIN_APPROVAL_EMAIL') ?? 'robson.rossetto14@gmail.com';
    const baseUrl = Deno.env.get('ADMIN_APPROVAL_BASE_URL') ?? 'https://www.homensdefemga.com.br';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase service configuration' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: 'Email provider not configured' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const payload = (await req.json()) as ApprovalRequestPayload;
    const userId = payload.userId?.trim();
    const email = payload.email?.trim().toLowerCase();
    const fullName = payload.fullName?.trim() || null;

    if (!userId || !email || !isLikelyEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const token = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`;
    const tokenHash = await sha256Hex(token);

    await fetch(`${supabaseUrl}/rest/v1/account_approval_tokens?user_id=eq.${encodeURIComponent(userId)}&consumed_at=is.null`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ consumed_at: now.toISOString() }),
    });

    const tokenInsert = await fetch(`${supabaseUrl}/rest/v1/account_approval_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        email,
        full_name: fullName,
        token_hash: tokenHash,
        expires_at: expiresAt,
      }),
    });

    if (!tokenInsert.ok) {
      const details = await tokenInsert.text();
      return new Response(JSON.stringify({ error: 'Failed to create approval token', details }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const safeBase = baseUrl.replace(/\/+$/, '');
    const approvalLink = `${safeBase}/aprovar-conta?token=${encodeURIComponent(token)}`;
    const subject = `Nova conta aguardando aprovação - ${fullName ?? email}`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;">
        <h2>Nova conta aguardando aprovação</h2>
        <p><strong>Nome:</strong> ${fullName ?? '-'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p>Para liberar o acesso, clique no link abaixo:</p>
        <p><a href="${approvalLink}">${approvalLink}</a></p>
        <p>Este link expira em 7 dias.</p>
      </div>
    `;

    const emailResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: adminApprovalEmail,
        participantName: fullName ?? email,
        subject,
        html,
        action: 'admin_account_approval',
        retreatName: 'Painel administrativo',
        ...(webhookToken ? { token: webhookToken } : {}),
      }),
    });

    if (!emailResponse.ok) {
      const details = await emailResponse.text();
      return new Response(JSON.stringify({ error: 'Failed to send approval email', details }), {
        status: 502,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});

