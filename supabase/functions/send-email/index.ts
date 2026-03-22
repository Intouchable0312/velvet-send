import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Base64 encode helper
function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>')
}

function buildMimeMessage(from: string, to: string, subject: string, html: string): string {
  const boundary = `boundary_${crypto.randomUUID()}`
  
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${base64Encode(subject)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Encode(html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Encode(html),
    ``,
    `--${boundary}--`,
  ]
  
  return lines.join('\r\n')
}

// Simple SMTP client that works with Deno's modern API
async function sendViaSMTP(
  host: string,
  port: number,
  username: string,
  password: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const conn = await Deno.connectTls({ hostname: host, port })
  
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  
  async function readLine(): Promise<string> {
    const buf = new Uint8Array(4096)
    let result = ''
    while (true) {
      const n = await conn.read(buf)
      if (n === null) break
      result += decoder.decode(buf.subarray(0, n))
      if (result.includes('\r\n')) break
    }
    return result.trim()
  }
  
  async function send(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + '\r\n'))
    return await readLine()
  }
  
  // Read greeting
  await readLine()
  
  // EHLO
  await send(`EHLO localhost`)
  // Read multi-line response
  await new Promise(r => setTimeout(r, 200))
  
  // AUTH LOGIN
  await send('AUTH LOGIN')
  await send(btoa(username))
  const authResult = await send(btoa(password))
  
  if (!authResult.startsWith('235')) {
    conn.close()
    throw new Error('Authentication failed: ' + authResult)
  }
  
  // MAIL FROM
  await send(`MAIL FROM:<${from}>`)
  
  // RCPT TO
  await send(`RCPT TO:<${to}>`)
  
  // DATA
  await send('DATA')
  
  // Send message
  const mime = buildMimeMessage(from, to, subject, html)
  const dataResult = await send(mime + '\r\n.')
  
  if (!dataResult.startsWith('250')) {
    conn.close()
    throw new Error('Send failed: ' + dataResult)
  }
  
  // QUIT
  await send('QUIT')
  conn.close()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { to, subject, body, signature } = await req.json()

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

    const gmailAddress = Deno.env.get('GMAIL_ADDRESS')
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    if (!gmailAddress || !gmailPassword) {
      return new Response(
        JSON.stringify({ error: 'Configuration email manquante côté serveur.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    await sendViaSMTP(
      'smtp.gmail.com',
      465,
      gmailAddress,
      gmailPassword,
      gmailAddress,
      to,
      subject,
      html
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
