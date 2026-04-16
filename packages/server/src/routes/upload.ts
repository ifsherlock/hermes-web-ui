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

  // Read raw body
  const chunks: Buffer[] = []
  for await (const chunk of ctx.req) chunks.push(chunk)
  const body = Buffer.concat(chunks).toString('latin1')
  const parts = body.split(boundary).slice(1, -1)

  const results: { name: string; path: string }[] = []

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue
    const header = part.substring(0, headerEnd)
    const data = part.substring(headerEnd + 4, part.length - 2)

    const filenameMatch = header.match(/filename="([^"]+)"/)
    if (!filenameMatch) continue

    const filename = filenameMatch[1]
    const ext = filename.includes('.') ? '.' + filename.split('.').pop() : ''
    const savedName = randomBytes(8).toString('hex') + ext
    const savedPath = `${config.uploadDir}/${savedName}`

    await writeFile(savedPath, Buffer.from(data, 'binary'))
    results.push({ name: filename, path: savedPath })
  }

  ctx.body = { files: results }
})
