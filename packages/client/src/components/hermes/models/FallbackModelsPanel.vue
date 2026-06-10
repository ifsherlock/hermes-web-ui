<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NAlert, NButton, NCheckbox, NCheckboxGroup, NInput, NSelect, NSwitch, useMessage } from 'naive-ui'
import { useAppStore } from '@/stores/hermes/app'
import { useModelsStore } from '@/stores/hermes/models'
import { useProfilesStore } from '@/stores/hermes/profiles'
import type { ModelFallbackConfig, ModelFallbackRule, ModelFallbackTarget } from '@/api/hermes/system'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const appStore = useAppStore()
const modelsStore = useModelsStore()
const profilesStore = useProfilesStore()
const message = useMessage()

const saving = ref(false)
const search = ref('')
const draft = ref<ModelFallbackConfig>({ enabled: false, rules: [] })

const retryOptions = [
  { label: t('models.fallbackRetryRunFailed'), value: 'run_failed' },
  { label: t('models.fallbackRetryEmptyOutput'), value: 'empty_output' },
]

const profileOptions = computed(() => [
  { label: t('models.fallbackAllProfiles'), value: '' },
  ...profilesStore.profiles.map(profile => ({ label: profile.name, value: profile.name })),
])

const providerOptions = computed(() =>
  modelsStore.providers.map(provider => ({ label: provider.label, value: provider.provider })),
)

const filteredRules = computed(() => {
  const q = search.value.trim().toLowerCase()
  const rules = draft.value.rules || []
  if (!q) return rules
  return rules.filter(rule => [
    rule.profile,
    rule.provider,
    rule.model,
    ...rule.fallbacks.flatMap(target => [target.provider, target.model]),
  ].some(value => String(value || '').toLowerCase().includes(q)))
})

function cloneConfig(config: ModelFallbackConfig): ModelFallbackConfig {
  return {
    enabled: config.enabled === true,
    rules: (config.rules || []).map(rule => ({
      ...rule,
      fallbacks: rule.fallbacks.map(target => ({ ...target })),
      retry_on: [...(rule.retry_on || ['run_failed', 'empty_output'])],
    })),
  }
}

function providerModels(provider: string): string[] {
  return modelsStore.providers.find(item => item.provider === provider)?.models || []
}

function modelOptions(provider: string) {
  return providerModels(provider).map(model => ({
    label: appStore.displayModelName(model, provider),
    value: model,
  }))
}

function firstTarget(exclude: ModelFallbackTarget[] = []): ModelFallbackTarget {
  const selected = {
    provider: appStore.selectedProvider,
    model: appStore.selectedModel,
  }
  const selectedExists = modelsStore.providers.some(item =>
    item.provider === selected.provider && item.models.includes(selected.model),
  )
  if (selectedExists && !exclude.some(item => item.provider === selected.provider && item.model === selected.model)) {
    return selected
  }
  const provider = modelsStore.providers.find(item => item.models.length > 0)
  const fallbackProvider = modelsStore.providers.find(item =>
    item.models.some(model => !exclude.some(target => target.provider === item.provider && target.model === model)),
  ) || provider
  const model = fallbackProvider?.models.find(item =>
    !exclude.some(target => target.provider === fallbackProvider.provider && target.model === item),
  ) || fallbackProvider?.models[0] || ''
  return {
    provider: fallbackProvider?.provider || '',
    model,
  }
}

function ensureRuleDefaults(rule: ModelFallbackRule) {
  if (!rule.provider) {
    const target = firstTarget()
    rule.provider = target.provider
    rule.model = target.model
  }
  if (!rule.model) rule.model = providerModels(rule.provider)[0] || ''
  if (!rule.retry_on?.length) rule.retry_on = ['run_failed', 'empty_output']
}

function addRule() {
  const target = firstTarget()
  const fallbackProvider = modelsStore.providers.find(item =>
    item.provider !== target.provider && item.models.length > 0,
  ) || modelsStore.providers.find(item => item.models.some(model => model !== target.model))
  const fallback = {
    provider: fallbackProvider?.provider || target.provider,
    model: fallbackProvider?.models.find(model => model !== target.model) || fallbackProvider?.models[0] || '',
  }
  draft.value.rules = [
    ...(draft.value.rules || []),
    {
      id: `rule_${Date.now().toString(36)}`,
      enabled: true,
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
  const target = firstTarget([{ provider: rule.provider, model: rule.model }, ...rule.fallbacks])
  rule.fallbacks.push(target)
}

function removeFallback(rule: ModelFallbackRule, index: number) {
  rule.fallbacks.splice(index, 1)
}

function moveFallback(rule: ModelFallbackRule, index: number, direction: -1 | 1) {
  const next = index + direction
  if (next < 0 || next >= rule.fallbacks.length) return
  const [item] = rule.fallbacks.splice(index, 1)
  rule.fallbacks.splice(next, 0, item)
}

function onRuleProviderChange(rule: ModelFallbackRule, provider: string) {
  rule.provider = provider
  rule.model = providerModels(provider)[0] || ''
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
  if (profilesStore.profiles.length === 0) await profilesStore.fetchProfiles()
  const res = await appStore.loadModelFallback()
  draft.value = cloneConfig(res.model_fallback)
}

async function save() {
  saving.value = true
  try {
    const next = cloneConfig(draft.value)
    next.rules?.forEach(ensureRuleDefaults)
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
        <NButton size="small" @click="addRule">{{ t('models.fallbackAddRule') }}</NButton>
        <NButton size="small" type="primary" :loading="saving" @click="save">{{ t('common.save') }}</NButton>
      </div>
    </div>

    <NInput
      v-model:value="search"
      size="small"
      clearable
      :placeholder="t('models.fallbackSearchPlaceholder')"
      class="fallback-search"
    />

    <NAlert v-if="appStore.modelFallbackWarnings.length > 0" type="warning" class="fallback-alert">
      {{ t('models.fallbackWarningCount', { count: appStore.modelFallbackWarnings.length }) }}
    </NAlert>

    <div v-if="filteredRules.length === 0" class="fallback-empty">
      {{ t('models.fallbackEmpty') }}
    </div>

    <div v-for="rule in filteredRules" :key="rule.id" class="fallback-rule">
      <div class="rule-top">
        <NSwitch v-model:value="rule.enabled" />
        <span class="rule-label">{{ t('models.fallbackPrimaryModel') }}</span>
        <NSelect
          v-model:value="rule.profile"
          :options="profileOptions"
          size="small"
          class="profile-select"
        />
        <NSelect
          :value="rule.provider"
          :options="providerOptions"
          size="small"
          class="provider-select"
          @update:value="value => onRuleProviderChange(rule, value)"
        />
        <NSelect
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
          <NButton size="tiny" quaternary :disabled="index === 0" @click="moveFallback(rule, index, -1)">{{ t('models.fallbackMoveUp') }}</NButton>
          <NButton size="tiny" quaternary :disabled="index === rule.fallbacks.length - 1" @click="moveFallback(rule, index, 1)">{{ t('models.fallbackMoveDown') }}</NButton>
          <NButton size="tiny" quaternary type="error" @click="removeFallback(rule, index)">{{ t('models.fallbackRemoveTarget') }}</NButton>
        </div>
        <NButton size="tiny" quaternary @click="addFallback(rule)">{{ t('models.fallbackAddTarget') }}</NButton>
      </div>

      <div v-if="warningText(rule.id)" class="rule-warning">
        {{ warningText(rule.id) }}
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
.rule-top,
.fallback-target,
.retry-options {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fallback-header {
  justify-content: space-between;
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

.fallback-search,
.fallback-alert {
  margin-bottom: 12px;
}

.fallback-empty {
  padding: 24px 0;
  color: $text-muted;
  font-size: 13px;
  text-align: center;
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
