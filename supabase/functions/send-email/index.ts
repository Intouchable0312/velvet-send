import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function convertToEmailHtml(html: string): string {
  // Convert Tiptap CSS classes/tags to inline styles for email compatibility
  return html
    .replace(/<strong>/g, '<strong style="color:#111111;font-weight:bold;">')
    .replace(/<em>/g, '<em style="font-style:italic;">')
    .replace(/<u>/g, '<u style="text-decoration:underline;">')
    .replace(/<s>/g, '<s style="text-decoration:line-through;">')
    .replace(/<h2>/g, '<h2 style="font-size:22px;font-weight:700;color:#111111;margin:16px 0 8px 0;">')
    .replace(/<h2 /g, '<h2 style="font-size:22px;font-weight:700;color:#111111;margin:16px 0 8px 0;" ')
    .replace(/<p>/g, '<p style="margin:0 0 12px 0;font-size:17px;line-height:1.9;color:#444444;">')
    .replace(/<p style="/g, '<p style="margin:0 0 12px 0;font-size:17px;line-height:1.9;color:#444444;')
    .replace(/<ul>/g, '<ul style="margin:8px 0;padding-left:24px;font-size:17px;line-height:1.9;color:#444444;">')
    .replace(/<ol>/g, '<ol style="margin:8px 0;padding-left:24px;font-size:17px;line-height:1.9;color:#444444;">')
    .replace(/<li>/g, '<li style="margin:4px 0;">');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function sendViaSMTP(
  host: string, port: number, username: string, password: string,
  from: string, to: string, subject: string, html: string
): Promise<void> {
  const conn = await Deno.connectTls({ hostname: host, port })
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  async function readResponse(): Promise<string> {
    const buf = new Uint8Array(4096)
    let result = ''
    while (true) {
      const n = await conn.read(buf)
      if (n === null) break
      result += decoder.decode(buf.subarray(0, n))
      if (result.includes('\r\n') && !/^\d{3}-/m.test(result.split('\r\n').slice(-2, -1)[0] || '')) break
    }
    return result.trim()
  }

  async function send(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + '\r\n'))
    return await readResponse()
  }

  await readResponse() // greeting
  await send('EHLO localhost')

  // AUTH LOGIN
  await send('AUTH LOGIN')
  await send(btoa(username))
  const authResult = await send(btoa(password))
  if (!authResult.startsWith('235')) {
    conn.close()
    throw new Error('Authentification échouée')
  }

  await send(`MAIL FROM:<${from}>`)
  await send(`RCPT TO:<${to}>`)
  await send('DATA')

  const boundary = `b_${crypto.randomUUID().replace(/-/g, '')}`
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`

  const plainText = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
  const htmlBase64 = btoa(unescape(encodeURIComponent(html)))
  const plainBase64 = btoa(unescape(encodeURIComponent(plainText)))

  const mime = [
    `From: VIZION <${from}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    plainBase64,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    htmlBase64,
    ``,
    `--${boundary}--`,
  ].join('\r\n')

  const dataResult = await send(mime + '\r\n.')
  if (!dataResult.startsWith('250')) {
    conn.close()
    throw new Error('Envoi échoué: ' + dataResult)
  }

  await send('QUIT')
  conn.close()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, prenom, subject, bodyHtml } = await req.json()

    if (!to || !subject || !bodyHtml) {
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

    const gmailAddress = Deno.env.get('GMAIL_ADDRESS')
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    if (!gmailAddress || !gmailPassword) {
      return new Response(
        JSON.stringify({ error: 'Configuration email manquante côté serveur.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const escapedPrenom = prenom ? escapeHtml(prenom) : ''

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f3f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f3f3;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background-color:#ffffff;border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:38px 48px 24px 48px;text-align:center;background-color:#ffffff;">
              <div style="font-size:42px;font-weight:800;letter-spacing:4px;color:#111111;">VIZION</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background-color:#e9e9e9;width:100%;"></div>
            </td>
          </tr>
          ${escapedPrenom ? `<tr>
            <td style="padding:42px 48px 18px 48px;">
              <div style="font-size:20px;line-height:1.5;color:#111111;font-weight:700;">Bonjour ${escapedPrenom},</div>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding:${escapedPrenom ? '0' : '42px'} 48px 18px 48px;">
              <div style="font-size:17px;line-height:1.9;color:#444444;">${bodyHtml}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 42px 48px;">
              <div style="font-size:17px;line-height:1.9;color:#111111;">
                Bien à toi,<br><strong>L'équipe VIZION</strong>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 34px 48px;">
              <div style="height:1px;background-color:#e9e9e9;width:100%;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 38px 48px;text-align:center;">
              <div style="font-size:13px;line-height:1.8;color:#888888;">VIZION — Collaboration & Partenariats</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    await sendViaSMTP(
      'smtp.gmail.com', 465, gmailAddress, gmailPassword,
      gmailAddress, to, subject, html
    )

    return new Response(
      JSON.stringify({ success: true, message: 'Email envoyé avec succès !' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('SMTP Error:', error)
    return new Response(
      JSON.stringify({ error: `Échec de l'envoi: ${error instanceof Error ? error.message : 'Erreur inconnue'}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
