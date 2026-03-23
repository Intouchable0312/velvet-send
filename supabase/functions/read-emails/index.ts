import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function imapConnect(host: string, port: number, username: string, password: string) {
  const conn = await Deno.connectTls({ hostname: host, port })
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let tagCounter = 0

  async function readUntilComplete(expectedTag?: string): Promise<string> {
    const buf = new Uint8Array(65536)
    let result = ''
    const maxAttempts = 50
    let attempts = 0

    while (attempts < maxAttempts) {
      const n = await conn.read(buf)
      if (n === null) break
      result += decoder.decode(buf.subarray(0, n))
      attempts++

      if (expectedTag) {
        // Check if we have the tagged response (OK, NO, or BAD)
        if (result.includes(`${expectedTag} OK`) || result.includes(`${expectedTag} NO`) || result.includes(`${expectedTag} BAD`)) {
          break
        }
      } else {
        // For greeting, just wait for \r\n
        if (result.includes('\r\n')) break
      }
    }
    return result
  }

  async function sendCommand(cmd: string): Promise<string> {
    tagCounter++
    const tag = `A${String(tagCounter).padStart(4, '0')}`
    await conn.write(encoder.encode(`${tag} ${cmd}\r\n`))
    return await readUntilComplete(tag)
  }

  // Read greeting
  const greeting = await readUntilComplete()
  console.log('IMAP greeting received:', greeting.substring(0, 100))

  // Login — quote credentials to handle special characters
  const quotedUser = `"${username.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const quotedPass = `"${password.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const loginResult = await sendCommand(`LOGIN ${quotedUser} ${quotedPass}`)
  console.log('IMAP login response:', loginResult.substring(0, 200))
  
  if (loginResult.includes('NO') || loginResult.includes('BAD') || !loginResult.includes('OK')) {
    conn.close()
    throw new Error('IMAP authentication failed: ' + loginResult.substring(0, 200))
  }

  return { sendCommand, close: () => conn.close() }
}

function parseEmailHeaders(raw: string): { from: string; subject: string; date: string; messageId: string; to: string } {
  const getHeader = (name: string): string => {
    const regex = new RegExp(`^${name}:\\s*(.+?)(?=\\r?\\n[^ \\t]|\\r?\\n\\r?\\n)`, 'ims')
    const match = raw.match(regex)
    if (!match) return ''
    // Unfold headers (join continuation lines)
    return match[1].replace(/\r?\n[ \t]+/g, ' ').trim()
  }

  return {
    from: getHeader('From'),
    subject: decodeHeader(getHeader('Subject')),
    date: getHeader('Date'),
    messageId: getHeader('Message-ID') || getHeader('Message-Id'),
    to: getHeader('To'),
  }
}

function decodeHeader(value: string): string {
  if (!value) return ''
  // Decode =?charset?encoding?text?= patterns
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0))
        return new TextDecoder(charset).decode(bytes)
      } else if (encoding.toUpperCase() === 'Q') {
        const decoded = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
          String.fromCharCode(parseInt(hex, 16))
        )
        const bytes = Uint8Array.from(decoded, (c: string) => c.charCodeAt(0))
        return new TextDecoder(charset).decode(bytes)
      }
    } catch { /* fallback */ }
    return text
  })
}

function extractBody(raw: string): { text: string; html: string } {
  // Find the boundary between headers and body
  const headerBodySplit = raw.indexOf('\r\n\r\n')
  if (headerBodySplit === -1) return { text: '', html: '' }

  const headers = raw.substring(0, headerBodySplit)
  const body = raw.substring(headerBodySplit + 4)

  // Check content type
  const ctMatch = headers.match(/Content-Type:\s*([^;\r\n]+)/i)
  const contentType = ctMatch ? ctMatch[1].trim().toLowerCase() : 'text/plain'

  if (contentType.includes('multipart/')) {
    // Find boundary
    const boundaryMatch = headers.match(/boundary="?([^"\r\n;]+)"?/i)
    if (!boundaryMatch) return { text: body, html: '' }
    return parseMultipart(body, boundaryMatch[1])
  }

  // Check transfer encoding
  const teMatch = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
  const encoding = teMatch ? teMatch[1].trim().toLowerCase() : '7bit'
  const decoded = decodeContent(body, encoding)

  if (contentType.includes('text/html')) {
    return { text: '', html: decoded }
  }
  return { text: decoded, html: '' }
}

function parseMultipart(body: string, boundary: string): { text: string; html: string } {
  let text = ''
  let html = ''
  const parts = body.split(`--${boundary}`)

  for (const part of parts) {
    if (part.trim() === '--' || part.trim() === '') continue

    const partHeaderEnd = part.indexOf('\r\n\r\n')
    if (partHeaderEnd === -1) continue

    const partHeaders = part.substring(0, partHeaderEnd)
    const partBody = part.substring(partHeaderEnd + 4).replace(/\r\n$/, '')

    const ctMatch = partHeaders.match(/Content-Type:\s*([^;\r\n]+)/i)
    const partCt = ctMatch ? ctMatch[1].trim().toLowerCase() : ''

    const teMatch = partHeaders.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
    const encoding = teMatch ? teMatch[1].trim().toLowerCase() : '7bit'

    if (partCt.includes('multipart/')) {
      const innerBoundary = partHeaders.match(/boundary="?([^"\r\n;]+)"?/i)
      if (innerBoundary) {
        const inner = parseMultipart(partBody, innerBoundary[1])
        if (inner.text) text = inner.text
        if (inner.html) html = inner.html
      }
    } else if (partCt.includes('text/html')) {
      html = decodeContent(partBody, encoding)
    } else if (partCt.includes('text/plain')) {
      text = decodeContent(partBody, encoding)
    }
  }

  return { text, html }
}

function decodeContent(content: string, encoding: string): string {
  if (encoding === 'base64') {
    try {
      const cleaned = content.replace(/[\r\n\s]/g, '')
      const bytes = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0))
      return new TextDecoder('utf-8').decode(bytes)
    } catch {
      return content
    }
  }
  if (encoding === 'quoted-printable') {
    return content
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  }
  return content
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, uid, page = 1, pageSize = 20 } = await req.json()

    const gmailAddress = Deno.env.get('GMAIL_ADDRESS')
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')

    if (!gmailAddress || !gmailPassword) {
      return new Response(
        JSON.stringify({ error: 'Configuration email manquante.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const imap = await imapConnect('imap.gmail.com', 993, gmailAddress, gmailPassword)

    try {
      if (action === 'list') {
        // Select INBOX
        const selectResult = await imap.sendCommand('SELECT INBOX')
        const existsMatch = selectResult.match(/\*\s+(\d+)\s+EXISTS/i)
        const totalCount = existsMatch ? parseInt(existsMatch[1]) : 0

        if (totalCount === 0) {
          return new Response(
            JSON.stringify({ emails: [], total: 0 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Calculate range for pagination (newest first)
        const start = Math.max(1, totalCount - (page * pageSize) + 1)
        const end = Math.max(1, totalCount - ((page - 1) * pageSize))

        if (start > end) {
          return new Response(
            JSON.stringify({ emails: [], total: totalCount }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Fetch headers only for the range
        const fetchResult = await imap.sendCommand(
          `FETCH ${start}:${end} (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID TO)])`
        )

        // Parse the fetch results
        const emails: Array<{
          uid: number
          from: string
          subject: string
          date: string
          read: boolean
        }> = []

        // Split by "* N FETCH" pattern
        const fetchParts = fetchResult.split(/\*\s+\d+\s+FETCH/i)

        for (const part of fetchParts) {
          if (!part.trim()) continue

          const uidMatch = part.match(/UID\s+(\d+)/i)
          const flagsMatch = part.match(/FLAGS\s+\(([^)]*)\)/i)

          if (!uidMatch) continue

          const emailUid = parseInt(uidMatch[1])
          const flags = flagsMatch ? flagsMatch[1] : ''
          const isRead = flags.includes('\\Seen')

          // Extract header content between the { } block
          const headerContent = part.replace(/^[^{]*\{\d+\}\r?\n/, '').replace(/\)\r?\n.*$/s, '')
          const headers = parseEmailHeaders(headerContent)

          emails.push({
            uid: emailUid,
            from: headers.from,
            subject: headers.subject || '(Sans objet)',
            date: headers.date,
            read: isRead,
          })
        }

        // Reverse so newest is first
        emails.reverse()

        await imap.sendCommand('LOGOUT')

        return new Response(
          JSON.stringify({ emails, total: totalCount }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } else if (action === 'read') {
        if (!uid) {
          return new Response(
            JSON.stringify({ error: 'UID requis.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        await imap.sendCommand('SELECT INBOX')

        // Fetch full email by UID
        const fetchResult = await imap.sendCommand(`UID FETCH ${uid} (BODY[])`)

        // Extract the raw email content
        const sizeMatch = fetchResult.match(/\{(\d+)\}\r?\n/)
        let rawEmail = ''
        if (sizeMatch) {
          const startIdx = fetchResult.indexOf(sizeMatch[0]) + sizeMatch[0].length
          rawEmail = fetchResult.substring(startIdx)
          // Remove trailing IMAP response
          const lastParen = rawEmail.lastIndexOf(')')
          if (lastParen > 0) rawEmail = rawEmail.substring(0, lastParen)
        }

        const headers = parseEmailHeaders(rawEmail)
        const body = extractBody(rawEmail)

        // Mark as read
        await imap.sendCommand(`UID STORE ${uid} +FLAGS (\\Seen)`)
        await imap.sendCommand('LOGOUT')

        return new Response(
          JSON.stringify({
            uid,
            from: headers.from,
            to: headers.to,
            subject: headers.subject || '(Sans objet)',
            date: headers.date,
            messageId: headers.messageId,
            body: body.html || body.text,
            isHtml: !!body.html,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await imap.sendCommand('LOGOUT')
      return new Response(
        JSON.stringify({ error: 'Action inconnue.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (innerError) {
      try { await imap.sendCommand('LOGOUT') } catch { /* ignore */ }
      try { imap.close() } catch { /* ignore */ }
      throw innerError
    }

  } catch (error) {
    console.error('IMAP Error:', error)
    return new Response(
      JSON.stringify({ error: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})