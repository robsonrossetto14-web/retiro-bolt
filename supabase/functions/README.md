## Edge Function: send-email (Google Apps Script + Gmail)

This project includes a Supabase Edge Function at:

- `supabase/functions/send-email/index.ts`

It sends transactional emails through Google Apps Script (Gmail) for:

- registration confirmation
- payment link
- payment confirmation

### Deploy

Run:

```bash
supabase functions deploy send-email
```

### Required secrets

Set these secrets in Supabase:

```bash
supabase secrets set GOOGLE_SCRIPT_WEBHOOK_URL="https://script.google.com/macros/s/xxx/exec"
supabase secrets set GOOGLE_SCRIPT_WEBHOOK_TOKEN="your_optional_token"
supabase secrets set EMAIL_LOGO_URL="https://your-public-image-url/logo-homens-de-fe.png"
supabase secrets set WHATSAPP_ACCESS_TOKEN="EAAG..."
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="123456789012345"
supabase secrets set WHATSAPP_API_VERSION="v22.0"
supabase secrets set WHATSAPP_TEMPLATE_PAYMENT_LINK="pagamento_por_email"
supabase secrets set WHATSAPP_TEMPLATE_PAYMENT_CONFIRMED="pagamento_confirmado_grupo"
supabase secrets set WHATSAPP_TEMPLATE_LANGUAGE_CODE="pt_BR"
supabase secrets set EMAIL_ALLOWED_ORIGINS="http://localhost:5173,https://seu-dominio.com"
```

`GOOGLE_SCRIPT_WEBHOOK_TOKEN` is optional but recommended for basic protection.
`EMAIL_LOGO_URL` is optional and should be a public image URL (https).
`WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are required for automatic WhatsApp sending via WhatsApp Cloud API.
`WHATSAPP_API_VERSION` is optional (default: `v22.0`).
`WHATSAPP_TEMPLATE_PAYMENT_LINK` and `WHATSAPP_TEMPLATE_PAYMENT_CONFIRMED` are optional in code, but recommended for production.
When set, WhatsApp is sent using approved templates (Utility category). When absent, function falls back to free-text (best for testing only).
`WHATSAPP_TEMPLATE_LANGUAGE_CODE` is optional (default: `pt_BR`).
`EMAIL_ALLOWED_ORIGINS` is optional but strongly recommended. When set, only these frontend origins can call the function.

### Suggested Utility templates (Meta)

Create and approve these templates in WhatsApp Manager:

1. `pagamento_por_email` (Utility) with 4 body params:
   - `{{1}}` participant name
   - `{{2}}` retreat name
   - `{{3}}` retreat date
   - `{{4}}` location

2. `pagamento_confirmado_grupo` (Utility) with 4 body params:
   - `{{1}}` participant name
   - `{{2}}` retreat name
   - `{{3}}` WhatsApp group link
   - `{{4}}` retreat date

### Google Apps Script (copy/paste)

Create a new Apps Script project and use this code:

```javascript
function doPost(e) {
  var expectedToken = PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN');

  var payload = JSON.parse((e.postData && e.postData.contents) || '{}');
  var subject = payload.subject || 'Mensagem';
  var html = payload.html || '<p>Sem conteudo</p>';
  var to = payload.to;

  if (!to) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Missing recipient' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Optional token check (token comes in POST body).
  if (expectedToken) {
    var token = payload.token || '';
    if (token !== expectedToken) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: html,
    name: 'Homens de Fe'
  });

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Then:

1. Go to **Project Settings** -> **Script properties**.
2. Add `WEBHOOK_TOKEN` (same value used in `GOOGLE_SCRIPT_WEBHOOK_TOKEN`).
3. Click **Deploy** -> **New deployment** -> type **Web app**.
4. Execute as: **Me**.
5. Who has access: **Anyone**.
6. Copy the Web App URL and save it in `GOOGLE_SCRIPT_WEBHOOK_URL`.

### Frontend usage

The frontend calls:

- `POST {VITE_SUPABASE_URL}/functions/v1/send-email`

with the Supabase anon key headers.

