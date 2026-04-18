import { beforeEach, describe, expect, it, vi } from 'vitest'

const allMock = vi.fn()
const prepareMock = vi.fn(() => ({ all: allMock }))
const closeMock = vi.fn()
const databaseSyncMock = vi.fn(() => ({ prepare: prepareMock, close: closeMock }))
const getActiveProfileDirMock = vi.fn(() => '/tmp/hermes-profile')

vi.mock('node:sqlite', () => ({
  DatabaseSync: databaseSyncMock,
}))

vi.mock('../../packages/server/src/services/hermes/hermes-profile', () => ({
  getActiveProfileDir: getActiveProfileDirMock,
}))

describe('session DB summaries', () => {
  beforeEach(() => {
    vi.resetModules()
    allMock.mockReset()
    prepareMock.mockClear()
    closeMock.mockClear()
    databaseSyncMock.mockClear()
    getActiveProfileDirMock.mockReset()
    getActiveProfileDirMock.mockReturnValue('/tmp/hermes-profile')
  })

  it('queries sqlite for lightweight session summaries', async () => {
    allMock.mockReturnValue([
      {
        id: 's1',
        source: 'cli',
        user_id: '',
        model: 'openai/gpt-5.4',
        title: 'Named session',
        started_at: 1710000000,
        ended_at: null,
        end_reason: '',
        message_count: 3,
        tool_call_count: 1,
        input_tokens: 10,
        output_tokens: 20,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        reasoning_tokens: 0,
        billing_provider: 'openrouter',
        estimated_cost_usd: 0.01,
        actual_cost_usd: null,
        cost_status: 'estimated',
        preview: 'hello world',
        last_active: 1710000005,
      },
    ])

    const mod = await import('../../packages/server/src/services/hermes/sessions-db')
    const rows = await mod.listSessionSummaries(undefined, 50)

    expect(databaseSyncMock).toHaveBeenCalledWith('/tmp/hermes-profile/state.db', { open: true, readOnly: true })
    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining("AND s.source != 'tool'"))
    expect(allMock).toHaveBeenCalledWith(50)
    expect(closeMock).toHaveBeenCalled()
    expect(rows).toEqual([
      {
        id: 's1',
        source: 'cli',
        user_id: null,
        model: 'openai/gpt-5.4',
        title: 'Named session',
        started_at: 1710000000,
        ended_at: null,
        end_reason: null,
        message_count: 3,
        tool_call_count: 1,
        input_tokens: 10,
        output_tokens: 20,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        reasoning_tokens: 0,
        billing_provider: 'openrouter',
        estimated_cost_usd: 0.01,
        actual_cost_usd: null,
        cost_status: 'estimated',
        preview: 'hello world',
        last_active: 1710000005,
      },
    ])
  })

  it('adds source filter and falls back last_active to started_at', async () => {
    allMock.mockReturnValue([
      {
        id: 's2',
        source: 'telegram',
        user_id: '',
        model: 'openai/gpt-5.4',
        title: '',
        started_at: 1710000100,
        ended_at: null,
        end_reason: '',
        message_count: 1,
        tool_call_count: 0,
        input_tokens: 4,
        output_tokens: 5,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        reasoning_tokens: 0,
        billing_provider: '',
        estimated_cost_usd: 0,
        actual_cost_usd: null,
        cost_status: '',
        preview: 'preview text',
        last_active: null,
      },
    ])

    const mod = await import('../../packages/server/src/services/hermes/sessions-db')
    const rows = await mod.listSessionSummaries('telegram', 2)

    expect(prepareMock).toHaveBeenCalledWith(expect.stringContaining('AND s.source = ?'))
    expect(allMock).toHaveBeenCalledWith('telegram', 2)
    expect(rows[0].last_active).toBe(1710000100)
    expect(rows[0].source).toBe('telegram')
    expect(rows[0].title).toBeNull()
  })
})
