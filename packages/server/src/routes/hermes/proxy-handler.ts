import type { Context } from 'koa'
import { config } from '../../config'

export async function proxy(ctx: Context) {
  const upstream = config.upstream.replace(/\/$/, '')
  // Rewrite path for upstream gateway:
  //   /api/hermes/v1/* -> /v1/*  (upstream uses /v1/ prefix)
  //   /api/hermes/*     -> /api/* (upstream uses /api/ prefix)
  const upstreamPath = ctx.path.replace(/^\/api\/hermes\/v1/, '/v1').replace(/^\/api\/hermes/, '/api')
  const url = `${upstream}${upstreamPath}${ctx.search || ''}`

  // Build headers — forward most, strip browser/web-ui specific ones
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(ctx.headers)) {
    if (value == null) continue
    const lower = key.toLowerCase()
    if (lower === 'host') {
      headers['host'] = new URL(upstream).host
    } else if (lower === 'authorization' || lower === 'origin' || lower === 'referer' || lower === 'connection') {
      continue
    } else {
      const v = Array.isArray(value) ? value[0] : value
      if (v) headers[key] = v
    }
  }

  try {
    // Build request body from raw body
    let body: string | undefined
    if (ctx.req.method !== 'GET' && ctx.req.method !== 'HEAD') {
      body = (ctx as any).request.rawBody as string | undefined
    }

    const res = await fetch(url, {
      method: ctx.req.method,
      headers,
      body,
    })

    // Set response headers
    res.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower !== 'transfer-encoding' && lower !== 'connection') {
        ctx.set(key, value)
      }
    })

    ctx.status = res.status

    // Stream response body
    if (res.body) {
      const reader = res.body.getReader()
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          ctx.res.write(value)
        }
        ctx.res.end()
      }
      await pump()
    } else {
      ctx.res.end()
    }
  } catch (err: any) {
    if (!ctx.res.headersSent) {
      ctx.status = 502
      ctx.set('Content-Type', 'application/json')
      ctx.body = { error: { message: `Proxy error: ${err.message}` } }
    } else {
      ctx.res.end()
    }
  }
}
