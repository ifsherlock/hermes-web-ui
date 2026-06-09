import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  checkHealth,
  fetchAvailableModels,
  addCustomModel as persistCustomModel,
  removeCustomModel as deletePersistedCustomModel,
  updateDefaultModel,
  updateModelVisibility,
  fetchModelFallback,
  saveModelFallback,
  triggerUpdate,
  updateModelAlias,
  type AvailableModelGroup,
  type AvailableModelsResponse,
  type ProfileAvailableModels,
  type ModelFallbackConfig,
  type ModelFallbackRule,
  type ModelFallbackTarget,
  type ModelFallbackWarning,
  type ModelVisibility,
  type ModelVisibilityRule,
} from '@/api/hermes/system'
import { hasApiKey } from '@/api/client'

const WEB_UI_VERSION = __APP_VERSION__

const SIDEBAR_COLLAPSED_KEY = 'hermes_sidebar_collapsed'
const ACTIVE_PROFILE_STORAGE_KEY = 'hermes_active_profile_name'
const MODELS_CACHE_TTL_MS = 30000

export const useAppStore = defineStore('app', () => {
  const sidebarOpen = ref(false)
  // Desktop-only collapsed state (icon-rail mode). Persisted to localStorage.
  const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')

  const connected = ref(false)
  const serverVersion = ref(WEB_UI_VERSION)
  const latestVersion = ref('')
  const updateAvailable = ref(false)
  const clientOutdated = ref(false)
  const updating = ref(false)
  const modelGroups = ref<AvailableModelGroup[]>([])
  const profileModelGroups = ref<ProfileAvailableModels[]>([])
  const selectedModel = ref('')
  const selectedProvider = ref('')
  const customModels = ref<Record<string, string[]>>({})
  const modelAliases = ref<Record<string, Record<string, string>>>({})
  const modelVisibility = ref<ModelVisibility>({})
  const modelFallback = ref<ModelFallbackConfig>({ enabled: false, rules: [] })
  const modelFallbackWarnings = ref<ModelFallbackWarning[]>([])
  const healthPollTimer = ref<ReturnType<typeof setInterval>>()
  const nodeVersion = ref('')

  // Settings
  const streamEnabled = ref(true)
  const sessionPersistence = ref(true)
  const maxTokens = ref(4096)
  let modelsLoadPromise: Promise<void> | null = null
  let modelsLastRequestedAt = 0

  async function doUpdate(): Promise<boolean> {
    updating.value = true
    try {
      const res = await triggerUpdate()
      if (res.success) {
        updateAvailable.value = false
        await checkConnection()
      }
      return res.success
    } catch (err) {
      console.error('Failed to update Hermes Web UI:', err)
      return false
    } finally {
      updating.value = false
    }
  }

  async function checkConnection() {
    try {
      const res = await checkHealth()
      connected.value = res.status === 'ok'
      if (res.webui_version) serverVersion.value = res.webui_version
      clientOutdated.value = !!res.webui_version && res.webui_version !== WEB_UI_VERSION
      if (res.webui_latest) latestVersion.value = res.webui_latest
      updateAvailable.value = !!res.webui_update_available
      if (res.node_version) nodeVersion.value = res.node_version
    } catch {
      connected.value = false
      clientOutdated.value = false
    }
  }

  function applyAvailableModelsResponse(res: AvailableModelsResponse) {
    modelGroups.value = res.groups
    profileModelGroups.value = res.profiles || []
    modelAliases.value = res.model_aliases || {}
    modelVisibility.value = res.model_visibility || {}
    customModels.value = res.custom_models || {}
    if (res.model_fallback) modelFallback.value = res.model_fallback

    const activeProfileName = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || ''
    const activeProfileModels = activeProfileName
      ? profileModelGroups.value.find(entry => entry.profile === activeProfileName)
      : undefined
    const defaultSource = activeProfileModels || res
    const defaultGroups = defaultSource.groups || []
    const defaultModel = defaultSource.default || ''
    const defaultProvider = defaultSource.default_provider || ''
    const explicitGroup = defaultGroups.find(g => g.provider === defaultProvider && g.models.includes(defaultModel))
    const inferredGroup = defaultGroups.find(g => g.models.includes(defaultModel))
    const fallbackGroup = defaultGroups.find(g => g.models.length > 0)

    const providerGroup = defaultProvider ? defaultGroups.find(g => g.provider === defaultProvider) : undefined
    const allProvider = defaultProvider ? res.allProviders.find(g => g.provider === defaultProvider) : undefined
    const providerCatalog = providerGroup?.available_models?.length
      ? providerGroup.available_models
      : allProvider?.available_models?.length
        ? allProvider.available_models
        : allProvider?.models || []
    const visibilityRule = defaultProvider ? modelVisibility.value[defaultProvider] : undefined
    const hiddenByVisibility = !!(
      defaultModel &&
      visibilityRule?.mode === 'include' &&
      !visibilityRule.models.includes(defaultModel) &&
      (providerCatalog.length === 0 || providerCatalog.includes(defaultModel))
    )
    const unlistedDefault = !!(
      defaultModel &&
      defaultProvider &&
      providerGroup &&
      !providerGroup.models.includes(defaultModel) &&
      !hiddenByVisibility
    )

    if (explicitGroup || inferredGroup) {
      const selectedGroup = explicitGroup || inferredGroup!
      selectedModel.value = defaultModel
      selectedProvider.value = selectedGroup.provider
    } else if (unlistedDefault) {
      selectedModel.value = defaultModel
      selectedProvider.value = defaultProvider
      customModels.value = {
        ...customModels.value,
        [defaultProvider]: Array.from(new Set([...(customModels.value[defaultProvider] || []), defaultModel])),
      }
    } else if (fallbackGroup) {
      selectedModel.value = fallbackGroup.models[0]
      selectedProvider.value = fallbackGroup.provider
    } else {
      selectedModel.value = ''
      selectedProvider.value = ''
    }
  }

  async function loadModels(force = false) {
    if (!hasApiKey()) return
    if (!force && modelsLoadPromise) return modelsLoadPromise
    if (!force && modelsLastRequestedAt > 0 && Date.now() - modelsLastRequestedAt < MODELS_CACHE_TTL_MS) return
    modelsLastRequestedAt = Date.now()
    modelsLoadPromise = (async () => {
      try {
        const res = await fetchAvailableModels()
        applyAvailableModelsResponse(res)
      } catch {
        // ignore
      } finally {
        modelsLoadPromise = null
      }
    })()
    return modelsLoadPromise
  }

  async function waitForModelsForRun(timeoutMs = 15000) {
    if (!hasApiKey()) return
    const pending = modelsLoadPromise || (modelsLastRequestedAt === 0 ? loadModels() : null)
    if (!pending) return
    await Promise.race([
      pending,
      new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
    ])
  }

  async function reloadModels() {
    return loadModels(true)
  }

  async function loadModelFallback() {
    const res = await fetchModelFallback()
    modelFallback.value = res.model_fallback || { enabled: false, rules: [] }
    modelFallbackWarnings.value = res.warnings || []
    return res
  }

  async function setModelFallback(config: ModelFallbackConfig) {
    const res = await saveModelFallback(config)
    modelFallback.value = res.model_fallback || { enabled: false, rules: [] }
    modelFallbackWarnings.value = res.warnings || []
    await reloadModels()
    return res
  }

  function fallbackRuleMatches(rule: ModelFallbackRule, target: ModelFallbackTarget, profile?: string): boolean {
    if (rule.enabled === false) return false
    if (rule.provider !== target.provider || rule.model !== target.model) return false
    return !rule.profile || !profile || rule.profile === profile
  }

  function getFallbackChain(provider: string, model: string, profile?: string): ModelFallbackTarget[] {
    if (!modelFallback.value.enabled) return []
    const target = { provider, model }
    const rules = modelFallback.value.rules || []
    const exactProfile = profile
      ? rules.find(rule => rule.profile === profile && fallbackRuleMatches(rule, target, profile))
      : undefined
    const rule = exactProfile || rules.find(candidate => !candidate.profile && fallbackRuleMatches(candidate, target, profile))
    return rule?.fallbacks || []
  }

  function getModelAlias(modelId: string, provider?: string): string {
    if (provider) return modelAliases.value[provider]?.[modelId] || ''
    for (const aliases of Object.values(modelAliases.value)) {
      if (aliases[modelId]) return aliases[modelId]
    }
    return ''
  }

  function displayModelName(modelId: string, provider?: string): string {
    return getModelAlias(modelId, provider) || modelId
  }

  function removeModelFromGroupList(groups: AvailableModelGroup[], provider: string, modelId: string): AvailableModelGroup[] {
    return groups.map(group => {
      if (group.provider !== provider) return group
      return {
        ...group,
        models: group.models.filter(model => model !== modelId),
        available_models: group.available_models?.filter(model => model !== modelId),
      }
    })
  }

  function removeModelFromLoadedGroups(provider: string, modelId: string) {
    modelGroups.value = removeModelFromGroupList(modelGroups.value, provider, modelId)
    profileModelGroups.value = profileModelGroups.value.map(profileEntry => ({
      ...profileEntry,
      groups: removeModelFromGroupList(profileEntry.groups, provider, modelId),
    }))
  }

  async function setModelAlias(modelId: string, provider: string, alias: string) {
    const cleanAlias = alias.trim()
    await updateModelAlias({ provider, model: modelId, alias: cleanAlias })
    const next = { ...modelAliases.value }
    const providerAliases = { ...(next[provider] || {}) }
    if (cleanAlias) {
      providerAliases[modelId] = cleanAlias
      next[provider] = providerAliases
    } else {
      delete providerAliases[modelId]
      if (Object.keys(providerAliases).length > 0) next[provider] = providerAliases
      else delete next[provider]
    }
    modelAliases.value = next
  }

  async function switchModel(modelId: string, providerOverride?: string) {
    try {
      // Find the group containing this model to get provider info
      const group = modelGroups.value.find(g => g.models.includes(modelId))
      const provider = providerOverride || group?.provider || ''
      await updateDefaultModel({ default: modelId, provider })
      selectedModel.value = modelId
      selectedProvider.value = provider || ''
      // Track as custom if not already in the server-fetched list
      if (provider && !modelGroups.value.find(g => g.provider === provider)?.models.includes(modelId)) {
        const res = await persistCustomModel({ provider, model: modelId })
        customModels.value = res.custom_models || {}
      }
    } catch (err: any) {
      console.error('Failed to switch model:', err)
    }
  }

  async function removeCustomModel(modelId: string, provider: string) {
    const providerModels = customModels.value[provider] || []
    if (!providerModels.includes(modelId)) return

    const nextCustomModels = { ...customModels.value }
    const remaining = providerModels.filter(m => m !== modelId)
    if (remaining.length > 0) nextCustomModels[provider] = remaining
    else delete nextCustomModels[provider]
    try {
      const res = await deletePersistedCustomModel({ provider, model: modelId })
      customModels.value = res.custom_models || nextCustomModels
    } catch (err) {
      console.error('Failed to remove custom model:', err)
      customModels.value = nextCustomModels
    }
    removeModelFromLoadedGroups(provider, modelId)

    if (selectedModel.value === modelId && selectedProvider.value === provider) {
      const providerGroup = modelGroups.value.find(g => g.provider === provider && g.models.length > 0)
      const fallbackGroup = providerGroup || modelGroups.value.find(g => g.models.length > 0)
      if (fallbackGroup) {
        await switchModel(fallbackGroup.models[0], fallbackGroup.provider)
      } else {
        selectedModel.value = ''
        selectedProvider.value = ''
      }
    }
  }

  function getProviderVisibility(provider: string): ModelVisibilityRule {
    return modelVisibility.value[provider] || { mode: 'all', models: [] }
  }

  function isModelVisible(provider: string, model: string): boolean {
    const rule = getProviderVisibility(provider)
    return rule.mode !== 'include' || rule.models.includes(model)
  }

  async function setModelVisibility(provider: string, rule: ModelVisibilityRule) {
    const res = await updateModelVisibility({ provider, mode: rule.mode, models: rule.models })
    modelVisibility.value = res.model_visibility || {}
    await reloadModels()
  }

  function startHealthPolling(interval = 30000) {
    stopHealthPolling()
    checkConnection()
    healthPollTimer.value = setInterval(checkConnection, interval)
  }

  function stopHealthPolling() {
    if (healthPollTimer.value) {
      clearInterval(healthPollTimer.value)
      healthPollTimer.value = undefined
    }
  }

  function reloadClient() {
    const url = new URL(window.location.href)
    url.searchParams.set('__hwui_reload', Date.now().toString())
    window.location.replace(url.toString())
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  function toggleSidebarCollapsed() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value ? '1' : '0')
    } catch {
      // ignore quota errors — fallback to in-memory only
    }
  }

  return {
    sidebarOpen,
    sidebarCollapsed,
    toggleSidebar,
    closeSidebar,
    toggleSidebarCollapsed,
    connected,
    serverVersion,
    latestVersion,
    nodeVersion,
    updateAvailable,
    clientOutdated,
    updating,
    doUpdate,
    reloadClient,
    modelGroups,
    profileModelGroups,
    customModels,
    modelAliases,
    modelVisibility,
    modelFallback,
    modelFallbackWarnings,
    selectedModel,
    selectedProvider,
    streamEnabled,
    sessionPersistence,
    maxTokens,
    checkConnection,
    loadModels,
    waitForModelsForRun,
    reloadModels,
    loadModelFallback,
    setModelFallback,
    getFallbackChain,
    applyAvailableModelsResponse,
    switchModel,
    removeCustomModel,
    getModelAlias,
    displayModelName,
    setModelAlias,
    getProviderVisibility,
    isModelVisible,
    setModelVisibility,
    startHealthPolling,
    stopHealthPolling,
  }
})
