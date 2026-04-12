import { request } from './client'

export interface SessionSummary {
  id: string
  source: string
  model: string
  title: string | null
  started_at: number
  ended_at: number | null
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  billing_provider: string | null
  estimated_cost_usd: number
}

export interface SessionDetail extends SessionSummary {
  messages: HermesMessage[]
}

export interface HermesMessage {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_call_id: string | null
  tool_calls: any[] | null
  tool_name: string | null
  timestamp: number
  token_count: number | null
  finish_reason: string | null
  reasoning: string | null
}

export async function fetchSessions(source?: string, limit?: number): Promise<SessionSummary[]> {
  const params = new URLSearchParams()
  if (source) params.set('source', source)
  if (limit) params.set('limit', String(limit))
  const query = params.toString()
  const res = await request<{ sessions: SessionSummary[] }>(`/api/sessions${query ? `?${query}` : ''}`)
  return res.sessions
}

export async function fetchSession(id: string): Promise<SessionDetail | null> {
  try {
    const res = await request<{ session: SessionDetail }>(`/api/sessions/${id}`)
    return res.session
  } catch {
    return null
  }
}

export async function deleteSession(id: string): Promise<boolean> {
  try {
    await request(`/api/sessions/${id}`, { method: 'DELETE' })
    return true
  } catch {
    return false
  }
}

export async function renameSession(id: string, title: string): Promise<boolean> {
  try {
    await request(`/api/sessions/${id}/rename`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
    return true
  } catch {
    return false
  }
}
