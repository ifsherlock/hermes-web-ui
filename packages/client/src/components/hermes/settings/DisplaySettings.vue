<script setup lang="ts">
import { ref } from 'vue'
import { NSwitch, NSelect, NInput, NButton, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/hermes/settings'
import { useTheme, type BrightnessMode, type ThemeStyle } from '@/composables/useTheme'
import { getServerUrlValue, normalizeServerUrlValue, setServerUrl } from '@/api/client'
import SettingRow from './SettingRow.vue'

const settingsStore = useSettingsStore()
const message = useMessage()
const { t } = useI18n()
const { brightness, style, setBrightness, setStyle } = useTheme()
const serverUrl = ref(getServerUrlValue())

const themeOptions = [
  { label: t('settings.display.themeLight'), value: 'light' },
  { label: t('settings.display.themeDark'), value: 'dark' },
  { label: t('settings.display.themeSystem'), value: 'system' },
]

const styleOptions = [
  { label: '水墨经典', value: 'ink' },
  { label: '漫画风格', value: 'comic' },
  { label: 'PERSON5 怪盗风格', value: 'person5' },
]

async function save(values: Record<string, any>) {
  try {
    await settingsStore.saveSection('display', values)
    message.success(t('settings.saved'))
  } catch (err: any) {
    message.error(t('settings.saveFailed'))
  }
}

function handleThemeChange(val: string) {
  const m = val as BrightnessMode
  setBrightness(m)
  save({ skin: m })
}

function handleStyleChange(val: string) {
  const next = val as ThemeStyle
  setStyle(next)
  save({ style: next })
}

function handleServerUrlSave() {
  const normalized = normalizeServerUrlValue(serverUrl.value)
  setServerUrl(normalized)
  serverUrl.value = normalized
  message.success(normalized ? `服务器地址已设置为 ${normalized}` : '已恢复为当前页面同源服务器')
}

function handleServerUrlReset() {
  serverUrl.value = ''
  setServerUrl('')
  message.success('已恢复为当前页面同源服务器')
}
</script>

<template>
  <section class="settings-section">
    <SettingRow :label="t('settings.display.theme')" :hint="t('settings.display.themeHint')">
      <NSelect :value="brightness" :options="themeOptions" size="small" :consistent-menu-width="false" class="input-sm" @update:value="handleThemeChange" />
    </SettingRow>
    <SettingRow label="界面风格" hint="切换整体视觉风格，可从 PERSON5 怪盗风格切回默认界面。">
      <NSelect :value="style" :options="styleOptions" size="small" :consistent-menu-width="false" class="input-md" @update:value="handleStyleChange" />
    </SettingRow>
    <SettingRow label="服务器地址" hint="Windows exe 或跨设备访问时填写 Web UI 后端地址；留空表示使用当前页面同源服务器。">
      <div class="server-url-control">
        <NInput
          v-model:value="serverUrl"
          size="small"
          clearable
          placeholder="例如 http://10.10.10.189:6060"
          class="input-lg"
          @keyup.enter="handleServerUrlSave"
        />
        <NButton size="small" type="primary" @click="handleServerUrlSave">保存</NButton>
        <NButton size="small" secondary @click="handleServerUrlReset">清空</NButton>
      </div>
    </SettingRow>
    <SettingRow :label="t('settings.display.streaming')" :hint="t('settings.display.streamingHint')">
      <NSwitch :value="settingsStore.display.streaming" @update:value="v => save({ streaming: v })" />
    </SettingRow>
    <SettingRow :label="t('settings.display.compact')" :hint="t('settings.display.compactHint')">
      <NSwitch :value="settingsStore.display.compact" @update:value="v => save({ compact: v })" />
    </SettingRow>
    <SettingRow :label="t('settings.display.showReasoning')" :hint="t('settings.display.showReasoningHint')">
      <NSwitch :value="settingsStore.display.show_reasoning" @update:value="v => save({ show_reasoning: v })" />
    </SettingRow>
    <SettingRow :label="t('settings.display.showCost')" :hint="t('settings.display.showCostHint')">
      <NSwitch :value="settingsStore.display.show_cost" @update:value="v => save({ show_cost: v })" />
    </SettingRow>
    <SettingRow :label="t('settings.display.inlineDiffs')" :hint="t('settings.display.inlineDiffsHint')">
      <NSwitch :value="settingsStore.display.inline_diffs" @update:value="v => save({ inline_diffs: v })" />
    </SettingRow>
    <SettingRow :label="t('settings.display.bellOnComplete')" :hint="t('settings.display.bellOnCompleteHint')">
      <NSwitch :value="settingsStore.display.bell_on_complete" @update:value="v => save({ bell_on_complete: v })" />
    </SettingRow>
    <SettingRow :label="t('settings.display.busyInputMode')" :hint="t('settings.display.busyInputModeHint')">
      <NSwitch :value="settingsStore.display.busy_input_mode === 'interrupt'" @update:value="v => save({ busy_input_mode: v ? 'interrupt' : 'off' })" />
    </SettingRow>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.settings-section {
  margin-top: 16px;
}

.server-url-control {
  display: flex;
  width: min(560px, 100%);
  align-items: center;
  gap: 8px;
}

.server-url-control .input-lg {
  flex: 1 1 auto;
  min-width: 220px;
}

@media (max-width: 720px) {
  .server-url-control {
    align-items: stretch;
    flex-direction: column;
  }

  .server-url-control .input-lg {
    width: 100%;
    min-width: 0;
  }
}
</style>
