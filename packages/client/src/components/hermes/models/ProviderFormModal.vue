<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NSelect, useMessage } from 'naive-ui'
import { useModelsStore } from '@/stores/hermes/models'
import { PROVIDER_PRESETS } from '@/shared/providers'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const modelsStore = useModelsStore()
const message = useMessage()

const showModal = ref(true)
const loading = ref(false)
const fetchingModels = ref(false)

const providerType = ref<'preset' | 'custom'>('preset')
const selectedPreset = ref<string | null>(null)
const formData = ref({
  name: '',
  base_url: '',
  api_key: '',
  model: '',
})

const modelOptions = ref<Array<{ label: string; value: string }>>([])

const PRESET_PROVIDERS = PROVIDER_PRESETS as any[]

function autoGenerateName(url: string): string {
  const clean = url.replace(/^https?:\/\//, '').replace(/\/v1\/?$/, '')
  const host = clean.split('/')[0]
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return t('models.local', { host })
  }
  return host.charAt(0).toUpperCase() + host.slice(1)
}

watch(selectedPreset, (val) => {
  formData.value.model = ''
  if (val) {
    const preset = PRESET_PROVIDERS.find(p => p.value === val)
    if (preset) {
      formData.value.name = preset.label
      formData.value.base_url = preset.base_url
      modelOptions.value = preset.models.map((m: string) => ({ label: m, value: m }))
      if (preset.models.length > 0) {
        formData.value.model = preset.models[0]
      }
    }
  }
})

watch(() => formData.value.base_url, (url) => {
  if (providerType.value === 'custom' && url.trim()) {
    formData.value.name = autoGenerateName(url.trim())
  }
})

watch(providerType, () => {
  modelOptions.value = []
  formData.value = { name: '', base_url: '', api_key: '', model: '' }
  selectedPreset.value = null
})

async function fetchModels() {
  const { base_url } = formData.value
  if (!base_url.trim()) {
    message.warning(t('models.enterBaseUrl'))
    return
  }

  fetchingModels.value = true
  try {
    const url = base_url.replace(/\/+$/, '') + '/models'
    const headers: Record<string, string> = {}
    if (formData.value.api_key.trim()) {
      headers['Authorization'] = `Bearer ${formData.value.api_key.trim()}`
    }
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { data?: Array<{ id: string }> }
    if (!Array.isArray(data.data)) throw new Error(t('models.unexpectedFormat'))

    modelOptions.value = data.data.map(m => ({ label: m.id, value: m.id }))
    if (modelOptions.value.length > 0 && !formData.value.model) {
      formData.value.model = modelOptions.value[0].value
    }
    message.success(t('models.foundModels', { count: modelOptions.value.length }))
  } catch (e: any) {
    message.error(t('models.fetchFailed') + ': ' + e.message)
  } finally {
    fetchingModels.value = false
  }
}

async function handleSave() {
  if (providerType.value === 'preset' && !selectedPreset.value) {
    message.warning(t('models.selectProviderRequired'))
    return
  }
  if (!formData.value.base_url.trim()) {
    message.warning(t('models.baseUrlRequired'))
    return
  }
  if (!formData.value.api_key.trim()) {
    message.warning(t('models.apiKeyRequired'))
    return
  }
  if (!formData.value.model) {
    message.warning(t('models.modelRequired'))
    return
  }

  loading.value = true
  try {
    const providerKey = providerType.value === 'preset'
      ? (PRESET_PROVIDERS.find(p => p.value === selectedPreset.value)?.value || null)
      : null

    await modelsStore.addProvider({
      name: formData.value.name.trim(),
      base_url: formData.value.base_url.trim(),
      api_key: formData.value.api_key.trim(),
      model: formData.value.model,
      providerKey,
    })
    message.success(t('models.providerAdded'))
    emit('saved')
  } catch (e: any) {
    message.error(e.message)
  } finally {
    loading.value = false
  }
}

function handleClose() {
  showModal.value = false
  setTimeout(() => emit('close'), 200)
}
</script>

<template>
  <NModal
    v-model:show="showModal"
    preset="card"
    :title="t('models.addProvider')"
    :style="{ width: 'min(520px, calc(100vw - 32px))' }"
    :mask-closable="!loading"
    @after-leave="emit('close')"
  >
    <NForm label-placement="top">
      <NFormItem :label="t('models.providerType')">
        <div style="display: flex; gap: 12px">
          <NButton
            :type="providerType === 'preset' ? 'primary' : 'default'"
            size="small"
            @click="providerType = 'preset'"
          >
            {{ t('models.preset') }}
          </NButton>
          <NButton
            :type="providerType === 'custom' ? 'primary' : 'default'"
            size="small"
            @click="providerType = 'custom'"
          >
            {{ t('models.custom') }}
          </NButton>
        </div>
      </NFormItem>

      <NFormItem v-if="providerType === 'preset'" :label="t('models.selectProvider')" required>
        <NSelect
          v-model:value="selectedPreset"
          :options="PRESET_PROVIDERS"
          :placeholder="t('models.chooseProvider')"
          filterable
        />
      </NFormItem>

      <NFormItem v-if="providerType === 'custom'" :label="t('models.name')">
        <NInput
          v-model:value="formData.name"
          :placeholder="t('models.autoGeneratedName')"
          disabled
        />
      </NFormItem>

      <NFormItem :label="t('models.baseUrl')" required>
        <NInput
          v-model:value="formData.base_url"
          :placeholder="t('models.baseUrlPlaceholder')"
          :disabled="providerType === 'preset'"
        />
      </NFormItem>

      <NFormItem :label="t('models.apiKey')" required>
        <NInput
          v-model:value="formData.api_key"
          type="password"
          show-password-on="click"
          :placeholder="t('models.apiKeyPlaceholder')"
        />
      </NFormItem>

      <NFormItem :label="t('models.defaultModel')" required>
        <div style="display: flex; gap: 8px; width: 100%">
          <NSelect
            v-model:value="formData.model"
            :options="modelOptions"
            filterable
            :placeholder="t('models.selectModel')"
            style="flex: 1"
          />
          <NButton
            v-if="providerType === 'custom' || (providerType === 'preset' && modelOptions.length === 0)"
            :loading="fetchingModels"
            @click="fetchModels"
          >
            {{ t('common.fetch') }}
          </NButton>
        </div>
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="modal-footer">
        <NButton @click="handleClose">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="loading" @click="handleSave">
          {{ t('common.add') }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
