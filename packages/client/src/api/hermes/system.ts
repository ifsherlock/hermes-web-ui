import { request } from '../client'

export interface HealthResponse {
  status: string
  version?: string
}

// Config-based model types
export interface ModelInfo {
  id: string
  label: string
}

export interface ModelGroup {
  provider: string
  models: ModelInfo[]
}

export interface ConfigModelsResponse {
  default: string
  groups: ModelGroup[]
}

export interface AvailableModelGroup {
  provider: string   // credential pool key (e.g. "zai", "custom:subrouter.ai")
  label: string      // display name (e.g. "zai", "subrouter.ai")
  base_url: string
  models: string[]
}

export interface AvailableModelsResponse {
  default: string
  groups: AvailableModelGroup[]
}

export interface CustomProvider {
  name: string
  base_url: string
  api_key: string
  model: string
  providerKey?: string | null
}

export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

export async function fetchConfigModels(): Promise<ConfigModelsResponse> {
  return request<ConfigModelsResponse>('/api/hermes/config/models')
}

export async function fetchAvailableModels(): Promise<AvailableModelsResponse> {
  return request<AvailableModelsResponse>('/api/hermes/available-models')
}

export async function updateDefaultModel(data: {
  default: string
  provider?: string
  base_url?: string
  api_key?: string
}): Promise<void> {
  await request('/api/hermes/config/model', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function addCustomProvider(data: CustomProvider): Promise<void> {
  await request('/api/hermes/config/providers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function removeCustomProvider(name: string): Promise<void> {
  await request(`/api/hermes/config/providers/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}
