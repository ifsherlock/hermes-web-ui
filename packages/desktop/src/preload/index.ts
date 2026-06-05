import { contextBridge, ipcRenderer } from 'electron'

try {
  document.documentElement.classList.add('desktop-shell')
} catch {
  /* ignore */
}

function installDesktopPerson5FixCss(): void {
  const styleId = 'hermes-desktop-person5-fix'
  if (document.getElementById(styleId)) return
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
html.person5.desktop-shell,
html.person5.desktop-shell body,
html.person5.desktop-shell #app {
  width: 100% !important;
  height: 100vh !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  transform: none !important;
  overflow: hidden !important;
}

html.person5.desktop-shell body::before {
  opacity: 0.18 !important;
  pointer-events: none !important;
}

html.person5.desktop-shell .app-layout:not(.no-sidebar) {
  width: 100% !important;
  height: calc(100vh - var(--p5-top-height, 86px)) !important;
  min-width: 0 !important;
  padding: 0 !important;
  gap: 0 !important;
  overflow: hidden !important;
}

html.person5.desktop-shell .app-main {
  position: relative !important;
  z-index: 1 !important;
  min-width: 0 !important;
  height: 100% !important;
  margin: 0 !important;
  border: 0 !important;
  outline: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: hidden !important;
  transform: none !important;
  pointer-events: auto !important;
}

html.person5.desktop-shell .app-main::before,
html.person5.desktop-shell .app-main::after,
html.person5.desktop-shell .chat-panel::before,
html.person5.desktop-shell .chat-panel::after,
html.person5.desktop-shell .chat-content-wrapper::before,
html.person5.desktop-shell .chat-content-wrapper::after {
  pointer-events: none !important;
}

html.person5.desktop-shell .p5-command-bar {
  position: relative !important;
  z-index: 60 !important;
  width: 100% !important;
}

html.person5.desktop-shell .sidebar {
  position: relative !important;
  z-index: 40 !important;
  height: calc(100vh - var(--p5-top-height, 86px)) !important;
}

html.person5.desktop-shell .chat-view,
html.person5.desktop-shell .chat-panel,
html.person5.desktop-shell .chat-main {
  width: 100% !important;
  height: 100% !important;
  min-width: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
  transform: none !important;
  pointer-events: auto !important;
}

html.person5.desktop-shell .chat-content-wrapper {
  min-width: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
  pointer-events: auto !important;
}

html.person5.desktop-shell .session-backdrop:not(.active) {
  display: none !important;
  pointer-events: none !important;
}

html.person5.desktop-shell .session-list.collapsed {
  pointer-events: none !important;
}

html.person5.desktop-shell button,
html.person5.desktop-shell a,
html.person5.desktop-shell input,
html.person5.desktop-shell textarea,
html.person5.desktop-shell select,
html.person5.desktop-shell .n-button,
html.person5.desktop-shell .nav-group-label,
html.person5.desktop-shell .nav-item,
html.person5.desktop-shell .p5-session-handle,
html.person5.desktop-shell .chat-input-area {
  pointer-events: auto !important;
}
`
  document.head.appendChild(style)
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installDesktopPerson5FixCss, { once: true })
} else {
  installDesktopPerson5FixCss()
}

contextBridge.exposeInMainWorld('hermesDesktop', {
  getToken: (): Promise<string> => ipcRenderer.invoke('hermes-desktop:get-token'),
  retryBootstrap: (source?: 'cf' | 'github'): Promise<void> => ipcRenderer.invoke('hermes-desktop:retry-bootstrap', source),
  enterRemoteMode: (): Promise<void> => ipcRenderer.invoke('hermes-desktop:enter-remote-mode'),
  platform: process.platform,
  isDesktop: true,
})

const API_KEY_LS = 'hermes_api_key'
const DEFAULT_USERNAME = 'admin'
const DEFAULT_PASSWORD = '123456'

// Auto-login the bundled web UI so users don't see a login screen on launch.
// We POST to /api/auth/login with the well-known default credentials, using
// the server's AUTH_TOKEN as the bearer (the server requires *some* auth on
// /api/auth/login from a packaged client). The returned JWT is dropped into
// localStorage where the Vue client expects it.
async function autoLogin(token: string): Promise<void> {
  if (localStorage.getItem(API_KEY_LS)) return
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD }),
    })
    if (!res.ok) return
    const body = await res.json().catch(() => null) as { token?: string; jwt?: string } | null
    const jwt = body?.token || body?.jwt
    if (jwt) localStorage.setItem(API_KEY_LS, jwt)
  } catch {
    /* ignore — first-load race or server still starting */
  }
}

// Silently strip the "你必须修改默认密码" flag from /api/auth/me responses on
// desktop. Users on a single-machine install don't benefit from a managed
// password. The Web UI client uses BOTH fetch and axios (which goes through
// XMLHttpRequest), so we patch both code paths.
function isAuthMeUrl(url: string): boolean {
  return /\/api\/auth\/me(?:\?|$)/.test(url)
}

function stripCredentialFlag(text: string): string {
  try {
    const data = JSON.parse(text)
    if (data?.user && data.user.requiresCredentialChange) {
      data.user.requiresCredentialChange = false
      return JSON.stringify(data)
    }
  } catch { /* not JSON */ }
  return text
}

function installFetchPatch(): void {
  const origFetch = window.fetch.bind(window)
  const patchedFetch = (async (input, init) => {
    const res = await origFetch(input, init)
    try {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url && isAuthMeUrl(url) && res.ok) {
        const text = await res.clone().text()
        const patched = stripCredentialFlag(text)
        if (patched !== text) {
          return new Response(patched, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
          })
        }
      }
    } catch { /* fall through */ }
    return res
  }) as typeof window.fetch
  window.fetch = patchedFetch

  const OrigXHR = window.XMLHttpRequest
  type XHRWithDesktop = XMLHttpRequest & { __hermesDesktopUrl?: string }
  const origOpen = OrigXHR.prototype.open
  OrigXHR.prototype.open = function (
    this: XHRWithDesktop,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    this.__hermesDesktopUrl = String(url)
    // @ts-expect-error — forwarding variadic
    return origOpen.call(this, method, url, ...rest)
  }
  const origGetResponse = Object.getOwnPropertyDescriptor(OrigXHR.prototype, 'response')
  const origGetResponseText = Object.getOwnPropertyDescriptor(OrigXHR.prototype, 'responseText')
  if (origGetResponse?.get && origGetResponseText?.get) {
    Object.defineProperty(OrigXHR.prototype, 'responseText', {
      configurable: true,
      get(this: XHRWithDesktop) {
        const raw = origGetResponseText.get!.call(this) as string
        if (this.__hermesDesktopUrl && isAuthMeUrl(this.__hermesDesktopUrl) && typeof raw === 'string') {
          return stripCredentialFlag(raw)
        }
        return raw
      },
    })
    Object.defineProperty(OrigXHR.prototype, 'response', {
      configurable: true,
      get(this: XHRWithDesktop) {
        const raw = origGetResponse.get!.call(this)
        if (this.__hermesDesktopUrl && isAuthMeUrl(this.__hermesDesktopUrl)) {
          if (typeof raw === 'string') return stripCredentialFlag(raw)
          if (raw && typeof raw === 'object' && (raw as { user?: { requiresCredentialChange?: boolean } }).user?.requiresCredentialChange) {
            return { ...(raw as object), user: { ...(raw as { user: object }).user, requiresCredentialChange: false } }
          }
        }
        return raw
      },
    })
  }
}

installFetchPatch()

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const token = await ipcRenderer.invoke('hermes-desktop:get-token')
    if (token) {
      try { localStorage.setItem('AUTH_TOKEN', token) } catch { /* */ }
      await autoLogin(token)
    }
  } catch {
    /* ignore */
  }
})
