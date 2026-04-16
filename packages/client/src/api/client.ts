import router from '@/router'

const DEFAULT_BASE_URL = ''

function getBaseUrl(): string {
  return localStorage.getItem('hermes_server_url') || DEFAULT_BASE_URL
}

export function getApiKey(): string {
  return localStorage.getItem('hermes_api_key') || ''
}

export function setServerUrl(url: string) {
  localStorage.setItem('hermes_server_url', url)
}

export function setApiKey(key: string) {
  localStorage.setItem('hermes_api_key', key)
}

export function clearApiKey() {
  localStorage.removeItem('hermes_api_key')
}

export function hasApiKey(): boolean {
  return !!getApiKey()
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getBaseUrl()
  const url = `${base}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  }

  const apiKey = getApiKey()
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const res = await fetch(url, { ...options, headers })

  // Global 401 handler — clear auth and redirect to login
  if (res.status === 401) {
    clearApiKey()
    if (router.currentRoute.value.name !== 'login') {
      router.replace({ name: 'login' })
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API Error ${res.status}: ${text || res.statusText}`)
  }

  return res.json()
}

export function getBaseUrlValue(): string {
  return getBaseUrl()
}
