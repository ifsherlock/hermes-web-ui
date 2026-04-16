<script setup lang="ts">
import { computed } from 'vue'
import { NSelect } from 'naive-ui'
import { useAppStore } from '@/stores/hermes/app'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const appStore = useAppStore()

const options = computed(() =>
  appStore.modelGroups.map(g => ({
    label: g.label,
    type: 'group' as const,
    key: g.provider,
    children: g.models.map(m => ({
      label: m,
      value: m,
    })),
  })),
)

function handleChange(value: string | number | Array<string | number>) {
  if (typeof value === 'string') {
    appStore.switchModel(value)
  }
}
</script>

<template>
  <div class="model-selector">
    <div class="model-label">{{ t('models.title') }}</div>
    <NSelect
      :value="appStore.selectedModel"
      :options="options"
      size="small"
      @update:value="handleChange"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.model-selector {
  padding: 0 12px;
  margin-bottom: 8px;
}

.model-label {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}
</style>
