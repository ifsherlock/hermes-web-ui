import Router from '@koa/router'
import * as hermesCli from '../../services/hermes-cli'

export const logRoutes = new Router()

// List available log files
logRoutes.get('/api/hermes/logs', async (ctx) => {
  const files = await hermesCli.listLogFiles()
  ctx.body = { files }
})

interface LogEntry {
  timestamp: string
  level: string
  logger: string
  message: string
  raw: string
}

// Parse a single log line into structured entry
function parseLine(line: string): LogEntry | null {
  // Match: 2026-04-11 20:16:16,289 INFO aiohttp.access: message
  const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s+(DEBUG|INFO|WARNING|ERROR|CRITICAL)\s+(\S+?):\s(.*)$/)
  if (match) {
    return {
      timestamp: match[1],
      level: match[2],
      logger: match[3],
      message: match[4],
      raw: line,
    }
  }
  // Unparseable line (e.g. traceback continuation)
  return null
}

// Read log lines (parsed)
logRoutes.get('/api/hermes/logs/:name', async (ctx) => {
  const logName = ctx.params.name
  const lines = ctx.query.lines ? parseInt(ctx.query.lines as string, 10) : 100
  const level = (ctx.query.level as string) || undefined
  const session = (ctx.query.session as string) || undefined
  const since = (ctx.query.since as string) || undefined

  try {
    const content = await hermesCli.readLogs(logName, lines, level, session, since)
    const rawLines = content.split('\n')

    const entries: (LogEntry | null)[] = []
    for (const line of rawLines) {
      // Skip header lines like "--- ~/.hermes/logs/agent.log (last 100) ---"
      if (line.startsWith('---') || line.trim() === '') continue
      entries.push(parseLine(line))
    }

    ctx.body = { entries }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})
