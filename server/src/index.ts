import Koa from 'koa'
import cors from '@koa/cors'
import bodyParser from '@koa/bodyparser'
import serve from 'koa-static'
import send from 'koa-send'
import { resolve } from 'path'
import { mkdir } from 'fs/promises'
import { config } from './config'
import { proxyRoutes } from './routes/proxy'
import { uploadRoutes } from './routes/upload'
import { sessionRoutes } from './routes/sessions'
import { webhookRoutes } from './routes/webhook'
import { logRoutes } from './routes/logs'
import { fsRoutes } from './routes/filesystem'
import { configRoutes } from './routes/config'
import { weixinRoutes } from './routes/weixin'
import * as hermesCli from './services/hermes-cli'
const { restartGateway, startGateway, startGatewayBackground, getVersion } = hermesCli

export async function bootstrap() {
  await mkdir(config.uploadDir, { recursive: true })
  await mkdir(config.dataDir, { recursive: true })
  await ensureApiServerConfig()
  await ensureGatewayRunning()

  const app = new Koa()

  app.use(cors({ origin: config.corsOrigins }))
  app.use(bodyParser())

  app.use(webhookRoutes.routes())
  app.use(logRoutes.routes())
  app.use(uploadRoutes.routes())
  app.use(sessionRoutes.routes())
  app.use(fsRoutes.routes())
  app.use(configRoutes.routes())
  app.use(weixinRoutes.routes())

  // Health endpoint: check CLI version + gateway connectivity
  app.use(async (ctx, next) => {
    if (ctx.path === '/health') {
      const raw = await getVersion()
      const version = raw.split('\n')[0].replace('Hermes Agent ', '') || ''

      let gatewayOk = false
      try {
        const res = await fetch(`${config.upstream.replace(/\/$/, '')}/health`, {
          signal: AbortSignal.timeout(5000),
        })
        gatewayOk = res.ok
      } catch { /* not reachable */ }

      ctx.body = {
        status: gatewayOk ? 'ok' : 'error',
        platform: 'hermes-agent',
        version,
        gateway: gatewayOk ? 'running' : 'stopped',
      }
      return
    }
    await next()
  })

  app.use(proxyRoutes.routes())

  // SPA fallback
  const distDir = resolve(__dirname, '..')
  app.use(serve(distDir))
  app.use(async (ctx) => {
    if (!ctx.path.startsWith('/api') && !ctx.path.startsWith('/v1') && ctx.path !== '/health' && ctx.path !== '/upload' && ctx.path !== '/webhook') {
      await send(ctx, 'index.html', { root: distDir })
    }
  })

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`  ➜  Hermes BFF Server: http://localhost:${config.port}`)
    console.log(`  ➜  Upstream: ${config.upstream}`)
  })
}

async function ensureApiServerConfig() {
  const { homedir } = await import('os')
  const { readFileSync, writeFileSync, existsSync, copyFileSync } = await import('fs')
  const yaml = (await import('js-yaml')).default
  const configPath = resolve(homedir(), '.hermes/config.yaml')

  const apiServerDefaults: Record<string, any> = {
    enabled: true,
    host: '127.0.0.1',
    port: 8642,
    key: '',
    cors_origins: '*',
  }

  try {
    if (!existsSync(configPath)) {
      console.log('  ✗ config.yaml not found, run "hermes setup" first')
      return
    }

    const content = readFileSync(configPath, 'utf-8')
    const config = yaml.load(content) as any || {}

    if (!config.platforms) config.platforms = {}
    if (!config.platforms.api_server) config.platforms.api_server = {}

    const api = config.platforms.api_server
    let needsUpdate = false

    for (const [key, value] of Object.entries(apiServerDefaults)) {
      if (api[key] === undefined || api[key] === null) {
        api[key] = value
        needsUpdate = true
      }
    }

    if (!needsUpdate) {
      console.log('  ✓ api_server config is correct')
      return
    }

    // Backup before modifying
    copyFileSync(configPath, configPath + '.bak')

    const updated = yaml.dump(config, { lineWidth: -1, noRefs: true, quotingType: '"' })
    writeFileSync(configPath, updated, 'utf-8')
    console.log('  ✓ api_server config ensured (backup saved to config.yaml.bak)')
    await restartGateway()
  } catch (err: any) {
    console.error('  ✗ Failed to update config:', err.message)
  }
}

async function ensureGatewayRunning() {
  const upstream = config.upstream.replace(/\/$/, '')
  try {
    const res = await fetch(`${upstream}/health`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      console.log('  ✓ Gateway is running')
      return
    }
  } catch {
    // Gateway not reachable
  }

  // Detect WSL — no launchd/systemd, hermes gateway start won't work
  const { existsSync, readFileSync } = await import('fs')
  const isWSL = existsSync('/proc/version') && readFileSync('/proc/version', 'utf-8').toLowerCase().includes('microsoft')

  if (isWSL) {
    console.log('  ⚠ WSL detected — Gateway not reachable, starting in background...')
    try {
      const pid = await startGatewayBackground()
      await new Promise(r => setTimeout(r, 3000))
      const res = await fetch(`${upstream}/health`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        console.log(`  ✓ Gateway started in background (PID: ${pid})`)
        return
      }
      console.log('  ✗ Gateway start attempted but still not reachable')
    } catch (err: any) {
      console.error('  ✗ Failed to start gateway:', err.message)
    }
    return
  }

  console.log('  ⚠ Gateway not reachable, starting...')
  try {
    await startGateway()
    await new Promise(r => setTimeout(r, 3000))
    const res = await fetch(`${upstream}/health`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      console.log('  ✓ Gateway started successfully')
      return
    }
    console.log('  ✗ Gateway start attempted but still not reachable')
  } catch (err: any) {
    console.error('  ✗ Failed to start gateway:', err.message)
  }
}

bootstrap()
