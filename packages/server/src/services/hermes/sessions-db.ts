import { DatabaseSync } from 'node:sqlite'
import { getActiveProfileDir } from './hermes-profile'

export interface HermesSessionRow {
  id: string
  source: string
  user_id: string | null
  model: string
  title: string | null
  started_at: number
  ended_at: number | null
  end_reason: string | null
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  reasoning_tokens: number
  billing_provider: string | null
  estimated_cost_usd: number
  actual_cost_usd: number | null
  cost_status: string
  preview: string
  last_active: number
}

function sessionDbPath(): string {
  return `${getActiveProfileDir()}/state.db`
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeNullableString(value: unknown): string | null {
  if (value == null || value === '') return null
  return String(value)
}

function mapRow(row: Record<string, unknown>): HermesSessionRow {
  const startedAt = normalizeNumber(row.started_at)
  return {
    id: String(row.id || ''),
    source: String(row.source || ''),
    user_id: normalizeNullableString(row.user_id),
    model: String(row.model || ''),
    title: normalizeNullableString(row.title),
    started_at: startedAt,
    ended_at: normalizeNullableNumber(row.ended_at),
    end_reason: normalizeNullableString(row.end_reason),
    message_count: normalizeNumber(row.message_count),
    tool_call_count: normalizeNumber(row.tool_call_count),
    input_tokens: normalizeNumber(row.input_tokens),
    output_tokens: normalizeNumber(row.output_tokens),
    cache_read_tokens: normalizeNumber(row.cache_read_tokens),
    cache_write_tokens: normalizeNumber(row.cache_write_tokens),
    reasoning_tokens: normalizeNumber(row.reasoning_tokens),
    billing_provider: normalizeNullableString(row.billing_provider),
    estimated_cost_usd: normalizeNumber(row.estimated_cost_usd),
    actual_cost_usd: normalizeNullableNumber(row.actual_cost_usd),
    cost_status: String(row.cost_status || ''),
    preview: String(row.preview || ''),
    last_active: normalizeNumber(row.last_active, startedAt),
  }
}

const BASE_SELECT = `
  SELECT
    s.id,
    s.source,
    COALESCE(s.user_id, '') AS user_id,
    COALESCE(s.model, '') AS model,
    COALESCE(s.title, '') AS title,
    COALESCE(s.started_at, 0) AS started_at,
    s.ended_at AS ended_at,
    COALESCE(s.end_reason, '') AS end_reason,
    COALESCE(s.message_count, 0) AS message_count,
    COALESCE(s.tool_call_count, 0) AS tool_call_count,
    COALESCE(s.input_tokens, 0) AS input_tokens,
    COALESCE(s.output_tokens, 0) AS output_tokens,
    COALESCE(s.cache_read_tokens, 0) AS cache_read_tokens,
    COALESCE(s.cache_write_tokens, 0) AS cache_write_tokens,
    COALESCE(s.reasoning_tokens, 0) AS reasoning_tokens,
    COALESCE(s.billing_provider, '') AS billing_provider,
    COALESCE(s.estimated_cost_usd, 0) AS estimated_cost_usd,
    s.actual_cost_usd AS actual_cost_usd,
    COALESCE(s.cost_status, '') AS cost_status,
    COALESCE(
      (
        SELECT SUBSTR(REPLACE(REPLACE(m.content, CHAR(10), ' '), CHAR(13), ' '), 1, 63)
        FROM messages m
        WHERE m.session_id = s.id AND m.role = 'user' AND m.content IS NOT NULL
        ORDER BY m.timestamp, m.id
        LIMIT 1
      ),
      ''
    ) AS preview,
    COALESCE((SELECT MAX(m2.timestamp) FROM messages m2 WHERE m2.session_id = s.id), s.started_at) AS last_active
  FROM sessions s
  WHERE s.parent_session_id IS NULL
    AND s.source != 'tool'
`

export async function listSessionSummaries(source?: string, limit = 2000): Promise<HermesSessionRow[]> {
  const db = new DatabaseSync(sessionDbPath(), { open: true, readOnly: true })

  try {
    const sql = source
      ? `${BASE_SELECT}\n    AND s.source = ?\n  ORDER BY s.started_at DESC\n  LIMIT ?`
      : `${BASE_SELECT}\n  ORDER BY s.started_at DESC\n  LIMIT ?`

    const statement = db.prepare(sql)
    const rows = source
      ? statement.all(source, limit) as Record<string, unknown>[]
      : statement.all(limit) as Record<string, unknown>[]

    return rows.map(mapRow)
  } finally {
    db.close()
  }
}
