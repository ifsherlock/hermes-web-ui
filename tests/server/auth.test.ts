import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

// Mock config
vi.mock('../../packages/server/src/config', () => ({
  config: { dataDir: '/tmp/hermes-test-data' },
}))

import { readFile, writeFile } from 'fs/promises'
import { getToken, authMiddleware } from '../../packages/server/src/services/auth'

const mockedReadFile = vi.mocked(readFile)
const mockedWriteFile = vi.mocked(writeFile)

describe('Auth Service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('getToken', () => {
    it('returns null when AUTH_DISABLED=1', async () => {
      process.env.AUTH_DISABLED = '1'

      const token = await getToken()

      expect(token).toBeNull()
      expect(mockedReadFile).not.toHaveBeenCalled()
    })

    it('returns null when AUTH_DISABLED=true', async () => {
      process.env.AUTH_DISABLED = 'true'

      const token = await getToken()

      expect(token).toBeNull()
    })

    it('returns AUTH_TOKEN env var if set', async () => {
      process.env.AUTH_TOKEN = 'my-custom-token'

      const token = await getToken()

      expect(token).toBe('my-custom-token')
      expect(mockedReadFile).not.toHaveBeenCalled()
    })

    it('reads token from file if exists', async () => {
      mockedReadFile.mockResolvedValue('file-token\n')

      const token = await getToken()

      expect(token).toBe('file-token')
      expect(mockedReadFile).toHaveBeenCalledWith('/tmp/hermes-test-data/.token', 'utf-8')
    })

    it('generates and saves new token if file missing', async () => {
      mockedReadFile.mockRejectedValue(new Error('ENOENT'))

      const token = await getToken()

      expect(token).toBeTruthy()
      expect(token).toHaveLength(64) // 32 bytes hex
      expect(mockedWriteFile).toHaveBeenCalledWith(
        '/tmp/hermes-test-data/.token',
        expect.stringMatching(/^[a-f0-9]{64}\n$/),
        { mode: 0o600 },
      )
    })
  })

  describe('authMiddleware', () => {
    function createMockCtx(path: string, headers: Record<string, string> = {}, query: Record<string, string> = {}) {
      return {
        path,
        headers,
        query,
        status: 200,
        body: null,
        set: vi.fn(),
      }
    }

    const next = vi.fn()

    it('allows all requests when auth is disabled (null token)', async () => {
      const middleware = await authMiddleware(null)
      const ctx = createMockCtx('/api/hermes/sessions')

      await middleware(ctx, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('skips /health path', async () => {
      const middleware = await authMiddleware('secret')
      const ctx = createMockCtx('/health')

      await middleware(ctx, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('skips non-API paths', async () => {
      const middleware = await authMiddleware('secret')
      const ctx = createMockCtx('/index.html')

      await middleware(ctx, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('requires auth for /webhook path (it is an API-like endpoint)', async () => {
      const middleware = await authMiddleware('secret')
      const ctx = createMockCtx('/webhook', {})

      await middleware(ctx, next)

      expect(ctx.status).toBe(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects request without auth header', async () => {
      const middleware = await authMiddleware('secret')
      const ctx = createMockCtx('/api/hermes/sessions', {})

      await middleware(ctx, next)

      expect(ctx.status).toBe(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('rejects request with wrong token', async () => {
      const middleware = await authMiddleware('secret')
      const ctx = createMockCtx('/api/hermes/sessions', { authorization: 'Bearer wrong' })

      await middleware(ctx, next)

      expect(ctx.status).toBe(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('allows request with correct Bearer token', async () => {
      const middleware = await authMiddleware('secret')
      const ctx = createMockCtx('/api/hermes/sessions', { authorization: 'Bearer secret' })

      await middleware(ctx, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('allows request with correct query token', async () => {
      const middleware = await authMiddleware('secret')
      const ctx = createMockCtx('/api/hermes/sessions', {}, { token: 'secret' })

      await middleware(ctx, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('returns 401 JSON on auth failure', async () => {
      const middleware = await authMiddleware('secret')
      const ctx = createMockCtx('/api/hermes/sessions', { authorization: 'Bearer wrong' })

      await middleware(ctx, next)

      expect(ctx.status).toBe(401)
      expect(ctx.set).toHaveBeenCalledWith('Content-Type', 'application/json')
      expect(ctx.body).toEqual({ error: 'Unauthorized' })
    })
  })
})
