import { getActiveProfileDir } from './hermes-profile'
import { spawnHermesWithBin } from './hermes-process'
import { logger } from '../logger'

export function startGatewayRunManaged(
  hermesBin: string,
  opts: { profileDir?: string } = {},
): { pid: number | null; reused: boolean } {
  const profileDir = opts.profileDir || getActiveProfileDir()
  const child = spawnHermesWithBin(hermesBin, ['gateway', 'run', '--replace'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      HERMES_HOME: profileDir,
    },
  })
  child.once('error', (err) => {
    logger.warn(
      err,
      '[gateway-runner] failed to spawn Hermes gateway process; Web UI will continue without gateway autostart',
    )
    console.warn(
      '[gateway-runner] failed to spawn Hermes gateway process; Web UI will continue without gateway autostart:',
      err instanceof Error ? err.message : err,
    )
  })
  child.unref()

  const pid = child.pid ?? null
  return { pid, reused: false }
}
