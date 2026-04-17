import { beforeEach, describe, expect, it, vi } from 'vitest'

const listSessionSummariesMock = vi.fn()
const listSessionsMock = vi.fn()

vi.mock('../../packages/server/src/services/hermes/sessions-db', () => ({
  listSessionSummaries: listSessionSummariesMock,
}))

vi.mock('../../packages/server/src/services/hermes/hermes-cli', () => ({
  listSessions: listSessionsMock,
  getSession: vi.fn(),
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
}))

describe('session routes', () => {
  beforeEach(() => {
    vi.resetModules()
    listSessionSummariesMock.mockReset()
    listSessionsMock.mockReset()
  })

  it('serves summaries from sqlite-backed helper when available', async () => {
    listSessionSummariesMock.mockResolvedValue([{ id: 's1' }])
    const { sessionRoutes } = await import('../../packages/server/src/routes/hermes/sessions')
    const layer = sessionRoutes.stack.find((entry: any) => entry.path === '/api/hermes/sessions')
    const handler = layer.stack[0]
    const ctx: any = { query: { source: 'cli', limit: '5' }, body: null }

    await handler(ctx)

    expect(listSessionSummariesMock).toHaveBeenCalledWith('cli', 5)
    expect(listSessionsMock).not.toHaveBeenCalled()
    expect(ctx.body).toEqual({ sessions: [{ id: 's1' }] })
  })

  it('falls back to CLI wrapper when sqlite summary query fails', async () => {
    listSessionSummariesMock.mockRejectedValue(new Error('sqlite unavailable'))
    listSessionsMock.mockResolvedValue([{ id: 'fallback' }])
    const { sessionRoutes } = await import('../../packages/server/src/routes/hermes/sessions')
    const layer = sessionRoutes.stack.find((entry: any) => entry.path === '/api/hermes/sessions')
    const handler = layer.stack[0]
    const ctx: any = { query: { limit: '7' }, body: null }

    await handler(ctx)

    expect(listSessionSummariesMock).toHaveBeenCalledWith(undefined, 7)
    expect(listSessionsMock).toHaveBeenCalledWith(undefined, 7)
    expect(ctx.body).toEqual({ sessions: [{ id: 'fallback' }] })
  })
})
