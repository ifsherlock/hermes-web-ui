<script setup lang="ts">
import { onMounted } from 'vue'
import { NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import PlatformSettings from '@/components/settings/PlatformSettings.vue'

const settingsStore = useSettingsStore()
const { t } = useI18n()

onMounted(() => {
  settingsStore.fetchSettings()
})
</script>

<template>
  <div class="channels-view">
    <header class="channels-header">
      <h2 class="header-title">{{ t('sidebar.channels') }}</h2>
    </header>

    <div class="channels-content">
      <NSpin :show="settingsStore.loading">
        <PlatformSettings />
      </NSpin>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.channels-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.channels-header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid $border-color;
  flex-shrink: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
}

.channels-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
