import { describe, expect, it } from 'vitest'
import {
  gatewayStatusLooksRuntimeLocked,
  gatewayStatusLooksRunning,
  parseGatewayStatusesFromProfileListOutput,
} from '../../packages/server/src/services/hermes/gateway-autostart'

describe('gateway autostart status parsing', () => {
  it('treats runtime lock conflicts as an already-running gateway', () => {
    expect(gatewayStatusLooksRuntimeLocked(
      'Gateway runtime lock is already held by another instance. Exiting.',
    )).toBe(true)
  })

  it('does not treat not-running status as running', () => {
    expect(gatewayStatusLooksRunning('Gateway is not running')).toBe(false)
  })

  it('parses gateway status from hermes profile list output', () => {
    const output = `
 Profile          Model                        Gateway      Alias        Distribution
 ───────────────    ───────────────────────────    ───────────    ───────────    ────────────────────
 ◆default         glm-5-turbo                  running      —            —
  akri            glm-5-turbo                  running      akri         —
  tester          gpt-5.5                      stopped      tester       —
`
    const statuses = parseGatewayStatusesFromProfileListOutput(output)
    expect(statuses.get('default')).toBe('running')
    expect(statuses.get('akri')).toBe('running')
    expect(statuses.get('tester')).toBe('stopped')
  })

  it('uses profile-list gateway status text for running checks', () => {
    expect(gatewayStatusLooksRunning('running')).toBe(true)
    expect(gatewayStatusLooksRunning('stopped')).toBe(false)
    expect(gatewayStatusLooksRunning('not running')).toBe(false)
  })
})
