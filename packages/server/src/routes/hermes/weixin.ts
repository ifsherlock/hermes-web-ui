import Router from '@koa/router'
import axios from 'axios'
import { readFile, writeFile } from 'fs/promises'
import { chmod } from 'fs/promises'
import { resolve } from 'path'
import { homedir } from 'os'
import { restartGateway } from '../../services/hermes-cli'

const envPath = resolve(homedir(), '.hermes/.env')
const ILINK_BASE = 'https://ilinkai.weixin.qq.com'

export const weixinRoutes = new Router()

// GET /api/weixin/qrcode — fetch QR code from Tencent iLink API
weixinRoutes.get('/api/hermes/weixin/qrcode', async (ctx) => {
  try {
    const res = await axios.get(`${ILINK_BASE}/ilink/bot/get_bot_qrcode`, {
      params: { bot_type: 3 },
      timeout: 15000,
    })
    const data = res.data
    if (!data || !data.qrcode) {
      ctx.status = 500
      ctx.body = { error: 'Failed to get QR code' }
      return
    }
    ctx.body = {
      qrcode: data.qrcode,
      qrcode_url: data.qrcode_img_content,
    }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message || 'Failed to connect to iLink API' }
  }
})

// GET /api/weixin/qrcode/status — poll QR scan status
weixinRoutes.get('/api/hermes/weixin/qrcode/status', async (ctx) => {
  const qrcode = ctx.query.qrcode as string
  if (!qrcode) {
    ctx.status = 400
    ctx.body = { error: 'Missing qrcode parameter' }
    return
  }

  try {
    const res = await axios.get(`${ILINK_BASE}/ilink/bot/get_qrcode_status`, {
      params: { qrcode },
      timeout: 35000,
    })
    const data = res.data
    const status = data?.status || 'wait'
    ctx.body = { status }

    // If confirmed, return credentials so frontend can save them
    if (status === 'confirmed') {
      ctx.body = {
        status: 'confirmed',
        account_id: data.ilink_bot_id,
        token: data.bot_token,
        base_url: data.baseurl,
      }
    }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message || 'Failed to poll QR status' }
  }
})

// POST /api/weixin/save — save weixin credentials to .env
weixinRoutes.post('/api/hermes/weixin/save', async (ctx) => {
  const { account_id, token, base_url } = ctx.request.body as {
    account_id: string
    token: string
    base_url?: string
  }

  if (!account_id || !token) {
    ctx.status = 400
    ctx.body = { error: 'Missing account_id or token' }
    return
  }

  try {
    let raw: string
    try {
      raw = await readFile(envPath, 'utf-8')
    } catch {
      raw = ''
    }

    const entries: Record<string, string> = {
      WEIXIN_ACCOUNT_ID: account_id,
      WEIXIN_TOKEN: token,
    }
    if (base_url) entries.WEIXIN_BASE_URL = base_url

    const lines = raw.split('\n')
    const existingKeys = new Set<string>()

    const result: string[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#')) {
        result.push(line)
        continue
      }
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        if (key in entries) {
          result.push(`${key}=${entries[key]}`)
          existingKeys.add(key)
          continue
        }
      }
      result.push(line)
    }

    for (const [key, val] of Object.entries(entries)) {
      if (!existingKeys.has(key)) {
        result.push(`${key}=${val}`)
      }
    }

    let output = result.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '') + '\n'
    await writeFile(envPath, output, 'utf-8')
    try { await chmod(envPath, 0o600) } catch { /* ignore */ }
    await restartGateway()

    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})
