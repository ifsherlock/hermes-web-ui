import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface HermesSession {
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
  billing_provider: string | null
  estimated_cost_usd: number
  messages?: any[]
}

interface HermesSessionFull extends HermesSession {
  system_prompt?: string
  model_config?: string
  cache_read_tokens?: number
  cache_write_tokens?: number
  reasoning_tokens?: number
  actual_cost_usd?: number | null
  cost_status?: string
  cost_source?: string
  pricing_version?: string | null
  [key: string]: any
}

/**
 * List sessions from Hermes CLI (without messages)
 */
export async function listSessions(source?: string, limit?: number): Promise<HermesSession[]> {
  const args = ['sessions', 'export', '-']
  if (source) args.push('--source', source)

  try {
    const { stdout } = await execFileAsync('hermes', args, {
      maxBuffer: 50 * 1024 * 1024, // 50MB
      timeout: 30000,
    })

    const lines = stdout.trim().split('\n').filter(Boolean)
    const sessions: HermesSession[] = []

    for (const line of lines) {
      try {
        const raw: HermesSessionFull = JSON.parse(line)
        let title = raw.title
        if (!title && raw.messages) {
          const firstUser = raw.messages.find((m: any) => m.role === 'user')
          if (firstUser?.content) {
            const t = String(firstUser.content).slice(0, 40)
            title = t + (String(firstUser.content).length > 40 ? '...' : '')
          }
        }
        sessions.push({
          id: raw.id,
          source: raw.source,
          user_id: raw.user_id,
          model: raw.model,
          title,
          started_at: raw.started_at,
          ended_at: raw.ended_at,
          end_reason: raw.end_reason,
          message_count: raw.message_count,
          tool_call_count: raw.tool_call_count,
          input_tokens: raw.input_tokens,
          output_tokens: raw.output_tokens,
          billing_provider: raw.billing_provider,
          estimated_cost_usd: raw.estimated_cost_usd,
        })
      } catch { /* skip malformed lines */ }
    }

    // Sort by started_at descending
    sessions.sort((a, b) => b.started_at - a.started_at)

    if (limit && limit > 0) {
      return sessions.slice(0, limit)
    }
    return sessions
  } catch (err: any) {
    console.error('[Hermes CLI] sessions export failed:', err.message)
    throw new Error(`Failed to list sessions: ${err.message}`)
  }
}

/**
 * Get a single session with messages from Hermes CLI
 */
export async function getSession(id: string): Promise<HermesSession | null> {
  const args = ['sessions', 'export', '-', '--session-id', id]

  try {
    const { stdout } = await execFileAsync('hermes', args, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
    })

    const lines = stdout.trim().split('\n').filter(Boolean)
    if (lines.length === 0) return null

    const raw: HermesSessionFull = JSON.parse(lines[0])
    return {
      id: raw.id,
      source: raw.source,
      user_id: raw.user_id,
      model: raw.model,
      title: raw.title,
      started_at: raw.started_at,
      ended_at: raw.ended_at,
      end_reason: raw.end_reason,
      message_count: raw.message_count,
      tool_call_count: raw.tool_call_count,
      input_tokens: raw.input_tokens,
      output_tokens: raw.output_tokens,
      billing_provider: raw.billing_provider,
      estimated_cost_usd: raw.estimated_cost_usd,
      messages: raw.messages,
    }
  } catch (err: any) {
    if (err.code === 1 || err.status === 1) return null
    console.error('[Hermes CLI] session export failed:', err.message)
    throw new Error(`Failed to get session: ${err.message}`)
  }
}

/**
 * Delete a session from Hermes CLI
 */
export async function deleteSession(id: string): Promise<boolean> {
  try {
    await execFileAsync('hermes', ['sessions', 'delete', id, '--yes'], {
      timeout: 10000,
    })
    return true
  } catch (err: any) {
    console.error('[Hermes CLI] session delete failed:', err.message)
    return false
  }
}

/**
 * Rename a session title via Hermes CLI
 */
export async function renameSession(id: string, title: string): Promise<boolean> {
  try {
    await execFileAsync('hermes', ['sessions', 'rename', id, title], {
      timeout: 10000,
    })
    return true
  } catch (err: any) {
    console.error('[Hermes CLI] session rename failed:', err.message)
    return false
  }
}

export interface LogFileInfo {
  name: string
  size: string
  modified: string
}

/**
 * Get Hermes version
 */
export async function getVersion(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('hermes', ['--version'], { timeout: 5000 })
    return stdout.trim()
  } catch {
    return ''
  }
}

/**
 * Start Hermes gateway (uses launchd/systemd)
 */
export async function startGateway(): Promise<string> {
  const { stdout, stderr } = await execFileAsync('hermes', ['gateway', 'start'], {
    timeout: 30000,
  })
  return stdout || stderr
}

/**
 * Start Hermes gateway in background (for WSL where launchd/systemd is unavailable)
 * Uses "hermes gateway run" as a detached background process
 */
export async function startGatewayBackground(): Promise<number | null> {
  const { spawn } = require('child_process') as typeof import('child_process')
  const child = spawn('hermes', ['gateway', 'run'], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  return child.pid ?? null
}

/**
 * Restart Hermes gateway
 */
export async function restartGateway(): Promise<string> {
  const { stdout, stderr } = await execFileAsync('hermes', ['gateway', 'restart'], {
    timeout: 30000,
  })
  return stdout || stderr
}

/**
 * List available log files
 */
export async function listLogFiles(): Promise<LogFileInfo[]> {
  try {
    const { stdout } = await execFileAsync('hermes', ['logs', 'list'], {
      timeout: 10000,
    })
    const files: LogFileInfo[] = []
    const lines = stdout.trim().split('\n').filter(l => l.includes('.log'))
    for (const line of lines) {
      const match = line.match(/^\s+(\S+)\s+([\d.]+\w+)\s+(.+)$/)
      if (match) {
        const rawName = match[1]
        const name = rawName.replace(/\.log$/, '')
        if (['agent', 'errors', 'gateway'].includes(name)) {
          files.push({ name, size: match[2], modified: match[3].trim() })
        }
      }
    }
    return files
  } catch (err: any) {
    console.error('[Hermes CLI] logs list failed:', err.message)
    return []
  }
}

/**
 * Read log lines
 */
export async function readLogs(
  logName: string = 'agent',
  lines: number = 100,
  level?: string,
  session?: string,
  since?: string,
): Promise<string> {
  const args = ['logs', logName, '-n', String(lines)]
  if (level) args.push('--level', level)
  if (session) args.push('--session', session)
  if (since) args.push('--since', since)

  try {
    const { stdout } = await execFileAsync('hermes', args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
    })
    return stdout
  } catch (err: any) {
    console.error('[Hermes CLI] logs read failed:', err.message)
    throw new Error(`Failed to read logs: ${err.message}`)
  }
}
