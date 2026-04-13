<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, NSelect, useMessage } from 'naive-ui'
import { useModelsStore } from '@/stores/models'
import { PROVIDER_PRESETS } from '@/shared/providers'

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

const PRESET_PROVIDERS = PROVIDER_PRESETS

function autoGenerateName(url: string): string {
  const clean = url.replace(/^https?:\/\//, '').replace(/\/v1\/?$/, '')
  const host = clean.split('/')[0]
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `Local (${host})`
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
      modelOptions.value = preset.models.map(m => ({ label: m, value: m }))
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
    message.warning('Please enter Base URL first')
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
    if (!Array.isArray(data.data)) throw new Error('Unexpected response format')

    modelOptions.value = data.data.map(m => ({ label: m.id, value: m.id }))
    if (modelOptions.value.length > 0 && !formData.value.model) {
      formData.value.model = modelOptions.value[0].value
    }
    message.success(`Found ${modelOptions.value.length} models`)
  } catch (e: any) {
    message.error('Failed to fetch models: ' + e.message)
  } finally {
    fetchingModels.value = false
  }
}

async function handleSave() {
  if (providerType.value === 'preset' && !selectedPreset.value) {
    message.warning('Please select a provider')
    return
  }
  if (!formData.value.base_url.trim()) {
    message.warning('Base URL is required')
    return
  }
  if (!formData.value.api_key.trim()) {
    message.warning('API Key is required')
    return
  }
  if (!formData.value.model) {
    message.warning('Default Model is required')
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
    message.success('Provider added')
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
    title="Add Provider"
    :style="{ width: '520px' }"
    :mask-closable="!loading"
    @after-leave="emit('close')"
  >
    <NForm label-placement="top">
      <NFormItem label="Provider Type">
        <div style="display: flex; gap: 12px">
          <NButton
            :type="providerType === 'preset' ? 'primary' : 'default'"
            size="small"
            @click="providerType = 'preset'"
          >
            Preset
          </NButton>
          <NButton
            :type="providerType === 'custom' ? 'primary' : 'default'"
            size="small"
            @click="providerType = 'custom'"
          >
            Custom
          </NButton>
        </div>
      </NFormItem>

      <NFormItem v-if="providerType === 'preset'" label="Select Provider" required>
        <NSelect
          v-model:value="selectedPreset"
          :options="PRESET_PROVIDERS"
          placeholder="Choose a provider..."
          filterable
        />
      </NFormItem>

      <NFormItem v-if="providerType === 'custom'" label="Name">
        <NInput
          v-model:value="formData.name"
          placeholder="Auto-generated from Base URL"
          disabled
        />
      </NFormItem>

      <NFormItem label="Base URL" required>
        <NInput
          v-model:value="formData.base_url"
          placeholder="e.g. https://api.example.com/v1"
          :disabled="providerType === 'preset'"
        />
      </NFormItem>

      <NFormItem label="API Key" required>
        <NInput
          v-model:value="formData.api_key"
          type="password"
          show-password-on="click"
          placeholder="sk-..."
        />
      </NFormItem>

      <NFormItem label="Default Model" required>
        <div style="display: flex; gap: 8px; width: 100%">
          <NSelect
            v-model:value="formData.model"
            :options="modelOptions"
            filterable
            placeholder="Select a model..."
            style="flex: 1"
          />
          <NButton
            v-if="providerType === 'custom' || (providerType === 'preset' && modelOptions.length === 0)"
            :loading="fetchingModels"
            @click="fetchModels"
          >
            Fetch
          </NButton>
        </div>
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="modal-footer">
        <NButton @click="handleClose">Cancel</NButton>
        <NButton type="primary" :loading="loading" @click="handleSave">
          Add
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
