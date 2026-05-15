/**
 * Usage calculation — token counting from DB messages,
 * snapshot-aware computation, client notification.
 */

import {
  getSessionDetail,
} from '../../../db/hermes/session-store'
import { getCompressionSnapshot } from '../../../db/hermes/compression-snapshot'
import { countTokens, SUMMARY_PREFIX } from '../../../lib/context-compressor'
import { logger } from '../../logger'
import type { SessionState } from './types'

export async function calcAndUpdateUsage(
  sid: string,
  state: SessionState,
  emit: (event: string, payload: any) => void,
): Promise<{ inputTokens: number; outputTokens: number }> {
  try {
    const detail = getSessionDetail(sid)
    const msgs = detail?.messages
      ?.filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'tool') || []

    const snapshot = getCompressionSnapshot(sid)
    let inputTokens: number
    let outputTokens: number
    if (snapshot && msgs.length) {
      const newMessages = msgs.slice(snapshot.lastMessageIndex + 1)
      inputTokens = countTokens(SUMMARY_PREFIX + snapshot.summary) +
        newMessages.filter(m => m.role === 'user').reduce((sum, m) => sum + countTokens(m.content || ''), 0)
      outputTokens = newMessages
        .filter(m => m.role === 'assistant' || m.role === 'tool')
        .reduce((sum, m) => sum + countTokens(m.content || '') + countTokens(m.tool_calls + '' || ''), 0)
    } else {
      inputTokens = msgs.filter(m => m.role === 'user').reduce((sum, m) => sum + countTokens(m.content || ''), 0)
      outputTokens = msgs
        .filter(m => m.role === 'assistant' || m.role === 'tool')
        .reduce((sum, m) => sum + countTokens(m.content || '') + countTokens(m.tool_calls + '' || ''), 0)
    }
    state.inputTokens = inputTokens
    state.outputTokens = outputTokens
    emit('usage.updated', {
      event: 'usage.updated',
      session_id: sid,
      inputTokens,
      outputTokens,
    })
    return { inputTokens, outputTokens }
  } catch (err: any) {
    logger.warn(err, '[chat-run-socket] failed to calculate usage for session %s', sid)
    return { inputTokens: 0, outputTokens: 0 }
  }
}
