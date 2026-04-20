import Router from '@koa/router'
import { randomBytes } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { config } from '../config'

export const uploadRoutes = new Router()

uploadRoutes.post('/upload', async (ctx) => {
  const contentType = ctx.get('content-type') || ''
  if (!contentType.startsWith('multipart/form-data')) {
    ctx.status = 400
    ctx.body = { error: 'Expected multipart/form-data' }
    return
  }

  const boundary = '--' + contentType.split('boundary=')[1]
  if (!boundary || boundary === '--undefined') {
    ctx.status = 400
    ctx.body = { error: 'Missing boundary' }
    return
  }

  await mkdir(config.uploadDir, { recursive: true })

  // Read raw body as Buffer
  const chunks: Buffer[] = []
  for await (const chunk of ctx.req) chunks.push(chunk)
  const raw = Buffer.concat(chunks)
  const boundaryBuf = Buffer.from(boundary)
  const parts = splitMultipart(raw, boundaryBuf)

  const results: { name: string; path: string }[] = []

  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEnd === -1) continue
    const headerBuf = part.subarray(0, headerEnd)
    const header = headerBuf.toString('utf-8')
    const data = part.subarray(headerEnd + 4, part.length - 2)

    // Try RFC 5987 filename* first, fall back to filename
    let filename = ''
    const filenameStarMatch = header.match(/filename\*=UTF-8''(.+)/i)
    if (filenameStarMatch) {
      filename = decodeURIComponent(filenameStarMatch[1])
    } else {
      const filenameMatch = header.match(/filename="([^"]+)"/)
      if (!filenameMatch) continue
      filename = filenameMatch[1]
    }

    const ext = filename.includes('.') ? '.' + filename.split('.').pop() : ''
    const savedName = randomBytes(8).toString('hex') + ext
    const savedPath = `${config.uploadDir}/${savedName}`

    await writeFile(savedPath, data)
    results.push({ name: filename, path: savedPath })
  }

  ctx.body = { files: results }
})

/**
 * Split a multipart Buffer by boundary, returning part Buffers.
 * Avoids string decoding so multi-byte characters (e.g. Chinese filenames) are preserved.
 */
function splitMultipart(raw: Buffer, boundary: Buffer): Buffer[] {
  const parts: Buffer[] = []
  let start = 0
  while (true) {
    const idx = raw.indexOf(boundary, start)
    if (idx === -1) break
    if (start > 0) {
      // Skip the \r\n after boundary
      const partStart = start + 2
      parts.push(raw.subarray(partStart, idx))
    }
    start = idx + boundary.length
  }
  return parts
}
