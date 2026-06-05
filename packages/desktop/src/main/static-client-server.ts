import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { webuiDir } from './paths'

let staticServer: Server | null = null
let staticServerUrl: string | null = null

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function clientDir(): string {
  return join(webuiDir(), 'dist', 'client')
}

function contentType(file: string): string {
  return CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream'
}

function resolveClientFile(pathname: string): string {
  const root = clientDir()
  const decoded = decodeURIComponent(pathname.split('?')[0] || '/')
  const relative = normalize(decoded.replace(/^\/+/, ''))
  const candidate = resolve(root, relative || 'index.html')
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return join(root, 'index.html')
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  return join(root, 'index.html')
}

export async function startStaticClientServer(preferredPort = 8749): Promise<string> {
  if (staticServerUrl) return staticServerUrl

  const root = clientDir()
  if (!existsSync(join(root, 'index.html'))) {
    throw new Error(`Desktop client build is missing: ${root}`)
  }

  staticServer = createServer((req, res) => {
    const pathname = (req.url || '/').split('?')[0] || '/'
    if (pathname.startsWith('/api/')) {
      res.statusCode = 404
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Remote server URL is not configured in this desktop client' }))
      return
    }

    const file = resolveClientFile(req.url || '/')
    res.setHeader('Cache-Control', file.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable')
    res.setHeader('Content-Type', contentType(file))
    createReadStream(file)
      .on('error', () => {
        res.statusCode = 404
        res.end('Not found')
      })
      .pipe(res)
  })

  await new Promise<void>((resolveListen, rejectListen) => {
    const server = staticServer
    if (!server) {
      rejectListen(new Error('Failed to create desktop client server'))
      return
    }
    const listenOnRandomPort = () => {
      server.removeListener('error', onPreferredPortError)
      server.once('error', rejectListen)
      server.listen(0, '127.0.0.1', () => resolveListen())
    }
    const onPreferredPortError = () => listenOnRandomPort()
    server.once('error', onPreferredPortError)
    server.listen(preferredPort, '127.0.0.1', () => {
      server.removeListener('error', onPreferredPortError)
      resolveListen()
    })
  })

  const address = staticServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind desktop client server')
  }
  staticServerUrl = `http://127.0.0.1:${address.port}`
  return staticServerUrl
}

export async function stopStaticClientServer(): Promise<void> {
  const server = staticServer
  staticServer = null
  staticServerUrl = null
  if (!server) return
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
}
