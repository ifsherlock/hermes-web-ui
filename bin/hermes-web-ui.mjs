#!/usr/bin/env node
import { spawn } from 'child_process'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, openSync } from 'fs'
import { homedir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverEntry = resolve(__dirname, '..', 'dist', 'server', 'index.js')
const PID_DIR = resolve(homedir(), '.hermes-web-ui')
const PID_FILE = join(PID_DIR, 'server.pid')
const LOG_FILE = join(PID_DIR, 'server.log')
const DEFAULT_PORT = 8648

function getPort() {
  if (process.argv[3] && !isNaN(process.argv[3])) return parseInt(process.argv[3])
  if (process.argv.includes('--port')) return parseInt(process.argv[process.argv.indexOf('--port') + 1])
  return DEFAULT_PORT
}

function getPid() {
  try {
    return parseInt(readFileSync(PID_FILE, 'utf-8').trim())
  } catch {
    return null
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function writePid(pid) {
  writeFileSync(PID_FILE, String(pid))
}

function removePid() {
  try { unlinkSync(PID_FILE) } catch {}
}

function startDaemon(port) {
  const existing = getPid()
  if (existing && isRunning(existing)) {
    console.log(`  ✗ hermes-web-ui is already running (PID: ${existing})`)
    console.log(`    Use "hermes-web-ui stop" to stop it first`)
    process.exit(1)
  }
  removePid()
  mkdirSync(PID_DIR, { recursive: true })

  const logStream = openSync(LOG_FILE, 'a')
  const child = spawn(process.execPath, [serverEntry], {
    detached: true,
    stdio: ['ignore', logStream, logStream],
    env: { ...process.env, PORT: String(port) },
  })

  child.on('error', (err) => {
    console.error(`  ✗ Failed to start: ${err.message}`)
    removePid()
    process.exit(1)
  })

  child.unref()
  writePid(child.pid)

  setTimeout(() => {
    if (isRunning(child.pid)) {
      console.log(`  ✓ hermes-web-ui started (PID: ${child.pid}, port: ${port})`)
      console.log(`    http://localhost:${port}`)
      console.log(`    Log: ${LOG_FILE}`)
    } else {
      console.log('  ✗ Failed to start hermes-web-ui')
      removePid()
      process.exit(1)
    }
  }, 500)
}

function stopDaemon() {
  const pid = getPid()
  if (!pid) {
    console.log('  ✗ hermes-web-ui is not running')
    process.exit(1)
  }

  if (!isRunning(pid)) {
    removePid()
    console.log(`  ✓ hermes-web-ui was not running (cleaned stale PID)`)
    return
  }

  try {
    try {
      process.kill(pid, 'SIGTERM')
      // Wait briefly for graceful shutdown
      for (let i = 0; i < 10; i++) {
        if (!isRunning(pid)) break
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
      }
    } catch {}
    // Force kill if still alive
    if (isRunning(pid)) {
      process.kill(pid, 'SIGKILL')
    }
    removePid()
    console.log(`  ✓ hermes-web-ui stopped (PID: ${pid})`)
  } catch (err) {
    console.log(`  ✗ Failed to stop: ${err.message}`)
    process.exit(1)
  }
}

function showStatus() {
  const pid = getPid()
  if (pid && isRunning(pid)) {
    console.log(`  ✓ hermes-web-ui is running (PID: ${pid})`)
    console.log(`    PID file: ${PID_FILE}`)
  } else {
    if (pid) removePid()
    console.log('  ✗ hermes-web-ui is not running')
  }
}

const command = process.argv[2] || 'start'

switch (command) {
  case 'start':
    startDaemon(getPort())
    break
  case 'stop':
    stopDaemon()
    break
  case 'restart':
    stopDaemon()
    setTimeout(() => startDaemon(getPort()), 500)
    break
  case 'status':
    showStatus()
    break
  default:
    const port = !isNaN(command) ? parseInt(command) : DEFAULT_PORT
    const child = spawn(process.execPath, [serverEntry], {
      stdio: 'inherit',
      env: { ...process.env, PORT: String(port) },
    })
    child.on('exit', (code) => process.exit(code ?? 1))
    process.on('SIGTERM', () => child.kill('SIGTERM'))
    process.on('SIGINT', () => child.kill('SIGINT'))
}
