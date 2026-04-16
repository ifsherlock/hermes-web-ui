<script setup lang="ts">
import { onMounted } from 'vue'
import { NTabs, NTabPane, NSpin, NSwitch, NInput, NInputNumber, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/hermes/settings'
import DisplaySettings from '@/components/hermes/settings/DisplaySettings.vue'
import AgentSettings from '@/components/hermes/settings/AgentSettings.vue'
import MemorySettings from '@/components/hermes/settings/MemorySettings.vue'
import SessionSettings from '@/components/hermes/settings/SessionSettings.vue'
import PrivacySettings from '@/components/hermes/settings/PrivacySettings.vue'
import SettingRow from '@/components/hermes/settings/SettingRow.vue'

const settingsStore = useSettingsStore()
const message = useMessage()
const { t } = useI18n()

onMounted(() => {
  settingsStore.fetchSettings()
})

async function saveApiServer(values: Record<string, any>) {
  try {
    await settingsStore.saveSection('platforms', { api_server: values })
    message.success(t('settings.saved'))
  } catch (err: any) {
    message.error(t('settings.saveFailed'))
  }
}
</script>

<template>
  <div class="settings-view">
    <header class="page-header">
      <h2 class="header-title">{{ t('settings.title') }}</h2>
    </header>

    <div class="settings-content">
      <NSpin :show="settingsStore.loading || settingsStore.saving" size="large" :description="t('common.loading')">
        <NTabs type="line" animated>
          <NTabPane name="display" :tab="t('settings.tabs.display')">
            <DisplaySettings />
          </NTabPane>
          <NTabPane name="agent" :tab="t('settings.tabs.agent')">
            <AgentSettings />
          </NTabPane>
          <NTabPane name="memory" :tab="t('settings.tabs.memory')">
            <MemorySettings />
          </NTabPane>
          <NTabPane name="session" :tab="t('settings.tabs.session')">
            <SessionSettings />
          </NTabPane>
          <NTabPane name="privacy" :tab="t('settings.tabs.privacy')">
            <PrivacySettings />
          </NTabPane>
          <NTabPane name="api_server" :tab="t('settings.tabs.apiServer')">
            <section class="settings-section">
              <SettingRow :label="t('settings.apiServer.enable')" :hint="t('settings.apiServer.enableHint')">
                <NSwitch
                  :value="settingsStore.platforms?.api_server?.enabled"
                  @update:value="v => saveApiServer({ enabled: v })"
                />
              </SettingRow>
              <SettingRow :label="t('settings.apiServer.host')" :hint="t('settings.apiServer.hostHint')">
                <NInput
                  :value="settingsStore.platforms?.api_server?.host || ''"
                  size="small" class="input-md"
                  @update:value="v => saveApiServer({ host: v })"
                />
              </SettingRow>
              <SettingRow :label="t('settings.apiServer.port')" :hint="t('settings.apiServer.portHint')">
                <NInputNumber
                  :value="settingsStore.platforms?.api_server?.port"
                  :min="1024" :max="65535"
                  size="small" class="input-sm"
                  @update:value="v => v != null && saveApiServer({ port: v })"
                />
              </SettingRow>
              <SettingRow :label="t('settings.apiServer.key')" :hint="t('settings.apiServer.keyHint')">
                <NInput
                  :value="settingsStore.platforms?.api_server?.key || ''"
                  type="password" show-password-on="click"
                  size="small" class="input-md"
                  @update:value="v => saveApiServer({ key: v })"
                />
              </SettingRow>
              <SettingRow :label="t('settings.apiServer.cors')" :hint="t('settings.apiServer.corsHint')">
                <NInput
                  :value="settingsStore.platforms?.api_server?.cors_origins || ''"
                  size="small" class="input-md"
                  @update:value="v => saveApiServer({ cors_origins: v })"
                />
              </SettingRow>
            </section>
          </NTabPane>
        </NTabs>
      </NSpin>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.settings-view {
  height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
