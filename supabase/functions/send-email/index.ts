import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, subject, body, signature } = await req.json()

    // Validation
    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Destinataire, objet et message sont requis.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Adresse email invalide.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (subject.length > 200) {
      return new Response(
        JSON.stringify({ error: "L'objet ne doit pas dépasser 200 caractères." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (body.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Le message est trop long.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const gmailAddress = Deno.env.get('GMAIL_ADDRESS')
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    if (!gmailAddress || !gmailPassword) {
      console.error('Gmail credentials not configured')
      return new Response(
        JSON.stringify({ error: 'Configuration email manquante côté serveur.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Escape HTML
    const escapeHtml = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/\n/g, '<br>')

    const escapedBody = escapeHtml(body)
    const escapedSignature = signature ? escapeHtml(signature) : ''

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <tr><td style="padding:40px 32px;">
          <div style="color:#1a1a2e;font-size:15px;line-height:1.7;">${escapedBody}</div>
          ${escapedSignature ? `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee;color:#666;font-size:14px;line-height:1.6;">${escapedSignature}</div>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    // Use Deno's SMTP via Gmail
    // We'll use the MailChannels or direct SMTP approach
    // Since Deno edge functions can't do raw SMTP, we use Gmail's SMTP relay via a fetch-based approach
    // Using the Gmail API with app password via basic SMTP over a worker

    // Alternative: Use a lightweight SMTP client for Deno
    const { SmtpClient } = await import("https://deno.land/x/smtp@v0.7.0/mod.ts")

    const client = new SmtpClient()
    
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: gmailAddress,
      password: gmailPassword,
    })

    await client.send({
      from: gmailAddress,
      to: to,
      subject: subject,
      content: "Voir la version HTML",
      html: html,
    })

    await client.close()

    return new Response(
      JSON.stringify({ success: true, message: 'Email envoyé avec succès !' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('SMTP Error:', error)
    return new Response(
      JSON.stringify({ error: "Échec de l'envoi. Vérifiez vos identifiants Gmail et le mot de passe d'application." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
