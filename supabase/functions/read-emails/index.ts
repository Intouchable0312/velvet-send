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
    const buf = new Uint8Array(131072)
    let result = ''
    const maxAttempts = 100
    let attempts = 0
    while (attempts < maxAttempts) {
      const n = await conn.read(buf)
      if (n === null) break
      result += decoder.decode(buf.subarray(0, n))
      attempts++
      if (expectedTag) {
        if (result.includes(`${expectedTag} OK`) || result.includes(`${expectedTag} NO`) || result.includes(`${expectedTag} BAD`)) break
      } else {
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

  await readUntilComplete() // greeting
  const quotedUser = `"${username.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const quotedPass = `"${password.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const loginResult = await sendCommand(`LOGIN ${quotedUser} ${quotedPass}`)
  if (loginResult.includes('NO') || loginResult.includes('BAD') || !loginResult.includes('OK')) {
    conn.close()
    throw new Error('IMAP authentication failed')
  }

  return { sendCommand, close: () => conn.close() }
}

// ── Header parsing ──

function decodeEncodedWords(value: string): string {
  if (!value) return ''
  // Handle consecutive encoded words (remove whitespace between them)
  let result = value.replace(/\?=\s+=\?/g, '?==?')
  result = result.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, charset: string, enc: string, text: string) => {
    try {
      if (enc.toUpperCase() === 'B') {
        const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0))
        return new TextDecoder(charset).decode(bytes)
      } else {
        const raw = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_: string, h: string) =>
          String.fromCharCode(parseInt(h, 16)))
        const bytes = Uint8Array.from(raw, (c: string) => c.charCodeAt(0))
        return new TextDecoder(charset).decode(bytes)
      }
    } catch { return text }
  })
  return result
}

function getHeader(raw: string, name: string): string {
  // Match header, handling folded lines (continuation with space/tab)
  const regex = new RegExp(`^${name}:\\s*((?:.*(?:\\r?\\n[ \\t].*)*)*)`, 'im')
  const m = raw.match(regex)
  if (!m) return ''
  return m[1].replace(/\r?\n[ \t]+/g, ' ').trim()
}

function parseHeaders(raw: string) {
  return {
    from: decodeEncodedWords(getHeader(raw, 'From')),
    subject: decodeEncodedWords(getHeader(raw, 'Subject')),
    date: getHeader(raw, 'Date'),
    messageId: getHeader(raw, 'Message-ID') || getHeader(raw, 'Message-Id'),
    to: decodeEncodedWords(getHeader(raw, 'To')),
  }
}

// ── Content decoding ──

function decodeQuotedPrintable(content: string, charset = 'utf-8'): string {
  // Remove soft line breaks
  const joined = content.replace(/=\r?\n/g, '')
  // Convert =XX sequences to bytes
  const byteArr: number[] = []
  let i = 0
  while (i < joined.length) {
    if (joined[i] === '=' && i + 2 < joined.length) {
      const hex = joined.substring(i + 1, i + 3)
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        byteArr.push(parseInt(hex, 16))
        i += 3
        continue
      }
    }
    byteArr.push(joined.charCodeAt(i))
    i++
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(byteArr))
  } catch {
    return new TextDecoder('utf-8').decode(new Uint8Array(byteArr))
  }
}

function decodeBase64Content(content: string, charset = 'utf-8'): string {
  try {
    const cleaned = content.replace(/[\r\n\s]/g, '')
    const bytes = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0))
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return content
  }
}

function decodeContent(content: string, encoding: string, charset = 'utf-8'): string {
  const enc = encoding.toLowerCase().trim()
  if (enc === 'base64') return decodeBase64Content(content, charset)
  if (enc === 'quoted-printable') return decodeQuotedPrintable(content, charset)
  return content
}

function getCharset(headerBlock: string): string {
  const m = headerBlock.match(/charset="?([^"\s;]+)"?/i)
  return m ? m[1] : 'utf-8'
}

function getTransferEncoding(headerBlock: string): string {
  const m = headerBlock.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
  return m ? m[1].trim() : '7bit'
}

function getContentType(headerBlock: string): string {
  const m = headerBlock.match(/Content-Type:\s*([^;\r\n]+)/i)
  return m ? m[1].trim().toLowerCase() : 'text/plain'
}

function getBoundary(headerBlock: string): string | null {
  // Try quoted boundary first, then unquoted
  const quoted = headerBlock.match(/boundary="([^"]+)"/i)
  if (quoted) return quoted[1]
  const unquoted = headerBlock.match(/boundary=([^\s;\r\n]+)/i)
  return unquoted ? unquoted[1] : null
}

// ── Multipart parsing ──

function extractBody(raw: string): { text: string; html: string } {
  const splitIdx = raw.indexOf('\r\n\r\n')
  if (splitIdx === -1) {
    const splitIdx2 = raw.indexOf('\n\n')
    if (splitIdx2 === -1) return { text: '', html: '' }
    const headers = raw.substring(0, splitIdx2)
    const body = raw.substring(splitIdx2 + 2)
    return processBodyPart(headers, body)
  }
  const headers = raw.substring(0, splitIdx)
  const body = raw.substring(splitIdx + 4)
  return processBodyPart(headers, body)
}

function processBodyPart(headers: string, body: string): { text: string; html: string } {
  const ct = getContentType(headers)
  const charset = getCharset(headers)
  const encoding = getTransferEncoding(headers)

  if (ct.includes('multipart/')) {
    const boundary = getBoundary(headers)
    if (!boundary) return { text: body, html: '' }
    return parseMultipart(body, boundary)
  }

  const decoded = decodeContent(body, encoding, charset)
  if (ct.includes('text/html')) return { text: '', html: decoded }
  return { text: decoded, html: '' }
}

function parseMultipart(body: string, boundary: string): { text: string; html: string } {
  let text = ''
  let html = ''

  // Split on boundary, handling both \r\n-- and \n-- prefixes
  const delimiter = `--${boundary}`
  const parts = body.split(delimiter)

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed || trimmed === '--') continue

    // Find header/body split
    let splitIdx = part.indexOf('\r\n\r\n')
    let bodyStart = 4
    if (splitIdx === -1) {
      splitIdx = part.indexOf('\n\n')
      bodyStart = 2
    }
    if (splitIdx === -1) continue

    const partHeaders = part.substring(0, splitIdx)
    const partBody = part.substring(splitIdx + bodyStart)
    // Remove trailing boundary markers
    const cleanBody = partBody.replace(/\r?\n?$/, '')

    const partCt = getContentType(partHeaders)

    if (partCt.includes('multipart/')) {
      const innerBoundary = getBoundary(partHeaders)
      if (innerBoundary) {
        const inner = parseMultipart(cleanBody, innerBoundary)
        if (inner.html) html = inner.html
        if (inner.text && !text) text = inner.text
      }
    } else if (partCt.includes('text/html')) {
      html = decodeContent(cleanBody, getTransferEncoding(partHeaders), getCharset(partHeaders))
    } else if (partCt.includes('text/plain')) {
      text = decodeContent(cleanBody, getTransferEncoding(partHeaders), getCharset(partHeaders))
    }
  }

  return { text, html }
}

// ── Extract raw email from IMAP FETCH response ──

function extractRawEmail(fetchResult: string): string {
  // The format is: * N FETCH ... {SIZE}\r\n<raw email bytes>\r\n)\r\nTAG OK
  const sizeMatch = fetchResult.match(/\{(\d+)\}\r?\n/)
  if (!sizeMatch) return fetchResult

  const size = parseInt(sizeMatch[1])
  const startIdx = fetchResult.indexOf(sizeMatch[0]) + sizeMatch[0].length
  // Use declared size to extract exactly the email content
  return fetchResult.substring(startIdx, startIdx + size)
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, uid, page = 1, pageSize = 20, search } = await req.json()

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
        await imap.sendCommand('SELECT INBOX')

        let uids: number[] = []

        if (search && search.trim()) {
          // Use IMAP SEARCH to find matching emails
          const searchTerm = search.trim().replace(/"/g, '')
          const searchResult = await imap.sendCommand(
            `UID SEARCH OR OR FROM "${searchTerm}" SUBJECT "${searchTerm}" BODY "${searchTerm}"`
          )
          // Parse UIDs from "* SEARCH uid1 uid2 uid3..."
          const searchLine = searchResult.match(/\*\s+SEARCH\s+([\d\s]+)/i)
          if (searchLine) {
            uids = searchLine[1].trim().split(/\s+/).map(Number).filter(n => !isNaN(n))
          }
          // Reverse for newest first
          uids.reverse()
        } else {
          // Get total count
          const selectResult = await imap.sendCommand('SELECT INBOX')
          const existsMatch = selectResult.match(/\*\s+(\d+)\s+EXISTS/i)
          const totalCount = existsMatch ? parseInt(existsMatch[1]) : 0

          if (totalCount === 0) {
            return new Response(
              JSON.stringify({ emails: [], total: 0 }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          // Get all UIDs to paginate properly
          const uidResult = await imap.sendCommand('UID SEARCH ALL')
          const uidLine = uidResult.match(/\*\s+SEARCH\s+([\d\s]+)/i)
          if (uidLine) {
            uids = uidLine[1].trim().split(/\s+/).map(Number).filter(n => !isNaN(n))
          }
          uids.reverse() // newest first
        }

        const total = uids.length
        const startIdx = (page - 1) * pageSize
        const pageUids = uids.slice(startIdx, startIdx + pageSize)

        if (pageUids.length === 0) {
          await imap.sendCommand('LOGOUT')
          return new Response(
            JSON.stringify({ emails: [], total }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Fetch headers for these UIDs
        const uidSet = pageUids.join(',')
        const fetchResult = await imap.sendCommand(
          `UID FETCH ${uidSet} (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID TO)])`
        )

        const emails: Array<{
          uid: number; from: string; subject: string; date: string; read: boolean
        }> = []

        // Parse fetch results
        const fetchParts = fetchResult.split(/\*\s+\d+\s+FETCH/i)
        for (const part of fetchParts) {
          if (!part.trim()) continue
          const uidMatch = part.match(/UID\s+(\d+)/i)
          const flagsMatch = part.match(/FLAGS\s+\(([^)]*)\)/i)
          if (!uidMatch) continue

          const emailUid = parseInt(uidMatch[1])
          const flags = flagsMatch ? flagsMatch[1] : ''
          const isRead = flags.includes('\\Seen')

          // Extract header block after {SIZE}
          const headerStart = part.match(/\{\d+\}\r?\n/)
          if (!headerStart) continue
          const headerIdx = part.indexOf(headerStart[0]) + headerStart[0].length
          // Get content up to the closing paren
          let headerContent = part.substring(headerIdx)
          // Remove trailing ) and anything after
          const closeParen = headerContent.lastIndexOf(')')
          if (closeParen > 0) headerContent = headerContent.substring(0, closeParen)

          const headers = parseHeaders(headerContent)

          emails.push({
            uid: emailUid,
            from: headers.from,
            subject: headers.subject || '(Sans objet)',
            date: headers.date,
            read: isRead,
          })
        }

        // Sort by UID descending (newest first)
        emails.sort((a, b) => b.uid - a.uid)

        await imap.sendCommand('LOGOUT')
        return new Response(
          JSON.stringify({ emails, total }),
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
        const fetchResult = await imap.sendCommand(`UID FETCH ${uid} (BODY[])`)
        const rawEmail = extractRawEmail(fetchResult)
        const headers = parseHeaders(rawEmail)
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
      try { await imap.sendCommand('LOGOUT') } catch { /* */ }
      try { imap.close() } catch { /* */ }
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