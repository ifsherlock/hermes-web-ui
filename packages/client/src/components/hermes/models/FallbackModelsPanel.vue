<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NAlert, NButton, NCheckbox, NCheckboxGroup, NInput, NSelect, NSwitch, useMessage } from 'naive-ui'
import { useAppStore } from '@/stores/hermes/app'
import { useModelsStore } from '@/stores/hermes/models'
import { useProfilesStore } from '@/stores/hermes/profiles'
import type { ModelFallbackConfig, ModelFallbackReason, ModelFallbackRule, ModelFallbackTarget } from '@/api/hermes/system'
import { useI18n } from 'vue-i18n'

type FallbackScope = NonNullable<ModelFallbackRule['scope']>

const { t } = useI18n()
const appStore = useAppStore()
const modelsStore = useModelsStore()
const profilesStore = useProfilesStore()
const message = useMessage()

const saving = ref(false)
const loading = ref(false)
const search = ref('')
const draft = ref<ModelFallbackConfig>({
  enabled: false,
  fallbacks: [],
  retry_on: ['run_failed', 'empty_output'],
  rules: [],
})

const retryOptions: Array<{ label: string; value: ModelFallbackReason }> = [
  { label: t('models.fallbackRetryRunFailed'), value: 'run_failed' },
  { label: t('models.fallbackRetryEmptyOutput'), value: 'empty_output' },
]

const scopeOptions = computed(() => [
  { label: t('models.fallbackScopeModel'), value: 'model' },
  { label: t('models.fallbackScopeProvider'), value: 'provider' },
  { label: t('models.fallbackScopeProfile'), value: 'profile' },
])

const profileOptions = computed(() => [
  { label: t('models.fallbackAllProfiles'), value: '' },
  ...profilesStore.profiles.map(profile => ({ label: profile.name, value: profile.name })),
])

const profileOnlyOptions = computed(() => {
  const profiles = profilesStore.profiles.map(profile => ({ label: profile.name, value: profile.name }))
  return profiles.length > 0 ? profiles : [{ label: 'default', value: 'default' }]
})

const providerOptions = computed(() =>
  modelsStore.providers.map(provider => ({ label: provider.label, value: provider.provider })),
)

const filteredRules = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rules = draft.value.rules || []
  if (!q) return rules
  return rules.filter(rule => [
    fallbackScope(rule),
    rule.profile,
    rule.provider,
    rule.model,
    ...rule.fallbacks.flatMap(target => [target.provider, target.model]),
  ].some(value => String(value || '').toLowerCase().includes(q)))
})

function cloneTargets(targets: ModelFallbackTarget[] | undefined): ModelFallbackTarget[] {
  return (targets || []).map(target => ({ ...target }))
}

function cloneConfig(config: ModelFallbackConfig): ModelFallbackConfig {
  return {
    enabled: config.enabled === true,
    fallbacks: cloneTargets(config.fallbacks),
    retry_on: [...(config.retry_on || ['run_failed', 'empty_output'])],
    rules: (config.rules || []).map(rule => ({
      ...rule,
      scope: fallbackScope(rule),
      fallbacks: cloneTargets(rule.fallbacks),
      retry_on: [...(rule.retry_on || ['run_failed', 'empty_output'])],
    })),
  }
}

function providerModels(provider?: string): string[] {
  return modelsStore.providers.find(item => item.provider === provider)?.models || []
}

function modelOptions(provider?: string) {
  return providerModels(provider).map(model => ({
    label: appStore.displayModelName(model, provider),
    value: model,
  }))
}

function fallbackScope(rule: ModelFallbackRule): FallbackScope {
  if (rule.scope === 'model' || rule.scope === 'provider' || rule.scope === 'profile') return rule.scope
  if (rule.provider && rule.model) return 'model'
  if (rule.provider) return 'provider'
  return 'profile'
}

function targetExists(target: ModelFallbackTarget): boolean {
  return modelsStore.providers.some(item =>
    item.provider === target.provider && item.models.includes(target.model),
  )
}

function targetExcluded(target: ModelFallbackTarget, exclude: ModelFallbackTarget[]): boolean {
  return exclude.some(item => item.provider === target.provider && item.model === target.model)
}

function firstTarget(exclude: ModelFallbackTarget[] = []): ModelFallbackTarget {
  const candidates = [
    {
      provider: appStore.selectedProvider,
      model: appStore.selectedModel,
    },
    {
      provider: modelsStore.defaultProvider,
      model: modelsStore.defaultModel,
    },
  ]

  const seen = new Set<string>()
  for (const candidate of candidates) {
    const key = `${candidate.provider}:${candidate.model}`
    if (seen.has(key)) continue
    seen.add(key)
    if (candidate.provider && candidate.model && targetExists(candidate) && !targetExcluded(candidate, exclude)) {
      return candidate
    }
  }

  const provider = modelsStore.providers.find(item => item.models.length > 0)
  const fallbackProvider = modelsStore.providers.find(item =>
    item.models.some(model => !targetExcluded({ provider: item.provider, model }, exclude)),
  ) || provider
  const model = fallbackProvider?.models.find(item =>
    !targetExcluded({ provider: fallbackProvider.provider, model: item }, exclude),
  ) || fallbackProvider?.models[0] || ''
  return {
    provider: fallbackProvider?.provider || '',
    model,
  }
}

function activeProfileName() {
  return profilesStore.activeProfileName || profilesStore.profiles[0]?.name || 'default'
}

function primaryTarget(rule: ModelFallbackRule): ModelFallbackTarget | null {
  return fallbackScope(rule) === 'model' && rule.provider && rule.model
    ? { provider: rule.provider, model: rule.model }
    : null
}

function ensureRuleDefaults(rule: ModelFallbackRule) {
  rule.scope = fallbackScope(rule)
  if (rule.scope === 'profile') {
    rule.profile = rule.profile || activeProfileName()
    rule.provider = undefined
    rule.model = undefined
  } else {
    if (!rule.provider) rule.provider = firstTarget().provider
    if (rule.scope === 'model') {
      rule.model = rule.model || providerModels(rule.provider)[0] || ''
    } else {
      rule.model = undefined
    }
  }
  if (!rule.retry_on?.length) rule.retry_on = ['run_failed', 'empty_output']
}

function ensureConfigDefaults(config: ModelFallbackConfig) {
  config.fallbacks = cloneTargets(config.fallbacks)
  if (!config.retry_on?.length) config.retry_on = ['run_failed', 'empty_output']
  config.rules = (config.rules || []).map(rule => {
    const next = { ...rule, fallbacks: cloneTargets(rule.fallbacks), retry_on: [...(rule.retry_on || [])] }
    ensureRuleDefaults(next)
    return next
  })
}

function addDefaultFallback() {
  const target = firstTarget(draft.value.fallbacks || [])
  if (!target.provider || !target.model) return
  draft.value.fallbacks = [...(draft.value.fallbacks || []), target]
}

function addRule() {
  const target = firstTarget()
  const fallback = firstTarget([target])
  draft.value.rules = [
    ...(draft.value.rules || []),
    {
      id: `rule_${Date.now().toString(36)}`,
      enabled: true,
      scope: 'model',
      profile: '',
      provider: target.provider,
      model: target.model,
      fallbacks: fallback.model ? [fallback] : [],
      retry_on: ['run_failed', 'empty_output'],
    },
  ]
}

function removeRule(rule: ModelFallbackRule) {
  draft.value.rules = (draft.value.rules || []).filter(item => item.id !== rule.id)
}

function addFallback(rule: ModelFallbackRule) {
  const exclude = [...rule.fallbacks]
  const primary = primaryTarget(rule)
  if (primary) exclude.push(primary)
  const target = firstTarget(exclude)
  if (!target.provider || !target.model) return
  rule.fallbacks.push(target)
}

function removeTarget(targets: ModelFallbackTarget[], index: number) {
  targets.splice(index, 1)
}

function moveTarget(targets: ModelFallbackTarget[], index: number, direction: -1 | 1) {
  const next = index + direction
  if (next < 0 || next >= targets.length) return
  const [item] = targets.splice(index, 1)
  targets.splice(next, 0, item)
}

function setRuleScope(rule: ModelFallbackRule, scope: FallbackScope) {
  rule.scope = scope
  if (scope === 'profile') {
    rule.profile = rule.profile || activeProfileName()
    rule.provider = undefined
    rule.model = undefined
    return
  }

  const target = firstTarget()
  rule.provider = rule.provider || target.provider
  if (scope === 'model') {
    rule.model = rule.model || target.model || providerModels(rule.provider)[0] || ''
  } else {
    rule.model = undefined
  }
}

function onRuleProviderChange(rule: ModelFallbackRule, provider: string) {
  rule.provider = provider
  rule.model = fallbackScope(rule) === 'model' ? providerModels(provider)[0] || '' : undefined
}

function onFallbackProviderChange(target: ModelFallbackTarget, provider: string) {
  target.provider = provider
  target.model = providerModels(provider)[0] || ''
}

function warningText(ruleId: string): string {
  return appStore.modelFallbackWarnings
    .filter(warning => warning.rule_id === ruleId)
    .map(warning => warning.message)
    .join('；')
}

async function loadConfig() {
  loading.value = true
  try {
    if (profilesStore.profiles.length === 0) await profilesStore.fetchProfiles()
    await Promise.all([
      modelsStore.providers.length === 0 ? modelsStore.fetchProviders() : Promise.resolve(),
      appStore.modelGroups.length === 0 ? appStore.loadModels(true) : Promise.resolve(),
    ])
    const res = await appStore.loadModelFallback()
    draft.value = cloneConfig(res.model_fallback)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const next = cloneConfig(draft.value)
    ensureConfigDefaults(next)
    const res = await appStore.setModelFallback(next)
    draft.value = cloneConfig(res.model_fallback)
    message.success(t('models.fallbackSaved'))
  } catch (e: any) {
    message.error(e?.message || t('models.fallbackSaveFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(loadConfig)
</script>

<template>
  <section class="fallback-panel">
    <div class="fallback-header">
      <div>
        <h3>{{ t('models.fallbackTitle') }}</h3>
        <p>{{ t('models.fallbackSubtitle') }}</p>
      </div>
      <div class="fallback-header-actions">
        <NSwitch v-model:value="draft.enabled" />
        <NButton size="small" type="primary" :loading="saving" @click="save">{{ t('common.save') }}</NButton>
      </div>
    </div>

    <NAlert v-if="appStore.modelFallbackWarnings.length > 0" type="warning" class="fallback-alert">
      {{ t('models.fallbackWarningCount', { count: appStore.modelFallbackWarnings.length }) }}
    </NAlert>

    <div class="fallback-section">
      <div class="section-title-row">
        <div>
          <h4>{{ t('models.fallbackDefaultChain') }}</h4>
          <p>{{ t('models.fallbackDefaultChainHint') }}</p>
        </div>
        <NButton size="tiny" quaternary :disabled="loading" @click="addDefaultFallback">
          {{ t('models.fallbackAddTarget') }}
        </NButton>
      </div>

      <NCheckboxGroup v-model:value="draft.retry_on">
        <div class="retry-options">
          <NCheckbox
            v-for="option in retryOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </NCheckbox>
        </div>
      </NCheckboxGroup>

      <div v-if="(draft.fallbacks || []).length === 0" class="fallback-empty compact">
        {{ t('models.fallbackDefaultEmpty') }}
      </div>
      <div
        v-for="(target, index) in draft.fallbacks"
        :key="`default-${index}`"
        class="fallback-target"
      >
        <span class="target-order">{{ index + 1 }}</span>
        <NSelect
          :value="target.provider"
          :options="providerOptions"
          size="small"
          class="provider-select"
          @update:value="value => onFallbackProviderChange(target, value)"
        />
        <NSelect
          v-model:value="target.model"
          :options="modelOptions(target.provider)"
          size="small"
          filterable
          class="model-select"
        />
        <NButton size="tiny" quaternary :disabled="index === 0" @click="moveTarget(draft.fallbacks || [], index, -1)">{{ t('models.fallbackMoveUp') }}</NButton>
        <NButton size="tiny" quaternary :disabled="index === (draft.fallbacks || []).length - 1" @click="moveTarget(draft.fallbacks || [], index, 1)">{{ t('models.fallbackMoveDown') }}</NButton>
        <NButton size="tiny" quaternary type="error" @click="removeTarget(draft.fallbacks || [], index)">{{ t('models.fallbackRemoveTarget') }}</NButton>
      </div>

      <div v-if="warningText('default')" class="rule-warning">
        {{ warningText('default') }}
      </div>
    </div>

    <div class="fallback-section">
      <div class="section-title-row">
        <div>
          <h4>{{ t('models.fallbackAdvancedRules') }}</h4>
          <p>{{ t('models.fallbackAdvancedHint') }}</p>
        </div>
        <NButton size="small" :disabled="loading" @click="addRule">{{ t('models.fallbackAddRule') }}</NButton>
      </div>

      <NInput
        v-model:value="search"
        size="small"
        clearable
        :placeholder="t('models.fallbackSearchPlaceholder')"
        class="fallback-search"
      />

      <div v-if="filteredRules.length === 0" class="fallback-empty">
        {{ t('models.fallbackEmpty') }}
      </div>

      <div v-for="rule in filteredRules" :key="rule.id" class="fallback-rule">
        <div class="rule-top">
          <NSwitch v-model:value="rule.enabled" />
          <span class="rule-label">{{ t('models.fallbackOverrideRule') }}</span>
          <NSelect
            :value="fallbackScope(rule)"
            :options="scopeOptions"
            size="small"
            class="scope-select"
            @update:value="value => setRuleScope(rule, value)"
          />
          <NSelect
            v-if="fallbackScope(rule) === 'profile'"
            v-model:value="rule.profile"
            :options="profileOnlyOptions"
            size="small"
            class="profile-select"
          />
          <NSelect
            v-else
            v-model:value="rule.profile"
            :options="profileOptions"
            size="small"
            class="profile-select"
          />
          <NSelect
            v-if="fallbackScope(rule) !== 'profile'"
            :value="rule.provider"
            :options="providerOptions"
            size="small"
            class="provider-select"
            @update:value="value => onRuleProviderChange(rule, value)"
          />
          <NSelect
            v-if="fallbackScope(rule) === 'model'"
            v-model:value="rule.model"
            :options="modelOptions(rule.provider)"
            size="small"
            filterable
            class="model-select"
          />
          <NButton size="tiny" quaternary type="error" @click="removeRule(rule)">{{ t('common.delete') }}</NButton>
        </div>

        <NCheckboxGroup v-model:value="rule.retry_on">
          <div class="retry-options">
            <NCheckbox
              v-for="option in retryOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </NCheckbox>
          </div>
        </NCheckboxGroup>

        <div class="fallback-chain">
          <div class="chain-label">{{ t('models.fallbackChain') }}</div>
          <div
            v-for="(target, index) in rule.fallbacks"
            :key="`${rule.id}-${index}`"
            class="fallback-target"
          >
            <span class="target-order">{{ index + 1 }}</span>
            <NSelect
              :value="target.provider"
              :options="providerOptions"
              size="small"
              class="provider-select"
              @update:value="value => onFallbackProviderChange(target, value)"
            />
            <NSelect
              v-model:value="target.model"
              :options="modelOptions(target.provider)"
              size="small"
              filterable
              class="model-select"
            />
            <NButton size="tiny" quaternary :disabled="index === 0" @click="moveTarget(rule.fallbacks, index, -1)">{{ t('models.fallbackMoveUp') }}</NButton>
            <NButton size="tiny" quaternary :disabled="index === rule.fallbacks.length - 1" @click="moveTarget(rule.fallbacks, index, 1)">{{ t('models.fallbackMoveDown') }}</NButton>
            <NButton size="tiny" quaternary type="error" @click="removeTarget(rule.fallbacks, index)">{{ t('models.fallbackRemoveTarget') }}</NButton>
          </div>
          <NButton size="tiny" quaternary @click="addFallback(rule)">{{ t('models.fallbackAddTarget') }}</NButton>
        </div>

        <div v-if="warningText(rule.id)" class="rule-warning">
          {{ warningText(rule.id) }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.fallback-panel {
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: 16px;
  margin-bottom: 18px;
}

.fallback-header,
.fallback-header-actions,
.section-title-row,
.rule-top,
.fallback-target,
.retry-options {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fallback-header,
.section-title-row {
  justify-content: space-between;
}

.fallback-header {
  margin-bottom: 12px;

  h3 {
    margin: 0;
    font-size: 15px;
    color: $text-primary;
  }

  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: $text-muted;
  }
}

.fallback-section {
  border-top: 1px solid $border-color;
  padding-top: 14px;
  margin-top: 14px;
}

.section-title-row {
  margin-bottom: 10px;

  h4 {
    margin: 0;
    color: $text-primary;
    font-size: 14px;
  }

  p {
    margin: 4px 0 0;
    color: $text-muted;
    font-size: 12px;
  }
}

.fallback-search,
.fallback-alert {
  margin-bottom: 12px;
}

.fallback-empty {
  padding: 24px 0;
  color: $text-muted;
  font-size: 13px;
  text-align: center;

  &.compact {
    padding: 12px 0;
    text-align: left;
  }
}

.fallback-rule {
  border-top: 1px solid $border-color;
  padding-top: 12px;
  margin-top: 12px;
}

.rule-top {
  flex-wrap: wrap;
}

.rule-label,
.chain-label {
  flex: 0 0 auto;
  color: $text-muted;
  font-size: 12px;
  font-weight: 600;
}

.scope-select {
  width: 140px;
}

.profile-select {
  width: 150px;
}

.provider-select {
  width: 180px;
}

.model-select {
  flex: 1;
  min-width: 220px;
}

.retry-options {
  margin: 10px 0;
  font-size: 12px;
  color: $text-secondary;
  flex-wrap: wrap;
}

.fallback-chain {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chain-label {
  margin-top: 2px;
}

.fallback-target {
  min-width: 0;
  flex-wrap: wrap;
}

.target-order {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(var(--accent-primary-rgb), 0.12);
  color: $accent-primary;
  font-size: 12px;
  flex: 0 0 auto;
}

.rule-warning {
  margin-top: 8px;
  font-size: 12px;
  color: $warning;
}
</style>
