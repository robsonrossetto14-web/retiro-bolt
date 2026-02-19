import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

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
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase service configuration' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const payload = (await req.json()) as { token?: string };
    const token = payload.token?.trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const tokenHash = await sha256Hex(token);
    const tokenResponse = await fetch(
      `${supabaseUrl}/rest/v1/account_approval_tokens?select=id,user_id,expires_at,consumed_at&token_hash=eq.${tokenHash}&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );

    if (!tokenResponse.ok) {
      const details = await tokenResponse.text();
      return new Response(JSON.stringify({ error: 'Failed to validate token', details }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const rows = (await tokenResponse.json()) as Array<{
      id: string;
      user_id: string;
      expires_at: string;
      consumed_at: string | null;
    }>;

    const row = rows[0];
    if (!row) {
      return new Response(JSON.stringify({ error: 'Link de aprovação inválido.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (row.consumed_at) {
      return new Response(JSON.stringify({ ok: true, message: 'Esta conta já foi aprovada anteriormente.' }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const expiresAtMs = new Date(row.expires_at).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
      return new Response(JSON.stringify({ error: 'Link de aprovação expirado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const nowIso = new Date().toISOString();
    const profileUpdate = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(row.user_id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        role: 'admin',
        approval_status: 'approved',
        approved_at: nowIso,
      }),
    });

    if (!profileUpdate.ok) {
      const details = await profileUpdate.text();
      return new Response(JSON.stringify({ error: 'Failed to approve account', details }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    await fetch(`${supabaseUrl}/rest/v1/account_approval_tokens?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ consumed_at: nowIso }),
    });

    return new Response(JSON.stringify({ ok: true, message: 'Conta aprovada com sucesso.' }), {
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

